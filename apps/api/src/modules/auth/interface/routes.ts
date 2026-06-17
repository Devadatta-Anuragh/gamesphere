import { Router, type RequestHandler } from 'express';
import { asyncHandler } from '@/infrastructure/http/http-helpers.js';
import type { AuthController } from './auth.controller.js';
import type { UserController } from './user.controller.js';

/**
 * Wires the auth/user module's HTTP routes. The auth guard is injected so the
 * module does not depend on how authentication is implemented.
 */
export const createAuthRoutes = (
  auth: AuthController,
  users: UserController,
  authGuard: RequestHandler,
): Router => {
  const router = Router();

  // Public
  router.post('/auth/login', asyncHandler(auth.login));

  // Authenticated
  router.get('/users/me', authGuard, asyncHandler(users.me));

  return router;
};
