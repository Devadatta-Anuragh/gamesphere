const K_FACTOR = 32;
export const FLOOR_RATING = 100;

/** Probability that A beats B given their ratings (logistic Elo curve). */
const expectedScore = (ratingA: number, ratingB: number): number =>
  1 / (1 + 10 ** ((ratingB - ratingA) / 400));

/**
 * Computes both players' new Elo ratings after a decisive result. `aWon`
 * is true when player A won. Ratings never drop below FLOOR_RATING.
 */
export const applyElo = (
  ratingA: number,
  ratingB: number,
  aWon: boolean,
): { a: number; b: number } => {
  const expA = expectedScore(ratingA, ratingB);
  const expB = expectedScore(ratingB, ratingA);
  const scoreA = aWon ? 1 : 0;
  const scoreB = aWon ? 0 : 1;
  const a = Math.max(FLOOR_RATING, Math.round(ratingA + K_FACTOR * (scoreA - expA)));
  const b = Math.max(FLOOR_RATING, Math.round(ratingB + K_FACTOR * (scoreB - expB)));
  return { a, b };
};
