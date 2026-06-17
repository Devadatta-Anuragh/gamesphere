'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Swords } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMatchStatus } from '@/lib/api-hooks';
import { formatMoney, shortId } from '@/lib/format';
import { Card, CardBody, CardHeader, Badge, StatCard } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

const TIERS = [10_000, 50_000, 100_000];

export default function MatchmakingPage() {
  const { user } = useAuth();
  const { data: status } = useMatchStatus();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tier, setTier] = useState(TIERS[0]!);
  const [busy, setBusy] = useState(false);

  const queued = status?.state === 'queued';
  const matched = status?.state === 'matched' && status.match;

  const join = async () => {
    setBusy(true);
    try {
      await api.post('/matchmaking/join', { entryFee: tier });
      await queryClient.invalidateQueries({ queryKey: ['matchmaking', 'status'] });
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await api.post('/matchmaking/leave', { entryFee: tier });
      await queryClient.invalidateQueries({ queryKey: ['matchmaking', 'status'] });
    } finally {
      setBusy(false);
    }
  };

  const opponent = matched
    ? status!.match!.players.find((p) => p.userId !== user?.id)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Matchmaking</h1>
        <p className="text-sm text-muted">
          Skill-rated Redis queues with atomic pairing. Entry fee is escrowed on
          match.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Player" value={user?.username ?? '—'} tone="brand" />
        <StatCard label="Skill Rating" value={user?.rating ?? '—'} tone="cyan" />
        <StatCard
          label="Queue State"
          value={status?.state ?? 'idle'}
          tone={matched ? 'green' : queued ? 'amber' : 'slate'}
        />
      </div>

      <Card>
        <CardHeader title="Cash Tables" subtitle="Pick a stake and join the queue" />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                disabled={queued || Boolean(matched)}
                className={`rounded-xl border px-4 py-5 text-center transition-colors disabled:opacity-50 ${
                  tier === t
                    ? 'border-brand bg-brand/10'
                    : 'border-line hover:bg-panel'
                }`}
              >
                <div className="font-mono text-lg font-semibold text-ink">
                  {formatMoney(t)}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-muted">
                  pool {formatMoney(t * 2)}
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {queued ? (
              <>
                <Button variant="danger" onClick={leave} disabled={busy}>
                  Leave Queue
                </Button>
                <span className="flex items-center gap-2 font-mono text-sm text-amber-300">
                  <Loader2 size={15} className="animate-spin" />
                  searching for an opponent…
                </span>
              </>
            ) : (
              <Button onClick={join} disabled={busy || Boolean(matched)}>
                <Swords size={16} /> Join Queue · {formatMoney(tier)}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Modal open={Boolean(matched)} title="Match Found">
        {matched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Match</span>
              <Badge tone="brand">{shortId(status!.match!.id)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Opponent</span>
              <span className="font-mono text-sm text-ink">
                {opponent ? shortId(opponent.userId) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Prize pool</span>
              <span className="font-mono text-sm text-emerald-300">
                {formatMoney(status!.match!.pool)}
              </span>
            </div>
            <Button
              className="w-full"
              onClick={() => router.push(`/live/${status!.match!.id}`)}
            >
              Enter Match →
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
