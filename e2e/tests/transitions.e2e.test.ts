/**
 * E2E tests for Jira issue transitions
 * Tests the action logic against a real Jira instance
 */
import * as core from '@actions/core';
import type { Context } from '@actions/github/lib/context';
import { type SpyInstance, vi } from 'vitest';
import type { Args } from '../../src/@types';
import { Action } from '../../src/action';
import { getE2EConfig } from '../scripts/e2e-config';
import { JiraE2EClient } from '../scripts/jira-client';

describe('Jira Transition E2E Tests', () => {
  // Initialize config immediately so timeout values are available for test definitions
  const config = getE2EConfig();
  let client: JiraE2EClient;
  const projectKey = 'E2E';

  beforeAll(async () => {
    client = new JiraE2EClient(config);

    // Verify Jira is ready
    const serverInfo = await client.getServerInfo();
    console.log(`Connected to Jira ${serverInfo.version}`);
  }, 300000); // 5 minutes timeout for Jira readiness

  describe('Issue Creation and Retrieval', () => {
    it(
      'should create and retrieve an issue',
      async () => {
        const issue = await client.createIssue(projectKey, 'Test issue for transitions', config.test.issueType);

        expect(issue).toBeDefined();
        expect(issue.key).toMatch(new RegExp(`^${projectKey}-\\d+$`));
        expect(issue.fields.summary).toBe('Test issue for transitions');

        // Verify we can retrieve it
        const retrieved = await client.getIssue(issue.key);
        expect(retrieved.key).toBe(issue.key);
      },
      config.timeouts.testTimeout,
    );

    it(
      'should search for issues by JQL',
      async () => {
        const results = await client.searchIssues(`project = ${projectKey} ORDER BY created DESC`, [
          'key',
          'summary',
          'status',
        ]);

        expect(results).toBeDefined();
        expect(results.issues.length).toBeGreaterThan(0);
        expect(results.issues[0].key).toMatch(new RegExp(`^${projectKey}-\\d+$`));
      },
      config.timeouts.testTimeout,
    );
  });

  describe('Action Integration', () => {
    it('should construct action with valid config', () => {
      const mockContext = {
        eventName: 'push',
        action: '',
        payload: {},
      } as Context;

      const args: Args = {
        issues: 'E2E-1',
        failOnError: false,
        jiraTransitionsYaml: '',
        config: {
          baseUrl: config.jira.baseUrl,
          email: config.jira.auth.email || config.jira.auth.username || 'admin',
          token: config.jira.auth.apiToken || config.jira.auth.password || 'admin',
        },
      };

      const action = new Action(mockContext, args);
      expect(action).toBeDefined();
      expect(action.jira).toBeDefined();
      expect(action.config.baseUrl).toBe(config.jira.baseUrl);
    });

    it(
      'should handle issue that does not exist gracefully',
      async () => {
        // Suppress core.warning/info/error output during this test since the action
        // intentionally logs "Failed to process issue" and "Successes: 0 Failures: 1"
        // which would otherwise leak into CI output as annotations.
        const warningSpy = vi.spyOn(core, 'warning').mockImplementation(() => {});
        const errorSpy = vi.spyOn(core, 'error').mockImplementation(() => {});
        const infoSpy = vi.spyOn(core, 'info').mockImplementation(() => {});
        const setOutputSpy = vi.spyOn(core, 'setOutput').mockImplementation(() => {});

        try {
          const mockContext = {
            eventName: 'push',
            action: '',
            payload: {},
          } as Context;

          const args: Args = {
            issues: 'E2E-999999', // Non-existent issue
            failOnError: false, // Don't fail on error
            jiraTransitionsYaml: '',
            config: {
              baseUrl: config.jira.baseUrl,
              email: config.jira.auth.email || config.jira.auth.username || 'admin',
              token: config.jira.auth.apiToken || config.jira.auth.password || 'admin',
            },
          };

          const action = new Action(mockContext, args);
          const result = await action.execute();
          expect(result).toBe(false);

          // Verify the action logged the expected warning about the non-existent issue
          expect(warningSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to process issue E2E-999999'),
          );
        } finally {
          warningSpy.mockRestore();
          errorSpy.mockRestore();
          infoSpy.mockRestore();
          setOutputSpy.mockRestore();
        }
      },
      config.timeouts.testTimeout,
    );
  });

  describe('Jira Client Methods', () => {
    let testIssueKey: string;

    beforeAll(async () => {
      const issue = await client.createIssue(projectKey, 'Test issue for client methods', config.test.issueType);
      testIssueKey = issue.key;
    });

    it(
      'should get server info',
      async () => {
        const info = await client.getServerInfo();
        expect(info).toBeDefined();
        expect(info.version).toBeDefined();
        expect(info.baseUrl).toBeDefined();
      },
      config.timeouts.testTimeout,
    );

    it(
      'should get current user',
      async () => {
        const user = await client.getMyself();
        expect(user).toBeDefined();
        expect(user.displayName).toBeDefined();
      },
      config.timeouts.testTimeout,
    );

    it(
      'should get issue by key',
      async () => {
        const issue = await client.getIssue(testIssueKey);
        expect(issue).toBeDefined();
        expect(issue.key).toBe(testIssueKey);
        expect(issue.fields).toBeDefined();
        expect(issue.fields.summary).toBe('Test issue for client methods');
      },
      config.timeouts.testTimeout,
    );

    it(
      'should update issue fields',
      async () => {
        const newSummary = 'Updated test issue summary';
        await client.updateIssue(testIssueKey, {
          summary: newSummary,
        });

        const updated = await client.getIssue(testIssueKey, ['summary']);
        expect(updated.fields.summary).toBe(newSummary);
      },
      config.timeouts.testTimeout,
    );
  });
});
