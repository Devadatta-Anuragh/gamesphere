import type { Redis } from 'ioredis';
import type { DomainEvent, DomainEventType } from '@gamesphere/shared';
import type { Logger } from '@/shared/logger.js';
import type { EventBus, EventHandler } from '../domain/event-bus.js';

const CHANNEL = 'gamesphere:events';

/**
 * Redis Pub/Sub transport for the event bus. Publishing PUBLISHes to a channel;
 * a dedicated subscriber connection receives every event (including this
 * instance's own) and dispatches to local handlers — so fan-out works across
 * many API instances. Delivery is at-most-once (fire-and-forget); durable
 * delivery would use Redis Streams instead (see design docs).
 */
export class RedisEventBus implements EventBus {
  private readonly handlers = new Map<DomainEventType, EventHandler[]>();

  constructor(
    private readonly pub: Redis,
    private readonly sub: Redis,
    private readonly logger: Logger,
  ) {
    void this.sub.subscribe(CHANNEL);
    this.sub.on('message', (_channel, message) => {
      void this.dispatch(message);
    });
  }

  subscribe(type: DomainEventType, handler: EventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.pub.publish(CHANNEL, JSON.stringify(event));
  }

  private async dispatch(message: string): Promise<void> {
    let event: DomainEvent;
    try {
      event = JSON.parse(message) as DomainEvent;
    } catch {
      this.logger.warn('Dropping malformed event message');
      return;
    }
    const list = this.handlers.get(event.type) ?? [];
    await Promise.all(
      list.map(async (handler) => {
        try {
          await handler(event);
        } catch (err) {
          this.logger.error({ err, eventType: event.type }, 'Event handler failed');
        }
      }),
    );
  }
}
