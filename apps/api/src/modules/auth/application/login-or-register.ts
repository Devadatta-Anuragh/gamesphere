import { asUserId } from '@gamesphere/shared';
import type { Result } from '@/shared/result.js';
import { err, ok } from '@/shared/result.js';
import { AppError, isAppError } from '@/shared/errors.js';
import type { Clock } from '@/shared/clock.js';
import type { IdGenerator } from '@/shared/id-generator.js';
import type { UserRepository } from '../domain/user-repository.js';
import type { TokenService } from '../domain/token-service.js';
import {
  NoopUserLifecycleListener,
  type UserLifecycleListener,
} from '../domain/user-lifecycle.js';
import { createUser, type User } from '../domain/user.js';

export interface LoginOrRegisterResult {
  readonly user: User;
  readonly token: string;
  readonly created: boolean;
}

/**
 * Lightweight auth for demos: a username is enough. If the user exists we log
 * them in; otherwise we register them. The unique index on `username` is the
 * real concurrency guard — if two requests race to create the same name, one
 * insert fails and we fall back to a fetch, so the operation is idempotent.
 */
export class LoginOrRegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly onRegistered: UserLifecycleListener = NoopUserLifecycleListener,
  ) {}

  async execute(
    username: string,
  ): Promise<Result<LoginOrRegisterResult, AppError>> {
    const existing = await this.users.findByUsername(username);
    if (existing) {
      return ok({ user: existing, token: this.tokens.issue(existing.id), created: false });
    }

    const user = createUser({
      id: asUserId(this.ids.generate()),
      username,
      createdAt: this.clock.now(),
    });

    try {
      await this.users.insert(user);
    } catch (e) {
      // Lost a registration race: another request created this username first.
      if (isAppError(e) && e.code === 'USERNAME_TAKEN') {
        const winner = await this.users.findByUsername(username);
        if (winner) {
          return ok({ user: winner, token: this.tokens.issue(winner.id), created: false });
        }
      }
      return err(
        isAppError(e)
          ? e
          : AppError.internal('REGISTER_FAILED', 'Could not register user'),
      );
    }

    await this.onRegistered.onUserRegistered(user);
    return ok({ user, token: this.tokens.issue(user.id), created: true });
  }
}
