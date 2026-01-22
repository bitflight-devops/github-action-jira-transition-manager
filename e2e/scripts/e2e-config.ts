/**
 * Central configuration for E2E tests
 * This configuration can be swapped to point to Jira Cloud for future testing
 */
export interface E2EConfig {
  jira: {
    baseUrl: string;
    // For Jira DC local testing, use basic auth
    auth: {
      type: 'basic' | 'cloud';
      // Basic auth (DC)
      username?: string;
      password?: string;
      // Cloud auth
      email?: string;
      apiToken?: string;
    };
  };
  test: {
    projectKey: string;
    projectName: string;
    initialVersion: string;
    issueType: string;
  };
  timeouts: {
    jiraReady: number;
    apiCall: number;
    testTimeout: number;
  };
}

/**
 * Default configuration for local Jira DC E2E testing
 */
export const defaultConfig: E2EConfig = {
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
    jiraReady: 600000, // 10 minutes for Jira to be ready (DC takes longer on first run)
    apiCall: 30000, // 30 seconds for individual API calls
    testTimeout: 60000, // 1 minute for individual tests
  },
};

/**
 * Get configuration for E2E tests
 * Can be extended to support Jira Cloud by changing environment variables
 */
export function getE2EConfig(): E2EConfig {
  // For future Cloud testing, check for Cloud-specific env vars
  if (process.env.E2E_JIRA_EMAIL && process.env.E2E_JIRA_API_TOKEN) {
    return {
      ...defaultConfig,
      jira: {
        baseUrl: process.env.E2E_JIRA_BASE_URL || defaultConfig.jira.baseUrl,
        auth: {
          type: 'cloud',
          email: process.env.E2E_JIRA_EMAIL,
          apiToken: process.env.E2E_JIRA_API_TOKEN,
        },
      },
    };
  }

  return defaultConfig;
}
