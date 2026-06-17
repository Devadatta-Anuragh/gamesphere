import type { DomainEvent, DomainEventType } from '@gamesphere/shared';
import type { Logger } from '@/shared/logger.js';
import type {
  EventBus,
  EventHandler,
} from '../domain/event-bus.js';

/**
 * Synchronous, single-process event bus. Handlers are isolated: one throwing
 * never prevents the others from running and never fails the publisher (events
 * are best-effort side-effects, not part of the producer's transaction).
 */
export class InProcessEventBus implements EventBus {
  private readonly handlers = new Map<DomainEventType, EventHandler[]>();

  constructor(private readonly logger: Logger) {}

  subscribe(type: DomainEventType, handler: EventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async publish(event: DomainEvent): Promise<void> {
    const list = this.handlers.get(event.type) ?? [];
    await Promise.all(
      list.map(async (handler) => {
        try {
          await handler(event);
        } catch (err) {
          this.logger.error(
            { err, eventType: event.type },
            'Event handler failed',
          );
        }
      }),
    );
  }
}
