#!/usr/bin/env node
/**
 * Wait for Jira to be ready
 * Polls Jira until it responds to authenticated requests
 */
import { getE2EConfig } from './e2e-config';
import { JiraE2EClient } from './jira-client';

/**
 * Pauses execution for the specified duration.
 * @param ms - The number of milliseconds to sleep
 * @returns A promise that resolves after the specified delay
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for Jira to become ready by polling the status and authenticated endpoints.
 *
 * Polls the Jira instance with a 5-second interval until:
 * - HTTP status endpoint responds successfully
 * - Server info can be retrieved
 * - Authentication is verified
 *
 * Implements fail-fast behavior: exits early if the same error occurs 6 consecutive times
 * (30 seconds of identical errors) to avoid wasting CI time.
 *
 * @returns A promise that resolves when Jira is ready
 * @throws Exits process with code 1 if times out (2 minutes) or the same error occurs repeatedly
 */
async function waitForJira(): Promise<void> {
  const config = getE2EConfig();
  const client = new JiraE2EClient(config);
  const startTime = Date.now();
  const timeout = 120000; // 2 minutes max, not 600s
  const pollInterval = 5000; // 5 seconds

  console.log(`Waiting for Jira at ${config.jira.baseUrl}...`);
  console.log(`Timeout: ${timeout / 1000}s (fail-fast on repeated errors)`);

  let lastError: Error | null = null;
  let consecutiveSameError = 0;
  let lastErrorMessage = '';
  const maxConsecutiveSameError = 6; // 30 seconds of same error = fail

  while (Date.now() - startTime < timeout) {
    try {
      // First check if HTTP is up
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${config.jira.baseUrl}/status`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }

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
      const errorMsg = lastError.message;

      // Track consecutive same errors for fail-fast
      if (errorMsg === lastErrorMessage) {
        consecutiveSameError++;
        if (consecutiveSameError >= maxConsecutiveSameError) {
          console.error(`✗ Same error ${consecutiveSameError} times in a row - failing fast`);
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
    console.error('Last error:', lastError.message);
  }
  process.exit(1);
}

// Run if called directly
if (require.main === module) {
  waitForJira().catch((error) => {
    console.error('Failed to wait for Jira:', error);
    process.exit(1);
  });
}

export { waitForJira };
