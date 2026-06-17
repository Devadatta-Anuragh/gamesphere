import { ok, type Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import type { MatchmakingQueue } from '../domain/matchmaking-queue.js';

/** Removes a waiting player from a tier's queue. */
export class LeaveQueue {
  constructor(private readonly queue: MatchmakingQueue) {}

  async execute(userId: string, entryFee: number): Promise<Result<void, AppError>> {
    await this.queue.leave(userId, entryFee);
    return ok(undefined);
  }
}
