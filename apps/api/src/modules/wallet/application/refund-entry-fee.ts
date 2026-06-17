import type { Money } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import { err, ok } from '@/shared/result.js';
import { AppError } from '@/shared/errors.js';
import type { IdGenerator } from '@/shared/id-generator.js';
import { Movements, TransactionType } from '../domain/transaction.js';
import type { WalletRepository } from '../domain/wallet-repository.js';

export interface RefundEntryFeeCommand {
  readonly userId: string;
  readonly matchId: string;
  readonly amount: Money;
}

/**
 * Returns a player's staked entry fee from escrow back to their balance when a
 * match is abandoned/cancelled before a result. Idempotent per (match, user).
 */
export class RefundEntryFee {
  constructor(
    private readonly wallet: WalletRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(cmd: RefundEntryFeeCommand): Promise<Result<void, AppError>> {
    const outcome = await this.wallet.commit({
      id: this.ids.generate(),
      type: TransactionType.Refund,
      idempotencyKey: `refund:${cmd.matchId}:${cmd.userId}`,
      entries: Movements.refund(cmd.userId, cmd.matchId, cmd.amount),
      metadata: { matchId: cmd.matchId, userId: cmd.userId },
    });

    switch (outcome.status) {
      case 'committed':
      case 'duplicate':
        return ok(undefined);
      case 'guard_failed':
        // Escrow lacks the funds → already settled or refunded.
        return err(
          AppError.conflict('REFUND_UNAVAILABLE', 'Escrow has no funds to refund', {
            matchId: cmd.matchId,
          }),
        );
    }
  }
}
