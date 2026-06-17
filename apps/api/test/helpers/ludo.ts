import {
  applyMove,
  applyRoll,
  legalMoves,
  type LegalMove,
} from '@/modules/game/domain/ludo/engine.js';
import {
  TurnPhase,
  type GameState,
  type Seat,
} from '@/modules/game/domain/ludo/state.js';
import type { DiceRoller } from '@/modules/game/domain/dice-roller.js';

/** Override a seat's token progresses for setting up specific scenarios. */
export const withTokens = (
  state: GameState,
  seat: Seat,
  progresses: number[],
): GameState => ({
  ...state,
  tokens: { ...state.tokens, [seat]: progresses },
});

/** Greedy policy: prefer finishing, then capturing, then advancing furthest. */
const pickMove = (moves: readonly LegalMove[]): LegalMove => {
  const ranked = [...moves].sort((a, b) => {
    if (a.finishes !== b.finishes) return a.finishes ? -1 : 1;
    if (a.captures.length !== b.captures.length)
      return b.captures.length - a.captures.length;
    return b.to - a.to;
  });
  return ranked[0]!;
};

export interface PlaythroughResult {
  winner: Seat | null;
  plies: number;
  finalState: GameState;
}

/**
 * Drives a full self-play game with a greedy policy until someone wins or the
 * ply budget is exhausted. Used to assert the state machine always terminates.
 */
export const playToCompletion = (
  initial: GameState,
  roller: DiceRoller,
  maxPlies = 10_000,
): PlaythroughResult => {
  let state = initial;
  let plies = 0;

  while (state.phase !== TurnPhase.Finished && plies < maxPlies) {
    plies += 1;
    if (state.phase === TurnPhase.AwaitingRoll) {
      const rolled = applyRoll(state, roller.roll());
      if (!rolled.ok) throw new Error(`applyRoll failed: ${rolled.error.code}`);
      state = rolled.value.state;
    } else {
      const move = pickMove(legalMoves(state, state.lastRoll!));
      const moved = applyMove(state, move.tokenIndex);
      if (!moved.ok) throw new Error(`applyMove failed: ${moved.error.code}`);
      state = moved.value.state;
    }
  }
  return { winner: state.winner, plies, finalState: state };
};
