import 'dotenv/config';

import { loadEnv, type Env } from '../src/config/env.js';

/** Env for e2e tests: separate Postgres database and Redis logical DB. */
export function testEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error('TEST_DATABASE_URL is not set (see apps/backend/.env.example)');
  const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6380');
  redisUrl.pathname = '/15';
  return loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl.toString(),
    SMS_PROVIDER: 'console',
    PUSH_PROVIDER: 'console',
    ...overrides,
  });
}
