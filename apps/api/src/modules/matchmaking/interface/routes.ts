import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@/infrastructure/http/http-helpers.js';
import type { MatchmakingController } from './matchmaking.controller.js';

export const createMatchmakingRoutes = (
  controller: MatchmakingController,
  authGuard: RequestHandler,
): Router => {
  const router = Router();
  router.post('/matchmaking/join', authGuard, asyncHandler(controller.join));
  router.post('/matchmaking/leave', authGuard, asyncHandler(controller.leave));
  router.get('/matchmaking/status', authGuard, asyncHandler(controller.status));
  return router;
};
