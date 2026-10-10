import * as path from 'node:path';

import * as core from '@actions/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Args } from '../src/@types';
import { Action } from '../src/action';
import * as fsHelper from '../src/fs-helper';
import * as inputHelper from '../src/input-helper';

import { jiraTransitionsYaml } from './fixtures/jira-fixtures';

// Inputs for mock @actions/core
let inputs = {} as Record<string, string>;

// Mock @actions/core
vi.mock('@actions/core', () => ({
  getInput: vi.fn((name: string) => inputs[name]),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
}));

// Mock @actions/github - we'll mutate the context object directly in tests
vi.mock('@actions/github', () => {
  const mockContext = {
    payload: {} as Record<string, unknown>,
    eventName: '',
    action: '',
    sha: '1234567890123456789012345678901234567890',
    ref: 'refs/heads/some-ref',
    workflow: '',
    actor: 'test-actor',
    job: 'test-job',
    runNumber: 1,
    runId: 1,
    apiUrl: 'https://api.github.com',
    serverUrl: 'https://github.com',
    graphqlUrl: 'https://api.github.com/graphql',
    repo: {
      owner: 'some-owner',
      repo: 'some-repo',
    },
    issue: {
      owner: 'some-owner',
      repo: 'some-repo',
      number: 1,
    },
  };

  return {
    context: mockContext,
    getOctokit: vi.fn(),
  };
});

// Define mock data inline (vi.mock is hoisted, so we can't use imports)
const mockIssue336 = {
  id: '10336',
  key: 'DVPS-336',
  self: 'https://mock-jira.atlassian.net/rest/api/2/issue/10336',
  fields: {
    summary: 'Test issue 336',
    status: {
      id: '1',
      name: 'To Do',
      self: 'https://mock-jira.atlassian.net/rest/api/2/status/1',
      statusCategory: { id: 2, key: 'new', name: 'To Do' },
    },
    project: { id: '10000', key: 'DVPS', name: 'DevOps' },
  },
};

const mockIssue339 = {
  id: '10339',
  key: 'DVPS-339',
  self: 'https://mock-jira.atlassian.net/rest/api/2/issue/10339',
  fields: {
    summary: 'Test issue 339',
    status: {
      id: '1',
      name: 'To Do',
      self: 'https://mock-jira.atlassian.net/rest/api/2/status/1',
      statusCategory: { id: 2, key: 'new', name: 'To Do' },
    },
    project: { id: '10000', key: 'DVPS', name: 'DevOps' },
  },
};

