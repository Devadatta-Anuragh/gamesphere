/** Player rating read/write + display profile, as the leaderboard needs it. */
export interface PlayerProfiles {
  rating(userId: string): Promise<number | null>;
  setRating(userId: string, rating: number): Promise<void>;
  profile(userId: string): Promise<{ username: string; rating: number } | null>;
}
