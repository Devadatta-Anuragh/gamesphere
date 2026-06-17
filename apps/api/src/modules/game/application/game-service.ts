import {
  DomainEventType,
  asMatchId,
  asRoomId,
  asUserId,
} from '@gamesphere/shared';
import { err, ok, type Result } from '@/shared/result.js';
import { AppError } from '@/shared/errors.js';
import type { Clock } from '@/shared/clock.js';
import type { Logger } from '@/shared/logger.js';
import type { EventPublisher } from '@/modules/events/domain/event-bus.js';
import {
  applyMove,
  applyRoll,
  legalMoves,
  type LegalMove,
} from '../domain/ludo/engine.js';
import { TurnPhase, createInitialState, type Seat } from '../domain/ludo/state.js';
import {
  opponentSeat,
  seatOfUser,
  userOfSeat,
  usernameOfSeat,
  type GameSession,
  type SessionSeat,
} from '../domain/game-session.js';
import type { GameGateway } from '../domain/game-gateway.js';
import type { TimerScheduler } from '../domain/timer-scheduler.js';
import { legalMovesFor, toStateView } from '../interface/state-view.js';
import type {
  ActivePlayersReleaser,
  DiceRollerFactory,
  MatchGateway,
  SettlementService,
  UserDirectory,
} from './ports.js';

export interface GameServiceOptions {
  readonly turnTimeoutMs: number;
  readonly disconnectGraceMs: number;
  readonly maxMissedTurns: number;
}

/** Greedy auto-move used when a player times out (finish > capture > furthest). */
const pickAutoMove = (moves: readonly LegalMove[]): LegalMove =>
  [...moves].sort((a, b) => {
    if (a.finishes !== b.finishes) return a.finishes ? -1 : 1;
    if (a.captures.length !== b.captures.length)
      return b.captures.length - a.captures.length;
    return b.to - a.to;
  })[0]!;

/**
 * The authoritative real-time game loop. The server owns the dice and the state;
 * clients only send intents (`roll`, `move`) which are validated against the
 * current turn/phase and the engine's legal moves. Turn timeouts and disconnect
 * grace are enforced here so a stalling or vanished player cannot freeze a
 * real-money match — they auto-play and ultimately forfeit, triggering an
 * idempotent settlement.
 */
export class GameService {
  private readonly sessions = new Map<string, GameSession>();
  // Dedupes concurrent first-joins so two sockets arriving at once cannot each
  // build a separate session (which would deadlock the "both connected" check).
  private readonly loading = new Map<string, Promise<GameSession | null>>();
  private readonly userMatch = new Map<string, string>();

  constructor(
    private readonly matches: MatchGateway,
    private readonly settlement: SettlementService,
    private readonly releaser: ActivePlayersReleaser,
    private readonly events: EventPublisher,
    private readonly gateway: GameGateway,
    private readonly scheduler: TimerScheduler,
    private readonly newDice: DiceRollerFactory,
    private readonly directory: UserDirectory,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly options: GameServiceOptions,
  ) {}

  // ---- Inbound intents -----------------------------------------------------

  async handleJoin(
    userId: string,
    matchId: string,
  ): Promise<Result<void, AppError>> {
    const session = await this.getOrLoadSession(matchId);
    if (!session) {
      return err(AppError.notFound('MATCH_NOT_FOUND', 'No such active match'));
    }
    const seat = seatOfUser(session, userId);
    if (seat === undefined) {
      return err(AppError.forbidden('NOT_A_PLAYER', 'You are not in this match'));
    }

    this.cancelGrace(session, seat);
    session.connected.add(seat);
    this.userMatch.set(userId, matchId);

    if (
      session.status === 'WAITING' &&
      session.connected.size === session.seats.length
    ) {
      await this.startGame(session);
    }

    this.broadcast(session);
    return ok(undefined);
  }

  handleRoll(userId: string, matchId: string): Result<void, AppError> {
    const session = this.sessions.get(matchId);
    const guard = this.guardTurn(session, userId, TurnPhase.AwaitingRoll);
    if (!guard.ok) return guard;

    this.scheduler.cancel(session!.turnTimer);
    this.doRoll(session!);
    return ok(undefined);
  }

  handleMove(
    userId: string,
    matchId: string,
    tokenIndex: number,
  ): Result<void, AppError> {
    const session = this.sessions.get(matchId);
    const guard = this.guardTurn(session, userId, TurnPhase.AwaitingMove);
    if (!guard.ok) return guard;

    this.scheduler.cancel(session!.turnTimer);
    return this.doMove(session!, tokenIndex);
  }

