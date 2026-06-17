import { money, type Money } from '@gamesphere/shared';
import {
  accountKey,
  isGuarded,
  type AccountRef,
} from '@/modules/wallet/domain/account.js';
import type { LedgerEntry } from '@/modules/wallet/domain/ledger.js';
import { netDeltas, type Transaction } from '@/modules/wallet/domain/transaction.js';
import type {
  CommitOutcome,
  WalletRepository,
} from '@/modules/wallet/domain/wallet-repository.js';
import { AccountType } from '@/modules/wallet/domain/account.js';
import type { Clock } from '@/shared/clock.js';
import type { IdGenerator } from '@/shared/id-generator.js';

/**
 * In-memory implementation of WalletRepository with the SAME contract as the
 * Mongo adapter: idempotent on idempotencyKey, all-or-nothing commits, and the
 * no-negative guard on USER/ESCROW accounts. Tests use cases against this so
 * domain behaviour is verified without a database (LSP: it must be substitutable).
 */
export class InMemoryWalletRepository implements WalletRepository {
  private readonly balances = new Map<string, number>();
  private readonly seenKeys = new Set<string>();
  readonly entries: LedgerEntry[] = [];

  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async getBalance(account: AccountRef): Promise<Money> {
    return money(this.balances.get(accountKey(account)) ?? 0);
  }

  async commit(tx: Transaction): Promise<CommitOutcome> {
    if (this.seenKeys.has(tx.idempotencyKey)) {
      return { status: 'duplicate' };
    }

    const deltas = [...netDeltas(tx.entries).values()];

    // Validate every guard BEFORE mutating anything (atomicity).
    for (const { account, delta } of deltas) {
      if (isGuarded(account.type) && delta < 0) {
        const current = this.balances.get(accountKey(account)) ?? 0;
        if (current + delta < 0) {
          return { status: 'guard_failed', account };
        }
      }
    }

    for (const { account, delta } of deltas) {
      const key = accountKey(account);
      this.balances.set(key, (this.balances.get(key) ?? 0) + delta);
    }
    const now = this.clock.now();
    for (const e of tx.entries) {
      this.entries.push({
        ...e,
        id: this.ids.generate(),
        transactionId: tx.id,
        createdAt: now,
      });
    }
    this.seenKeys.add(tx.idempotencyKey);
    return { status: 'committed' };
  }

  async listUserEntries(userId: string, limit: number): Promise<LedgerEntry[]> {
    return this.entries
      .filter(
        (e) =>
          e.account.type === AccountType.User && e.account.ref === userId,
      )
      .reverse()
      .slice(0, limit);
  }

  /** Test-only invariant helper: money is conserved across all accounts. */
  systemSum(): number {
    return [...this.balances.values()].reduce((a, b) => a + b, 0);
  }
}
