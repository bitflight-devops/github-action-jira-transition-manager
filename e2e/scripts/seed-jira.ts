#!/usr/bin/env node
/**
 * Seed Jira with minimal test data
 * Idempotent - safe to run multiple times
 */
import { getE2EConfig } from './e2e-config';
import { JiraE2EClient } from './jira-client';

// Number of stack trace lines to show in error output
const STACK_TRACE_LINES = 5;

/**
 * Seeds Jira with minimal test data required for E2E testing.
 *
 * This function is idempotent and safe to run multiple times. It performs
 * the following setup steps in order:
 * 1. Configures screens to include fixVersions field
 * 2. Ensures the test project exists
 * 3. Ensures the initial version exists
 * 4. Ensures a test issue exists with the initial version
 *
 * @returns A promise that resolves when seeding is complete
 * @throws Error if project, version, or issue creation fails
 */
async function seedJira(): Promise<void> {
  const config = getE2EConfig();
  const client = new JiraE2EClient(config);

  console.log('Starting Jira seeding...');

  try {
    // 1. Configure screens to include fixVersions field
    console.log('\n1. Configuring screens for fixVersions...');
    try {
      await client.configureScreensForFixVersions();
      console.log('✓ Screen configuration complete');
    } catch (error) {
      console.error(`✗ Screen configuration failed: ${(error as Error).message}`);
      // Don't fail the entire seeding if screens fail - continue with project creation
    }

    // 2. Ensure project exists
    console.log(`\n2. Ensuring project ${config.test.projectKey} exists...`);
    const project = await client.ensureProject(config.test.projectKey, config.test.projectName);
    console.log(`✓ Project: ${project.key} - ${project.name} (Type: ${project.projectTypeKey})`);

    // 3. Ensure initial version exists
    console.log(`\n3. Ensuring version ${config.test.initialVersion} exists...`);
    const version = await client.ensureVersion(config.test.projectKey, config.test.initialVersion);
    console.log(`✓ Version: ${version.name} (ID: ${version.id})`);

    // 4. Ensure test issue exists
    console.log('\n4. Ensuring test issue exists...');
    const issue = await client.ensureIssue(config.test.projectKey, 'E2E Test Issue', config.test.issueType, [
      config.test.initialVersion,
    ]);
    console.log(`✓ Issue: ${issue.key} - ${issue.fields.summary}`);

    console.log('\n✅ Seeding complete!');
    console.log(`   Project: ${project.key}`);
    console.log(`   Initial Version: ${version.name}`);
    console.log(`   Test Issue: ${issue.key}`);
  } catch (error) {
    console.error('\n❌ Seeding failed!');
    console.error(`   Error: ${(error as Error).message}`);
    if (error instanceof Error && error.stack) {
      const stackLines = error.stack.split('\n').slice(0, STACK_TRACE_LINES);
      console.error(`   Stack:\n     ${stackLines.join('\n     ')}`);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedJira().catch((error) => {
    console.error('Failed to seed Jira:', error);
    process.exit(1);
  });
}

export { seedJira };
