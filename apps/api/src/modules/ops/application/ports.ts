import type { MetricsSnapshot } from '@/infrastructure/metrics/metrics-registry.js';

/** Live queue/player counts (Redis-backed). */
export interface QueueStatsProvider {
  activePlayers(): Promise<number>;
  queueLength(): Promise<number>;
}

export interface MatchStatsProvider {
  activeMatches(): Promise<number>;
}

/** Realtime connection count (Socket.IO engine). */
export interface RealtimeStatsProvider {
  connectionCount(): number;
}

/** Dependency probes for the health panel + infra metrics. */
export interface HealthChecker {
  redisOk(): Promise<boolean>;
  mongo(): Promise<{ ok: boolean; pingMs: number }>;
  redisHitRatio(): Promise<number | null>;
}

/** Anything that can produce a metrics snapshot (the MetricsRegistry). */
export interface MetricsSource {
  snapshot(): MetricsSnapshot;
}

/** Pushes an event to the global `ops` room (live activity feed). */
export interface OpsBroadcaster {
  broadcast(event: string, data: unknown): void;
}
