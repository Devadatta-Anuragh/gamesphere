/**
 * Ludo board geometry, expressed as a per-token "progress" value:
 *
 *   0            -> token is in the yard (base), not yet on the board
 *   1 .. 51      -> on the shared 52-cell main ring (relative to the seat's start)
 *   52 .. 57     -> in the seat's private 6-cell home column
 *   57           -> finished (reached home)
 *
 * A token must land EXACTLY on 57 to finish (overshoots are illegal). The
 * absolute cell on the shared ring is derived from the seat's start offset, so
 * two seats at the same progress occupy different physical cells.
 */
export const TOKENS_PER_PLAYER = 4;
export const MAIN_TRACK = 52;
export const YARD = 0;
export const FIRST_MAIN_PROGRESS = 1;
export const LAST_MAIN_PROGRESS = 51;
export const FINISH = 57;
export const DICE_TO_LEAVE_YARD = 6;

/**
 * Safe cells (absolute ring indices): the four seat-start cells (0,13,26,39)
 * and the four "star" cells (8,21,34,47). No captures happen on safe cells, so
 * tokens of different seats may coexist there.
 */
export const SAFE_CELLS: ReadonlySet<number> = new Set([
  0, 8, 13, 21, 26, 34, 39, 47,
]);

const QUADRANT_OFFSETS = [0, 13, 26, 39] as const;

/**
 * Assigns each seat a start offset on the ring, spreading players as evenly as
 * possible. 2 players sit opposite (0, 26); 4 players take all quadrants.
 */
export const seatStartOffsets = (playerCount: number): Record<number, number> => {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error(`Unsupported player count: ${playerCount}`);
  }
  const offsets: Record<number, number> = {};
  if (playerCount === 2) {
    offsets[0] = QUADRANT_OFFSETS[0];
    offsets[1] = QUADRANT_OFFSETS[2];
  } else {
    for (let seat = 0; seat < playerCount; seat += 1) {
      offsets[seat] = QUADRANT_OFFSETS[seat] as number;
    }
  }
  return offsets;
};

export const isOnMainTrack = (progress: number): boolean =>
  progress >= FIRST_MAIN_PROGRESS && progress <= LAST_MAIN_PROGRESS;

/** Absolute ring cell for a token, given its seat's start offset and progress. */
export const absoluteCell = (startOffset: number, progress: number): number =>
  (startOffset + progress - 1) % MAIN_TRACK;

export const isSafeCell = (cell: number): boolean => SAFE_CELLS.has(cell);
