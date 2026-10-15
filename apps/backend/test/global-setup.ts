import { execSync } from 'node:child_process';

import { testEnv } from './env.js';

/** Applies migrations to the test database once per e2e run. */
export default function setup(): void {
  const env = testEnv();
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
    stdio: 'pipe',
  });
}
