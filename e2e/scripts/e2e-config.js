'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getE2EConfig = exports.defaultConfig = void 0;
/**
 * Default configuration for local Jira DC E2E testing
 */
exports.defaultConfig = {
  jira: {
    baseUrl: process.env.E2E_JIRA_BASE_URL || 'http://localhost:8080',
    auth: {
      type: 'basic',
      username: process.env.E2E_JIRA_USERNAME || 'admin',
      password: process.env.E2E_JIRA_PASSWORD || 'admin',
    },
  },
  test: {
    projectKey: 'E2E',
    projectName: 'E2E Project',
    initialVersion: '1.0.0',
    issueType: 'Task',
  },
  timeouts: {
    jiraReady: 300000,
    apiCall: 30000,
    testTimeout: 60000, // 1 minute for individual tests
  },
};
/**
 * Get configuration for E2E tests
 * Can be extended to support Jira Cloud by changing environment variables
 */
function getE2EConfig() {
  // For future Cloud testing, check for Cloud-specific env vars
  if (process.env.E2E_JIRA_EMAIL && process.env.E2E_JIRA_API_TOKEN) {
    return {
      ...exports.defaultConfig,
      jira: {
        baseUrl: process.env.E2E_JIRA_BASE_URL || exports.defaultConfig.jira.baseUrl,
        auth: {
          type: 'cloud',
          email: process.env.E2E_JIRA_EMAIL,
          apiToken: process.env.E2E_JIRA_API_TOKEN,
        },
      },
    };
  }
  return exports.defaultConfig;
}
exports.getE2EConfig = getE2EConfig;
