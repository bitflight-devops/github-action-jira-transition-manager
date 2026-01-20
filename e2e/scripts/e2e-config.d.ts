/**
 * Central configuration for E2E tests
 * This configuration can be swapped to point to Jira Cloud for future testing
 */
export interface E2EConfig {
  jira: {
    baseUrl: string;
    auth: {
      type: 'basic' | 'cloud';
      username?: string;
      password?: string;
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
export declare const defaultConfig: E2EConfig;
/**
 * Get configuration for E2E tests
 * Can be extended to support Jira Cloud by changing environment variables
 */
export declare function getE2EConfig(): E2EConfig;
