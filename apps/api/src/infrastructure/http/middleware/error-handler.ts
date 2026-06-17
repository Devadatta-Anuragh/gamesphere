import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from '@/shared/logger.js';
import { AppError, ErrorKind, isAppError } from '@/shared/errors.js';

/** 404 for any unmatched route, expressed as a normal AppError. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound('ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.path}`));
};

/**
 * The single place that turns errors into HTTP responses. Known AppErrors map
 * to their status + a stable code; anything else is treated as an unexpected
 * 500 and logged at error level (its message is never leaked to the client).
 */
export const createErrorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (error, req, res, _next) => {
    const appError = isAppError(error)
      ? error
      : AppError.internal('INTERNAL_ERROR', 'Unexpected error');

    if (appError.kind === ErrorKind.Internal) {
      logger.error({ err: error, path: req.path }, 'Unhandled error');
    } else {
      logger.debug({ code: appError.code, path: req.path }, appError.message);
    }

    res.status(appError.httpStatus).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details ? { details: appError.details } : {}),
      },
    });
  };
