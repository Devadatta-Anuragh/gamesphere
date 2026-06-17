import { Router } from 'express';
import { asyncHandler } from '@/infrastructure/http/http-helpers.js';
import type { OpsController } from './ops.controller.js';

/** Mounted under /api/ops (unthrottled — polled by the dashboard). */
export const createOpsRoutes = (controller: OpsController): Router => {
  const router = Router();
  router.get('/overview', asyncHandler(controller.overview));
  router.get('/metrics', asyncHandler(controller.metrics));
  router.get('/ledger-integrity', asyncHandler(controller.ledgerIntegrity));
  return router;
};
