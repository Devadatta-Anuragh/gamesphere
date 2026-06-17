import type { Money } from '@gamesphere/shared';
import type { AccountRef } from './account.js';

export enum EntryDirection {
  Credit = 'CREDIT',
  Debit = 'DEBIT',
}

/** Why a money movement happened — part of the audit trail and of reporting. */
export enum EntryReason {
  Deposit = 'DEPOSIT',
  SignupBonus = 'SIGNUP_BONUS',
  EntryFeeHold = 'ENTRY_FEE_HOLD',
  EntryFeeRefund = 'ENTRY_FEE_REFUND',
  Winnings = 'WINNINGS',
  Rake = 'RAKE',
}

/** A proposed entry, before it is assigned an id and persisted. */
export interface NewEntry {
  readonly account: AccountRef;
  readonly direction: EntryDirection;
  readonly amount: Money; // always positive; direction carries the sign
  readonly reason: EntryReason;
}

/** A persisted, immutable ledger entry (append-only journal). */
export interface LedgerEntry extends NewEntry {
  readonly id: string;
  readonly transactionId: string;
  readonly createdAt: Date;
}

/** Signed contribution of an entry to its account's balance. */
export const signedAmount = (entry: NewEntry): number =>
  entry.direction === EntryDirection.Credit ? entry.amount : -entry.amount;
