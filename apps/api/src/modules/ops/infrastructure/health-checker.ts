import type { Redis } from 'ioredis';
import mongoose from 'mongoose';
import type { HealthChecker } from '../application/ports.js';

/** Probes Redis and MongoDB for the health panel and infra metrics. */
export class DependencyHealthChecker implements HealthChecker {
  constructor(private readonly redis: Redis) {}

  async redisOk(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async mongo(): Promise<{ ok: boolean; pingMs: number }> {
    const start = Date.now();
    try {
      await mongoose.connection.db?.admin().ping();
      return { ok: true, pingMs: Date.now() - start };
    } catch {
      return { ok: false, pingMs: Date.now() - start };
    }
  }

  async redisHitRatio(): Promise<number | null> {
    try {
      const info = await this.redis.info('stats');
      const hits = Number(/keyspace_hits:(\d+)/.exec(info)?.[1] ?? 0);
      const misses = Number(/keyspace_misses:(\d+)/.exec(info)?.[1] ?? 0);
      const total = hits + misses;
      return total === 0 ? null : Number((hits / total).toFixed(4));
    } catch {
      return null;
    }
  }
}
