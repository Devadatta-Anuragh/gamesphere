import type { Clock } from '@/shared/clock.js';

interface SecondBucket {
  second: number; // epoch seconds
  requests: number;
  errors: number;
  latencySum: number;
}

export interface MetricsSnapshot {
  rps: number;
  avgResponseMs: number;
  errorRate: number; // 0..1
  totalRequests: number;
  /** Per-second history (oldest → newest) for charts. */
  series: { t: number; requests: number; errors: number }[];
}

const WINDOW_SECONDS = 60;
const RPS_WINDOW = 10;

/**
 * Tiny in-process metrics collector. Keeps a rolling ring of per-second buckets
 * so the ops API can report RPS, average latency, error rate and a short time
 * series for charts — without pulling in Prometheus (deferred to the infra
 * phase). Time is injected for deterministic tests.
 */
export class MetricsRegistry {
  private readonly buckets = new Map<number, SecondBucket>();
  private total = 0;

  constructor(private readonly clock: Clock) {}

  record(durationMs: number, statusCode: number): void {
    this.total += 1;
    const second = Math.floor(this.clock.nowMs() / 1000);
    const bucket = this.buckets.get(second) ?? {
      second,
      requests: 0,
      errors: 0,
      latencySum: 0,
    };
    bucket.requests += 1;
    bucket.latencySum += durationMs;
    if (statusCode >= 500) bucket.errors += 1;
    this.buckets.set(second, bucket);
    this.prune(second);
  }

  private prune(now: number): void {
    for (const second of this.buckets.keys()) {
      if (second <= now - WINDOW_SECONDS) this.buckets.delete(second);
    }
  }

  snapshot(): MetricsSnapshot {
    const now = Math.floor(this.clock.nowMs() / 1000);
    this.prune(now);

    let recentRequests = 0;
    let recentErrors = 0;
    let latencySum = 0;
    let windowRequests = 0;

    for (const b of this.buckets.values()) {
      if (b.second > now - RPS_WINDOW) recentRequests += b.requests;
      windowRequests += b.requests;
      recentErrors += b.errors;
      latencySum += b.latencySum;
    }

    const series = Array.from({ length: WINDOW_SECONDS }, (_, i) => {
      const t = now - (WINDOW_SECONDS - 1 - i);
      const b = this.buckets.get(t);
      return { t, requests: b?.requests ?? 0, errors: b?.errors ?? 0 };
    });

    return {
      rps: Number((recentRequests / RPS_WINDOW).toFixed(2)),
      avgResponseMs: windowRequests
        ? Number((latencySum / windowRequests).toFixed(1))
        : 0,
      errorRate: windowRequests
        ? Number((recentErrors / windowRequests).toFixed(4))
        : 0,
      totalRequests: this.total,
      series,
    };
  }
}
