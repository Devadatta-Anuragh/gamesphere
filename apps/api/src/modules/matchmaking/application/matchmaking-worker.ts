import type { Logger } from '@/shared/logger.js';
import type { MatchmakingQueue } from '../domain/matchmaking-queue.js';
import type { FormMatch } from './form-match.js';

/**
 * Background worker that drains each tier's queue, forming matches while pairs
 * are available. A `running` guard prevents overlapping ticks; pairing is
 * atomic in Redis, so multiple worker instances (horizontal scaling) are safe.
 */
export class MatchmakingWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly queue: MatchmakingQueue,
    private readonly formMatch: FormMatch,
    private readonly tiers: readonly number[],
    private readonly intervalMs: number,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.logger.info({ intervalMs: this.intervalMs }, 'matchmaking worker started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const fee of this.tiers) {
        let pair = await this.queue.tryFormPair(fee);
        while (pair) {
          const result = await this.formMatch.execute(pair, fee);
          if (result.ok) {
            this.logger.info({ matchId: result.value.id, fee }, 'match created');
          } else {
            this.logger.warn({ code: result.error.code, fee }, 'match formation failed');
          }
          pair = await this.queue.tryFormPair(fee);
        }
      }
    } catch (err) {
      this.logger.error({ err }, 'matchmaking tick error');
    } finally {
      this.running = false;
    }
  }
}
