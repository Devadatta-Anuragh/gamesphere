import { Redis } from 'ioredis';
import type { Logger } from '@/shared/logger.js';

/**
 * Creates an ioredis client. Pub/Sub requires dedicated connections (a
 * subscriber connection cannot run normal commands), so the event bus creates
 * its own via `duplicate()` rather than sharing this one.
 */
export const createRedis = (url: string, logger: Logger): Redis => {
  const client = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
  client.on('error', (err) => logger.error({ err }, 'Redis error'));
  client.on('connect', () => logger.info('Redis connected'));
  return client;
};
