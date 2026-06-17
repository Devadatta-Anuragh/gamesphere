/**
 * Integration check for the Mongo wallet adapter against a live replica set.
 * Proves the three properties that matter for real money:
 *   1. Atomic, guarded debits prevent double-spend under real concurrency.
 *   2. Settlement is idempotent (a winner is never paid twice).
 *   3. Money is conserved (sum of all account balances == 0).
 *
 * Run with: pnpm --filter @gamesphere/api exec tsx scripts/verify-wallet.ts
 */
import process from 'node:process';
import mongoose from 'mongoose';
import { money } from '@gamesphere/shared';
import { loadConfig } from '@/config/env.js';
import { createLogger } from '@/shared/logger.js';
import { SystemClock } from '@/shared/clock.js';
import { NanoidGenerator } from '@/shared/id-generator.js';
import { connectMongo, disconnectMongo } from '@/infrastructure/mongo/mongo-connection.js';
import { MongoWalletRepository } from '@/modules/wallet/infrastructure/mongo-wallet-repository.js';
import { CreditFunds } from '@/modules/wallet/application/credit-funds.js';
import { HoldEntryFee } from '@/modules/wallet/application/hold-entry-fee.js';
import { SettleMatch } from '@/modules/wallet/application/settle-match.js';
import { EntryReason } from '@/modules/wallet/domain/ledger.js';
import {
  escrowAccount,
  userAccount,
} from '@/modules/wallet/domain/account.js';

const assert = (cond: boolean, msg: string): void => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
};

async function main(): Promise<void> {
  process.loadEnvFile(new URL('../.env', import.meta.url).pathname);
  const config = loadConfig();
  const logger = createLogger('warn', false);
  await connectMongo(config.MONGO_URI, logger);

  // Fresh slate.
  await Promise.all([
    mongoose.connection.collection('transactions').deleteMany({}),
    mongoose.connection.collection('ledgerentries').deleteMany({}),
    mongoose.connection.collection('balances').deleteMany({}),
  ]);

  const ids = new NanoidGenerator();
  const repo = new MongoWalletRepository(ids, new SystemClock());
  const credit = new CreditFunds(repo, ids);
  const hold = new HoldEntryFee(repo, ids);
  const settle = new SettleMatch(repo, ids, config.DEFAULT_RAKE_BPS);

  console.log('\n[1] Concurrent competing debits (double-spend guard)');
  await credit.execute({
    userId: 'alice',
    amount: money(1000),
    reason: EntryReason.Deposit,
    idempotencyKey: 'seed:alice',
  });
  // 20 concurrent stakes of 100 from a 1000 balance → at most 10 can succeed.
  const stakes = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      hold.execute({ userId: 'alice', matchId: `mm${i}`, amount: money(100) }),
    ),
  );
  const ok = stakes.filter((r) => r.ok).length;
  const rejected = stakes.filter((r) => !r.ok).length;
  console.log(`  -> ${ok} succeeded, ${rejected} rejected`);
  assert(ok === 10, 'exactly 10 of 20 concurrent stakes succeeded');
  assert((await repo.getBalance(userAccount('alice'))) === 0, 'alice balance is exactly 0 (never negative)');

  console.log('\n[2] Idempotent settlement (concurrent duplicate GAME_ENDED)');
  await credit.execute({ userId: 'bob', amount: money(100), reason: EntryReason.Deposit, idempotencyKey: 'seed:bob' });
  await hold.execute({ userId: 'bob', matchId: 'final', amount: money(100) });
  await hold.execute({ userId: 'alice', matchId: 'final', amount: money(100) }); // alice staked mm? no — restake from 0 fails
  // alice has 0; give her exactly one stake worth for this match via a fresh deposit
  await credit.execute({ userId: 'alice', amount: money(100), reason: EntryReason.Deposit, idempotencyKey: 'seed:alice2' });
  await hold.execute({ userId: 'alice', matchId: 'final', amount: money(100) });
  const pool = await repo.getBalance(escrowAccount('final'));
  console.log(`  -> escrow pool = ${pool}`);
  const settlements = await Promise.all([
    settle.execute({ matchId: 'final', winnerId: 'alice', pool }),
    settle.execute({ matchId: 'final', winnerId: 'alice', pool }),
    settle.execute({ matchId: 'final', winnerId: 'alice', pool }),
  ]);
  assert(settlements.every((r) => r.ok), 'all settlement calls returned ok');
  assert((await repo.getBalance(escrowAccount('final'))) === 0, 'escrow drained exactly once');

  console.log('\n[3] Money conservation');
  const balances = await mongoose.connection
    .collection('balances')
    .find({})
    .toArray();
  const sum = balances.reduce((a, b) => a + (b.balance as number), 0);
  console.log('  -> account balances:', balances.map((b) => `${b._id}=${b.balance}`).join(', '));
  assert(sum === 0, 'sum of all account balances is 0 (money conserved)');

  console.log('\nALL WALLET INTEGRITY CHECKS PASSED ✅');
  await disconnectMongo();
}

main().catch((err: unknown) => {
  console.error('\nVERIFICATION FAILED ❌', err);
  process.exit(1);
});
