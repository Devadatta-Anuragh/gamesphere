'use client';

import {
  Boxes,
  Database,
  Radio,
  ServerCog,
  ShieldCheck,
  Dices,
} from 'lucide-react';
import { Card, CardBody, CardHeader, Badge } from '@/components/ui/primitives';

function Node({
  title,
  subtitle,
  tone = 'slate',
}: {
  title: string;
  subtitle: string;
  tone?: 'brand' | 'green' | 'amber' | 'cyan' | 'slate';
}) {
  const ring =
    tone === 'brand'
      ? 'border-brand/50'
      : tone === 'green'
        ? 'border-emerald-500/50'
        : tone === 'amber'
          ? 'border-amber-500/50'
          : tone === 'cyan'
            ? 'border-cyan-500/50'
            : 'border-line';
  return (
    <div className={`rounded-lg border ${ring} bg-panel px-4 py-3 text-center`}>
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="font-mono text-[11px] text-muted">{subtitle}</div>
    </div>
  );
}

const Arrow = () => (
  <div className="flex justify-center text-muted">↓</div>
);

const SERVICES = [
  { icon: ShieldCheck, name: 'Auth', desc: 'JWT · username login' },
  { icon: Boxes, name: 'Matchmaking', desc: 'Redis queues · atomic Lua' },
  { icon: Dices, name: 'Game', desc: 'authoritative engine · fair dice' },
  { icon: Database, name: 'Wallet', desc: 'double-entry ledger · escrow' },
  { icon: ServerCog, name: 'Leaderboard', desc: 'Redis sorted sets · Elo' },
  { icon: Radio, name: 'Notifications', desc: 'Pub/Sub → WebSocket' },
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Architecture</h1>
        <p className="text-sm text-muted">
          Modular monolith · ports &amp; adapters · event-driven. The same
          backend this console is reading from, live.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Request / Realtime Flow" />
          <CardBody className="space-y-2">
            <Node title="Client (Next.js)" subtitle="REST + Socket.IO" tone="brand" />
            <Arrow />
            <Node title="Nginx" subtitle="reverse proxy (infra phase)" />
            <Arrow />
            <Node title="Node API" subtitle="Express + Socket.IO gateway" tone="cyan" />
            <Arrow />
            <div className="grid grid-cols-2 gap-3">
              <Node title="Redis" subtitle="queues · ZSETs · Pub/Sub" tone="amber" />
              <Node title="MongoDB" subtitle="users · ledger · matches" tone="green" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Service Breakdown" subtitle="bounded contexts behind ports" />
          <CardBody className="grid grid-cols-2 gap-3">
            {SERVICES.map(({ icon: Icon, name, desc }) => (
              <div
                key={name}
                className="flex items-start gap-3 rounded-lg border border-line bg-panel/60 p-3"
              >
                <Icon size={18} className="mt-0.5 text-brand" />
                <div>
                  <div className="text-sm font-medium text-ink">{name}</div>
                  <div className="font-mono text-[11px] text-muted">{desc}</div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Correctness Guarantees" subtitle="what makes it real-money safe" />
        <CardBody className="flex flex-wrap gap-2">
          {[
            'Double-entry ledger (Σ = 0)',
            'Atomic guarded debits (no double-spend)',
            'Idempotent settlement',
            'Provably-fair dice (commit-reveal)',
            'Escrow + refund saga',
            'Server-authoritative moves',
            'Disconnect → forfeit',
            'Multi-doc transactions',
          ].map((g) => (
            <Badge key={g} tone="brand">
              {g}
            </Badge>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Deployment (infra phase)" />
        <CardBody className="flex flex-wrap gap-2 font-mono text-xs text-muted">
          {['nginx', 'api', 'redis', 'mongo', 'prometheus', 'grafana'].map((c) => (
            <span key={c} className="rounded border border-line px-2 py-1">
              docker · {c}
            </span>
          ))}
          <span className="rounded border border-line px-2 py-1">AWS EC2</span>
          <span className="rounded border border-line px-2 py-1">GitHub Actions CI/CD</span>
        </CardBody>
      </Card>
    </div>
  );
}
