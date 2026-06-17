import type { UserId } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import { err, ok } from '@/shared/result.js';
import { AppError } from '@/shared/errors.js';
import type { UserRepository } from '../domain/user-repository.js';
import type { User } from '../domain/user.js';

/**
 * Returns the core user aggregate. Wallet balance is intentionally NOT included
 * here — the wallet module owns that and the HTTP layer composes the two so
 * each module stays responsible for exactly one thing (SRP).
 */
export class GetProfile {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: UserId): Promise<Result<User, AppError>> {
    const user = await this.users.findById(userId);
    if (!user) {
      return err(AppError.notFound('USER_NOT_FOUND', 'User not found'));
    }
    return ok(user);
  }
}
