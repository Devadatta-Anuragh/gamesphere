import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/modules/game/domain/ludo/state.js';
import { FINISH } from '@/modules/game/domain/ludo/board.js';
import { ProvablyFairDiceRoller } from '@/modules/game/infrastructure/provably-fair-dice.js';
import { playToCompletion } from '../helpers/ludo.js';

describe('Ludo engine — full self-play', () => {
  it('always terminates with a winner whose four tokens are home', () => {
    // Many seeds → confidence the state machine never deadlocks or loops.
    for (let i = 0; i < 25; i += 1) {
      const dice = new ProvablyFairDiceRoller(`seed-${i}`.padEnd(64, '0'));
      const result = playToCompletion(createInitialState(2, 0), dice);
      expect(result.winner).not.toBeNull();
      const winnerTokens = result.finalState.tokens[result.winner!]!;
      expect(winnerTokens.every((p) => p === FINISH)).toBe(true);
    }
  });

  it('also terminates for a 4-player game', () => {
    const dice = new ProvablyFairDiceRoller('four-player'.padEnd(64, '0'));
    const result = playToCompletion(createInitialState(4, 0), dice);
    expect(result.winner).not.toBeNull();
  });
});
