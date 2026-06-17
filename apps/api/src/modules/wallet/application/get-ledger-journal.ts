import { ok, type Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import type {
  LedgerTransactionView,
  WalletRepository,
} from '../domain/wallet-repository.js';

const DEFAULT_LIMIT = 25;

/**
 * Returns recent transactions with all of their legs so the UI can render the
 * double-entry journal as transfers (EXTERNAL → USER, USER → ESCROW, ...).
 */
export class GetLedgerJournal {
  constructor(private readonly wallet: WalletRepository) {}

  async execute(
    userId: string,
    limit = DEFAULT_LIMIT,
  ): Promise<Result<LedgerTransactionView[], AppError>> {
    return ok(await this.wallet.listRecentTransactions(userId, limit));
  }
}
