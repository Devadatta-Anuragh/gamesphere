import { AppError } from '@/shared/errors.js';
import { err, ok, type Result } from '@/shared/result.js';
import {
  DICE_TO_LEAVE_YARD,
  FINISH,
  FIRST_MAIN_PROGRESS,
  TOKENS_PER_PLAYER,
  YARD,
  absoluteCell,
  isOnMainTrack,
  isSafeCell,
} from './board.js';
import {
  TurnPhase,
  cloneTokens,
  nextSeat,
  tokensOf,
  type GameState,
  type Seat,
} from './state.js';

export interface CapturedToken {
  readonly seat: Seat;
  readonly tokenIndex: number;
}

export interface LegalMove {
  readonly tokenIndex: number;
  readonly from: number;
  readonly to: number;
  readonly exitsYard: boolean;
  readonly finishes: boolean;
  readonly captures: readonly CapturedToken[];
}

export interface RollOutcome {
  readonly state: GameState;
  readonly legalMoves: readonly LegalMove[];
  /** True when the turn passed without a move (no legal moves, or triple-six). */
  readonly turnPassed: boolean;
  readonly reason?: 'NO_LEGAL_MOVES' | 'TRIPLE_SIX';
}

export interface MoveOutcome {
  readonly state: GameState;
  readonly captured: readonly CapturedToken[];
  readonly finishedToken: boolean;
  readonly extraTurn: boolean;
  readonly winner: Seat | null;
}

const MAX_CONSECUTIVE_SIXES = 3;

/** Opponent tokens captured if `seat` lands a token on ring `progress`. */
const capturesAt = (
  state: GameState,
  seat: Seat,
  progress: number,
): CapturedToken[] => {
  if (!isOnMainTrack(progress)) return [];
  const offset = state.startOffset[seat] as number;
  const cell = absoluteCell(offset, progress);
  if (isSafeCell(cell)) return [];

  const captured: CapturedToken[] = [];
  for (const other of state.seats) {
    if (other === seat) continue;
    const otherOffset = state.startOffset[other] as number;
    tokensOf(state, other).forEach((p, tokenIndex) => {
      if (isOnMainTrack(p) && absoluteCell(otherOffset, p) === cell) {
        captured.push({ seat: other, tokenIndex });
      }
    });
  }
  return captured;
};

/** All legal moves for the current seat given a dice value (1..6). */
export const legalMoves = (state: GameState, dice: number): LegalMove[] => {
  const seat = state.turnSeat;
  const moves: LegalMove[] = [];

  tokensOf(state, seat).forEach((from, tokenIndex) => {
    if (from === FINISH) return; // already home

    let to: number;
    let exitsYard = false;
    if (from === YARD) {
      if (dice !== DICE_TO_LEAVE_YARD) return; // need a 6 to leave the yard
      to = FIRST_MAIN_PROGRESS;
      exitsYard = true;
    } else {
      to = from + dice;
      if (to > FINISH) return; // overshoot — must land exactly on home
    }

    moves.push({
      tokenIndex,
      from,
      to,
      exitsYard,
      finishes: to === FINISH,
      captures: capturesAt(state, seat, to),
    });
  });

  return moves;
};

const advanceTurnState = (state: GameState): GameState => ({
  ...state,
  phase: TurnPhase.AwaitingRoll,
  turnSeat: nextSeat(state, state.turnSeat),
  lastRoll: null,
  consecutiveSixes: 0,
});

/**
 * Resolve a dice roll. The dice value is provided by the caller (the server's
 * authoritative DiceRoller) so the engine stays pure/deterministic. Handles the
 * triple-six forfeit and auto-passes the turn when no legal move exists.
 */
export const applyRoll = (
  state: GameState,
  dice: number,
): Result<RollOutcome, AppError> => {
  if (state.phase !== TurnPhase.AwaitingRoll) {
    return err(AppError.unprocessable('WRONG_PHASE', 'Not awaiting a roll'));
  }
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) {
    return err(AppError.validation('INVALID_DICE', 'Dice must be 1..6'));
  }

  const isSix = dice === DICE_TO_LEAVE_YARD;
  const sixes = isSix ? state.consecutiveSixes + 1 : 0;

  // Three sixes in a row forfeits the turn (anti-stalling rule).
  if (sixes >= MAX_CONSECUTIVE_SIXES) {
    return ok({
      state: advanceTurnState(state),
      legalMoves: [],
      turnPassed: true,
      reason: 'TRIPLE_SIX',
    });
  }

  const moves = legalMoves(state, dice);
  if (moves.length === 0) {
    return ok({
      state: advanceTurnState(state),
      legalMoves: [],
      turnPassed: true,
      reason: 'NO_LEGAL_MOVES',
    });
  }

  return ok({
    state: {
      ...state,
      phase: TurnPhase.AwaitingMove,
      lastRoll: dice,
      consecutiveSixes: sixes,
    },
    legalMoves: moves,
    turnPassed: false,
  });
};

/**
 * Apply the chosen move. Validates it against the legal moves for the pending
 * roll, performs captures, detects a win, and decides whether the same player
 * rolls again (extra turn on a six, a capture, or sending a token home).
 */
export const applyMove = (
  state: GameState,
  tokenIndex: number,
): Result<MoveOutcome, AppError> => {
  if (state.phase !== TurnPhase.AwaitingMove || state.lastRoll === null) {
    return err(AppError.unprocessable('WRONG_PHASE', 'Not awaiting a move'));
  }

  const move = legalMoves(state, state.lastRoll).find(
    (m) => m.tokenIndex === tokenIndex,
  );
  if (!move) {
    return err(
      AppError.unprocessable('ILLEGAL_MOVE', 'That token cannot make that move', {
        tokenIndex,
        dice: state.lastRoll,
      }),
    );
  }

  const seat = state.turnSeat;
  const tokens = cloneTokens(state);
  tokens[seat]![tokenIndex] = move.to;

  // Send captured opponents back to their yard.
  for (const cap of move.captures) {
    tokens[cap.seat]![cap.tokenIndex] = YARD;
  }

  const allHome = tokens[seat]!.every((p) => p === FINISH);
  const winner = allHome ? seat : null;

  if (winner !== null) {
    return ok({
      state: { ...state, tokens, phase: TurnPhase.Finished, winner, lastRoll: null },
      captured: move.captures,
      finishedToken: move.finishes,
      extraTurn: false,
      winner,
    });
  }

  const extraTurn =
    state.lastRoll === DICE_TO_LEAVE_YARD ||
    move.captures.length > 0 ||
    move.finishes;

  const nextState: GameState = extraTurn
    ? {
        ...state,
        tokens,
        phase: TurnPhase.AwaitingRoll,
        lastRoll: null,
        // keep the six-streak so triple-six still applies across extra rolls
      }
    : { ...advanceTurnState(state), tokens };

  return ok({
    state: nextState,
    captured: move.captures,
    finishedToken: move.finishes,
    extraTurn,
    winner: null,
  });
};

/** Count of a seat's tokens that have reached home (used for scoring/leaderboard). */
export const tokensHome = (state: GameState, seat: Seat): number =>
  tokensOf(state, seat).filter((p) => p === FINISH).length;

export const TOTAL_TOKENS = TOKENS_PER_PLAYER;
