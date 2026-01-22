/**
 * Jira API Fixtures for Testing
 * Based on jira.js library types for accurate mocking
 */

import type { Issue, Transitions, Version, Project, StatusCategory, IssueTransition } from 'jira.js/version2';

// Status Categories
export const statusCategories: Record<string, StatusCategory> = {
  new: {
    id: 2,
    key: 'new',
    name: 'To Do',
    self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/2',
  },
  inProgress: {
    id: 4,
    key: 'indeterminate',
    name: 'In Progress',
    self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/4',
  },
  done: {
    id: 3,
    key: 'done',
    name: 'Done',
    self: 'https://mock-jira.atlassian.net/rest/api/2/statuscategory/3',
  },
};

// Project fixtures
export const mockProject: Partial<Project> = {
  id: '10000',
  key: 'DVPS',
  name: 'DevOps',
  self: 'https://mock-jira.atlassian.net/rest/api/2/project/10000',
};

export const mockProjectUnicorn: Partial<Project> = {
  id: '10001',
  key: 'UNICORN',
  name: 'Unicorn Project',
  self: 'https://mock-jira.atlassian.net/rest/api/2/project/10001',
};

// Version fixtures for FixVersion testing
export const mockVersions: Version[] = [
  {
    id: '10100',
    name: '1.0.0',
    description: 'Initial release',
    archived: false,
    released: true,
    releaseDate: '2024-01-01',
    projectId: 10000,
    self: 'https://mock-jira.atlassian.net/rest/api/2/version/10100',
  },
  {
    id: '10101',
    name: '1.1.0',
    description: 'Feature release',
    archived: false,
    released: false,
    projectId: 10000,
    self: 'https://mock-jira.atlassian.net/rest/api/2/version/10101',
  },
  {
    id: '10102',
    name: '2.0.0',
    description: 'Major release',
    archived: false,
    released: false,
    projectId: 10000,
    self: 'https://mock-jira.atlassian.net/rest/api/2/version/10102',
  },
];

// Issue fixtures
export function createMockIssue(overrides: {
  id: string;
  key: string;
  summary?: string;
  statusName?: string;
  statusId?: string;
  projectKey?: string;
  fixVersions?: Version[];
}): Partial<Issue> {
  const statusId = overrides.statusId || '1';
  const statusName = overrides.statusName || 'To Do';
  const projectKey = overrides.projectKey || 'DVPS';

  return {
    id: overrides.id,
    key: overrides.key,
    self: `https://mock-jira.atlassian.net/rest/api/2/issue/${overrides.id}`,
    fields: {
      summary: overrides.summary || `Test issue ${overrides.key}`,
      status: {
        id: statusId,
        name: statusName,
        self: `https://mock-jira.atlassian.net/rest/api/2/status/${statusId}`,
        statusCategory:
          statusName === 'To Do'
            ? statusCategories.new
            : statusName === 'Done'
              ? statusCategories.done
              : statusCategories.inProgress,
      },
      project: {
        id: projectKey === 'DVPS' ? '10000' : '10001',
        key: projectKey,
        name: projectKey === 'DVPS' ? 'DevOps' : 'Unicorn Project',
        self: `https://mock-jira.atlassian.net/rest/api/2/project/${projectKey === 'DVPS' ? '10000' : '10001'}`,
      },
      fixVersions: overrides.fixVersions || [],
    },
  };
}

// Pre-created issue fixtures
export const mockIssue336 = createMockIssue({
  id: '10336',
  key: 'DVPS-336',
  summary: 'Test issue 336',
});

export const mockIssue339 = createMockIssue({
  id: '10339',
  key: 'DVPS-339',
  summary: 'Test issue 339',
});

export const mockIssueWithFixVersion = createMockIssue({
  id: '10340',
  key: 'DVPS-340',
  summary: 'Issue with fix version',
  fixVersions: [mockVersions[1]], // 1.1.0
});

// Transition fixtures
export function createMockTransition(overrides: {
  id: string;
  name: string;
  toStatusId: string;
  toStatusName: string;
  statusCategory?: StatusCategory;
}): IssueTransition {
  return {
    id: overrides.id,
    name: overrides.name,
    to: {
      id: overrides.toStatusId,
      name: overrides.toStatusName,
      self: `https://mock-jira.atlassian.net/rest/api/2/status/${overrides.toStatusId}`,
      statusCategory: overrides.statusCategory || statusCategories.inProgress,
    },
    hasScreen: false,
    isGlobal: true,
    isInitial: false,
    isConditional: false,
  };
}

export const mockTransitions: Transitions = {
  expand: 'transitions',
  transitions: [
    createMockTransition({
      id: '11',
      name: 'In Progress',
      toStatusId: '3',
      toStatusName: 'In Progress',
    }),
    createMockTransition({
      id: '21',
      name: 'Code Review',
      toStatusId: '4',
      toStatusName: 'Code Review',
    }),
    createMockTransition({
      id: '31',
      name: 'On Hold',
      toStatusId: '5',
      toStatusName: 'On Hold',
    }),
    createMockTransition({
      id: '41',
      name: 'Testing',
      toStatusId: '6',
      toStatusName: 'testing',
    }),
    createMockTransition({
      id: '51',
      name: 'Done',
      toStatusId: '7',
      toStatusName: 'done',
      statusCategory: statusCategories.done,
    }),
  ],
};

// YAML configuration for transition rules
export const jiraTransitionsYaml = `
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

// Factory for creating mock Jira client
export function createMockJiraClient(overrides?: {
  issues?: Map<string, Partial<Issue>>;
  transitions?: Transitions;
  versions?: Version[];
}) {
  const issueMap =
    overrides?.issues ||
    new Map([
      ['DVPS-336', mockIssue336],
      ['DVPS-339', mockIssue339],
    ]);

  return {
    getIssue: (issueId: string) => {
      const issue = issueMap.get(issueId);
      if (issue) return Promise.resolve(issue);
      return Promise.reject(new Error(`Issue not found: ${issueId}`));
    },
    getIssueTransitions: () => Promise.resolve(overrides?.transitions || mockTransitions),
    transitionIssue: () => Promise.resolve({}),
    getProjectVersions: () => Promise.resolve(overrides?.versions || mockVersions),
    createVersion: (version: Partial<Version>) => Promise.resolve({ ...version, id: '10999' }),
    updateVersion: (versionId: string, update: Partial<Version>) => Promise.resolve({ id: versionId, ...update }),
  };
}
