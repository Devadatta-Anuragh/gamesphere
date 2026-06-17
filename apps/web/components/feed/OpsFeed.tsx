'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSocket } from '@/lib/socket';
import { formatMoney, formatTime, shortId } from '@/lib/format';
import { Badge } from '@/components/ui/primitives';

interface OpsEvent {
  key: string;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

type Tone = 'brand' | 'green' | 'amber' | 'red' | 'slate' | 'cyan';

const META: Record<string, { label: string; tone: Tone }> = {
  USER_JOINED_QUEUE: { label: 'Joined queue', tone: 'cyan' },
  MATCH_CREATED: { label: 'Match created', tone: 'brand' },
  GAME_STARTED: { label: 'Game started', tone: 'green' },
  GAME_ENDED: { label: 'Game finished', tone: 'amber' },
  WALLET_UPDATED: { label: 'Wallet updated', tone: 'slate' },
  LEADERBOARD_UPDATED: { label: 'Leaderboard updated', tone: 'slate' },
};

const describe = (e: OpsEvent): string => {
  const p = e.payload;
  switch (e.type) {
    case 'USER_JOINED_QUEUE':
      return `${shortId(String(p.userId))} · ${formatMoney(Number(p.entryFee))} table`;
    case 'MATCH_CREATED':
      return `room ${shortId(String(p.matchId))} · ${formatMoney(Number(p.entryFee))}`;
    case 'GAME_STARTED':
      return `room ${shortId(String(p.roomId))}`;
    case 'GAME_ENDED':
      return p.winnerId
        ? `winner ${shortId(String(p.winnerId))}`
        : 'no winner';
    case 'LEADERBOARD_UPDATED':
      return `${shortId(String(p.userId))} → rating ${p.rating}`;
    default:
      return '';
  }
};

export function OpsFeed() {
  const { socket } = useSocket();
  const [events, setEvents] = useState<OpsEvent[]>([]);

  useEffect(() => {
    if (!socket) return;
    const handler = (e: Omit<OpsEvent, 'key'>) =>
      setEvents((prev) =>
        [{ ...e, key: `${e.type}-${Math.random().toString(36).slice(2)}` }, ...prev].slice(0, 40),
      );
    socket.on('ops:event', handler);
    return () => {
      socket.off('ops:event', handler);
    };
  }, [socket]);

  if (events.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted">
        Waiting for live events… join a queue in another tab to see the feed
        light up.
      </p>
    );
  }

  return (
    <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
      <AnimatePresence initial={false}>
        {events.map((e) => {
          const meta = META[e.type] ?? { label: e.type, tone: 'slate' as Tone };
          return (
            <motion.li
              key={e.key}
              layout
              initial={{ opacity: 0, x: -12, backgroundColor: 'rgba(45,212,191,0.08)' }}
              animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <span className="font-mono text-xs text-muted">{describe(e)}</span>
              </div>
              <span className="font-mono text-[11px] text-muted">
                {formatTime(e.occurredAt)}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
