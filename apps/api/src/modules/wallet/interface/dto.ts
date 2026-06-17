import { z } from 'zod';
import { EntryDirection, type LedgerEntry } from '../domain/ledger.js';
import type { WalletView } from '../application/get-wallet.js';
import type { LedgerTransactionView } from '../domain/wallet-repository.js';

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

/**
 * Pairs each transaction's debit/credit legs (by reason + amount) into readable
 * transfers so the UI can show "EXTERNAL → USER  1000".
 */
export const toLedgerDto = (tx: LedgerTransactionView) => {
  const debits = tx.legs.filter((l) => l.direction === EntryDirection.Debit);
  const credits = tx.legs.filter((l) => l.direction === EntryDirection.Credit);
  const used = new Set<number>();

  const transfers = credits.map((credit) => {
    const matchIdx = debits.findIndex(
      (d, i) =>
        !used.has(i) && d.reason === credit.reason && d.amount === credit.amount,
    );
    if (matchIdx >= 0) used.add(matchIdx);
    return {
      from: matchIdx >= 0 ? debits[matchIdx]!.accountType : 'UNKNOWN',
      to: credit.accountType,
      amount: credit.amount,
      reason: credit.reason,
    };
  });

  return {
    id: tx.transactionId,
    type: tx.type,
    createdAt: tx.createdAt.toISOString(),
    transfers,
  };
};
