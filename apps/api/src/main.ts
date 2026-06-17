import process from 'node:process';
import { loadConfig } from './config/env.js';
import { buildApp } from './composition/build-app.js';

/**
 * Process entrypoint. Loads configuration, builds the application via the
 * composition root, starts listening, and installs graceful-shutdown handlers.
 */
async function main(): Promise<void> {
  // Load apps/api/.env in dev if present; in production env comes from the host.
  try {
    process.loadEnvFile(new URL('../.env', import.meta.url).pathname);
  } catch {
    // No .env file — rely on the ambient environment.
  }

  const config = loadConfig();
  const ctx = await buildApp(config);

  ctx.httpServer.listen(config.PORT, () => {
    ctx.logger.info(
      { port: config.PORT, env: config.NODE_ENV },
      'GameSphere API listening',
    );
  });

  const stop = (signal: string): void => {
    ctx.logger.info({ signal }, 'Received shutdown signal');
    ctx
      .shutdown()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        ctx.logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      });
  };

  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
}

main().catch((error: unknown) => {
  // logger may not exist yet at this point, so fall back to stderr
  console.error('Fatal during bootstrap:', error);
  process.exit(1);
});
