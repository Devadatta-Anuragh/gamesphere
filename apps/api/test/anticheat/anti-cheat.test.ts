import { describe, expect, it } from 'vitest';
import {
  DomainEventType,
  asMatchId,
  asRoomId,
  asUserId,
  type GameEndedEvent,
} from '@gamesphere/shared';
import { AntiCheatMonitor } from '@/modules/anticheat/application/anti-cheat-monitor.js';
import {
  PlayerEventType,
  type PlayerEvent,
  type PlayerEventRepository,
} from '@/modules/anticheat/domain/player-event.js';
import { FixedClock } from '@/shared/clock.js';
import { SequentialIdGenerator } from '@/shared/id-generator.js';
import { createLogger } from '@/shared/logger.js';

class InMemoryPlayerEvents implements PlayerEventRepository {
  readonly events: PlayerEvent[] = [];
  async record(event: PlayerEvent) {
    this.events.push(event);
  }
  async recent(userId: string, limit: number) {
    return this.events
      .filter((e) => e.userId === userId)
      .reverse()
      .slice(0, limit);
  }
}

const gameEnded = (winner: string, loser: string, n: number): GameEndedEvent => ({
  type: DomainEventType.GameEnded,
  occurredAt: new Date().toISOString(),
  payload: {
    matchId: asMatchId(`m${n}`),
    roomId: asRoomId(`m${n}`),
    winnerId: asUserId(winner),
    players: [asUserId(winner), asUserId(loser)],
  },
});

describe('AntiCheatMonitor', () => {
  it('records win/loss events and flags an abnormal win streak', async () => {
    const repo = new InMemoryPlayerEvents();
    const monitor = new AntiCheatMonitor(
      repo,
      new SequentialIdGenerator('e'),
      new FixedClock(1),
      createLogger('fatal', false),
      3, // flag at 3 consecutive wins
    );

    await monitor.onGameEnded(gameEnded('cheater', 'victim', 1));
    await monitor.onGameEnded(gameEnded('cheater', 'victim', 2));
    expect(
      repo.events.some((e) => e.type === PlayerEventType.SuspiciousStreak),
    ).toBe(false);

    await monitor.onGameEnded(gameEnded('cheater', 'victim', 3)); // 3rd win -> flag

    const cheaterEvents = repo.events.filter((e) => e.userId === 'cheater');
    expect(
      cheaterEvents.filter((e) => e.type === PlayerEventType.MatchWon),
    ).toHaveLength(3);
    expect(
      cheaterEvents.some((e) => e.type === PlayerEventType.SuspiciousStreak),
    ).toBe(true);
    // The loser's events were recorded too.
    expect(repo.events.some((e) => e.userId === 'victim' && e.type === PlayerEventType.MatchLost)).toBe(true);
  });

  it('resets the streak after a loss', async () => {
    const repo = new InMemoryPlayerEvents();
    const monitor = new AntiCheatMonitor(
      repo,
      new SequentialIdGenerator('e'),
      new FixedClock(1),
      createLogger('fatal', false),
      3,
    );

    await monitor.onGameEnded(gameEnded('p', 'q', 1));
    await monitor.onGameEnded(gameEnded('p', 'q', 2));
    await monitor.onGameEnded(gameEnded('q', 'p', 3)); // p loses -> streak broken
    await monitor.onGameEnded(gameEnded('p', 'q', 4));

    expect(
      repo.events.some(
        (e) => e.userId === 'p' && e.type === PlayerEventType.SuspiciousStreak,
      ),
    ).toBe(false);
  });
});
