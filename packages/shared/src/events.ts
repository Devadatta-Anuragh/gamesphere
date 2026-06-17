import type { MatchId, RoomId, UserId } from './ids.js';
import type { Money } from './money.js';

/**
 * Domain events published on the event bus (Redis Pub/Sub in production).
 * Services subscribe to these rather than calling each other directly, which
 * keeps modules loosely coupled (e.g. leaderboard + notifications react to
 * GAME_ENDED without the game service knowing they exist).
 */
export enum DomainEventType {
  UserJoinedQueue = 'USER_JOINED_QUEUE',
  MatchCreated = 'MATCH_CREATED',
  GameStarted = 'GAME_STARTED',
  GameEnded = 'GAME_ENDED',
  WalletUpdated = 'WALLET_UPDATED',
  LeaderboardUpdated = 'LEADERBOARD_UPDATED',
}

interface BaseEvent<T extends DomainEventType, P> {
  readonly type: T;
  readonly occurredAt: string; // ISO-8601
  readonly payload: P;
}

export type UserJoinedQueueEvent = BaseEvent<
  DomainEventType.UserJoinedQueue,
  { userId: UserId; rating: number; entryFee: Money }
>;

export type MatchCreatedEvent = BaseEvent<
  DomainEventType.MatchCreated,
  { matchId: MatchId; roomId: RoomId; players: UserId[]; entryFee: Money }
>;

export type GameStartedEvent = BaseEvent<
  DomainEventType.GameStarted,
  { matchId: MatchId; roomId: RoomId; players: UserId[] }
>;

export type GameEndedEvent = BaseEvent<
  DomainEventType.GameEnded,
  {
    matchId: MatchId;
    roomId: RoomId;
    winnerId: UserId | null; // null = draw/abandoned with no winner
    players: UserId[];
  }
>;

export type WalletUpdatedEvent = BaseEvent<
  DomainEventType.WalletUpdated,
  { userId: UserId; balance: Money }
>;

export type LeaderboardUpdatedEvent = BaseEvent<
  DomainEventType.LeaderboardUpdated,
  { userId: UserId; rating: number }
>;

export type DomainEvent =
  | UserJoinedQueueEvent
  | MatchCreatedEvent
  | GameStartedEvent
  | GameEndedEvent
  | WalletUpdatedEvent
  | LeaderboardUpdatedEvent;
