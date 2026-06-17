'use client';

import { useOverview } from '@/lib/api-hooks';
import { formatNumber } from '@/lib/format';
import {
  Card,
  CardBody,
  CardHeader,
  SectionTitle,
  StatCard,
  StatusDot,
} from '@/components/ui/primitives';
import { OpsFeed } from '@/components/feed/OpsFeed';

function HealthRow({ label, status, hint }: { label: string; status: string; hint?: string }) {
  const up = status === 'up';
  return (
    <div className="flex items-center justify-between border-b border-line py-2 last:border-0">
      <span className="flex items-center gap-2 text-sm text-ink">
        <StatusDot tone={up ? 'green' : 'red'} />
        {label}
      </span>
      <span className="font-mono text-xs text-muted">
        {hint ?? (up ? 'operational' : 'down')}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data } = useOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Platform Overview</h1>
        <p className="text-sm text-muted">
          Live operational state of the real-money Ludo backend.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Players" value={formatNumber(data?.activePlayers ?? 0)} tone="brand" />
        <StatCard label="Active Matches" value={formatNumber(data?.activeMatches ?? 0)} tone="cyan" />
        <StatCard label="Queue Length" value={formatNumber(data?.queueLength ?? 0)} tone="amber" />
        <StatCard label="WS Connections" value={formatNumber(data?.wsConnections ?? 0)} tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle right={<span className="font-mono text-[11px] text-muted">via WebSocket · Redis Pub/Sub</span>}>
            Live Activity Feed
          </SectionTitle>
          <Card>
            <OpsFeed />
          </Card>
        </div>

        <div>
          <SectionTitle>System Status</SectionTitle>
          <Card>
            <CardHeader title="Dependencies" subtitle="Probed every 2s" />
            <CardBody className="py-2">
              <HealthRow label="API" status={data?.health.api ?? 'down'} />
              <HealthRow label="Redis" status={data?.health.redis ?? 'down'} />
              <HealthRow
                label="MongoDB"
                status={data?.health.mongo ?? 'down'}
                hint={data ? `ping ${data.health.mongoPingMs}ms` : undefined}
              />
              <HealthRow label="WebSocket" status={data?.health.ws ?? 'down'} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
