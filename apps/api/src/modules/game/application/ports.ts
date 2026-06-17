import type { Money } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import type { VerifiableDiceRoller } from '../domain/dice-roller.js';

export interface MatchSeat {
  readonly userId: string;
  readonly seat: number;
}

export interface MatchInfo {
  readonly id: string;
  readonly entryFee: Money;
  readonly pool: Money;
  readonly players: readonly MatchSeat[];
  readonly status: string; // PENDING | ACTIVE | SETTLED | ABANDONED
}

/** Narrow view of the match store that the game module needs. */
export interface MatchGateway {
  load(matchId: string): Promise<MatchInfo | null>;
  markActive(matchId: string): Promise<void>;
  markResult(matchId: string, winnerId: string | null): Promise<void>;
}

/** Wallet settlement, as the game module sees it. */
export interface SettlementService {
  settle(
    matchId: string,
    winnerId: string,
    pool: Money,
  ): Promise<Result<{ winnings: Money; rake: Money }, AppError>>;
}

/** Clears matchmaking's "in a match" flag when a game ends. */
export interface ActivePlayersReleaser {
  release(userIds: readonly string[]): Promise<void>;
}

/** Builds a fresh authoritative dice source for a new match. */
export type DiceRollerFactory = () => VerifiableDiceRoller;

/** Resolves a player's display name so the UI never shows raw user ids. */
export interface UserDirectory {
  usernameOf(userId: string): Promise<string | null>;
}
