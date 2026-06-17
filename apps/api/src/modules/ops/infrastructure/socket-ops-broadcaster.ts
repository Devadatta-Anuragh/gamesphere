import type { AppSocketServer } from '@/infrastructure/ws/socket-server.js';
import type { OpsBroadcaster } from '../application/ports.js';

export const OPS_ROOM = 'ops';

/** Emits to the global `ops` room that every connected socket auto-joins. */
export class SocketOpsBroadcaster implements OpsBroadcaster {
  constructor(private readonly io: AppSocketServer) {}

  broadcast(event: string, data: unknown): void {
    this.io.to(OPS_ROOM).emit(event, data);
  }
}
