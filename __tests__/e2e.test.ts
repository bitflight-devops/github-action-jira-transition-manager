import * as path from 'node:path';

import * as core from '@actions/core';
import * as github from '@actions/github';

import { Args } from '../src/@types';
import { Action } from '../src/action';
import * as fsHelper from '../src/fs-helper';
import * as inputHelper from '../src/input-helper';

const originalGitHubWorkspace = process.env.GITHUB_WORKSPACE;
const gitHubWorkspace = path.resolve('/checkout-tests/workspace');

// Use environment variables for e2e testing
const baseUrl = process.env.JIRA_BASE_URL || 'http://localhost:8080';
const userEmail = process.env.JIRA_USER_EMAIL || 'admin@example.com';
const apiToken = process.env.JIRA_API_TOKEN || 'admin';

// Test issues - these should be created by the seed script
const testIssues = process.env.JIRA_TEST_ISSUES || 'DVPS-1,DVPS-2';

const jira_transitions_yaml = `
projects:
  UNICORN:
    ignored_states:
      - 'done'
      - 'testing'
    to_state:
      'solution review':
        - eventName: create
      'code review':
        - eventName: pull_request
          action: 'opened'
        - eventName: pull_request
          action: 'synchronized'
      'testing':
        - eventName: pull_request
          payload:
            merged: true
          action: 'closed'
        - eventName: pull_request_review
          payload:
            state: 'APPROVED'
  DVPS:
    ignored_states:
      - 'done'
      - 'testing'
    to_state:
      'On Hold':
        - eventName: start_test
      'In Progress':
        - eventName: create
      'Code Review':
        - eventName: pull_request
          action: 'opened'
        - eventName: pull_request
          action: 'synchronized'
      'testing':
        - eventName: pull_request
          payload:
            merged: true
          action: 'closed'
        - eventName: pull_request_review
          payload:
            state: 'APPROVED'
`;

// Inputs for mock @actions/core
let inputs = {} as any;
// Shallow clone original @actions/github context
const originalContext = {
  ref: github.context.ref,
  sha: github.context.sha,
  eventName: github.context.eventName,
  action: github.context.action,
  payload: { ...github.context.payload },
};

describe('jira e2e - real instance', () => {
  beforeAll(() => {
    // Set timeout for all tests in this suite
    jest.setTimeout(60_000);

    // Mock getInput
    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      return inputs[name];
    });
    // Mock error/warning/info/debug
    jest.spyOn(core, 'error').mockImplementation(console.log);
    jest.spyOn(core, 'warning').mockImplementation(console.log);
    jest.spyOn(core, 'info').mockImplementation(console.log);
    jest.spyOn(core, 'debug').mockImplementation(console.log);

    // Mock github context
    jest.spyOn(github.context, 'repo', 'get').mockImplementation(() => {
      return {
        owner: 'test-owner',
        repo: 'test-repo',
      };
    });
    github.context.ref = 'refs/heads/test-ref';
    github.context.sha = '1234567890123456789012345678901234567890';

    // Mock ./fs-helper directoryExistsSync()
    jest.spyOn(fsHelper, 'directoryExistsSync').mockImplementation((fspath: string) => fspath === gitHubWorkspace);

    // GitHub workspace
    process.env.GITHUB_WORKSPACE = gitHubWorkspace;
  });

  beforeEach(() => {
    // Reset inputs
    inputs = {};
    inputs.issues = testIssues;
    inputs.jira_transitions_yaml = jira_transitions_yaml;
    inputs.jira_base_url = baseUrl;
    inputs.jira_user_email = userEmail;
    inputs.jira_api_token = apiToken;

    // Reset github context to original state before each test
    github.context.eventName = originalContext.eventName;
    github.context.action = originalContext.action;
    github.context.payload = { ...originalContext.payload };
  });

  afterAll(() => {
    // Restore GitHub workspace
    if (originalGitHubWorkspace !== undefined) {
      process.env.GITHUB_WORKSPACE = originalGitHubWorkspace;
    } else {
      delete process.env.GITHUB_WORKSPACE;
    }

    // Restore @actions/github context
    github.context.ref = originalContext.ref;
    github.context.sha = originalContext.sha;
    github.context.eventName = originalContext.eventName;
    github.context.action = originalContext.action;
    github.context.payload = { ...originalContext.payload };

    // Restore
    jest.restoreAllMocks();
  });

  it('should connect to real Jira instance and get transitions', async () => {
    github.context.eventName = 'push';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('should handle create event and transition issues', async () => {
    github.context.eventName = 'create';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('should handle pull_request opened event', async () => {
    github.context.eventName = 'pull_request';
    github.context.action = 'opened';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('should handle pull_request synchronized event', async () => {
    github.context.eventName = 'pull_request';
    github.context.action = 'synchronized';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('should handle pull_request closed (merged) event', async () => {
    github.context.eventName = 'pull_request';
    github.context.action = 'closed';
    github.context.payload.merged = true;
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('should handle pull_request_review approved event', async () => {
    github.context.eventName = 'pull_request_review';
    github.context.payload.state = 'APPROVED';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('should validate issue outputs contain expected fields', async () => {
    const setOutputSpy = jest.spyOn(core, 'setOutput');
    github.context.eventName = 'push';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    await action.execute();

    expect(setOutputSpy).toHaveBeenCalledWith('issueOutputs', expect.any(String));
    const outputCall = setOutputSpy.mock.calls.find((call) => call[0] === 'issueOutputs');
    expect(outputCall).toBeDefined();
    // Type guard: outputCall is defined after the assertion passes
    const issueOutputs = JSON.parse(outputCall![1] as string);
    expect(Array.isArray(issueOutputs)).toBe(true);
    expect(issueOutputs.length).toBeGreaterThan(0);
    const firstIssue = issueOutputs[0];
    expect(firstIssue).toHaveProperty('issue');
    expect(firstIssue).toHaveProperty('names');
    expect(firstIssue).toHaveProperty('ids');
    expect(firstIssue).toHaveProperty('status');
  });
});