const mockTransitions = {
  expand: 'transitions',
  transitions: [
    {
      id: '11',
      name: 'In Progress',
      to: { id: '3', name: 'In Progress', statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' } },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '21',
      name: 'Code Review',
      to: { id: '4', name: 'Code Review', statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' } },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '31',
      name: 'On Hold',
      to: { id: '5', name: 'On Hold', statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' } },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '41',
      name: 'Testing',
      to: { id: '6', name: 'testing', statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' } },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '51',
      name: 'Done',
      to: { id: '7', name: 'done', statusCategory: { id: 3, key: 'done', name: 'Done' } },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
  ],
};

// Mock the Jira class to avoid HTTP requests entirely
vi.mock('../src/Jira', () => {
  // Use a proper class constructor for vitest v4
  class MockJira {
    getIssue = vi.fn().mockImplementation((issueId: string) => {
      if (issueId === 'DVPS-336') return Promise.resolve(mockIssue336);
      if (issueId === 'DVPS-339') return Promise.resolve(mockIssue339);
      return Promise.reject(new Error(`Issue not found: ${issueId}`));
    });
    getIssueTransitions = vi.fn().mockResolvedValue(mockTransitions);
    transitionIssue = vi.fn().mockImplementation(async (issueId: string, transition: { to: { name: string } }) => {
      const issue = issueId === 'DVPS-336' ? mockIssue336 : mockIssue339;
      issue.fields.status.name = transition.to.name;
      return {};
    });
  }

  return {
    default: MockJira,
  };
});

const originalGitHubWorkspace = process.env.GITHUB_WORKSPACE;
const gitHubWorkspace = path.resolve('/checkout-tests/workspace');

const issues = 'DVPS-336,DVPS-339';
// Note: baseUrl is read from the JIRA_BASE_URL environment variable.
// Use a function so we always read the current value of the environment variable when tests run.
const getBaseUrl = () => process.env.JIRA_BASE_URL as string;

function expectOutputStatus(status: string): void {
  const output = vi.mocked(core.setOutput).mock.lastCall?.[1];
  expect(JSON.parse(output as string)).toEqual([
    expect.objectContaining({ issue: 'DVPS-336', beforestatus: 'To Do', status }),
    expect.objectContaining({ issue: 'DVPS-339', beforestatus: 'To Do', status }),
  ]);
}

describe('jira ticket transition', () => {
  // Import the mocked module
  let github: typeof import('@actions/github');

  beforeAll(async () => {
    // Import github after mocking to get the mocked version
    github = await import('@actions/github');

    // Mock ./fs-helper directoryExistsSync()
    vi.spyOn(fsHelper, 'directoryExistsSync').mockImplementation((fspath: string) => fspath === gitHubWorkspace);

    // GitHub workspace
    process.env.GITHUB_WORKSPACE = gitHubWorkspace;
  });

  beforeEach(() => {
    // Reset inputs
    inputs = {};
    inputs.issues = issues;
    inputs.jira_transitions_yaml = jiraTransitionsYaml;
    inputs.jira_base_url = getBaseUrl();

    // Reset github context for each test
    github.context.eventName = '';
    github.context.action = 'transition-step';
    github.context.payload = {};
    mockIssue336.fields.status.name = 'To Do';
    mockIssue339.fields.status.name = 'To Do';
  });

  afterAll(() => {
    // Restore GitHub workspace
    if (originalGitHubWorkspace === undefined) {
      delete process.env.GITHUB_WORKSPACE;
    } else {
      process.env.GITHUB_WORKSPACE = originalGitHubWorkspace;
    }

    // Restore
    vi.restoreAllMocks();
  });

  it('sets defaults', () => {
    const settings: Args = inputHelper.getInputs();
    expect(settings).toBeTruthy();
    expect(settings.issues).toEqual(issues);
    expect(settings.config).toBeTruthy();
    expect(settings.config.baseUrl).toEqual(getBaseUrl());
  });

  it('get transitions', async () => {
    github.context.eventName = 'push';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
    expect(action.jira.transitionIssue).not.toHaveBeenCalled();
    expectOutputStatus('To Do');
  });

  it('GitHub Event: start_test', async () => {
    github.context.eventName = 'start_test';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
    expectOutputStatus('On Hold');
  });

  it('GitHub Event: create', async () => {
    github.context.eventName = 'create';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
    expectOutputStatus('In Progress');
  });

  it('GitHub Event: pull_request, Github Action: opened', async () => {
    github.context.eventName = 'pull_request';
    github.context.payload = { action: 'opened' };
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
    expectOutputStatus('Code Review');
  });

  it('GitHub Event: pull_request, webhook action: synchronize', async () => {
    github.context.eventName = 'pull_request';
    github.context.payload = { action: 'synchronize' };
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
    expectOutputStatus('Code Review');
  });

  it('GitHub Event: pull_request, Github Action: closed, GitHub Payload: merged', async () => {
    github.context.eventName = 'pull_request';
    github.context.payload = { action: 'closed', pull_request: { number: 42, merged: true } };
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
    expectOutputStatus('testing');
  });

  it('GitHub Event: pull_request_review, review state: approved', async () => {
    github.context.eventName = 'pull_request_review';
    github.context.payload = { action: 'submitted', review: { state: 'approved' } };
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
    expectOutputStatus('testing');
  });
});
