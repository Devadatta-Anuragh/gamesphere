import { isPositive, type Money } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import { err, ok } from '@/shared/result.js';
import { AppError } from '@/shared/errors.js';
import type { IdGenerator } from '@/shared/id-generator.js';
import { AccountType } from '../domain/account.js';
import { Movements, TransactionType } from '../domain/transaction.js';
import type { WalletRepository } from '../domain/wallet-repository.js';

export interface HoldEntryFeeCommand {
  readonly userId: string;
  readonly matchId: string;
  readonly amount: Money;
}

/**
 * Moves a player's stake from their balance into the match escrow pool when a
 * match is formed. Returns INSUFFICIENT_FUNDS if they cannot cover the fee.
 * Idempotent per (match, user) so a retried match-join never double-charges.
 */
export class HoldEntryFee {
  constructor(
    private readonly wallet: WalletRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(cmd: HoldEntryFeeCommand): Promise<Result<void, AppError>> {
    if (!isPositive(cmd.amount)) {
      return err(AppError.validation('INVALID_AMOUNT', 'Entry fee must be positive'));
    }

    const outcome = await this.wallet.commit({
      id: this.ids.generate(),
      type: TransactionType.Stake,
      idempotencyKey: `stake:${cmd.matchId}:${cmd.userId}`,
      entries: Movements.stake(cmd.userId, cmd.matchId, cmd.amount),
      metadata: { matchId: cmd.matchId, userId: cmd.userId },
    });

    switch (outcome.status) {
      case 'committed':
      case 'duplicate':
        return ok(undefined);
      case 'guard_failed':
        // The only guarded debit here is the user's balance.
        return err(
          outcome.account.type === AccountType.User
            ? AppError.unprocessable('INSUFFICIENT_FUNDS', 'Insufficient balance for entry fee')
            : AppError.internal('STAKE_FAILED', 'Unexpected guard failure'),
        );
    }
  }
}
