import type { DomainEvent, DomainEventType } from '@gamesphere/shared';

export type EventHandler<E extends DomainEvent = DomainEvent> = (
  event: E,
) => Promise<void> | void;

/** Fire-and-forget publish side of the bus. Producers depend only on this. */
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

/** Subscription side. Reactors (leaderboard, notifications, anti-cheat) use this. */
export interface EventSubscriber {
  subscribe(type: DomainEventType, handler: EventHandler): void;
}

/**
 * The event bus decouples modules: the game service publishes GAME_ENDED and
 * has no idea the leaderboard, wallet-notifier and anti-cheat all react to it.
 * P4/P5 use an in-process implementation; P6 swaps in a Redis Pub/Sub transport
 * for cross-instance fan-out — producers/consumers are untouched (DIP).
 */
export interface EventBus extends EventPublisher, EventSubscriber {}
