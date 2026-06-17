import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendOk } from '@/infrastructure/http/http-helpers.js';
import { parse } from '@/infrastructure/http/validate.js';
import type { GetLeaderboard } from '../application/get-leaderboard.js';

const QuerySchema = z.object({
  scope: z.enum(['global', 'daily', 'weekly']).default('global'),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export class LeaderboardController {
  constructor(private readonly getLeaderboard: GetLeaderboard) {}

  top = async (req: Request, res: Response): Promise<void> => {
    const { scope, limit } = parse(QuerySchema, req.query);
    const result = await this.getLeaderboard.execute(scope, limit);
    if (!result.ok) throw result.error;
    sendOk(res, { scope, entries: result.value });
  };
}
