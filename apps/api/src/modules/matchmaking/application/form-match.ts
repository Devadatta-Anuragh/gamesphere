import { asMatchId, asRoomId, asUserId, money } from '@gamesphere/shared';
import { DomainEventType } from '@gamesphere/shared';
import { err, ok, type Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import type { Clock } from '@/shared/clock.js';
import type { IdGenerator } from '@/shared/id-generator.js';
import type { EventPublisher } from '@/modules/events/domain/event-bus.js';
import { MatchStatus, type Match } from '../domain/match.js';
import type { MatchRepository } from '../domain/match-repository.js';
import type { MatchmakingQueue, QueuedPlayer } from '../domain/matchmaking-queue.js';
import type { StakeService } from './ports.js';

/**
 * Turns a paired set of players into a real match. Collecting two separate
 * stakes is a small saga: if the first player cannot pay we drop them and
 * re-queue the second; if the second cannot pay we REFUND the first (the
 * compensating action) and re-queue them. Only when both stakes are escrowed do
 * we persist the match and announce MATCH_CREATED — so a match never exists
 * with an unfunded pool.
 */
export class FormMatch {
  constructor(
    private readonly queue: MatchmakingQueue,
    private readonly stake: StakeService,
    private readonly matches: MatchRepository,
    private readonly events: EventPublisher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    pair: readonly [QueuedPlayer, QueuedPlayer],
    entryFee: number,
  ): Promise<Result<Match, AppError>> {
    const [p0, p1] = pair;
    const matchId = this.ids.generate();
    const fee = money(entryFee);

    const hold0 = await this.stake.hold(p0.userId, matchId, fee);
    if (!hold0.ok) {
      await this.queue.release([p0.userId, p1.userId]);
      await this.queue.enqueue(p1.userId, p1.rating, entryFee); // give p1 another match
      return err(hold0.error);
    }

    const hold1 = await this.stake.hold(p1.userId, matchId, fee);
    if (!hold1.ok) {
      await this.stake.refund(p0.userId, matchId, fee); // compensate p0
      await this.queue.release([p0.userId, p1.userId]);
      await this.queue.enqueue(p0.userId, p0.rating, entryFee);
      return err(hold1.error);
    }

    const match: Match = {
      id: matchId,
      roomId: matchId,
      players: [
        { userId: p0.userId, seat: 0 },
        { userId: p1.userId, seat: 1 },
      ],
      entryFee: fee,
      pool: money(entryFee * 2),
      status: MatchStatus.Pending,
      winnerId: null,
      createdAt: this.clock.now(),
    };
    await this.matches.create(match);

    await this.events.publish({
      type: DomainEventType.MatchCreated,
      occurredAt: this.clock.now().toISOString(),
      payload: {
        matchId: asMatchId(matchId),
        roomId: asRoomId(matchId),
        players: [asUserId(p0.userId), asUserId(p1.userId)],
        entryFee: fee,
      },
    });

    return ok(match);
  }
}
