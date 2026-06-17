'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLeaderboard } from '@/lib/api-hooks';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import { Card, CardBody, CardHeader, Badge } from '@/components/ui/primitives';

type Scope = 'global' | 'daily' | 'weekly';
const SCOPES: Scope[] = ['global', 'daily', 'weekly'];

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>('global');
  const { data } = useLeaderboard(scope);
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  // Live refresh when ratings change.
  useEffect(() => {
    if (!socket) return;
    const handler = (e: { type: string }) => {
      if (e.type === 'LEADERBOARD_UPDATED' || e.type === 'GAME_ENDED') {
        void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      }
    };
    socket.on('ops:event', handler);
    return () => {
      socket.off('ops:event', handler);
    };
  }, [socket, queryClient]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leaderboard</h1>
          <p className="text-sm text-muted">
            Elo ratings ranked live via Redis sorted sets.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-line p-1">
          {SCOPES.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-md px-3 py-1 text-xs capitalize ${
                scope === s ? 'bg-brand/15 text-brand' : 'text-muted hover:text-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title={`${scope} rankings`} subtitle="auto-refreshes on match end" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Rank</th>
                  <th className="px-4 py-2 font-medium">Player</th>
                  <th className="px-4 py-2 text-right font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {(data?.entries ?? []).map((e) => (
                  <tr
                    key={e.userId}
                    className={`border-b border-line/60 ${
                      e.userId === user?.id ? 'bg-brand/5' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono">
                      {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : `#${e.rank}`}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.username}
                      {e.userId === user?.id && (
                        <Badge tone="brand" className="ml-2">
                          you
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-brand">
                      {e.rating}
                    </td>
                  </tr>
                ))}
                {data && data.entries.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted">
                      No players ranked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Powered by Redis Sorted Sets" />
          <CardBody className="space-y-3 font-mono text-xs text-muted">
            <p className="text-ink">O(log N) ranking, instant reads.</p>
            <div className="space-y-1.5">
              <div><span className="text-brand">ZADD</span> lb:{scope} 1016 user</div>
              <div><span className="text-brand">ZREVRANGE</span> lb:{scope} 0 19 WITHSCORES</div>
              <div><span className="text-brand">ZREVRANK</span> lb:{scope} user</div>
            </div>
            <p className="border-t border-line pt-3 text-[11px]">
              Ratings update via the Elo handler reacting to the GAME_ENDED event
              on the Redis Pub/Sub bus.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
