import type { RequestHandler } from 'express';
import { AppError } from '@/shared/errors.js';
import type { TokenService } from '@/modules/auth/domain/token-service.js';

/**
 * Verifies a `Authorization: Bearer <jwt>` header and attaches `req.userId`.
 * Depends only on the TokenService port, so it is agnostic to JWT specifics.
 */
export const createAuthGuard =
  (tokens: TokenService): RequestHandler =>
  (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(
        AppError.unauthorized('MISSING_TOKEN', 'Missing bearer token'),
      );
    }
    const result = tokens.verify(header.slice('Bearer '.length).trim());
    if (!result.ok) {
      return next(result.error);
    }
    req.userId = result.value;
    next();
  };
