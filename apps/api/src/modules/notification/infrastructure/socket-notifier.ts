import {
  DomainEventType,
  type GameEndedEvent,
  type LeaderboardUpdatedEvent,
  type MatchCreatedEvent,
} from '@gamesphere/shared';
import type { EventSubscriber } from '@/modules/events/domain/event-bus.js';
import type { GameGateway } from '@/modules/game/domain/game-gateway.js';

/**
 * Turns domain events into realtime client notifications. Subscribing to the
 * bus (rather than being called directly) keeps notifications fully decoupled
 * from matchmaking/game/leaderboard — they just emit events.
 */
export class SocketNotifier {
  constructor(
    private readonly subscriber: EventSubscriber,
    private readonly gateway: GameGateway,
  ) {}

  register(): void {
    this.subscriber.subscribe(DomainEventType.MatchCreated, (event) => {
      const { matchId, players } = (event as MatchCreatedEvent).payload;
      for (const userId of players) {
        this.gateway.toUser(userId, 'notify', { type: 'match_found', matchId });
      }
    });

    this.subscriber.subscribe(DomainEventType.GameEnded, (event) => {
      const { matchId, winnerId } = (event as GameEndedEvent).payload;
      this.gateway.toRoom(matchId, 'notify', { type: 'game_ended', winnerId });
    });

    this.subscriber.subscribe(DomainEventType.LeaderboardUpdated, (event) => {
      const { userId, rating } = (event as LeaderboardUpdatedEvent).payload;
      this.gateway.toUser(userId, 'notify', { type: 'rank_changed', rating });
    });
  }
}
