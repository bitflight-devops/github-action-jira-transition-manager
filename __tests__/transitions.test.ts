import * as core from '@actions/core';
import type { context } from '@actions/github';
import type { Version2Models } from 'jira.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Args } from '../src/@types';
import { Action } from '../src/action';
import { checkConditions } from '../src/TransitionEventManager';

type Context = typeof context;

const jira = vi.hoisted(() => ({
  getIssue: vi.fn(),
  getIssueTransitions: vi.fn(),
  transitionIssue: vi.fn(),
}));

vi.mock('../src/Jira', () => ({
  default: class {
    getIssue = jira.getIssue;
    getIssueTransitions = jira.getIssueTransitions;
    transitionIssue = jira.transitionIssue;
  },
}));

vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
}));

const transitions = [
  { id: '21', name: 'Start progress', to: { name: 'In Progress' } },
  { id: '31', name: 'Resolve issue', to: { name: 'Done' } },
] as Version2Models.IssueTransition[];

const mapping = `
projects:
  E2E:
    ignored_states: [done]
    to_state:
      In Progress:
        - eventName: pull_request
          action: opened
      Done:
        - eventName: pull_request
          action: closed
          payload:
            pull_request:
              merged: true
`;

function event(action = 'opened', merged = false): Context {
  const mockContext: Partial<Context> = {
    eventName: 'pull_request',
    action: 'transition-step',
    payload: { action, pull_request: { number: 42, merged } },
  };
  return mockContext as Context;
}

function args(overrides: Partial<Args> = {}): Args {
  return {
    issues: 'E2E-1',
    failOnError: true,
    jiraTransitionsYaml: mapping,
    config: { baseUrl: 'https://jira.invalid', email: 'admin', token: 'test-password' },
    ...overrides,
  };
}

describe('event conditions', () => {
  it('requires every condition, including nested payload fields, to match', () => {
    const conditions = {
      eventName: 'pull_request',
      payload: { action: 'closed', pull_request: { merged: true } },
    };

    expect(checkConditions({ eventName: 'pull_request', payload: { action: 'opened' } }, conditions)).toBe(false);
    expect(
      checkConditions(
        { eventName: 'pull_request', payload: { action: 'closed', pull_request: { merged: false } } },
        conditions,
      ),
    ).toBe(false);
    expect(checkConditions(conditions, conditions)).toBe(true);
  });

  it('treats absent nested objects as a mismatch', () => {
    expect(checkConditions({ payload: {} }, { payload: { pull_request: { merged: true } } })).toBe(false);
  });
});

describe('transition behavior', () => {
  let status: string;

  beforeEach(() => {
    vi.resetAllMocks();
    status = 'To Do';
    jira.getIssue.mockImplementation(async (key: string) => ({ key, fields: { status: { name: status } } }));
    jira.getIssueTransitions.mockResolvedValue({ transitions });
    jira.transitionIssue.mockImplementation(async (_key: string, transition: Version2Models.IssueTransition) => {
      status = transition.to?.name ?? status;
      return {};
    });
  });

  it('uses the webhook action and returns the actual before and after states', async () => {
    expect(await new Action(event(), args()).execute()).toBe(true);

    expect(jira.transitionIssue).toHaveBeenCalledExactlyOnceWith('E2E-1', transitions[0]);
    expect(core.setOutput).toHaveBeenCalledWith(
      'issueOutputs',
      JSON.stringify([
        {
          issue: 'E2E-1',
          names: ['Start progress', 'Resolve issue'],
          ids: ['21', '31'],
          status: 'In Progress',
          beforestatus: 'To Do',
        },
      ]),
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('selects the merged pull request rule only when all conditions match', async () => {
    await new Action(event('closed', true), args()).execute();

    expect(jira.transitionIssue).toHaveBeenCalledExactlyOnceWith('E2E-1', transitions[1]);
    expect(status).toBe('Done');
  });

  it.each(['closed', 'synchronize'])('does not transition for an unmatched %s webhook action', async (action) => {
    expect(await new Action(event(action), args()).execute()).toBe(true);

    expect(jira.transitionIssue).not.toHaveBeenCalled();
    expect(status).toBe('To Do');
  });

  it('does not transition when only the webhook action matches', async () => {
    const unrelatedEvent = { ...event(), eventName: 'issues' } as Context;
    await new Action(unrelatedEvent, args()).execute();

    expect(jira.transitionIssue).not.toHaveBeenCalled();
  });

  it('does not repeat a transition when the issue already has the target status', async () => {
    status = 'In Progress';
    expect(await new Action(event(), args()).execute()).toBe(true);

    expect(jira.transitionIssue).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('honors ignored states regardless of case', async () => {
    status = 'Done';
    expect(await new Action(event(), args()).execute()).toBe(true);

    expect(jira.transitionIssue).not.toHaveBeenCalled();
    expect(status).toBe('Done');
  });

  it.each([true, false])('does not report an unavailable target as success (failOnError=%s)', async (failOnError) => {
    jira.getIssueTransitions.mockResolvedValue({ transitions: [] });

    expect(await new Action(event(), args({ failOnError })).execute()).toBe(false);

    expect(jira.transitionIssue).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith('issueOutputs', '[]');
    expect(core.setFailed).toHaveBeenCalledTimes(failOnError ? 1 : 0);
  });

  it.each([true, false])('does not report a rejected transition as success (failOnError=%s)', async (failOnError) => {
    jira.transitionIssue.mockRejectedValue(new Error('Transition rejected: required field missing'));

    expect(await new Action(event(), args({ failOnError })).execute()).toBe(false);

    expect(status).toBe('To Do');
    expect(core.setOutput).toHaveBeenCalledWith('issueOutputs', '[]');
    expect(core.setFailed).toHaveBeenCalledTimes(failOnError ? 1 : 0);
  });

  it('retains successful issue results and fails the action when another issue cannot be read', async () => {
    jira.getIssue.mockImplementation(async (key: string) => {
      if (key === 'E2E-2') throw new Error('Issue not found');
      return { key, fields: { status: { name: status } } };
    });

    expect(await new Action(event(), args({ issues: 'E2E-1, E2E-2' })).execute()).toBe(true);

    expect(jira.transitionIssue).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenCalledWith('Failed to process issue E2E-2: Issue not found');
    const outputs = JSON.parse(vi.mocked(core.setOutput).mock.calls[0][1] as string);
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ issue: 'E2E-1', beforestatus: 'To Do', status: 'In Progress' });
  });
});
