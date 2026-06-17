export interface QueuedPlayer {
  readonly userId: string;
  readonly rating: number;
}

export type EnqueueResult = 'queued' | 'already_active';

/**
 * The matchmaking queue port. Implementations MUST make `enqueue` and
 * `tryFormPair` atomic so that (a) a player cannot be double-queued or queued
 * while already in a match, and (b) two concurrent workers can never pull the
 * same player into two different matches.
 */
export interface MatchmakingQueue {
  /** Adds a player to the tier's queue, unless already queued or in a match. */
  enqueue(
    userId: string,
    rating: number,
    entryFee: number,
  ): Promise<EnqueueResult>;

  /** Atomically removes and returns the two closest-rated waiting players. */
  tryFormPair(entryFee: number): Promise<[QueuedPlayer, QueuedPlayer] | null>;

  /** Removes a player from a tier's queue (voluntary leave). */
  leave(userId: string, entryFee: number): Promise<void>;

  /** Clears the "in a match" marker for players when their match ends. */
  release(userIds: readonly string[]): Promise<void>;

  size(entryFee: number): Promise<number>;
  isQueued(userId: string, entryFee: number): Promise<boolean>;
}
