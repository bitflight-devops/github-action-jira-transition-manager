// jest.config.cjs
/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFiles: ['dotenv/config'],
  reporters: ['default', 'jest-junit'],
  testTimeout: 50000,
  verbose: true,
};
module.exports = config;
