import type { Money } from '@gamesphere/shared';
import type { AccountRef } from './account.js';
import type { LedgerEntry } from './ledger.js';
import type { Transaction } from './transaction.js';

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
}
