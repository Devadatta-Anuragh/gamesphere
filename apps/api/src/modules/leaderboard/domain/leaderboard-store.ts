export type LeaderboardScope = 'global' | 'daily' | 'weekly';

export interface RankedPlayer {
  readonly userId: string;
  readonly rating: number;
  readonly rank: number; // 1-based
}

/**
 * Ranking store backed by Redis sorted sets. A single `setScore` updates the
 * player across all scopes; reads come straight off the sorted set, so top-N
 * and rank lookups are O(log N) and effectively instant for live leaderboards.
 */
export interface LeaderboardStore {
  setScore(userId: string, rating: number): Promise<void>;
  top(scope: LeaderboardScope, limit: number): Promise<RankedPlayer[]>;
  rank(scope: LeaderboardScope, userId: string): Promise<number | null>;
}
