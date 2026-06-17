import { ok, type Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import type {
  LeaderboardScope,
  LeaderboardStore,
} from '../domain/leaderboard-store.js';
import type { PlayerProfiles } from './ports.js';

export interface LeaderboardEntry {
  readonly rank: number;
  readonly userId: string;
  readonly username: string;
  readonly rating: number;
}

/** Read model for the leaderboard screen: top-N enriched with usernames. */
export class GetLeaderboard {
  constructor(
    private readonly store: LeaderboardStore,
    private readonly profiles: PlayerProfiles,
  ) {}

  async execute(
    scope: LeaderboardScope,
    limit: number,
  ): Promise<Result<LeaderboardEntry[], AppError>> {
    const ranked = await this.store.top(scope, limit);
    const entries = await Promise.all(
      ranked.map(async (r) => {
        const profile = await this.profiles.profile(r.userId);
        return {
          rank: r.rank,
          userId: r.userId,
          username: profile?.username ?? r.userId,
          rating: r.rating,
        };
      }),
    );
    return ok(entries);
  }
}
