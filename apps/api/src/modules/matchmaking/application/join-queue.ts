import { asUserId, gte, money } from '@gamesphere/shared';
import { DomainEventType } from '@gamesphere/shared';
import { err, ok, type Result } from '@/shared/result.js';
import { AppError } from '@/shared/errors.js';
import type { Clock } from '@/shared/clock.js';
import type { EventPublisher } from '@/modules/events/domain/event-bus.js';
import type { MatchmakingQueue } from '../domain/matchmaking-queue.js';
import { isSupportedTier } from '../domain/tiers.js';
import type { BalanceReader, PlayerProfileReader } from './ports.js';

/**
 * Validates that the player can afford the stake, then atomically enqueues them
 * for the tier. The balance check here is advisory — the authoritative debit
 * happens at match formation (escrow), which is what actually prevents
 * overdraft. Publishes USER_JOINED_QUEUE for observers.
 */
export class JoinQueue {
  constructor(
    private readonly queue: MatchmakingQueue,
    private readonly balances: BalanceReader,
    private readonly profiles: PlayerProfileReader,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    entryFee: number,
  ): Promise<Result<{ status: 'queued' }, AppError>> {
    if (!isSupportedTier(entryFee)) {
      return err(AppError.validation('INVALID_TIER', 'Unsupported entry fee'));
    }

    const rating = await this.profiles.ratingOf(userId);
    if (rating === null) {
      return err(AppError.notFound('USER_NOT_FOUND', 'User not found'));
    }

    const balance = await this.balances.available(userId);
    if (!gte(balance, money(entryFee))) {
      return err(
        AppError.unprocessable('INSUFFICIENT_FUNDS', 'Balance below entry fee'),
      );
    }

    const result = await this.queue.enqueue(userId, rating, entryFee);
    if (result === 'already_active') {
      return err(
        AppError.conflict('ALREADY_ACTIVE', 'Already in a queue or match'),
      );
    }

    await this.events.publish({
      type: DomainEventType.UserJoinedQueue,
      occurredAt: this.clock.now().toISOString(),
      payload: { userId: asUserId(userId), rating, entryFee: money(entryFee) },
    });
    return ok({ status: 'queued' });
  }
}
