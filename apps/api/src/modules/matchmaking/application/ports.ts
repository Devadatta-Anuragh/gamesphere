import type { Money } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';

/** What matchmaking needs from the wallet — narrow by design (ISP). */
export interface StakeService {
  hold(userId: string, matchId: string, amount: Money): Promise<Result<void, AppError>>;
  refund(userId: string, matchId: string, amount: Money): Promise<Result<void, AppError>>;
}

export interface BalanceReader {
  available(userId: string): Promise<Money>;
}

export interface PlayerProfileReader {
  ratingOf(userId: string): Promise<number | null>;
}
