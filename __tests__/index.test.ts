import * as path from 'node:path';

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
  error: vi.fn((message: string) => console.log(message)),
  warning: vi.fn((message: string) => console.log(message)),
  info: vi.fn((message: string) => console.log(message)),
  debug: vi.fn((message: string) => console.log(message)),
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
    transitionIssue = vi.fn().mockResolvedValue({});
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
    github.context.action = '';
    github.context.payload = {};
  });

  afterAll(() => {
    // Restore GitHub workspace
    process.env.GITHUB_WORKSPACE = undefined;
    if (originalGitHubWorkspace) {
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
  });

  it('GitHub Event: start_test', async () => {
    github.context.eventName = 'start_test';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('GitHub Event: create', async () => {
    github.context.eventName = 'create';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('GitHub Event: pull_request, Github Action: opened', async () => {
    github.context.eventName = 'pull_request';
    github.context.action = 'opened';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('GitHub Event: pull_request, Github Action: synchronized', async () => {
    github.context.eventName = 'pull_request';
    github.context.action = 'synchronized';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('GitHub Event: pull_request, Github Action: closed, GitHub Payload: merged', async () => {
    github.context.eventName = 'pull_request';
    github.context.action = 'closed';
    github.context.payload.merged = true;
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('GitHub Event: pull_request_review, Github State: APPROVED', async () => {
    github.context.eventName = 'pull_request_review';
    github.context.payload.state = 'APPROVED';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });
});
