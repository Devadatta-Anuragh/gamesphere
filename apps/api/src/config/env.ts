import { z } from 'zod';

/**
 * Fail fast on misconfiguration: the process refuses to boot if any required
 * env var is missing or malformed, with a readable aggregated error. Nothing
 * else in the codebase reads `process.env` directly — they take typed `AppConfig`.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DEFAULT_RAKE_BPS: z.coerce.number().int().min(0).max(10_000).default(1000),
  SIGNUP_BONUS_MINOR: z.coerce.number().int().min(0).default(50_000),
  TURN_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  DISCONNECT_GRACE_MS: z.coerce.number().int().positive().default(30_000),
});

export type AppConfig = Readonly<z.infer<typeof EnvSchema>> & {
  readonly isProduction: boolean;
  readonly isTest: boolean;
};

export const loadConfig = (
  source: NodeJS.ProcessEnv = process.env,
): AppConfig => {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === 'production',
    isTest: parsed.data.NODE_ENV === 'test',
  };
};
