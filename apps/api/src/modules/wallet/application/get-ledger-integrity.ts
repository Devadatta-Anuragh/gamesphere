import { ok, type Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import type {
  AccountTypeBalance,
  WalletRepository,
} from '../domain/wallet-repository.js';

export interface LedgerIntegrity {
  readonly total: number;
  readonly byAccountType: readonly AccountTypeBalance[];
  readonly conserved: boolean;
}

/**
 * Proves money conservation: the sum of every account's balance must be 0
 * (deposits make EXTERNAL negative by exactly what entered the system). The
 * headline correctness statement for the wallet screen.
 */
export class GetLedgerIntegrity {
  constructor(private readonly wallet: WalletRepository) {}

  async execute(): Promise<Result<LedgerIntegrity, AppError>> {
    const byAccountType = await this.wallet.sumByAccountType();
    const total = byAccountType.reduce((sum, a) => sum + a.balance, 0);
    return ok({ total, byAccountType, conserved: total === 0 });
  }
}
