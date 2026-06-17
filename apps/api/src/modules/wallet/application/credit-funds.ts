import { isPositive, type Money } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import { err, ok } from '@/shared/result.js';
import { AppError } from '@/shared/errors.js';
import type { IdGenerator } from '@/shared/id-generator.js';
import { userAccount } from '../domain/account.js';
import { EntryReason } from '../domain/ledger.js';
import { Movements, TransactionType } from '../domain/transaction.js';
import type { WalletRepository } from '../domain/wallet-repository.js';

export interface CreditFundsCommand {
  readonly userId: string;
  readonly amount: Money;
  readonly reason: EntryReason.Deposit | EntryReason.SignupBonus;
  /** Caller-supplied dedupe key (e.g. a deposit reference) for idempotency. */
  readonly idempotencyKey: string;
}

/**
 * Credits a user's balance with money entering from outside the system
 * (a deposit or the signup bonus). Idempotent on `idempotencyKey`.
 */
export class CreditFunds {
  constructor(
    private readonly wallet: WalletRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(cmd: CreditFundsCommand): Promise<Result<{ balance: Money }, AppError>> {
    if (!isPositive(cmd.amount)) {
      return err(AppError.validation('INVALID_AMOUNT', 'Amount must be positive'));
    }

    const outcome = await this.wallet.commit({
      id: this.ids.generate(),
      type:
        cmd.reason === EntryReason.SignupBonus
          ? TransactionType.SignupBonus
          : TransactionType.Deposit,
      idempotencyKey: cmd.idempotencyKey,
      entries: Movements.externalCredit(cmd.userId, cmd.amount, cmd.reason),
      metadata: { userId: cmd.userId },
    });

    if (outcome.status === 'guard_failed') {
      return err(AppError.internal('CREDIT_FAILED', 'Unexpected guard failure'));
    }
    // committed or duplicate → reflect the current balance either way.
    const balance = await this.wallet.getBalance(userAccount(cmd.userId));
    return ok({ balance });
  }
}
