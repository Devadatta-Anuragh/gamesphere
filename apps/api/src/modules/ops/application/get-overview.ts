import { ok, type Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import type {
  HealthChecker,
  MatchStatsProvider,
  QueueStatsProvider,
  RealtimeStatsProvider,
} from './ports.js';

export interface SystemOverview {
  activePlayers: number;
  activeMatches: number;
  queueLength: number;
  wsConnections: number;
  health: {
    api: 'up';
    redis: 'up' | 'down';
    mongo: 'up' | 'down';
    ws: 'up' | 'down';
    mongoPingMs: number;
  };
}

/** Dashboard read model: the four headline counters + dependency health. */
export class GetOverview {
  constructor(
    private readonly queue: QueueStatsProvider,
    private readonly matches: MatchStatsProvider,
    private readonly realtime: RealtimeStatsProvider,
    private readonly health: HealthChecker,
  ) {}

  async execute(): Promise<Result<SystemOverview, AppError>> {
    const [activePlayers, queueLength, activeMatches, redisOk, mongo] =
      await Promise.all([
        this.queue.activePlayers(),
        this.queue.queueLength(),
        this.matches.activeMatches(),
        this.health.redisOk(),
        this.health.mongo(),
      ]);
    const wsConnections = this.realtime.connectionCount();

    return ok({
      activePlayers,
      activeMatches,
      queueLength,
      wsConnections,
      health: {
        api: 'up',
        redis: redisOk ? 'up' : 'down',
        mongo: mongo.ok ? 'up' : 'down',
        ws: 'up',
        mongoPingMs: mongo.pingMs,
      },
    });
  }
}
