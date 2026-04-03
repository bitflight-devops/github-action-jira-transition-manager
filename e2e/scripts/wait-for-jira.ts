#!/usr/bin/env node
/**
 * Wait for Jira to be ready
 * Polls Jira until it responds to authenticated requests
 */
import http from 'node:http';
import { getE2EConfig } from './e2e-config.js';
import { JiraE2EClient } from './jira-client.js';

/**
 * Pauses execution for the specified duration.
 * @param ms - The number of milliseconds to sleep
 * @returns A promise that resolves after the specified delay
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Makes an HTTP GET request using Node.js http module.
 * Unlike fetch(), this provides detailed error codes (ECONNREFUSED, ECONNRESET, etc.)
 */
function httpGet(url: string, timeoutMs: number): Promise<{ statusCode: number }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      // Consume response body to free socket
      res.resume();
      resolve({ statusCode: res.statusCode ?? 0 });
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

/**
 * Waits for Jira to become ready by polling the status and authenticated endpoints.
 *
 * Polls the Jira instance with a 5-second interval until:
 * - HTTP status endpoint responds successfully
 * - Server info can be retrieved
 * - Authentication is verified
 *
 * Implements fail-fast behavior: exits early if the same error occurs 36 consecutive times
 * (3 minutes of identical errors) AND Jira has responded successfully before (regression).
 * During initial startup, errors are expected and the full timeout is used.
 *
 * @returns A promise that resolves when Jira is ready
 * @throws Exits process with code 1 if times out or regression detected
 */
async function waitForJira(): Promise<void> {
  const config = getE2EConfig();
  const client = new JiraE2EClient(config);
  const startTime = Date.now();
  const timeout = config.timeouts.jiraReady; // Use config timeout (default 10 minutes)
  const pollInterval = 5000; // 5 seconds

  console.log(`Waiting for Jira at ${config.jira.baseUrl}...`);
  console.log(`Timeout: ${timeout / 1000}s`);

  let lastError: Error | null = null;
  let consecutiveSameError = 0;
  let lastErrorMessage = '';
  let hasEverResponded = false; // Track if Jira ever responded successfully
  const maxConsecutiveSameError = 36; // 3 minutes of same error = fail (only after success)

  while (Date.now() - startTime < timeout) {
    try {
      // First check if HTTP is up using http module (provides detailed error codes)
      const result = await httpGet(`${config.jira.baseUrl}/status`, 5000);

      if (result.statusCode < 200 || result.statusCode >= 400) {
        throw new Error(`HTTP status: ${result.statusCode}`);
      }

      // Jira responded - mark for fail-fast eligibility on future errors
      hasEverResponded = true;
      console.log('✓ Jira HTTP is up');

      // Now try authenticated endpoint
      const serverInfo = await client.getServerInfo();
      console.log(`✓ Jira server info: ${serverInfo.version}`);

      const user = await client.getMyself();
      console.log(`✓ Authenticated as: ${user.displayName}`);

      console.log('✓ Jira is ready!');
      return;
    } catch (error) {
      lastError = error as Error;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const errorCode = (lastError as NodeJS.ErrnoException).code;
      const errorMsg = errorCode ? `${lastError.message} (${errorCode})` : lastError.message;

      // Track consecutive same errors for fail-fast (only after Jira has responded once)
      if (errorMsg === lastErrorMessage) {
        consecutiveSameError++;
        // Only fail-fast if Jira was working before (regression detection)
        if (hasEverResponded && consecutiveSameError >= maxConsecutiveSameError) {
          console.error(`✗ Same error ${consecutiveSameError} times after Jira was responding - failing fast`);
          console.error(`Error: ${errorMsg}`);
          process.exit(1);
        }
      } else {
        consecutiveSameError = 1;
        lastErrorMessage = errorMsg;
      }

      console.log(`⏳ Waiting... (${elapsed}s/${timeout / 1000}s) - ${errorMsg}`);
      await sleep(pollInterval);
    }
  }

  // Timeout reached
  console.error('✗ Timeout waiting for Jira to be ready');
  if (lastError) {
    const errorCode = (lastError as NodeJS.ErrnoException).code;
    console.error('Last error:', lastError.message, errorCode ? `(${errorCode})` : '');
  }
  process.exit(1);
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  waitForJira().catch((error) => {
    console.error('Failed to wait for Jira:', error);
    process.exit(1);
  });
}

export { waitForJira };
