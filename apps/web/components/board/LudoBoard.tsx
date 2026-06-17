'use client';

import { motion } from 'framer-motion';
import {
  COLORS,
  RING,
  YARD,
  coordOf,
  homeCellColor,
  ringCellSet,
  ringKey,
  safeCellSet,
} from './board-geometry';

const SIZE = 15;
const PCT = 100 / SIZE;
const FINISH = 57;

export interface BoardSeat {
  seat: number;
  userId: string;
  username?: string;
  tokens: number[];
}

interface Props {
  seats: BoardSeat[];
  startOffset: Record<number, number>;
  turnSeat: number;
}

// Which start offset (and therefore colour) owns each start cell.
const startColorByKey = new Map<string, string>(
  [0, 13, 26, 39].map((o) => [ringKey(RING[o]!), COLORS[o]!] as const),
);

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

// The four 6×6 corner bases, by start offset → CSS position.
const BASES: { offset: number; pos: React.CSSProperties }[] = [
  { offset: 0, pos: { top: '2%', left: '2%' } },
  { offset: 13, pos: { top: '2%', right: '2%' } },
  { offset: 26, pos: { bottom: '2%', right: '2%' } },
  { offset: 39, pos: { bottom: '2%', left: '2%' } },
];

export function LudoBoard({ seats, startOffset, turnSeat }: Props) {
  // Track / home / start cells (the cross). Everything else is transparent so
  // the rounded corner bases and centre show through.
  const cells = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const key = ringKey([r, c]);
      const home = homeCellColor.get(key);
      const startColor = startColorByKey.get(key);
      const onRing = ringCellSet.has(key);
      const isSafe = safeCellSet.has(key);
      if (!home && !onRing) continue; // transparent (base/centre area)

      let bg = 'rgba(226,232,240,0.10)';
      let border = 'rgba(148,163,184,0.16)';
      if (home) {
        bg = withAlpha(home, 0.55);
        border = withAlpha(home, 0.7);
      } else if (startColor) {
        bg = withAlpha(startColor, 0.85);
        border = withAlpha(startColor, 0.95);
      } else if (isSafe) {
        // Plain safe squares read as "safe": lighter fill + brighter border.
        bg = 'rgba(226,232,240,0.2)';
        border = 'rgba(226,232,240,0.4)';
      }

      cells.push(
        <div
          key={key}
          style={{ gridRow: r + 1, gridColumn: c + 1, background: bg, borderColor: border }}
          className="rounded-[2px] border"
        >
          {isSafe && (
            <span
              className={`flex h-full w-full items-center justify-center text-[9px] ${
                startColor ? 'text-black/60' : 'text-slate-100/90'
              }`}
            >
              ★
            </span>
          )}
        </div>,
      );
    }
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[480px] rounded-2xl border border-line bg-gradient-to-br from-[#0b1018] to-[#0e1622] p-2 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
      {/* Corner bases */}
      {BASES.map(({ offset, pos }) => {
        const color = COLORS[offset]!;
        return (
          <div
            key={offset}
            className="absolute h-[36%] w-[36%] rounded-2xl border-2"
            style={{
              ...pos,
              background: withAlpha(color, 0.16),
              borderColor: withAlpha(color, 0.5),
            }}
          />
        );
      })}

      {/* Centre home (four-colour) */}
      <div
        className="absolute left-1/2 top-1/2 h-[19%] w-[19%] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/20"
        style={{
          background: `conic-gradient(from 45deg, ${COLORS[13]}, ${COLORS[26]}, ${COLORS[39]}, ${COLORS[0]}, ${COLORS[13]})`,
        }}
      />

      {/* Cross track */}
      <div
        className="absolute inset-2 grid gap-px"
        style={{
          gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${SIZE}, 1fr)`,
        }}
      >
        {cells}
      </div>

      {/* Yard holder rings */}
      {seats.map((s) => {
        const offset = startOffset[s.seat] ?? 0;
        return (YARD[offset] ?? []).map(([r, c], i) => (
          <div
            key={`hold-${s.seat}-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20"
            style={{
              top: `${(r + 0.5) * PCT}%`,
              left: `${(c + 0.5) * PCT}%`,
              width: `${PCT * 0.72}%`,
              height: `${PCT * 0.72}%`,
            }}
          />
        ));
      })}

      {/* Tokens */}
      {seats.map((s) => {
        const offset = startOffset[s.seat] ?? 0;
        const color = COLORS[offset] ?? '#94a3b8';
        const active = s.seat === turnSeat;
        return s.tokens.map((progress, i) => {
          const [r, c] = coordOf(offset, progress, i);
          const stack = progress >= FINISH || progress === 0 ? 0 : (i - 1.5) * 1.4;
          return (
            <motion.div
              key={`${s.seat}-${i}`}
              className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[10px] font-bold"
              initial={false}
              animate={{
                top: `${(r + 0.5) * PCT + stack}%`,
                left: `${(c + 0.5) * PCT + stack}%`,
                scale: active ? 1.12 : 1,
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 20 }}
              style={{
                width: `${PCT * 0.82}%`,
                height: `${PCT * 0.82}%`,
                background: `radial-gradient(circle at 32% 28%, ${withAlpha(color, 1)}, ${withAlpha(color, 0.82)})`,
                borderColor: 'rgba(255,255,255,0.85)',
                color: 'rgba(0,0,0,0.7)',
                boxShadow: active
                  ? `0 0 12px 2px ${color}, 0 2px 4px rgba(0,0,0,0.5)`
                  : '0 2px 4px rgba(0,0,0,0.5)',
              }}
            >
              {i + 1}
            </motion.div>
          );
        });
      })}
    </div>
  );
}
