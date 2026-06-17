import type { User } from '@/modules/auth/domain/user.js';
import type { UserLifecycleListener } from '@/modules/auth/domain/user-lifecycle.js';
import type { LeaderboardStore } from '../domain/leaderboard-store.js';

/**
 * Seeds a newly-registered player into the leaderboard at their starting rating
 * (implements the auth lifecycle port — registration stays unaware of us).
 */
export class LeaderboardSeeder implements UserLifecycleListener {
  constructor(private readonly store: LeaderboardStore) {}

  async onUserRegistered(user: User): Promise<void> {
    await this.store.setScore(user.id, user.rating);
  }
}
