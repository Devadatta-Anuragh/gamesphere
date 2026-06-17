import type { Money } from '@gamesphere/shared';

export enum MatchStatus {
  Pending = 'PENDING', // created, stakes escrowed, waiting for play to start
  Active = 'ACTIVE', // game in progress
  Settled = 'SETTLED', // finished and paid out
  Abandoned = 'ABANDONED', // cancelled; stakes refunded
}

export interface MatchPlayer {
  readonly userId: string;
  readonly seat: number;
}

/**
 * The financial/lifecycle record of a match (the gameplay state lives in the
 * game module). `pool` is the total escrowed stake to be settled. `roomId`
 * doubles as the realtime room/channel id.
 */
export interface Match {
  readonly id: string;
  readonly roomId: string;
  readonly players: readonly MatchPlayer[];
  readonly entryFee: Money;
  readonly pool: Money;
  readonly status: MatchStatus;
  readonly winnerId: string | null;
  readonly createdAt: Date;
}

export const playerIds = (match: Match): string[] =>
  match.players.map((p) => p.userId);
