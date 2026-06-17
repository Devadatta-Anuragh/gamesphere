import type { Money } from '@gamesphere/shared';
import { ok, type Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import { userAccount } from '../domain/account.js';
import type { LedgerEntry } from '../domain/ledger.js';
import type { WalletRepository } from '../domain/wallet-repository.js';

export interface WalletView {
  readonly balance: Money;
  readonly entries: readonly LedgerEntry[];
}

const HISTORY_LIMIT = 50;

/** Read model for the wallet screen: current balance + recent ledger entries. */
export class GetWallet {
  constructor(private readonly wallet: WalletRepository) {}

  async execute(userId: string): Promise<Result<WalletView, AppError>> {
    const [balance, entries] = await Promise.all([
      this.wallet.getBalance(userAccount(userId)),
      this.wallet.listUserEntries(userId, HISTORY_LIMIT),
    ]);
    return ok({ balance, entries });
  }
}
