import mongoose from 'mongoose';
import { money, type Money } from '@gamesphere/shared';
import type { Clock } from '@/shared/clock.js';
import type { IdGenerator } from '@/shared/id-generator.js';
import {
  AccountType,
  accountKey,
  isGuarded,
  type AccountRef,
} from '../domain/account.js';
import type { LedgerEntry } from '../domain/ledger.js';
import { netDeltas, type Transaction } from '../domain/transaction.js';
import type {
  CommitOutcome,
  WalletRepository,
} from '../domain/wallet-repository.js';
import {
  BalanceModel,
  LedgerEntryModel,
  TransactionModel,
  type LedgerEntryDoc,
} from './wallet.models.js';

const MONGO_DUPLICATE_KEY = 11000;

// Sentinels used to unwind the Mongo transaction with a typed outcome.
class DuplicateTransaction extends Error {}
class GuardViolation extends Error {
  constructor(readonly account: AccountRef) {
    super('guard violation');
  }
}

const isDuplicateKey = (e: unknown): boolean =>
  typeof e === 'object' &&
  e !== null &&
  'code' in e &&
  (e as { code?: number }).code === MONGO_DUPLICATE_KEY;

/**
 * Atomic, idempotent, double-entry persistence. A single Mongo multi-document
 * transaction (1) inserts the transaction header — whose unique idempotencyKey
 * makes replays no-ops, (2) applies each account's net delta, using a guarded
 * conditional decrement on USER/ESCROW accounts so they can never go negative
 * and concurrent debits cannot double-spend, and (3) appends the journal
 * entries. If any guard fails the whole transaction rolls back.
 */
export class MongoWalletRepository implements WalletRepository {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async getBalance(account: AccountRef): Promise<Money> {
    const doc = await BalanceModel.findById(accountKey(account)).lean().exec();
    return money(doc?.balance ?? 0);
  }

  async commit(tx: Transaction): Promise<CommitOutcome> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const now = this.clock.now();

        // (1) Idempotency guard — a duplicate key means this already happened.
        try {
          await TransactionModel.create(
            [
              {
                _id: tx.id,
                type: tx.type,
                idempotencyKey: tx.idempotencyKey,
                ...(tx.metadata ? { metadata: tx.metadata } : {}),
                createdAt: now,
              },
            ],
            { session },
          );
        } catch (e) {
          if (isDuplicateKey(e)) throw new DuplicateTransaction();
          throw e;
        }

        // (2) Apply net balance deltas with the no-negative guard.
        for (const { account, delta } of netDeltas(tx.entries).values()) {
          if (delta === 0) continue;
          const key = accountKey(account);

          if (isGuarded(account.type) && delta < 0) {
            const res = await BalanceModel.updateOne(
              { _id: key, balance: { $gte: -delta } },
              { $inc: { balance: delta }, $set: { updatedAt: now } },
              { session },
            );
            if (res.matchedCount === 0) throw new GuardViolation(account);
          } else {
            await BalanceModel.updateOne(
              { _id: key },
              {
                $inc: { balance: delta },
                $set: { updatedAt: now },
                $setOnInsert: {
                  accountType: account.type,
                  accountRef: account.ref,
                },
              },
              { upsert: true, session },
            );
          }
        }

        // (3) Append the immutable journal entries.
        const entryDocs = tx.entries.map((e) => ({
          _id: this.ids.generate(),
          transactionId: tx.id,
          accountType: e.account.type,
          accountRef: e.account.ref,
          direction: e.direction,
          reason: e.reason,
          amount: e.amount,
          createdAt: now,
        }));
        await LedgerEntryModel.insertMany(entryDocs, { session });
      });

      return { status: 'committed' };
    } catch (e) {
      if (e instanceof DuplicateTransaction) return { status: 'duplicate' };
      if (e instanceof GuardViolation) {
        return { status: 'guard_failed', account: e.account };
      }
      throw e;
    } finally {
      await session.endSession();
    }
  }

  async listUserEntries(userId: string, limit: number): Promise<LedgerEntry[]> {
    const docs = await LedgerEntryModel.find({
      accountType: AccountType.User,
      accountRef: userId,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<LedgerEntryDoc[]>()
      .exec();

    return docs.map((d) => ({
      id: d._id,
      transactionId: d.transactionId,
      account: { type: d.accountType, ref: d.accountRef },
      direction: d.direction,
      reason: d.reason,
      amount: money(d.amount),
      createdAt: d.createdAt,
    }));
  }
}
