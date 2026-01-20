#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.waitForJira = void 0;
/**
 * Wait for Jira to be ready
 * Polls Jira until it responds to authenticated requests
 */
const e2e_config_1 = require('./e2e-config');
const jira_client_1 = require('./jira-client');
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForJira() {
  const config = (0, e2e_config_1.getE2EConfig)();
  const client = new jira_client_1.JiraE2EClient(config);
  const startTime = Date.now();
  const timeout = config.timeouts.jiraReady;
  const pollInterval = 5000; // 5 seconds
  console.log(`Waiting for Jira at ${config.jira.baseUrl}...`);
  console.log(`Timeout: ${timeout / 1000}s`);
  let lastError = null;
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
      lastError = error;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏳ Waiting... (${elapsed}s/${timeout / 1000}s) - ${lastError.message}`);
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
exports.waitForJira = waitForJira;
// Run if called directly
if (require.main === module) {
  waitForJira().catch((error) => {
    console.error('Failed to wait for Jira:', error);
    process.exit(1);
  });
}
