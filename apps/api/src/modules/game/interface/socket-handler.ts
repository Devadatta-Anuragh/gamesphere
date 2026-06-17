import type { Socket, DefaultEventsMap } from 'socket.io';
import type { SocketData } from '@/infrastructure/ws/socket-server.js';
import type { AppError } from '@/shared/errors.js';
import type { GameService } from '../application/game-service.js';

type GameSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

const asMatchId = (payload: unknown): string | null => {
  const id = (payload as { matchId?: unknown })?.matchId;
  return typeof id === 'string' ? id : null;
};

/**
 * Registers the realtime game protocol on a connected socket. Handlers are thin:
 * parse the payload, delegate to the GameService, and relay any domain error
 * back to the caller. All game logic and authority live in the service.
 */
export const registerGameHandlers =
  (service: GameService) =>
  (socket: GameSocket): void => {
    const userId = socket.data.userId;
    const fail = (e: AppError): void => {
      socket.emit('game:error', { code: e.code, message: e.message });
    };

    socket.on('game:join', (payload: unknown) => {
      const matchId = asMatchId(payload);
      if (!matchId) return;
      void socket.join(`match:${matchId}`);
      void service.handleJoin(userId, matchId).then((r) => {
        if (!r.ok) fail(r.error);
      });
    });

    socket.on('game:roll', (payload: unknown) => {
      const matchId = asMatchId(payload);
      if (!matchId) return;
      const r = service.handleRoll(userId, matchId);
      if (!r.ok) fail(r.error);
    });

    socket.on('game:move', (payload: unknown) => {
      const matchId = asMatchId(payload);
      const tokenIndex = (payload as { tokenIndex?: unknown })?.tokenIndex;
      if (!matchId || typeof tokenIndex !== 'number') return;
      const r = service.handleMove(userId, matchId, tokenIndex);
      if (!r.ok) fail(r.error);
    });

    socket.on('disconnect', () => {
      service.handleDisconnect(userId);
    });
  };
