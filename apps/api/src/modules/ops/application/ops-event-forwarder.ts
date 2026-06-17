import { DomainEventType } from '@gamesphere/shared';
import type { EventSubscriber } from '@/modules/events/domain/event-bus.js';
import type { OpsBroadcaster } from './ports.js';

/**
 * Bridges the domain event bus to the realtime `ops` room: every domain event
 * is forwarded to connected dashboards as `ops:event`, powering the live
 * activity feed. Read-only fan-out — it never mutates anything.
 */
export class OpsEventForwarder {
  constructor(
    private readonly subscriber: EventSubscriber,
    private readonly broadcaster: OpsBroadcaster,
  ) {}

  register(): void {
    for (const type of Object.values(DomainEventType)) {
      this.subscriber.subscribe(type, (event) => {
        this.broadcaster.broadcast('ops:event', {
          type: event.type,
          occurredAt: event.occurredAt,
          payload: event.payload,
        });
      });
    }
  }
}
