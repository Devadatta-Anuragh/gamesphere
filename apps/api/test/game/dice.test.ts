import { describe, expect, it } from 'vitest';
import {
  ProvablyFairDiceRoller,
  computeCommitment,
  rollFor,
} from '@/modules/game/infrastructure/provably-fair-dice.js';

describe('provably-fair dice', () => {
  it('produces values in 1..6 only', () => {
    const dice = new ProvablyFairDiceRoller();
    for (let i = 0; i < 1000; i += 1) {
      const v = dice.roll();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('is deterministic given the same seed (auditor can reproduce rolls)', () => {
    const seed = 'a'.repeat(64);
    const a = new ProvablyFairDiceRoller(seed);
    const b = new ProvablyFairDiceRoller(seed);
    const seqA = Array.from({ length: 50 }, () => a.roll());
    const seqB = Array.from({ length: 50 }, () => b.roll());
    expect(seqA).toEqual(seqB);
    // And each roll matches the standalone verification function + nonce.
    seqA.forEach((v, i) => expect(v).toBe(rollFor(seed, i + 1)));
  });

  it('commitment is the hash of the revealed seed', () => {
    const dice = new ProvablyFairDiceRoller();
    const commitment = dice.commitment();
    dice.roll();
    dice.roll();
    expect(dice.nonce()).toBe(2);
    expect(computeCommitment(dice.reveal())).toBe(commitment);
  });

  it('is approximately uniform over many rolls', () => {
    const dice = new ProvablyFairDiceRoller();
    const counts = [0, 0, 0, 0, 0, 0];
    const n = 60_000;
    for (let i = 0; i < n; i += 1) counts[dice.roll() - 1]! += 1;
    const expected = n / 6;
    // Each face within 8% of the expected frequency.
    for (const c of counts) {
      expect(Math.abs(c - expected) / expected).toBeLessThan(0.08);
    }
  });
});
