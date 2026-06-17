import {
  TOKENS_PER_PLAYER,
  YARD,
  seatStartOffsets,
} from './board.js';

export type Seat = number;

export enum TurnPhase {
  AwaitingRoll = 'AWAITING_ROLL',
  AwaitingMove = 'AWAITING_MOVE',
  Finished = 'FINISHED',
}

/**
 * The complete, serializable game state. It is treated as immutable — engine
 * transitions return a new state rather than mutating this one, which makes
 * the engine trivial to test and safe to snapshot/replay.
 */
export interface GameState {
  readonly playerCount: number;
  readonly seats: readonly Seat[]; // play order
  readonly startOffset: Readonly<Record<Seat, number>>;
  readonly tokens: Readonly<Record<Seat, readonly number[]>>; // 4 progress values per seat
  readonly phase: TurnPhase;
  readonly turnSeat: Seat;
  readonly lastRoll: number | null; // set while AwaitingMove
  readonly consecutiveSixes: number;
  readonly winner: Seat | null;
}

export const createInitialState = (
  playerCount: number,
  startingSeat: Seat = 0,
): GameState => {
  const seats = Array.from({ length: playerCount }, (_, i) => i);
  if (!seats.includes(startingSeat)) {
    throw new Error(`startingSeat ${startingSeat} out of range`);
  }
  const startOffset = seatStartOffsets(playerCount);
  const tokens: Record<Seat, readonly number[]> = {};
  for (const seat of seats) {
    tokens[seat] = Array.from({ length: TOKENS_PER_PLAYER }, () => YARD);
  }
  return {
    playerCount,
    seats,
    startOffset,
    tokens,
    phase: TurnPhase.AwaitingRoll,
    turnSeat: startingSeat,
    lastRoll: null,
    consecutiveSixes: 0,
    winner: null,
  };
};

/** The seat whose turn comes after `seat` in play order. */
export const nextSeat = (state: GameState, seat: Seat): Seat => {
  const idx = state.seats.indexOf(seat);
  return state.seats[(idx + 1) % state.seats.length] as Seat;
};

export const tokensOf = (state: GameState, seat: Seat): readonly number[] => {
  const t = state.tokens[seat];
  if (!t) throw new Error(`Unknown seat ${seat}`);
  return t;
};

/** Deep-clones the per-seat token arrays so callers can mutate the copy. */
export const cloneTokens = (
  state: GameState,
): Record<Seat, number[]> => {
  const copy: Record<Seat, number[]> = {};
  for (const seat of state.seats) {
    copy[seat] = [...tokensOf(state, seat)];
  }
  return copy;
};