  /**
   * Explicit forfeit: the quitting player loses immediately and the opponent
   * wins the pool (settled idempotently). Unlike a disconnect there is no grace
   * period — they chose to leave. Once stakes are escrowed, abandoning a match
   * forfeits, exactly as a real-money table would enforce.
   */
  async handleQuit(
    userId: string,
    matchId: string,
  ): Promise<Result<void, AppError>> {
    const session = await this.getOrLoadSession(matchId);
    if (!session) {
      return err(AppError.notFound('MATCH_NOT_FOUND', 'No such match'));
    }
    const seat = seatOfUser(session, userId);
    if (seat === undefined) {
      return err(AppError.forbidden('NOT_A_PLAYER', 'You are not in this match'));
    }
    if (session.status === 'FINISHED') return ok(undefined);
    await this.finishGame(session, opponentSeat(session, seat) ?? null);
    return ok(undefined);
  }

  handleDisconnect(userId: string): void {
    const matchId = this.userMatch.get(userId);
    if (!matchId) return;
    const session = this.sessions.get(matchId);
    if (!session) return;
    const seat = seatOfUser(session, userId);
    if (seat === undefined) return;

    session.connected.delete(seat);
    this.broadcast(session);
    if (session.status !== 'ACTIVE') return;

    // Grace period before the disconnected player forfeits.
    const handle = this.scheduler.schedule(() => {
      void this.onGraceExpired(matchId, seat);
    }, this.options.disconnectGraceMs);
    session.graceTimers.set(seat, handle);
  }

  // ---- Core transitions (no ownership checks) ------------------------------

  private doRoll(session: GameSession): void {
    const seat = session.state.turnSeat;
    const dice = session.dice.roll();
    const rolled = applyRoll(session.state, dice);
    if (!rolled.ok) {
      this.logger.error({ matchId: session.matchId }, 'applyRoll failed');
      return;
    }
    session.state = rolled.value.state;
    session.missedTurns[seat] = 0;
    this.gateway.toRoom(session.matchId, 'game:rolled', {
      seat,
      dice,
      turnPassed: rolled.value.turnPassed,
      reason: rolled.value.reason ?? null,
    });
    this.broadcast(session);
    this.armTurnTimer(session);
  }

  private doMove(session: GameSession, tokenIndex: number): Result<void, AppError> {
    const moved = applyMove(session.state, tokenIndex);
    if (!moved.ok) return moved;
    session.state = moved.value.state;

    if (moved.value.winner !== null) {
      void this.finishGame(session, moved.value.winner);
      return ok(undefined);
    }
    this.broadcast(session);
    this.armTurnTimer(session);
    return ok(undefined);
  }

  // ---- Lifecycle -----------------------------------------------------------

  /**
   * Returns the live session, loading it once. Concurrent callers share a
   * single in-flight load (the promise is registered synchronously before the
   * first await), so two simultaneous joins never create rival sessions.
   */
  private async getOrLoadSession(
    matchId: string,
  ): Promise<GameSession | null> {
    const existing = this.sessions.get(matchId);
    if (existing) return existing;
    const inflight = this.loading.get(matchId);
    if (inflight) return inflight;

    const load = (async (): Promise<GameSession | null> => {
      const info = await this.matches.load(matchId);
      if (!info) return null;
      if (info.status !== 'PENDING' && info.status !== 'ACTIVE') return null;

      const ordered = [...info.players].sort((a, b) => a.seat - b.seat);
      const seats: SessionSeat[] = await Promise.all(
        ordered.map(async (s) => ({
          userId: s.userId,
          seat: s.seat,
          username: (await this.directory.usernameOf(s.userId)) ?? `Seat ${s.seat}`,
        })),
      );
      const missedTurns: Record<Seat, number> = {};
      for (const s of seats) missedTurns[s.seat] = 0;

      const session: GameSession = {
        matchId,
        entryFee: info.entryFee,
        pool: info.pool,
        seats,
        state: createInitialState(seats.length, seats[0]!.seat),
        dice: this.newDice(),
        connected: new Set<Seat>(),
        missedTurns,
        status: info.status === 'ACTIVE' ? 'ACTIVE' : 'WAITING',
        turnTimer: null,
        graceTimers: new Map(),
      };
      this.sessions.set(matchId, session);
      return session;
    })();

    this.loading.set(matchId, load);
    try {
      return await load;
    } finally {
      this.loading.delete(matchId);
    }
  }

  private async startGame(session: GameSession): Promise<void> {
    session.status = 'ACTIVE';
    await this.matches.markActive(session.matchId);

    await this.events.publish({
      type: DomainEventType.GameStarted,
      occurredAt: this.clock.now().toISOString(),
      payload: {
        matchId: asMatchId(session.matchId),
        roomId: asRoomId(session.matchId),
        players: session.seats.map((s) => asUserId(s.userId)),
      },
    });
    this.gateway.toRoom(session.matchId, 'game:started', {
      matchId: session.matchId,
      diceCommitment: session.dice.commitment(),
    });
    this.armTurnTimer(session);
  }

