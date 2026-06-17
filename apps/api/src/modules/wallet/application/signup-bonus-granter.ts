import { money, type Money } from '@gamesphere/shared';
import type { Logger } from '@/shared/logger.js';
import type { User } from '@/modules/auth/domain/user.js';
import type { UserLifecycleListener } from '@/modules/auth/domain/user-lifecycle.js';
import { EntryReason } from '../domain/ledger.js';
import type { CreditFunds } from './credit-funds.js';

/**
 * Wallet-side implementation of the auth `UserLifecycleListener` port: grants a
 * one-time signup bonus when a user registers. The idempotency key `bonus:<id>`
 * guarantees a user can only ever receive it once, even on retries.
 */
export class SignupBonusGranter implements UserLifecycleListener {
  constructor(
    private readonly credit: CreditFunds,
    private readonly bonusAmount: Money,
    private readonly logger: Logger,
  ) {}

  async onUserRegistered(user: User): Promise<void> {
    if (this.bonusAmount <= 0) return;
    const result = await this.credit.execute({
      userId: user.id,
      amount: money(this.bonusAmount),
      reason: EntryReason.SignupBonus,
      idempotencyKey: `bonus:${user.id}`,
    });
    if (!result.ok) {
      // Never fail registration over a bonus; just record it.
      this.logger.warn(
        { userId: user.id, code: result.error.code },
        'Failed to grant signup bonus',
      );
    }
  }
}
