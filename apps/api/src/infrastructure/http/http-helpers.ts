import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async handler so any thrown error (or rejected promise) is forwarded
 * to Express' error middleware instead of crashing the process. Lets controller
 * bodies be plain `async` functions with no try/catch boilerplate.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Uniform success envelope: { data: ... }. */
export const sendOk = <T>(res: Response, data: T, status = 200): void => {
  res.status(status).json({ data });
};
