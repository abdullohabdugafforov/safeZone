import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    // e2e suites share one database; run files sequentially.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
