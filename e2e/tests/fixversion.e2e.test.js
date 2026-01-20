'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
/**
 * E2E tests for FixVersion management
 * Tests the action logic against a real Jira instance
 */
const e2e_config_1 = require('../scripts/e2e-config');
const jira_client_1 = require('../scripts/jira-client');
describe('FixVersion E2E Tests', () => {
  let config;
  let client;
  const projectKey = 'E2E';
  beforeAll(async () => {
    config = (0, e2e_config_1.getE2EConfig)();
    client = new jira_client_1.JiraE2EClient(config);
    // Verify Jira is ready
    const serverInfo = await client.getServerInfo();
    console.log(`Connected to Jira ${serverInfo.version}`);
  }, 300000); // 5 minutes timeout for Jira readiness
  describe('Project and Version Setup', () => {
    it(
      'should have the test project',
      async () => {
        const project = await client.ensureProject(config.test.projectKey, config.test.projectName);
        expect(project).toBeDefined();
        expect(project.key).toBe(config.test.projectKey);
        expect(project.name).toBe(config.test.projectName);
      },
      config.timeouts.testTimeout,
    );
    it(
      'should have the initial version',
      async () => {
        const versions = await client.listProjectVersions(projectKey);
        const initialVersion = versions.find((v) => v.name === config.test.initialVersion);
        expect(initialVersion).toBeDefined();
        expect(initialVersion?.name).toBe(config.test.initialVersion);
        expect(initialVersion?.archived).toBe(false);
      },
      config.timeouts.testTimeout,
    );
  });
  describe('Version Creation', () => {
    it(
      'should create a new patch version',
      async () => {
        const newVersion = '1.0.1';
        // Create the version
        const version = await client.createVersion(projectKey, newVersion);
        expect(version).toBeDefined();
        expect(version.name).toBe(newVersion);
        expect(version.archived).toBe(false);
        expect(version.released).toBe(false);
        // Verify it appears in the list
        const versions = await client.listProjectVersions(projectKey);
        const found = versions.find((v) => v.name === newVersion);
        expect(found).toBeDefined();
      },
      config.timeouts.testTimeout,
    );
    it(
      'should create a new minor version',
      async () => {
        const newVersion = '1.1.0';
        const version = await client.createVersion(projectKey, newVersion);
        expect(version).toBeDefined();
        expect(version.name).toBe(newVersion);
      },
      config.timeouts.testTimeout,
    );
    it(
      'should create a new major version',
      async () => {
        const newVersion = '2.0.0';
        const version = await client.createVersion(projectKey, newVersion);
        expect(version).toBeDefined();
        expect(version.name).toBe(newVersion);
      },
      config.timeouts.testTimeout,
    );
  });
  describe('Version Idempotency', () => {
    it(
      'should handle existing version without error',
      async () => {
        const existingVersion = '1.0.0';
        // This should return the existing version, not create a duplicate
        const version = await client.ensureVersion(projectKey, existingVersion);
        expect(version).toBeDefined();
        expect(version.name).toBe(existingVersion);
        // Verify no duplicates
        const versions = await client.listProjectVersions(projectKey);
        const matches = versions.filter((v) => v.name === existingVersion);
        expect(matches.length).toBe(1);
      },
      config.timeouts.testTimeout,
    );
  });
  describe('Issue FixVersion Management', () => {
    it(
      'should create issue with fixVersion',
      async () => {
        const testVersion = '1.2.0';
        // Ensure version exists
        await client.ensureVersion(projectKey, testVersion);
        // Create issue with fixVersion
        const issue = await client.createIssue(projectKey, 'Test issue with fixVersion', config.test.issueType, [
          testVersion,
        ]);
        expect(issue).toBeDefined();
        expect(issue.fields.fixVersions).toBeDefined();
        expect(issue.fields.fixVersions?.length).toBeGreaterThan(0);
        expect(issue.fields.fixVersions?.[0].name).toBe(testVersion);
      },
      config.timeouts.testTimeout,
    );
    it(
      'should update issue fixVersion',
      async () => {
        const oldVersion = '1.0.0';
        const newVersion = '1.2.1';
        // Create version if needed
        await client.ensureVersion(projectKey, newVersion);
        // Create issue with old version
        const issue = await client.createIssue(projectKey, 'Test issue for version update', config.test.issueType, [
          oldVersion,
        ]);
        expect(issue.fields.fixVersions?.[0].name).toBe(oldVersion);
        // Update to new version
        await client.updateIssue(issue.key, {
          fixVersions: [{ name: newVersion }],
        });
        // Verify update
        const updatedIssue = await client.getIssue(issue.key, ['fixVersions', 'summary']);
        expect(updatedIssue.fields.fixVersions?.[0].name).toBe(newVersion);
      },
      config.timeouts.testTimeout,
    );
    it(
      'should find issues with specific fixVersion',
      async () => {
        const targetVersion = '1.3.0';
        // Ensure version exists
        await client.ensureVersion(projectKey, targetVersion);
        // Create test issue
        const issue = await client.createIssue(projectKey, `Issue for ${targetVersion}`, config.test.issueType, [
          targetVersion,
        ]);
        // Search for issues with this version
        const results = await client.searchIssues(`project = ${projectKey} AND fixVersion = "${targetVersion}"`, [
          'key',
          'summary',
          'fixVersions',
        ]);
        expect(results.issues.length).toBeGreaterThan(0);
        const found = results.issues.find((i) => i.key === issue.key);
        expect(found).toBeDefined();
      },
      config.timeouts.testTimeout,
    );
  });
  describe('Edge Cases', () => {
    it(
      'should handle version names with special characters',
      async () => {
        const versionName = 'v1.0.0-beta.1';
        const version = await client.ensureVersion(projectKey, versionName);
        expect(version).toBeDefined();
        expect(version.name).toBe(versionName);
      },
      config.timeouts.testTimeout,
    );
    it(
      'should list all versions for project',
      async () => {
        const versions = await client.listProjectVersions(projectKey);
        expect(versions).toBeDefined();
        expect(Array.isArray(versions)).toBe(true);
        expect(versions.length).toBeGreaterThan(0);
        // Should include our initial version
        const hasInitial = versions.some((v) => v.name === config.test.initialVersion);
        expect(hasInitial).toBe(true);
      },
      config.timeouts.testTimeout,
    );
    it(
      'should handle empty fixVersions array',
      async () => {
        const issue = await client.createIssue(projectKey, 'Issue without fixVersion', config.test.issueType);
        expect(issue).toBeDefined();
        // fixVersions might be undefined or empty array
        expect(!issue.fields.fixVersions || issue.fields.fixVersions.length === 0).toBe(true);
      },
      config.timeouts.testTimeout,
    );
  });
});
