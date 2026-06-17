import type { Server as HttpServer } from 'node:http';
import { Server, type DefaultEventsMap } from 'socket.io';
import type { UserId } from '@gamesphere/shared';
import type { AppConfig } from '@/config/env.js';
import type { Logger } from '@/shared/logger.js';
import type { TokenService } from '@/modules/auth/domain/token-service.js';

/** Per-connection state attached after the auth handshake. */
export interface SocketData {
  userId: UserId;
}

export type AppSocketServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

interface SocketDeps {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly tokens: TokenService;
}

/**
 * Creates the Socket.IO gateway. Authentication happens once, in a connection
 * middleware: the JWT from `handshake.auth.token` is verified and the resolved
 * userId is pinned to `socket.data`. Game/notification handlers (P5/P6) attach
 * to this server later; here we only establish authenticated transport.
 */
export const createSocketServer = (
  httpServer: HttpServer,
  { config, logger, tokens }: SocketDeps,
): AppSocketServer => {
  const io: AppSocketServer = new Server(httpServer, {
    cors: { origin: config.CORS_ORIGIN, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('UNAUTHORIZED'));
    const result = tokens.verify(token);
    if (!result.ok) return next(new Error('UNAUTHORIZED'));
    socket.data.userId = result.value;
    next();
  });

  io.on('connection', (socket) => {
    // Join a per-user room so events can be pushed to a specific player
    // regardless of which socket/instance they are on.
    void socket.join(`user:${socket.data.userId}`);
    logger.debug({ userId: socket.data.userId, sid: socket.id }, 'socket connected');
    socket.on('disconnect', (reason) => {
      logger.debug({ userId: socket.data.userId, reason }, 'socket disconnected');
    });
  });

  return io;
};
