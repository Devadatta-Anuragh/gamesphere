import type { Redis } from 'ioredis';
import type {
  EnqueueResult,
  MatchmakingQueue,
  QueuedPlayer,
} from '../domain/matchmaking-queue.js';

const queueKey = (entryFee: number): string => `mm:queue:${entryFee}`;
const ACTIVE_KEY = 'mm:active'; // userIds currently queued-into or playing a match

/**
 * Redis-backed queue. Each tier is a sorted set keyed by rating, so the two
 * lowest entries are always the closest-rated waiting players. The atomicity
 * that matchmaking correctness depends on comes from Lua scripts executed
 * server-side — Redis runs each script to completion without interleaving, so
 * there are no races between enqueue and pairing across many workers.
 */
export class RedisMatchmakingQueue implements MatchmakingQueue {
  constructor(private readonly redis: Redis) {}

  // Reject if already queued in this tier OR already flagged as in a match.
  private static readonly ENQUEUE = `
    if redis.call('ZSCORE', KEYS[1], ARGV[1]) then return 0 end
    if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then return 0 end
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
    return 1
  `;

  // Pop the two lowest-rated players atomically and mark them as in a match.
  private static readonly FORM_PAIR = `
    if redis.call('ZCARD', KEYS[1]) < 2 then return nil end
    local m = redis.call('ZRANGE', KEYS[1], 0, 1, 'WITHSCORES')
    redis.call('ZREM', KEYS[1], m[1], m[3])
    redis.call('SADD', KEYS[2], m[1], m[3])
    return m
  `;

  async enqueue(
    userId: string,
    rating: number,
    entryFee: number,
  ): Promise<EnqueueResult> {
    const added = (await this.redis.eval(
      RedisMatchmakingQueue.ENQUEUE,
      2,
      queueKey(entryFee),
      ACTIVE_KEY,
      userId,
      String(rating),
    )) as number;
    return added === 1 ? 'queued' : 'already_active';
  }

  async tryFormPair(
    entryFee: number,
  ): Promise<[QueuedPlayer, QueuedPlayer] | null> {
    const res = (await this.redis.eval(
      RedisMatchmakingQueue.FORM_PAIR,
      2,
      queueKey(entryFee),
      ACTIVE_KEY,
    )) as string[] | null;

    if (!res || res.length < 4) return null;
    return [
      { userId: res[0]!, rating: Number(res[1]) },
      { userId: res[2]!, rating: Number(res[3]) },
    ];
  }

  async leave(userId: string, entryFee: number): Promise<void> {
    await this.redis.zrem(queueKey(entryFee), userId);
  }

  async release(userIds: readonly string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.redis.srem(ACTIVE_KEY, ...userIds);
  }

  async size(entryFee: number): Promise<number> {
    return this.redis.zcard(queueKey(entryFee));
  }

  async isQueued(userId: string, entryFee: number): Promise<boolean> {
    const score = await this.redis.zscore(queueKey(entryFee), userId);
    return score !== null;
  }
}
