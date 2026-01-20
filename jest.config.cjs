// jest.config.cjs
/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest',
  },
  // Transform ESM packages that Jest can't handle natively
  transformIgnorePatterns: [
    'node_modules/(?!(jira\\.js|mime)/)',
  ],
  setupFiles: ['dotenv/config', '<rootDir>/__tests__/setup.ts'],
  reporters: ['default', 'jest-junit'],
  testTimeout: 50000,
  verbose: true,
};
module.exports = config;
