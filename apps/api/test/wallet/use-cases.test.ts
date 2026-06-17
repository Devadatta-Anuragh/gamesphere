import { beforeEach, describe, expect, it } from 'vitest';
import { money } from '@gamesphere/shared';
import {
  HOUSE_ACCOUNT,
  escrowAccount,
  userAccount,
} from '@/modules/wallet/domain/account.js';
import { EntryReason } from '@/modules/wallet/domain/ledger.js';
import { CreditFunds } from '@/modules/wallet/application/credit-funds.js';
import { HoldEntryFee } from '@/modules/wallet/application/hold-entry-fee.js';
import { RefundEntryFee } from '@/modules/wallet/application/refund-entry-fee.js';
import { SettleMatch } from '@/modules/wallet/application/settle-match.js';
import { FixedClock } from '@/shared/clock.js';
import { SequentialIdGenerator } from '@/shared/id-generator.js';
import { InMemoryWalletRepository } from '../helpers/in-memory-wallet-repository.js';

const RAKE_BPS = 1000; // 10%

describe('wallet use cases', () => {
  let repo: InMemoryWalletRepository;
  let credit: CreditFunds;
  let hold: HoldEntryFee;
  let refund: RefundEntryFee;
  let settle: SettleMatch;

  beforeEach(() => {
    const ids = new SequentialIdGenerator();
    repo = new InMemoryWalletRepository(ids, new FixedClock(1_000));
    credit = new CreditFunds(repo, ids);
    hold = new HoldEntryFee(repo, ids);
    refund = new RefundEntryFee(repo, ids);
    settle = new SettleMatch(repo, ids, RAKE_BPS);
  });

  const deposit = (userId: string, amount: number) =>
    credit.execute({
      userId,
      amount: money(amount),
      reason: EntryReason.Deposit,
      idempotencyKey: `deposit:${userId}:${amount}`,
    });

  it('credits a deposit and derives the balance from the ledger', async () => {
    await deposit('alice', 1000);
    expect(await repo.getBalance(userAccount('alice'))).toBe(1000);
  });

  it('rejects a stake larger than the balance (no double-spend)', async () => {
    await deposit('alice', 50);
    const result = await hold.execute({ userId: 'alice', matchId: 'm1', amount: money(100) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INSUFFICIENT_FUNDS');
    // balance untouched
    expect(await repo.getBalance(userAccount('alice'))).toBe(50);
  });

  it('runs a full match: stakes escrowed, winner paid, rake to house, money conserved', async () => {
    await deposit('alice', 1000);
    await deposit('bob', 1000);

    await hold.execute({ userId: 'alice', matchId: 'm1', amount: money(100) });
    await hold.execute({ userId: 'bob', matchId: 'm1', amount: money(100) });
    expect(await repo.getBalance(escrowAccount('m1'))).toBe(200);

    const settled = await settle.execute({ matchId: 'm1', winnerId: 'alice', pool: money(200) });
    expect(settled.ok).toBe(true);
    if (settled.ok) {
      expect(settled.value.winnings).toBe(180);
      expect(settled.value.rake).toBe(20);
    }

    expect(await repo.getBalance(userAccount('alice'))).toBe(1080); // 900 + 180
    expect(await repo.getBalance(userAccount('bob'))).toBe(900);
    expect(await repo.getBalance(HOUSE_ACCOUNT)).toBe(20);
    expect(await repo.getBalance(escrowAccount('m1'))).toBe(0);
    // Money is conserved across all accounts (external went -2000).
    expect(repo.systemSum()).toBe(0);
  });

  it('settlement is idempotent — a duplicate GAME_ENDED never pays twice', async () => {
    await deposit('alice', 1000);
    await deposit('bob', 1000);
    await hold.execute({ userId: 'alice', matchId: 'm1', amount: money(100) });
    await hold.execute({ userId: 'bob', matchId: 'm1', amount: money(100) });

    await settle.execute({ matchId: 'm1', winnerId: 'alice', pool: money(200) });
    await settle.execute({ matchId: 'm1', winnerId: 'alice', pool: money(200) }); // replay

    expect(await repo.getBalance(userAccount('alice'))).toBe(1080);
    expect(await repo.getBalance(HOUSE_ACCOUNT)).toBe(20);
  });

  it('stake is idempotent per (match, user)', async () => {
    await deposit('alice', 1000);
    await hold.execute({ userId: 'alice', matchId: 'm1', amount: money(100) });
    await hold.execute({ userId: 'alice', matchId: 'm1', amount: money(100) }); // replay
    expect(await repo.getBalance(userAccount('alice'))).toBe(900);
  });

  it('refunds a stake from escrow on abandonment', async () => {
    await deposit('alice', 1000);
    await hold.execute({ userId: 'alice', matchId: 'm1', amount: money(100) });
    const r = await refund.execute({ userId: 'alice', matchId: 'm1', amount: money(100) });
    expect(r.ok).toBe(true);
    expect(await repo.getBalance(userAccount('alice'))).toBe(1000);
    expect(await repo.getBalance(escrowAccount('m1'))).toBe(0);
  });
});
