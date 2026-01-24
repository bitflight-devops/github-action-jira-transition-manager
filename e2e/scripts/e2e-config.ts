/**
 * Central configuration interface for E2E tests.
 *
 * This configuration can be swapped to point to Jira Cloud for future testing
 * by setting the appropriate environment variables.
 *
 * @property jira - Jira server connection settings
 * @property jira.baseUrl - The base URL of the Jira instance
 * @property jira.auth - Authentication configuration (basic for DC, cloud for Jira Cloud)
 * @property test - Test-specific settings for project and issue creation
 * @property test.projectKey - The key used for the test project (e.g., 'E2E')
 * @property test.projectName - Human-readable name for the test project
 * @property test.initialVersion - Version string to create in the test project
 * @property test.issueType - Issue type to use when creating test issues
 * @property timeouts - Timeout values in milliseconds for various operations
 * @property timeouts.jiraReady - Maximum wait time for Jira to become ready
 * @property timeouts.apiCall - Timeout for individual API calls
 * @property timeouts.testTimeout - Timeout for individual test cases
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
 * Default configuration for local Jira Data Center E2E testing.
 *
 * Uses environment variables when available, falling back to sensible defaults
 * for local Docker-based testing.
 *
 * Environment variables:
 * - `E2E_JIRA_BASE_URL` - Jira base URL (default: 'http://localhost:8080')
 * - `E2E_JIRA_USERNAME` - Basic auth username (default: 'admin')
 * - `E2E_JIRA_PASSWORD` - Basic auth password (default: 'admin')
 *
 * @type {E2EConfig}
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
 * Get configuration for E2E tests.
 *
 * Returns a Jira Cloud configuration if `E2E_JIRA_EMAIL` and `E2E_JIRA_API_TOKEN`
 * environment variables are set; otherwise returns the default Data Center
 * configuration with basic authentication.
 *
 * @returns The E2E configuration object appropriate for the detected environment
 *
 * @example
 * // For Jira Data Center (default)
 * const config = getE2EConfig();
 * // config.jira.auth.type === 'basic'
 *
 * @example
 * // For Jira Cloud (set env vars first)
 * // E2E_JIRA_EMAIL=user@example.com
 * // E2E_JIRA_API_TOKEN=your-api-token
 * const config = getE2EConfig();
 * // config.jira.auth.type === 'cloud'
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
