#!/usr/bin/env node
/**
 * Seed Jira with minimal test data
 * Idempotent - safe to run multiple times
 */
import { getE2EConfig } from './e2e-config';
import { JiraE2EClient } from './jira-client';

async function seedJira(): Promise<void> {
  const config = getE2EConfig();
  const client = new JiraE2EClient(config);

  console.log('Starting Jira seeding...');

  try {
    // 1. Configure screens to include fixVersions field
    console.log('Configuring screens for fixVersions...');
    await client.configureScreensForFixVersions();
    console.log('✓ Screen configuration complete');

    // 2. Ensure project exists
    console.log(`Ensuring project ${config.test.projectKey} exists...`);
    const project = await client.ensureProject(config.test.projectKey, config.test.projectName);
    console.log(`✓ Project: ${project.key} - ${project.name}`);

    // 3. Ensure initial version exists
    console.log(`Ensuring version ${config.test.initialVersion} exists...`);
    const version = await client.ensureVersion(config.test.projectKey, config.test.initialVersion);
    console.log(`✓ Version: ${version.name} (ID: ${version.id})`);

    // 3. Ensure test issue exists
    console.log('Ensuring test issue exists...');
    const issue = await client.ensureIssue(config.test.projectKey, 'E2E Test Issue', config.test.issueType, [
      config.test.initialVersion,
    ]);
    console.log(`✓ Issue: ${issue.key} - ${issue.fields.summary}`);

    console.log('\n✓ Seeding complete!');
    console.log(`Project: ${project.key}`);
    console.log(`Initial Version: ${version.name}`);
    console.log(`Test Issue: ${issue.key}`);
  } catch (error) {
    console.error('✗ Seeding failed:', error);
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