  private async finishGame(
    session: GameSession,
    winnerSeat: Seat | null,
  ): Promise<void> {
    if (session.status === 'FINISHED') return; // idempotent guard
    session.status = 'FINISHED';
    this.scheduler.cancel(session.turnTimer);
    for (const h of session.graceTimers.values()) this.scheduler.cancel(h);

    const winnerId =
      winnerSeat !== null ? (userOfSeat(session, winnerSeat) ?? null) : null;

    let winnings = 0;
    let rake = 0;
    if (winnerId) {
      const settled = await this.settlement.settle(
        session.matchId,
        winnerId,
        session.pool,
      );
      if (settled.ok) {
        winnings = settled.value.winnings;
        rake = settled.value.rake;
      } else {
        this.logger.error(
          { matchId: session.matchId, code: settled.error.code },
          'settlement failed',
        );
      }
    }

    await this.matches.markResult(session.matchId, winnerId);
    await this.releaser.release(session.seats.map((s) => s.userId));

    await this.events.publish({
      type: DomainEventType.GameEnded,
      occurredAt: this.clock.now().toISOString(),
      payload: {
        matchId: asMatchId(session.matchId),
        roomId: asRoomId(session.matchId),
        winnerId: winnerId ? asUserId(winnerId) : null,
        players: session.seats.map((s) => asUserId(s.userId)),
      },
    });

    this.gateway.toRoom(session.matchId, 'game:ended', {
      winnerId,
      winnerName:
        winnerSeat !== null ? (usernameOfSeat(session, winnerSeat) ?? null) : null,
      winnings,
      rake,
      // Reveal the seed so anyone can verify every roll was fair.
      dice: {
        commitment: session.dice.commitment(),
        serverSeed: session.dice.reveal(),
        rolls: session.dice.nonce(),
      },
    });

    this.sessions.delete(session.matchId);
    for (const s of session.seats) this.userMatch.delete(s.userId);
  }

  // ---- Timers --------------------------------------------------------------

  private armTurnTimer(session: GameSession): void {
    this.scheduler.cancel(session.turnTimer);
    if (session.status !== 'ACTIVE') return;
    session.turnTimer = this.scheduler.schedule(() => {
      this.onTurnTimeout(session.matchId);
    }, this.options.turnTimeoutMs);
  }

  private onTurnTimeout(matchId: string): void {
    const session = this.sessions.get(matchId);
    if (!session || session.status !== 'ACTIVE') return;
    const seat = session.state.turnSeat;
    session.missedTurns[seat] = (session.missedTurns[seat] ?? 0) + 1;

    if (session.missedTurns[seat] >= this.options.maxMissedTurns) {
      const winner = opponentSeat(session, seat);
      void this.finishGame(session, winner ?? null);
      return;
    }
    this.runAutomaticTurn(session);
  }

  /** Auto-play one ply for a timed-out player so the match keeps progressing. */
  private runAutomaticTurn(session: GameSession): void {
    if (session.state.phase === TurnPhase.AwaitingRoll) {
      this.doRoll(session);
    }
    if (session.state.phase === TurnPhase.AwaitingMove) {
      const moves = legalMoves(session.state, session.state.lastRoll!);
      if (moves.length > 0) this.doMove(session, pickAutoMove(moves).tokenIndex);
    }
  }

  private async onGraceExpired(matchId: string, seat: Seat): Promise<void> {
    const session = this.sessions.get(matchId);
    if (!session || session.status !== 'ACTIVE') return;
    if (session.connected.has(seat)) return; // reconnected in time
    await this.finishGame(session, opponentSeat(session, seat) ?? null);
  }

  // ---- Helpers -------------------------------------------------------------

  private guardTurn(
    session: GameSession | undefined,
    userId: string,
    phase: TurnPhase,
  ): Result<void, AppError> {
    if (!session) return err(AppError.notFound('MATCH_NOT_FOUND', 'No such match'));
    if (session.status !== 'ACTIVE') {
      return err(AppError.unprocessable('GAME_NOT_ACTIVE', 'Game is not active'));
    }
    const seat = seatOfUser(session, userId);
    if (seat === undefined) {
      return err(AppError.forbidden('NOT_A_PLAYER', 'You are not in this match'));
    }
    if (seat !== session.state.turnSeat) {
      return err(AppError.unprocessable('NOT_YOUR_TURN', 'Not your turn'));
    }
    if (session.state.phase !== phase) {
      return err(AppError.unprocessable('WRONG_PHASE', `Expected ${phase}`));
    }
    return ok(undefined);
  }

  private cancelGrace(session: GameSession, seat: Seat): void {
    const handle = session.graceTimers.get(seat);
    if (handle) {
      this.scheduler.cancel(handle);
      session.graceTimers.delete(seat);
    }
  }

  private broadcast(session: GameSession): void {
    this.gateway.toRoom(session.matchId, 'game:state', toStateView(session));
    if (session.state.phase === TurnPhase.AwaitingMove) {
      const currentUser = userOfSeat(session, session.state.turnSeat);
      if (currentUser) {
        this.gateway.toUser(currentUser, 'game:legalMoves', {
          matchId: session.matchId,
          moves: legalMovesFor(session),
        });
      }
    }
  }
}
