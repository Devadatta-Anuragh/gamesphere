import { z } from 'zod';
import type { LedgerEntry } from '../domain/ledger.js';
import type { WalletView } from '../application/get-wallet.js';

export const DepositSchema = z.object({
  /** Amount in minor units (kobo). */
  amount: z.number().int().positive().max(100_000_000),
  /** Optional client reference; makes the deposit idempotent if supplied. */
  reference: z.string().trim().min(1).max(64).optional(),
});

export type DepositInput = z.infer<typeof DepositSchema>;

interface PublicEntry {
  id: string;
  direction: string;
  reason: string;
  amount: number;
  createdAt: string;
}

const toPublicEntry = (e: LedgerEntry): PublicEntry => ({
  id: e.id,
  direction: e.direction,
  reason: e.reason,
  amount: e.amount,
  createdAt: e.createdAt.toISOString(),
});

export const toWalletDto = (view: WalletView) => ({
  balance: view.balance,
  entries: view.entries.map(toPublicEntry),
});
