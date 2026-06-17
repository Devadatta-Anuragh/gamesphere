import express, { type Express, type Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from '@/config/env.js';
import type { Logger } from '@/shared/logger.js';
import type { MetricsRegistry } from '@/infrastructure/metrics/metrics-registry.js';
import { sendOk } from './http-helpers.js';
import {
  createErrorHandler,
  notFoundHandler,
} from './middleware/error-handler.js';
import './express-augment.js';

export interface HttpDeps {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly metrics: MetricsRegistry;
  /** Lets the composition root attach module routers under `/api`. */
  readonly mountApi: (router: Router) => void;
  /**
   * Pre-built router mounted at `/api/ops` WITHOUT rate limiting. Passed in
   * (rather than populated via callback) so its routes can be attached later —
   * the ops controller depends on the Socket.IO server, which is created after
   * the Express app.
   */
  readonly opsRouter: Router;
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
  metrics,
  mountApi,
  opsRouter,
}: HttpDeps): Express => {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.use(pinoHttp({ logger }));

  // Record latency/status of every request for the metrics endpoint.
  app.use((_req, res, next) => {
    const start = Date.now();
    res.on('finish', () => metrics.record(Date.now() - start, res.statusCode));
    next();
  });

  // Liveness/readiness probe — outside /api and rate limiting.
  app.get('/health', (_req, res) => {
    sendOk(res, { status: 'ok', uptime: process.uptime() });
  });

  // Ops/observability routes: read-only and polled by the dashboard, so they
  // are mounted WITHOUT the rate limiter that protects the rest of the API.
  // The router is populated by the composition root after Socket.IO is ready.
  app.use('/api/ops', opsRouter);

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
