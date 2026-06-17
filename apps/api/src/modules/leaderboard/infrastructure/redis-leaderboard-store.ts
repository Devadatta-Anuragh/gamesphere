import type { Redis } from 'ioredis';
import type { Clock } from '@/shared/clock.js';
import type {
  LeaderboardScope,
  LeaderboardStore,
  RankedPlayer,
} from '../domain/leaderboard-store.js';

const GLOBAL_KEY = 'lb:global';

const dayKey = (d: Date): string => `lb:daily:${d.toISOString().slice(0, 10)}`;

const weekKey = (d: Date): string => {
  // ISO-week number.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `lb:weekly:${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

export class RedisLeaderboardStore implements LeaderboardStore {
  constructor(
    private readonly redis: Redis,
    private readonly clock: Clock,
  ) {}

  private keyFor(scope: LeaderboardScope): string {
    const now = this.clock.now();
    if (scope === 'daily') return dayKey(now);
    if (scope === 'weekly') return weekKey(now);
    return GLOBAL_KEY;
  }

  async setScore(userId: string, rating: number): Promise<void> {
    const now = this.clock.now();
    await this.redis
      .multi()
      .zadd(GLOBAL_KEY, rating, userId)
      .zadd(dayKey(now), rating, userId)
      .zadd(weekKey(now), rating, userId)
      .exec();
  }

  async top(scope: LeaderboardScope, limit: number): Promise<RankedPlayer[]> {
    const raw = await this.redis.zrevrange(
      this.keyFor(scope),
      0,
      limit - 1,
      'WITHSCORES',
    );
    const players: RankedPlayer[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      players.push({
        userId: raw[i]!,
        rating: Number(raw[i + 1]),
        rank: i / 2 + 1,
      });
    }
    return players;
  }

  async rank(scope: LeaderboardScope, userId: string): Promise<number | null> {
    const idx = await this.redis.zrevrank(this.keyFor(scope), userId);
    return idx === null ? null : idx + 1;
  }
}
