import {
  DomainEventType,
  asUserId,
  type GameEndedEvent,
} from '@gamesphere/shared';
import type { Clock } from '@/shared/clock.js';
import type { EventPublisher } from '@/modules/events/domain/event-bus.js';
import { applyElo } from '../domain/elo.js';
import type { LeaderboardStore } from '../domain/leaderboard-store.js';
import type { PlayerProfiles } from './ports.js';

/**
 * Reacts to GAME_ENDED: recomputes both players' Elo ratings, persists them, and
 * refreshes the leaderboard sorted sets. Decoupled from the game module — it
 * only knows the event contract. Publishes LEADERBOARD_UPDATED so the UI can
 * live-refresh rankings.
 */
export class UpdateRatingsOnGameEnded {
  constructor(
    private readonly profiles: PlayerProfiles,
    private readonly store: LeaderboardStore,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async handle(event: GameEndedEvent): Promise<void> {
    const { winnerId, players } = event.payload;
    if (!winnerId) return; // no rating change for an unresolved match
    const loserId = players.find((p) => p !== winnerId);
    if (!loserId) return;

    const [rw, rl] = await Promise.all([
      this.profiles.rating(winnerId),
      this.profiles.rating(loserId),
    ]);
    if (rw === null || rl === null) return;

    const { a: newWinner, b: newLoser } = applyElo(rw, rl, true);

    await Promise.all([
      this.profiles.setRating(winnerId, newWinner),
      this.profiles.setRating(loserId, newLoser),
      this.store.setScore(winnerId, newWinner),
      this.store.setScore(loserId, newLoser),
    ]);

    const occurredAt = this.clock.now().toISOString();
    await Promise.all([
      this.events.publish({
        type: DomainEventType.LeaderboardUpdated,
        occurredAt,
        payload: { userId: asUserId(winnerId), rating: newWinner },
      }),
      this.events.publish({
        type: DomainEventType.LeaderboardUpdated,
        occurredAt,
        payload: { userId: asUserId(loserId), rating: newLoser },
      }),
    ]);
  }
}
