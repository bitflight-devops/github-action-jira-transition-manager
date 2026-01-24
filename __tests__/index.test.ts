import * as path from 'node:path';

import * as core from '@actions/core';
import * as github from '@actions/github';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Args } from '../src/@types';
import { Action } from '../src/action';
import * as fsHelper from '../src/fs-helper';
import * as inputHelper from '../src/input-helper';

import { jiraTransitionsYaml } from './fixtures/jira-fixtures';

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
  return {
    default: vi.fn().mockImplementation(() => ({
      getIssue: vi.fn().mockImplementation((issueId: string) => {
        if (issueId === 'DVPS-336') return Promise.resolve(mockIssue336);
        if (issueId === 'DVPS-339') return Promise.resolve(mockIssue339);
        return Promise.reject(new Error(`Issue not found: ${issueId}`));
      }),
      getIssueTransitions: vi.fn().mockResolvedValue(mockTransitions),
      transitionIssue: vi.fn().mockResolvedValue({}),
    })),
  };
});

const originalGitHubWorkspace = process.env.GITHUB_WORKSPACE;
const gitHubWorkspace = path.resolve('/checkout-tests/workspace');

const issues = 'DVPS-336,DVPS-339';
// Note: baseUrl is read from the JIRA_BASE_URL environment variable.
// Use a function so we always read the current value of the environment variable when tests run.
const getBaseUrl = () => process.env.JIRA_BASE_URL as string;

// Inputs for mock @actions/core
let inputs = {} as Record<string, string>;

// Shallow clone original @actions/github context
const originalContext = { ...github.context };

describe('jira ticket transition', () => {
  beforeAll(() => {
    // Mock getInput
    vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
      return inputs[name];
    });
    // Mock error/warning/info/debug
    vi.spyOn(core, 'error').mockImplementation(console.log);
    vi.spyOn(core, 'warning').mockImplementation(console.log);
    vi.spyOn(core, 'info').mockImplementation(console.log);
    vi.spyOn(core, 'debug').mockImplementation(console.log);

    // Mock github context
    vi.spyOn(github.context, 'repo', 'get').mockImplementation(() => {
      return {
        owner: 'some-owner',
        repo: 'some-repo',
      };
    });
    github.context.ref = 'refs/heads/some-ref';
    github.context.sha = '1234567890123456789012345678901234567890';

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
  });

  afterAll(() => {
    // Restore GitHub workspace
    process.env.GITHUB_WORKSPACE = undefined;
    if (originalGitHubWorkspace) {
      process.env.GITHUB_WORKSPACE = originalGitHubWorkspace;
    }

    // Restore @actions/github context
    github.context.ref = originalContext.ref;
    github.context.sha = originalContext.sha;

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
