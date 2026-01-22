import * as path from 'node:path';

import * as core from '@actions/core';
import * as github from '@actions/github';

import { Args } from '../src/@types';
import { Action } from '../src/action';
import * as fsHelper from '../src/fs-helper';
import * as inputHelper from '../src/input-helper';

// Fixture data for Jira API responses
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
      statusCategory: {
        id: 2,
        key: 'new',
        name: 'To Do',
        self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/2',
      },
    },
    project: {
      id: '10000',
      key: 'DVPS',
      name: 'DevOps',
      self: 'https://mock-jira.atlassian.net/rest/api/2/project/10000',
    },
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
      statusCategory: {
        id: 2,
        key: 'new',
        name: 'To Do',
        self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/2',
      },
    },
    project: {
      id: '10000',
      key: 'DVPS',
      name: 'DevOps',
      self: 'https://mock-jira.atlassian.net/rest/api/2/project/10000',
    },
  },
};

const mockTransitions = {
  expand: 'transitions',
  transitions: [
    {
      id: '11',
      name: 'In Progress',
      to: {
        id: '3',
        name: 'In Progress',
        self: 'https://mock-jira.atlassian.net/rest/api/2/status/3',
        statusCategory: {
          id: 4,
          key: 'indeterminate',
          name: 'In Progress',
          self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/4',
        },
      },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '21',
      name: 'Code Review',
      to: {
        id: '4',
        name: 'Code Review',
        self: 'https://mock-jira.atlassian.net/rest/api/2/status/4',
        statusCategory: {
          id: 4,
          key: 'indeterminate',
          name: 'In Progress',
          self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/4',
        },
      },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '31',
      name: 'On Hold',
      to: {
        id: '5',
        name: 'On Hold',
        self: 'https://mock-jira.atlassian.net/rest/api/2/status/5',
        statusCategory: {
          id: 4,
          key: 'indeterminate',
          name: 'In Progress',
          self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/4',
        },
      },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '41',
      name: 'Testing',
      to: {
        id: '6',
        name: 'testing',
        self: 'https://mock-jira.atlassian.net/rest/api/2/status/6',
        statusCategory: {
          id: 4,
          key: 'indeterminate',
          name: 'In Progress',
          self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/4',
        },
      },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '51',
      name: 'Done',
      to: {
        id: '7',
        name: 'done',
        self: 'https://mock-jira.atlassian.net/rest/api/2/status/7',
        statusCategory: {
          id: 3,
          key: 'done',
          name: 'Done',
          self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/3',
        },
      },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
  ],
};

// Mock the Jira class to avoid HTTP requests entirely
jest.mock('../src/Jira', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      getIssue: jest.fn().mockImplementation((issueId: string) => {
        if (issueId === 'DVPS-336') return Promise.resolve(mockIssue336);
        if (issueId === 'DVPS-339') return Promise.resolve(mockIssue339);
        return Promise.reject(new Error(`Unknown issue: ${issueId}`));
      }),
      getIssueTransitions: jest.fn().mockResolvedValue(mockTransitions),
      transitionIssue: jest.fn().mockResolvedValue({}),
    })),
  };
});

const originalGitHubWorkspace = process.env.GITHUB_WORKSPACE;
const gitHubWorkspace = path.resolve('/checkout-tests/workspace');

const issues = 'DVPS-336,DVPS-339';
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
// Note: baseUrl is read from environment variable which is set in setup.ts
// We need to read it lazily since setup.ts runs before tests but after module load
const getBaseUrl = () => process.env.JIRA_BASE_URL as string;
// Inputs for mock @actions/core
let inputs = {} as any;
// Shallow clone original @actions/github context
const originalContext = { ...github.context };

describe('jira ticket transition', () => {
  beforeAll(() => {
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
        owner: 'some-owner',
        repo: 'some-repo',
      };
    });
    github.context.ref = 'refs/heads/some-ref';
    github.context.sha = '1234567890123456789012345678901234567890';

    // Mock ./fs-helper directoryExistsSync()
    jest.spyOn(fsHelper, 'directoryExistsSync').mockImplementation((fspath: string) => fspath === gitHubWorkspace);

    // GitHub workspace
    process.env.GITHUB_WORKSPACE = gitHubWorkspace;
  });
  beforeEach(() => {
    // Reset inputs
    inputs = {};
    inputs.issues = issues;

    inputs.jira_transitions_yaml = jira_transitions_yaml;
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
    jest.restoreAllMocks();
  });

  it('sets defaults', () => {
    jest.setTimeout(50_000);
    const settings: Args = inputHelper.getInputs();
    expect(settings).toBeTruthy();
    expect(settings.issues).toEqual(issues);
    expect(settings.config).toBeTruthy();
    expect(settings.config.baseUrl).toEqual(getBaseUrl());
  });

  it('get transitions', async () => {
    jest.setTimeout(50_000);
    // expect.hasAssertions()
    github.context.eventName = 'push';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('GitHub Event: start_test', async () => {
    jest.setTimeout(50_000);
    // expect.hasAssertions()
    github.context.eventName = 'start_test';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('GitHub Event: create', async () => {
    jest.setTimeout(50_000);
    // expect.hasAssertions()
    github.context.eventName = 'create';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });

  it('GitHub Event: pull_request, Github Action: opened', async () => {
    jest.setTimeout(50_000);
    // expect.hasAssertions()
    github.context.eventName = 'pull_request';
    github.context.action = 'opened';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });
  it('GitHub Event: pull_request, Github Action: synchronized', async () => {
    jest.setTimeout(50_000);
    // expect.hasAssertions()
    github.context.eventName = 'pull_request';
    github.context.action = 'synchronized';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });
  it('GitHub Event: pull_request, Github Action: closed, GitHub Payload: merged', async () => {
    jest.setTimeout(50_000);
    // expect.hasAssertions()
    github.context.eventName = 'pull_request';
    github.context.action = 'closed';
    github.context.payload.merged = true;
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });
  it('GitHub Event: pull_request_review, Github State: APPROVED', async () => {
    jest.setTimeout(50_000);
    // expect.hasAssertions()
    github.context.eventName = 'pull_request_review';
    github.context.payload.state = 'APPROVED';
    const settings: Args = inputHelper.getInputs();
    const action = new Action(github.context, settings);
    const result = await action.execute();
    expect(result).toEqual(true);
  });
});
