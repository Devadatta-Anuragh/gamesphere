import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { VerifiableDiceRoller } from '../domain/dice-roller.js';

const SIDES = 6;
// Largest multiple of SIDES that fits in a uint32; values >= this are rejected
// to remove modulo bias (rejection sampling) so every face is equiprobable.
const UINT32_LIMIT = Math.floor(0x1_0000_0000 / SIDES) * SIDES;

export const computeCommitment = (serverSeed: string): string =>
  createHash('sha256').update(serverSeed).digest('hex');

/**
 * Maps (serverSeed, nonce) to a uniform 1..6 deterministically. Pure and
 * exported so a client/auditor can recompute any roll from the revealed seed.
 */
export const rollFor = (serverSeed: string, nonce: number): number => {
  const digest = createHmac('sha256', serverSeed)
    .update(String(nonce))
    .digest(); // 32 bytes
  // Walk the digest in 4-byte words, rejecting biased values.
  for (let i = 0; i + 4 <= digest.length; i += 4) {
    const word = digest.readUInt32BE(i);
    if (word < UINT32_LIMIT) return (word % SIDES) + 1;
  }
  // Astronomically unlikely fallback; keeps the function total.
  return (digest.readUInt32BE(0) % SIDES) + 1;
};

/**
 * Provably-fair dice: a fresh 256-bit seed per match, a published commitment,
 * and HMAC-derived rolls indexed by an incrementing nonce.
 */
export class ProvablyFairDiceRoller implements VerifiableDiceRoller {
  private readonly serverSeed: string;
  private currentNonce = 0;

  constructor(serverSeed?: string) {
    this.serverSeed = serverSeed ?? randomBytes(32).toString('hex');
  }

  roll(): number {
    this.currentNonce += 1;
    return rollFor(this.serverSeed, this.currentNonce);
  }

  commitment(): string {
    return computeCommitment(this.serverSeed);
  }

  nonce(): number {
    return this.currentNonce;
  }

  reveal(): string {
    return this.serverSeed;
  }
}
