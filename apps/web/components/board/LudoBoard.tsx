'use client';

import { motion } from 'framer-motion';
import {
  COLORS,
  CENTER,
  coordOf,
  homeCellColor,
  ringCellSet,
  ringKey,
  safeCellSet,
  startCellSet,
  yardColor,
} from './board-geometry';

const SIZE = 15;
const PCT = 100 / SIZE;

export interface BoardSeat {
  seat: number;
  userId: string;
  tokens: number[];
}

interface Props {
  seats: BoardSeat[];
  startOffset: Record<number, number>;
  turnSeat: number;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

export function LudoBoard({ seats, startOffset, turnSeat }: Props) {
  const cells = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const key = ringKey([r, c]);
      const isCenter = r === CENTER[0] && c === CENTER[1];
      const homeColor = homeCellColor.get(key);
      const yColor = yardColor.get(key);
      const onRing = ringCellSet.has(key);
      const isStart = startCellSet.has(key);
      const isSafe = safeCellSet.has(key);

      let bg = 'transparent';
      let border = 'transparent';
      if (isCenter) bg = 'rgba(148,163,184,0.18)';
      else if (homeColor) bg = withAlpha(homeColor, 0.45);
      else if (onRing) {
        bg = isStart ? withAlpha('#94a3b8', 0.28) : 'rgba(148,163,184,0.10)';
        border = 'rgba(148,163,184,0.18)';
      } else if (yColor) {
        bg = withAlpha(yColor, 0.1);
      }

      cells.push(
        <div
          key={key}
          style={{
            gridRow: r + 1,
            gridColumn: c + 1,
            background: bg,
            borderColor: border,
          }}
          className="border"
        >
          {isSafe && (
            <span className="flex h-full w-full items-center justify-center text-[8px] text-slate-300/70">
              ★
            </span>
          )}
        </div>,
      );
    }
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px] rounded-xl border border-line bg-bg/60 p-1">
      <div
        className="grid h-full w-full overflow-hidden rounded-lg"
        style={{
          gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${SIZE}, 1fr)`,
        }}
      >
        {cells}
      </div>

      {/* Tokens overlay */}
      {seats.map((s) => {
        const offset = startOffset[s.seat] ?? 0;
        const color = COLORS[offset] ?? '#94a3b8';
        return s.tokens.map((progress, i) => {
          const [r, c] = coordOf(offset, progress, i);
          // Nudge stacked tokens so overlaps stay visible.
          const nudge = (i - 1.5) * 0.18;
          return (
            <motion.div
              key={`${s.seat}-${i}`}
              className="absolute rounded-full border-2 shadow-md"
              initial={false}
              animate={{
                top: `${(r + 0.12 + nudge) * PCT}%`,
                left: `${(c + 0.12 + nudge) * PCT}%`,
                scale: s.seat === turnSeat ? 1.06 : 1,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              style={{
                width: `${PCT * 0.76}%`,
                height: `${PCT * 0.76}%`,
                background: color,
                borderColor: 'rgba(0,0,0,0.45)',
                boxShadow:
                  s.seat === turnSeat ? `0 0 10px 1px ${color}` : undefined,
              }}
            />
          );
        });
      })}
    </div>
  );
}
