import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/e2e/**/*.e2e.test.ts'],
    setupFiles: ['dotenv/config'],
    testTimeout: 60000,
    hookTimeout: 60000,
    clearMocks: true,
    // Run e2e tests sequentially
    maxWorkers: 1,
    isolate: false,
  },
});
