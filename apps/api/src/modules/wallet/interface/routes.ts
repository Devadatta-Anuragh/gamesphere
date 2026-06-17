import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@/infrastructure/http/http-helpers.js';
import type { WalletController } from './wallet.controller.js';

export const createWalletRoutes = (
  wallet: WalletController,
  authGuard: RequestHandler,
): Router => {
  const router = Router();
  router.get('/wallet', authGuard, asyncHandler(wallet.view));
  router.post('/wallet/deposit', authGuard, asyncHandler(wallet.deposit));
  return router;
};
