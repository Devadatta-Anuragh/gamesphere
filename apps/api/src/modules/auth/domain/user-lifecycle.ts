import type { User } from './user.js';

/**
 * Hook invoked after a brand-new user is registered. Auth owns this port but
 * does not know who reacts to it — the wallet module implements it to grant the
 * signup bonus. Implementations MUST NOT throw: registration succeeds
 * regardless of side-effects (they should be idempotent and self-healing).
 */
export interface UserLifecycleListener {
  onUserRegistered(user: User): Promise<void>;
}

export const NoopUserLifecycleListener: UserLifecycleListener = {
  async onUserRegistered() {
    /* no-op */
  },
};

/** Fans a registration out to several listeners; one failing never blocks the rest. */
export const composeUserLifecycleListeners = (
  ...listeners: UserLifecycleListener[]
): UserLifecycleListener => ({
  async onUserRegistered(user) {
    await Promise.all(
      listeners.map((l) => Promise.resolve(l.onUserRegistered(user)).catch(() => undefined)),
    );
  },
});
