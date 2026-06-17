import type { Money } from '@gamesphere/shared';
import type { GameState, Seat } from './ludo/state.js';
import type { VerifiableDiceRoller } from './dice-roller.js';
import type { TimerHandle } from './timer-scheduler.js';
import type { MatchSeat } from '../application/ports.js';

export type SessionStatus = 'WAITING' | 'ACTIVE' | 'FINISHED';

/**
 * The authoritative, in-memory state of one live match. Holding this on the
 * server (never the client) is what makes the server the single source of
 * truth. NOTE: in-memory means a single instance owns a given match — scaling
 * out requires sticky sessions or moving this into Redis (see design docs).
 */
export interface GameSession {
  readonly matchId: string;
  readonly entryFee: Money;
  readonly pool: Money;
  readonly seats: readonly MatchSeat[];
  state: GameState;
  readonly dice: VerifiableDiceRoller;
  readonly connected: Set<Seat>;
  readonly missedTurns: Record<Seat, number>;
  status: SessionStatus;
  turnTimer: TimerHandle | null;
  readonly graceTimers: Map<Seat, TimerHandle>;
}

export const seatOfUser = (
  session: GameSession,
  userId: string,
): Seat | undefined => session.seats.find((s) => s.userId === userId)?.seat;

export const userOfSeat = (
  session: GameSession,
  seat: Seat,
): string | undefined => session.seats.find((s) => s.seat === seat)?.userId;

export const opponentSeat = (session: GameSession, seat: Seat): Seat | undefined =>
  session.seats.find((s) => s.seat !== seat)?.seat;
