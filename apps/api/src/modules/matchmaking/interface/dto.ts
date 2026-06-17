import { z } from 'zod';
import type { Match } from '../domain/match.js';
import type { MatchmakingStatus } from '../application/get-status.js';

export const JoinSchema = z.object({
  entryFee: z.number().int().positive(),
});

export const LeaveSchema = z.object({
  entryFee: z.number().int().positive(),
});

const toMatchDto = (m: Match) => ({
  id: m.id,
  roomId: m.roomId,
  status: m.status,
  entryFee: m.entryFee,
  pool: m.pool,
  players: m.players.map((p) => ({ userId: p.userId, seat: p.seat })),
});

export const toStatusDto = (status: MatchmakingStatus) => ({
  state: status.match ? 'matched' : status.queuedTiers.length > 0 ? 'queued' : 'idle',
  match: status.match ? toMatchDto(status.match) : null,
  queuedTiers: status.queuedTiers,
});
