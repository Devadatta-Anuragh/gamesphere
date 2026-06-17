import { pino } from 'pino';
import type { Logger } from 'pino';

export type { Logger };

/**
 * Structured JSON logging in production; pretty-printed in development.
 * A single root logger is created here; modules derive child loggers with
 * `logger.child({ module: 'wallet' })` so every line is traceable to a source.
 */
export const createLogger = (level: string, pretty: boolean): Logger =>
  pino(
    pretty
      ? {
          level,
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
          },
        }
      : { level },
  );
