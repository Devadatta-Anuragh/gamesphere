import type { UserId } from '@gamesphere/shared';

export const DEFAULT_RATING = 1000;

/**
 * The User aggregate. Note there is NO `walletBalance` field here even though
 * the PRD lists one: balance is derived from the wallet ledger (see the wallet
 * module), never stored as mutable state on the user. Keeping it off the
 * aggregate prevents it from drifting out of sync with the source of truth.
 */
export interface User {
  readonly id: UserId;
  readonly username: string;
  readonly avatar: string;
  readonly rating: number;
  readonly createdAt: Date;
}

export interface CreateUserInput {
  readonly id: UserId;
  readonly username: string;
  readonly avatar?: string;
  readonly rating?: number;
  readonly createdAt: Date;
}

export const createUser = (input: CreateUserInput): User => ({
  id: input.id,
  username: input.username,
  avatar: input.avatar ?? input.username,
  rating: input.rating ?? DEFAULT_RATING,
  createdAt: input.createdAt,
});
