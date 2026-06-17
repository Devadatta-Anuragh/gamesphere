/**
 * Maps the engine's abstract token model onto a concrete 15×15 Ludo board.
 *
 * The engine sends each seat's `startOffset` and per-token `progress`
 * (0 = yard, 1..51 = shared ring, 52..57 = that seat's home column). Here we
 * convert (offset, progress) → [row, col] so tokens can be positioned and
 * animated. This is purely presentational — all rules live on the server.
 */
export type Cell = readonly [number, number];

// The 52-cell main ring, index 0 = the offset-0 (red) start cell, clockwise.
export const RING: Cell[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];

// Home columns (6 cells) leading to the centre, keyed by start offset.
export const HOME: Record<number, Cell[]> = {
  0: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  13: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  26: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  39: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

// Yard (base) slots per offset — placed in the corner nearest the start cell.
export const YARD: Record<number, Cell[]> = {
  0: [[2, 2], [2, 4], [4, 2], [4, 4]],
  13: [[2, 10], [2, 12], [4, 10], [4, 12]],
  26: [[10, 10], [10, 12], [12, 10], [12, 12]],
  39: [[10, 2], [10, 4], [12, 2], [12, 4]],
};

export const COLORS: Record<number, string> = {
  0: '#f87171', // red
  13: '#34d399', // emerald
  26: '#fbbf24', // amber
  39: '#38bdf8', // sky
};

export const SAFE_RING_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const CENTER: Cell = [7, 7];

const FINISH = 57;

/** Coordinate for a token of a given start offset at a given progress. */
export const coordOf = (
  offset: number,
  progress: number,
  tokenIndex: number,
): Cell => {
  if (progress <= 0) return YARD[offset]?.[tokenIndex] ?? CENTER;
  if (progress >= FINISH) return CENTER;
  if (progress <= 51) return RING[(offset + progress - 1) % 52] ?? CENTER;
  return HOME[offset]?.[progress - 52] ?? CENTER;
};

export const ringKey = (c: Cell): string => `${c[0]},${c[1]}`;

/** Lookup tables for rendering the static board background. */
export const ringCellSet = new Set(RING.map(ringKey));
export const startCellSet = new Set(
  [0, 13, 26, 39].map((o) => ringKey(RING[o]!)),
);
export const safeCellSet = new Set(
  [...SAFE_RING_INDEXES].map((i) => ringKey(RING[i]!)),
);
export const homeCellColor = new Map<string, string>(
  Object.entries(HOME).flatMap(([offset, cells]) =>
    cells.map((c) => [ringKey(c), COLORS[Number(offset)]!] as const),
  ),
);
export const yardColor = new Map<string, string>(
  Object.entries(YARD).flatMap(([offset]) => {
    // Tint the whole 6×6 corner block for each base.
    const o = Number(offset);
    const blocks: Record<number, Cell[]> = {
      0: cornerBlock(0, 0),
      13: cornerBlock(0, 9),
      26: cornerBlock(9, 9),
      39: cornerBlock(9, 0),
    };
    return blocks[o]!.map((c) => [ringKey(c), COLORS[o]!] as const);
  }),
);

function cornerBlock(r0: number, c0: number): Cell[] {
  const cells: Cell[] = [];
  for (let r = r0; r < r0 + 6; r += 1)
    for (let c = c0; c < c0 + 6; c += 1) cells.push([r, c]);
  return cells;
}
