export enum PlayerEventType {
  MatchWon = 'MATCH_WON',
  MatchLost = 'MATCH_LOST',
  SuspiciousStreak = 'SUSPICIOUS_STREAK',
}

export interface PlayerEvent {
  readonly id: string;
  readonly userId: string;
  readonly type: PlayerEventType;
  readonly matchId: string | null;
  readonly createdAt: Date;
}

export interface PlayerEventRepository {
  record(event: PlayerEvent): Promise<void>;
  /** Most recent events for a user, newest first. */
  recent(userId: string, limit: number): Promise<PlayerEvent[]>;
}
