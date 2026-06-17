import { DomainEventType, type GameEndedEvent } from '@gamesphere/shared';
import type { Clock } from '@/shared/clock.js';
import type { Logger } from '@/shared/logger.js';
import type { IdGenerator } from '@/shared/id-generator.js';
import type { EventSubscriber } from '@/modules/events/domain/event-bus.js';
import {
  PlayerEventType,
  type PlayerEvent,
  type PlayerEventRepository,
} from '../domain/player-event.js';

/** Count leading consecutive wins in a newest-first list of result events. */
const leadingWinStreak = (events: readonly PlayerEvent[]): number => {
  let streak = 0;
  for (const e of events) {
    if (e.type === PlayerEventType.MatchWon) streak += 1;
    else if (e.type === PlayerEventType.MatchLost) break;
    // SuspiciousStreak markers are ignored when counting.
  }
  return streak;
};

/**
 * Records per-player game outcomes to an append-only event log and flags
 * abnormal win streaks. This is a lightweight, observable foundation for
 * anti-cheat — the same event log can feed richer offline analysis later.
 */
export class AntiCheatMonitor {
  constructor(
    private readonly events: PlayerEventRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly streakThreshold = 5,
  ) {}

  register(subscriber: EventSubscriber): void {
    subscriber.subscribe(DomainEventType.GameEnded, (event) =>
      this.onGameEnded(event as GameEndedEvent),
    );
  }

  private async record(
    userId: string,
    type: PlayerEventType,
    matchId: string | null,
  ): Promise<void> {
    await this.events.record({
      id: this.ids.generate(),
      userId,
      type,
      matchId,
      createdAt: this.clock.now(),
    });
  }

  async onGameEnded(event: GameEndedEvent): Promise<void> {
    const { winnerId, players, matchId } = event.payload;
    if (!winnerId) return;
    const loserId = players.find((p) => p !== winnerId) ?? null;

    await this.record(winnerId, PlayerEventType.MatchWon, matchId);
    if (loserId) await this.record(loserId, PlayerEventType.MatchLost, matchId);

    const recent = await this.events.recent(winnerId, this.streakThreshold + 2);
    const streak = leadingWinStreak(recent);
    if (streak === this.streakThreshold) {
      await this.record(winnerId, PlayerEventType.SuspiciousStreak, matchId);
      this.logger.warn(
        { userId: winnerId, streak },
        'anti-cheat: abnormal win streak flagged',
      );
    }
  }
}
