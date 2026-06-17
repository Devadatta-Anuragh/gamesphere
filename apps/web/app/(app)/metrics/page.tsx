'use client';

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMetrics } from '@/lib/api-hooks';
import { formatNumber, formatPercent } from '@/lib/format';
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/primitives';

export default function MetricsPage() {
  const { data } = useMetrics();
  const series = (data?.series ?? []).map((p, i) => ({
    i,
    requests: p.requests,
    errors: p.errors,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Metrics</h1>
        <p className="text-sm text-muted">
          In-process observability — API throughput, latency and dependency
          health. (Prometheus/Grafana deferred to the infra phase.)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Requests / sec" value={data?.rps ?? 0} tone="brand" />
        <StatCard label="Avg Response" value={`${data?.avgResponseMs ?? 0}ms`} tone="cyan" />
        <StatCard
          label="Error Rate"
          value={formatPercent(data?.errorRate ?? 0)}
          tone={data && data.errorRate > 0 ? 'amber' : 'green'}
        />
        <StatCard
          label="Total Requests"
          value={formatNumber(data?.totalRequests ?? 0)}
          tone="green"
        />
      </div>

      <Card>
        <CardHeader title="Request Volume" subtitle="last 60 seconds" />
        <CardBody>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="req" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="i" hide />
                <YAxis allowDecimals={false} width={28} stroke="#5b6b86" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: '#0d121c',
                    border: '1px solid #20293a',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={() => ''}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="#2dd4bf"
                  fill="url(#req)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Redis Hit Ratio"
          value={data?.redisHitRatio === null || data?.redisHitRatio === undefined ? '—' : formatPercent(data.redisHitRatio)}
          tone="cyan"
        />
        <StatCard label="Mongo Ping" value={`${data?.mongoPingMs ?? 0}ms`} tone="brand" />
        <StatCard label="WS Connections" value={data?.wsConnections ?? 0} tone="green" />
      </div>
    </div>
  );
}
