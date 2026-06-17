import { beforeEach, describe, expect, it } from 'vitest';
import { money } from '@gamesphere/shared';
import { userAccount } from '@/modules/wallet/domain/account.js';
import { EntryReason } from '@/modules/wallet/domain/ledger.js';
import { CreditFunds } from '@/modules/wallet/application/credit-funds.js';
import { HoldEntryFee } from '@/modules/wallet/application/hold-entry-fee.js';
import { RefundEntryFee } from '@/modules/wallet/application/refund-entry-fee.js';
import { FormMatch } from '@/modules/matchmaking/application/form-match.js';
import type { Match } from '@/modules/matchmaking/domain/match.js';
import type { MatchRepository } from '@/modules/matchmaking/domain/match-repository.js';
import type {
  MatchmakingQueue,
  QueuedPlayer,
} from '@/modules/matchmaking/domain/matchmaking-queue.js';
import { FixedClock } from '@/shared/clock.js';
import { SequentialIdGenerator } from '@/shared/id-generator.js';
import { InMemoryWalletRepository } from '../helpers/in-memory-wallet-repository.js';

class FakeMatchRepo implements MatchRepository {
  readonly created: Match[] = [];
  async create(m: Match) {
    this.created.push(m);
  }
  async findById() {
    return null;
  }
  async findActiveForUser() {
    return null;
  }
  async setStatus() {}
  async setResult() {}
  async listRecent() {
    return [];
  }
  async countActive() {
    return 0;
  }
}

class FakeQueue implements MatchmakingQueue {
  readonly reEnqueued: string[] = [];
  readonly released: string[] = [];
  async enqueue(userId: string) {
    this.reEnqueued.push(userId);
    return 'queued' as const;
  }
  async tryFormPair() {
    return null;
  }
  async leave() {}
  async release(ids: readonly string[]) {
    this.released.push(...ids);
  }
  async size() {
    return 0;
  }
  async isQueued() {
    return false;
  }
}

const noopBus = { publish: async () => {} };
const ENTRY_FEE = 10_000;
const pair = (): [QueuedPlayer, QueuedPlayer] => [
  { userId: 'p0', rating: 1000 },
  { userId: 'p1', rating: 1000 },
];

describe('FormMatch saga', () => {
  let wallet: InMemoryWalletRepository;
  let queue: FakeQueue;
  let matches: FakeMatchRepo;
  let formMatch: FormMatch;
  let credit: CreditFunds;

  beforeEach(() => {
    const ids = new SequentialIdGenerator('m');
    const clock = new FixedClock(1_000);
    wallet = new InMemoryWalletRepository(ids, clock);
    queue = new FakeQueue();
    matches = new FakeMatchRepo();
    credit = new CreditFunds(wallet, ids);
    const hold = new HoldEntryFee(wallet, ids);
    const refund = new RefundEntryFee(wallet, ids);
    formMatch = new FormMatch(
      queue,
      {
        hold: (u, m, a) => hold.execute({ userId: u, matchId: m, amount: a }),
        refund: (u, m, a) => refund.execute({ userId: u, matchId: m, amount: a }),
      },
      matches,
      noopBus,
      ids,
      clock,
    );
  });

  const fund = (u: string, amt: number) =>
    credit.execute({
      userId: u,
      amount: money(amt),
      reason: EntryReason.Deposit,
      idempotencyKey: `seed:${u}`,
    });

  it('creates a funded match when both players can pay', async () => {
    await fund('p0', 50_000);
    await fund('p1', 50_000);

    const result = await formMatch.execute(pair(), ENTRY_FEE);
    expect(result.ok).toBe(true);
    expect(matches.created).toHaveLength(1);
    expect(matches.created[0]!.pool).toBe(20_000);
    expect(await wallet.getBalance(userAccount('p0'))).toBe(40_000);
    expect(await wallet.getBalance(userAccount('p1'))).toBe(40_000);
  });

  it('refunds the first player when the second cannot pay (compensation)', async () => {
    await fund('p0', 50_000);
    // p1 has no funds.

    const result = await formMatch.execute(pair(), ENTRY_FEE);
    expect(result.ok).toBe(false);
    // No match persisted, p0 made whole, p0 re-queued.
    expect(matches.created).toHaveLength(0);
    expect(await wallet.getBalance(userAccount('p0'))).toBe(50_000);
    expect(queue.released).toEqual(['p0', 'p1']);
    expect(queue.reEnqueued).toEqual(['p0']);
  });

  it('drops the first player and re-queues the second when the first cannot pay', async () => {
    await fund('p1', 50_000);
    // p0 has no funds.

    const result = await formMatch.execute(pair(), ENTRY_FEE);
    expect(result.ok).toBe(false);
    expect(matches.created).toHaveLength(0);
    expect(await wallet.getBalance(userAccount('p1'))).toBe(50_000); // never charged
    expect(queue.reEnqueued).toEqual(['p1']);
  });
});
