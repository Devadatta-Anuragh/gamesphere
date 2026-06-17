import type { UserId } from '@gamesphere/shared';

/**
 * Augments Express' Request with the authenticated user id set by the auth
 * guard. Importing this module anywhere makes the typing visible app-wide.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required to merge into Express types
  namespace Express {
    interface Request {
      userId?: UserId;
    }
  }
}

export {};
