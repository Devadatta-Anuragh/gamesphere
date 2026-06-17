import type { Money } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import { err, ok } from '@/shared/result.js';
import { AppError } from '@/shared/errors.js';
import type { IdGenerator } from '@/shared/id-generator.js';
import { Movements, TransactionType } from '../domain/transaction.js';
import type { WalletRepository } from '../domain/wallet-repository.js';

export interface SettleMatchCommand {
  readonly matchId: string;
  readonly winnerId: string;
  /** Total escrow pool to distribute (Σ entry fees of all seats). */
  readonly pool: Money;
}

export interface SettlementResult {
  readonly winnings: Money;
  readonly rake: Money;
}

/**
 * Pays out a finished match: the escrow pool is split into the winner's
 * winnings (pool − rake) and the house rake, in one atomic transaction.
 * Idempotent per match (`settle:<matchId>`), so a duplicated GAME_ENDED event
 * can never pay a winner twice. The rake (basis points) is injected, not
 * hard-coded, so the house cut is configurable.
 */
export class SettleMatch {
  constructor(
    private readonly wallet: WalletRepository,
    private readonly ids: IdGenerator,
    private readonly rakeBps: number,
  ) {}

  async execute(
    cmd: SettleMatchCommand,
  ): Promise<Result<SettlementResult, AppError>> {
    const { entries, rake, winnings } = Movements.settlement(
      cmd.winnerId,
      cmd.matchId,
      cmd.pool,
      this.rakeBps,
    );

    const outcome = await this.wallet.commit({
      id: this.ids.generate(),
      type: TransactionType.Settlement,
      idempotencyKey: `settle:${cmd.matchId}`,
      entries,
      metadata: { matchId: cmd.matchId, winnerId: cmd.winnerId },
    });

    switch (outcome.status) {
      case 'committed':
      case 'duplicate':
        return ok({ winnings, rake });
      case 'guard_failed':
        return err(
          AppError.conflict('SETTLEMENT_POOL_MISMATCH', 'Escrow pool does not cover payout', {
            matchId: cmd.matchId,
          }),
        );
    }
  }
}
