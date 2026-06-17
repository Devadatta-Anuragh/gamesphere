import { Schema, model } from 'mongoose';
import { AccountType } from '../domain/account.js';
import { EntryDirection, EntryReason } from '../domain/ledger.js';
import { TransactionType } from '../domain/transaction.js';

/** Immutable transaction header. The unique idempotencyKey enforces dedupe. */
export interface TransactionDoc {
  _id: string;
  type: TransactionType;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const transactionSchema = new Schema<TransactionDoc>(
  {
    _id: { type: String, required: true },
    type: { type: String, enum: Object.values(TransactionType), required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, _id: false },
);

/** Immutable journal entry (append-only). */
export interface LedgerEntryDoc {
  _id: string;
  transactionId: string;
  accountType: AccountType;
  accountRef: string;
  direction: EntryDirection;
  reason: EntryReason;
  amount: number;
  createdAt: Date;
}

const ledgerEntrySchema = new Schema<LedgerEntryDoc>(
  {
    _id: { type: String, required: true },
    transactionId: { type: String, required: true, index: true },
    accountType: { type: String, enum: Object.values(AccountType), required: true },
    accountRef: { type: String, required: true },
    direction: { type: String, enum: Object.values(EntryDirection), required: true },
    reason: { type: String, enum: Object.values(EntryReason), required: true },
    amount: { type: Number, required: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, _id: false },
);
// Fast lookup of a user's entries, newest first.
ledgerEntrySchema.index({ accountType: 1, accountRef: 1, createdAt: -1 });

/**
 * Materialized per-account balance. This is a PROJECTION of the journal kept
 * consistent within the same transaction; it is not an independent source of
 * truth. It also serves as the contention point that serializes concurrent
 * debits (a guarded conditional `$inc` prevents double-spend).
 */
export interface BalanceDoc {
  _id: string; // accountKey
  accountType: AccountType;
  accountRef: string;
  balance: number;
  updatedAt: Date;
}

const balanceSchema = new Schema<BalanceDoc>(
  {
    _id: { type: String, required: true },
    accountType: { type: String, enum: Object.values(AccountType), required: true },
    accountRef: { type: String, required: true },
    balance: { type: Number, required: true, default: 0 },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false, _id: false },
);

export const TransactionModel = model<TransactionDoc>(
  'Transaction',
  transactionSchema,
);
export const LedgerEntryModel = model<LedgerEntryDoc>(
  'LedgerEntry',
  ledgerEntrySchema,
);
export const BalanceModel = model<BalanceDoc>('Balance', balanceSchema);
