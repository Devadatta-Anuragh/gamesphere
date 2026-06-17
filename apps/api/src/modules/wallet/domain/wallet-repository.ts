import type { Money } from '@gamesphere/shared';
import type { AccountRef } from './account.js';
import type { EntryDirection, EntryReason, LedgerEntry } from './ledger.js';
import type { Transaction } from './transaction.js';

export interface AccountTypeBalance {
  readonly type: string;
  readonly balance: Money;
}

export interface LedgerLeg {
  readonly accountType: string;
  readonly accountRef: string;
  readonly direction: EntryDirection;
  readonly reason: EntryReason;
  readonly amount: Money;
}

/** A transaction with both (all) of its legs — used to render the journal. */
export interface LedgerTransactionView {
  readonly transactionId: string;
  readonly type: string;
  readonly createdAt: Date;
  readonly legs: readonly LedgerLeg[];
}

/**
 * Outcome of attempting to commit a transaction atomically.
 *  - committed    : entries persisted and balances updated
 *  - duplicate    : the idempotency key was already used → treat as a no-op success
 *  - guard_failed : a guarded account (USER/ESCROW) would have gone negative
 */
export type CommitOutcome =
  | { readonly status: 'committed' }
  | { readonly status: 'duplicate' }
  | { readonly status: 'guard_failed'; readonly account: AccountRef };

/**
 * Persistence port for the wallet. `commit` must apply ALL of a transaction's
 * effects (ledger entries + per-account balance deltas) atomically, enforce the
 * no-negative guard on guarded accounts, and be idempotent on `idempotencyKey`.
 */
export interface WalletRepository {
  getBalance(account: AccountRef): Promise<Money>;
  commit(tx: Transaction): Promise<CommitOutcome>;
  listUserEntries(userId: string, limit: number): Promise<LedgerEntry[]>;
  /** Total balance per account type — used to prove Σ == 0 (money conserved). */
  sumByAccountType(): Promise<AccountTypeBalance[]>;
  /** Recent transactions involving the user, with all of their legs. */
  listRecentTransactions(
    userId: string,
    limit: number,
  ): Promise<LedgerTransactionView[]>;
}
