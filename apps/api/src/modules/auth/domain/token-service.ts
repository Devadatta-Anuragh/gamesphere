import type { UserId } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';

/**
 * Port for issuing/verifying auth tokens. Keeping it abstract means the JWT
 * library never leaks into use-case or transport code, and tests can swap in a
 * trivial in-memory token service.
 */
export interface TokenService {
  issue(userId: UserId): string;
  verify(token: string): Result<UserId, AppError>;
}
