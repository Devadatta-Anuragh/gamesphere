import type { Match, MatchStatus } from './match.js';

export interface MatchRepository {
  create(match: Match): Promise<void>;
  findById(matchId: string): Promise<Match | null>;
  /** The user's match that is still pending or active, if any. */
  findActiveForUser(userId: string): Promise<Match | null>;
  setStatus(matchId: string, status: MatchStatus): Promise<void>;
  setResult(matchId: string, winnerId: string | null, status: MatchStatus): Promise<void>;
  /** Most recent matches, for the ops dashboard. */
  listRecent(limit: number): Promise<Match[]>;
}
