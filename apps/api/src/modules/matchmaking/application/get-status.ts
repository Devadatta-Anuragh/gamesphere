import { ok, type Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import type { Match } from '../domain/match.js';
import type { MatchRepository } from '../domain/match-repository.js';
import type { MatchmakingQueue } from '../domain/matchmaking-queue.js';
import { ENTRY_FEE_TIERS } from '../domain/tiers.js';

export interface MatchmakingStatus {
  /** The user's active match if they have been paired, else null. */
  readonly match: Match | null;
  /** Entry-fee tiers the user is currently waiting in. */
  readonly queuedTiers: number[];
}

/** Read model for the lobby: am I matched, or still waiting (and where)? */
export class GetMatchmakingStatus {
  constructor(
    private readonly matches: MatchRepository,
    private readonly queue: MatchmakingQueue,
  ) {}

  async execute(userId: string): Promise<Result<MatchmakingStatus, AppError>> {
    const match = await this.matches.findActiveForUser(userId);
    if (match) return ok({ match, queuedTiers: [] });

    const flags = await Promise.all(
      ENTRY_FEE_TIERS.map((fee) => this.queue.isQueued(userId, fee)),
    );
    const queuedTiers = ENTRY_FEE_TIERS.filter((_, i) => flags[i]).map(Number);
    return ok({ match: null, queuedTiers });
  }
}
