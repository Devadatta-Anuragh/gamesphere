import { describe, expect, it } from 'vitest';
import { applyElo, FLOOR_RATING } from '@/modules/leaderboard/domain/elo.js';
import { GetLeaderboard } from '@/modules/leaderboard/application/get-leaderboard.js';
import type {
  LeaderboardStore,
  RankedPlayer,
} from '@/modules/leaderboard/domain/leaderboard-store.js';

describe('Elo', () => {
  it('equal ratings shift by half the K-factor on a decisive game', () => {
    const { a, b } = applyElo(1000, 1000, true);
    expect(a).toBe(1016);
    expect(b).toBe(984);
  });

  it('beating a stronger player gains more than beating a weaker one', () => {
    const upset = applyElo(1000, 1600, true).a - 1000;
    const expected = applyElo(1600, 1000, true).a - 1600;
    expect(upset).toBeGreaterThan(expected);
  });

  it('never drops a rating below the floor', () => {
    const { a } = applyElo(FLOOR_RATING, 2400, false);
    expect(a).toBeGreaterThanOrEqual(FLOOR_RATING);
  });
});

class InMemoryLeaderboard implements LeaderboardStore {
  private readonly scores = new Map<string, number>();
  async setScore(userId: string, rating: number) {
    this.scores.set(userId, rating);
  }
  async top(_scope: 'global' | 'daily' | 'weekly', limit: number): Promise<RankedPlayer[]> {
    return [...this.scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([userId, rating], i) => ({ userId, rating, rank: i + 1 }));
  }
  async rank() {
    return null;
  }
}

describe('GetLeaderboard', () => {
  it('returns top players in rank order, enriched with usernames', async () => {
    const store = new InMemoryLeaderboard();
    await store.setScore('u1', 1200);
    await store.setScore('u2', 1500);
    await store.setScore('u3', 900);

    const profiles = {
      rating: async () => null,
      setRating: async () => {},
      profile: async (id: string) => ({ username: `name-${id}`, rating: 0 }),
    };

    const result = await new GetLeaderboard(store, profiles).execute('global', 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((e) => e.userId)).toEqual(['u2', 'u1', 'u3']);
      expect(result.value[0]).toMatchObject({ rank: 1, username: 'name-u2', rating: 1500 });
    }
  });
});
