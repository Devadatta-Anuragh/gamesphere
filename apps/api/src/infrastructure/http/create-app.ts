import express, { type Express, type Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from '@/config/env.js';
import type { Logger } from '@/shared/logger.js';
import { sendOk } from './http-helpers.js';
import {
  createErrorHandler,
  notFoundHandler,
} from './middleware/error-handler.js';
import './express-augment.js';

export interface HttpDeps {
  readonly config: AppConfig;
  readonly logger: Logger;
  /** Lets the composition root attach module routers under `/api`. */
  readonly mountApi: (router: Router) => void;
}

/**
 * Assembles the Express application: security middleware, request logging with
 * a per-request id (tracing), body parsing, rate limiting, health probe, the
 * module routers, and finally the not-found + error handlers (which must be
 * registered last). Knows nothing about specific modules.
 */
export const createHttpApp = ({
  config,
  logger,
  mountApi,
}: HttpDeps): Express => {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.use(pinoHttp({ logger }));

  // Liveness/readiness probe — outside /api and rate limiting.
  app.get('/health', (_req, res) => {
    sendOk(res, { status: 'ok', uptime: process.uptime() });
  });

  const apiRouter = express.Router();
  apiRouter.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  mountApi(apiRouter);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
};
