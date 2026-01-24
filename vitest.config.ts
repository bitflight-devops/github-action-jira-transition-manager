import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    setupFiles: ['dotenv/config', './__tests__/setup.ts'],
    testTimeout: 50000,
    clearMocks: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'e2e/'],
    },
  },
});
