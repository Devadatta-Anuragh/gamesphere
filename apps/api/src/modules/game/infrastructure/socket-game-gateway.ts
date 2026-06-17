import type { AppSocketServer } from '@/infrastructure/ws/socket-server.js';
import type { GameGateway } from '../domain/game-gateway.js';

/** Socket.IO implementation of the game gateway: room and per-user fan-out. */
export class SocketGameGateway implements GameGateway {
  constructor(private readonly io: AppSocketServer) {}

  toRoom(matchId: string, event: string, data: unknown): void {
    this.io.to(`match:${matchId}`).emit(event, data);
  }

  toUser(userId: string, event: string, data: unknown): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }
}
