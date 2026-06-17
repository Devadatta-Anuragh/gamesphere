import { Router } from 'express';
import { asyncHandler } from '@/infrastructure/http/http-helpers.js';
import type { LeaderboardController } from './leaderboard.controller.js';

export const createLeaderboardRoutes = (
  controller: LeaderboardController,
): Router => {
  const router = Router();
  // Public ranking board.
  router.get('/leaderboard', asyncHandler(controller.top));
  return router;
};
