import type { Money } from '@gamesphere/shared';
import { applyRakeBps } from '@gamesphere/shared';
import {
  EXTERNAL_ACCOUNT,
  HOUSE_ACCOUNT,
  accountKey,
  escrowAccount,
  userAccount,
  type AccountRef,
} from './account.js';
import {
  EntryDirection,
  EntryReason,
  signedAmount,
  type NewEntry,
} from './ledger.js';

export enum TransactionType {
  Deposit = 'DEPOSIT',
  SignupBonus = 'SIGNUP_BONUS',
  Stake = 'STAKE',
  Settlement = 'SETTLEMENT',
  Refund = 'REFUND',
}

/** A balanced group of entries plus the metadata needed to persist it. */
export interface Transaction {
  readonly id: string;
  readonly type: TransactionType;
  /** Caller-supplied dedupe key; a unique index makes commits idempotent. */
  readonly idempotencyKey: string;
  readonly entries: readonly NewEntry[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Net signed delta applied to each account by a set of entries. */
export const netDeltas = (
  entries: readonly NewEntry[],
): Map<string, { account: AccountRef; delta: number }> => {
  const deltas = new Map<string, { account: AccountRef; delta: number }>();
  for (const e of entries) {
    const key = accountKey(e.account);
    const current = deltas.get(key);
    const delta = signedAmount(e);
    if (current) current.delta += delta;
    else deltas.set(key, { account: e.account, delta });
  }
  return deltas;
};

/** Double-entry invariant: a transaction's entries must net to zero overall. */
export const isBalanced = (entries: readonly NewEntry[]): boolean =>
  entries.reduce((sum, e) => sum + signedAmount(e), 0) === 0;

const credit = (
  account: AccountRef,
  amount: Money,
  reason: EntryReason,
): NewEntry => ({ account, direction: EntryDirection.Credit, amount, reason });

const debit = (
  account: AccountRef,
  amount: Money,
  reason: EntryReason,
): NewEntry => ({ account, direction: EntryDirection.Debit, amount, reason });

/**
 * Pure builders for each kind of money movement. Each returns a balanced set of
 * entries; the use case wraps them with an id + idempotency key. Keeping these
 * pure makes the accounting rules trivial to unit test.
 */
export const Movements = {
  /** Money entering the system from outside (deposit or signup bonus). */
  externalCredit(userId: string, amount: Money, reason: EntryReason): NewEntry[] {
    return [
      debit(EXTERNAL_ACCOUNT, amount, reason),
      credit(userAccount(userId), amount, reason),
    ];
  },

  /** Move a player's stake from their balance into the match escrow pool. */
  stake(userId: string, matchId: string, amount: Money): NewEntry[] {
    return [
      debit(userAccount(userId), amount, EntryReason.EntryFeeHold),
      credit(escrowAccount(matchId), amount, EntryReason.EntryFeeHold),
    ];
  },

  /** Return a player's stake from escrow (abandonment / cancelled match). */
  refund(userId: string, matchId: string, amount: Money): NewEntry[] {
    return [
      debit(escrowAccount(matchId), amount, EntryReason.EntryFeeRefund),
      credit(userAccount(userId), amount, EntryReason.EntryFeeRefund),
    ];
  },

  /**
   * Settle a finished match: the escrow pool is split into the winner's
   * winnings (pool minus rake) and the house rake. Returns the entries plus the
   * computed split so the caller can report/emit it.
   */
  settlement(
    winnerId: string,
    matchId: string,
    pool: Money,
    rakeBps: number,
  ): { entries: NewEntry[]; rake: Money; winnings: Money } {
    const { rake, net: winnings } = applyRakeBps(pool, rakeBps);
    const escrow = escrowAccount(matchId);
    const entries: NewEntry[] = [
      debit(escrow, winnings, EntryReason.Winnings),
      credit(userAccount(winnerId), winnings, EntryReason.Winnings),
      debit(escrow, rake, EntryReason.Rake),
      credit(HOUSE_ACCOUNT, rake, EntryReason.Rake),
    ];
    return { entries, rake, winnings };
  },
};
