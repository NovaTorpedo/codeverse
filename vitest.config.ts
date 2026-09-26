import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'demo/*/test/**/*.test.ts', 'scripts/test/**/*.test.ts', 'apps/viewer/src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
