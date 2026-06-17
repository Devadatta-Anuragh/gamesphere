import { ok, type Result } from '@/shared/result.js';
import type { AppError } from '@/shared/errors.js';
import type {
  HealthChecker,
  MetricsSource,
  RealtimeStatsProvider,
} from './ports.js';

export interface OpsMetrics {
  rps: number;
  avgResponseMs: number;
  errorRate: number;
  totalRequests: number;
  redisHitRatio: number | null;
  mongoPingMs: number;
  wsConnections: number;
  series: { t: number; requests: number; errors: number }[];
}

/** Metrics screen read model: API metrics + infra gauges + a short time series. */
export class GetMetrics {
  constructor(
    private readonly metrics: MetricsSource,
    private readonly realtime: RealtimeStatsProvider,
    private readonly health: HealthChecker,
  ) {}

  async execute(): Promise<Result<OpsMetrics, AppError>> {
    const snap = this.metrics.snapshot();
    const [redisHitRatio, mongo] = await Promise.all([
      this.health.redisHitRatio(),
      this.health.mongo(),
    ]);
    return ok({
      rps: snap.rps,
      avgResponseMs: snap.avgResponseMs,
      errorRate: snap.errorRate,
      totalRequests: snap.totalRequests,
      redisHitRatio,
      mongoPingMs: mongo.pingMs,
      wsConnections: this.realtime.connectionCount(),
      series: snap.series,
    });
  }
}
