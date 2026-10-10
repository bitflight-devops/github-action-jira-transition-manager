import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { packagedActionPath, runPackagedAction } from './action-runner';

const baseUrl = (process.env.E2E_JIRA_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const username = process.env.E2E_JIRA_USERNAME || 'admin';
const password = process.env.E2E_JIRA_PASSWORD || 'admin';
const projectKey = 'E2E';
const createdIssues = new Set<string>();

interface JiraIssue {
  key: string;
  fields: { status: { name: string }; updated: string };
  changelog: {
    histories: {
      id: string;
      items: { field: string; fromString: string; toString: string }[];
    }[];
  };
}

// These requests only prepare fixtures and independently verify Jira state.
// Every operation under test runs through the packaged action subprocess.
async function jiraRequest<T>(method: string, endpoint: string, body?: unknown, expectedStatus = 200): Promise<T> {
  const response = await fetch(`${baseUrl}/rest/api/2${endpoint}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(
      `Jira ${method} ${endpoint}: expected HTTP ${expectedStatus}, received ${response.status}: ${text}`,
    );
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

async function readIssue(key: string): Promise<JiraIssue> {
  return jiraRequest('GET', `/issue/${key}?fields=status,updated&expand=changelog`);
}

async function createIssue(): Promise<JiraIssue> {
  const created = await jiraRequest<{ key: string }>(
    'POST',
    '/issue',
    {
      fields: {
        project: { key: projectKey },
        issuetype: { name: 'Task' },
        summary: `Packaged transition action ${randomUUID()}`,
      },
    },
    201,
  );
  expect(created.key).toMatch(/^E2E-\d+$/);
  createdIssues.add(created.key);
  const issue = await readIssue(created.key);
  expect(issue.fields.status.name).toBe('To Do');
  return issue;
}

async function deleteIssue(key: string): Promise<void> {
  await jiraRequest('DELETE', `/issue/${key}`, undefined, 204);
  createdIssues.delete(key);
}

function webhook(action = 'opened', merged = false): Record<string, unknown> {
  return {
    action,
    number: 42,
    pull_request: {
      number: 42,
      merged,
      head: { ref: 'integration-test', sha: '1234567890123456789012345678901234567890' },
      base: { ref: 'main' },
    },
    repository: { name: 'jira-transition-manager', owner: { login: 'integration-tests' } },
  };
}

function mapping(openedTarget = 'In Progress'): string {
  return stringify({
    projects: {
      [projectKey]: {
        ignored_states: ['done'],
        to_state: {
          [openedTarget]: [{ eventName: 'pull_request', action: 'opened' }],
          Done: [{ eventName: 'pull_request', action: 'closed', payload: { pull_request: { merged: true } } }],
        },
      },
    },
  });
}

function runAction(issues: string[], overrides: Partial<Parameters<typeof runPackagedAction>[0]> = {}) {
  return runPackagedAction({
    issues,
    baseUrl,
    username,
    password,
    transitionsYaml: mapping(),
    payload: webhook(),
    ...overrides,
  });
}

function expectUnchanged(before: JiraIssue, after: JiraIssue): void {
  expect(before.fields.updated).toEqual(expect.any(String));
  expect(after.fields.status.name).toBe(before.fields.status.name);
  expect(after.fields.updated).toBe(before.fields.updated);
  expect(after.changelog.histories).toEqual(before.changelog.histories);
}

describe('packaged Jira transition action against Jira Data Center', () => {
  beforeAll(async () => {
    await access(packagedActionPath);
    await jiraRequest('GET', '/myself');
    const project = await jiraRequest<{ key: string }>('GET', `/project/${projectKey}`);
    expect(project.key).toBe(projectKey);
  });

  afterAll(async () => {
    for (const key of createdIssues) await deleteIssue(key);
  });

  it('transitions multiple issues and writes verified before/after outputs using the workspace config', async () => {
    const before = [await createIssue(), await createIssue()];
    const result = await runAction(
      before.map((issue) => issue.key),
      { configSource: 'file' },
    );

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.outputs).toHaveLength(2);
    for (const issue of before) {
      const after = await readIssue(issue.key);
      expect(after.fields.status.name).toBe('In Progress');
      expect(after.changelog.histories.flatMap((history) => history.items)).toContainEqual(
        expect.objectContaining({ field: 'status', fromString: 'To Do', toString: 'In Progress' }),
      );
      expect(result.outputs).toContainEqual(
        expect.objectContaining({
          issue: issue.key,
          beforestatus: issue.fields.status.name,
          status: after.fields.status.name,
        }),
      );
    }
  });

  it('matches a merged pull request payload to Done instead of the earlier opened rule', async () => {
    const before = await createIssue();
    const result = await runAction([before.key], { payload: webhook('closed', true) });

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    const after = await readIssue(before.key);
    expect(after.fields.status.name).toBe('Done');
    expect(result.outputs).toEqual([
      expect.objectContaining({ issue: before.key, beforestatus: 'To Do', status: after.fields.status.name }),
    ]);
  });

  it('leaves an issue unchanged when the pull request closed without merging', async () => {
    const before = await createIssue();
    const result = await runAction([before.key], { payload: webhook('closed', false) });

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expectUnchanged(before, await readIssue(before.key));
    expect(result.outputs).toEqual([
      expect.objectContaining({ issue: before.key, beforestatus: 'To Do', status: 'To Do' }),
    ]);
  });

  it('is idempotent when the issue already has the target status', async () => {
    const issue = await createIssue();
    const first = await runAction([issue.key]);
    expect(first.code, `${first.stdout}\n${first.stderr}`).toBe(0);
    const before = await readIssue(issue.key);
    expect(before.fields.status.name).toBe('In Progress');

    const second = await runAction([issue.key]);

    expect(second.code, `${second.stdout}\n${second.stderr}`).toBe(0);
    expect(second.stdout).not.toContain('Applying transition');
    expectUnchanged(before, await readIssue(issue.key));
    expect(second.outputs).toEqual([
      expect.objectContaining({ issue: issue.key, beforestatus: 'In Progress', status: 'In Progress' }),
    ]);
  });

  it('keeps an ignored Done issue unchanged on a matching opened event', async () => {
    const issue = await createIssue();
    const complete = await runAction([issue.key], { payload: webhook('closed', true) });
    expect(complete.code, `${complete.stdout}\n${complete.stderr}`).toBe(0);
    const before = await readIssue(issue.key);
    expect(before.fields.status.name).toBe('Done');

    const result = await runAction([issue.key]);

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).not.toContain('Applying transition');
    expectUnchanged(before, await readIssue(issue.key));
    expect(result.outputs).toEqual([
      expect.objectContaining({ issue: issue.key, beforestatus: 'Done', status: 'Done' }),
    ]);
  });

  it.each([true, false])('reports an unavailable transition accurately (fail_on_error=%s)', async (failOnError) => {
    const before = await createIssue();
    const result = await runAction([before.key], {
      failOnError,
      transitionsYaml: mapping('Unavailable E2E Status'),
    });

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(failOnError ? 1 : 0);
    expect(result.outputs).toEqual([]);
    expect(result.stdout).toContain(`No available transition for ${before.key}`);
    expectUnchanged(before, await readIssue(before.key));
  });

  it.each([true, false])('handles a real Jira 404 according to fail_on_error=%s', async (failOnError) => {
    const issue = await createIssue();
    await deleteIssue(issue.key);

    const result = await runAction([issue.key], { failOnError });

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(failOnError ? 1 : 0);
    expect(result.outputs).toEqual([]);
    expect(result.stdout).toContain(`Failed to process issue ${issue.key}`);
  });

  it('fails a mixed batch while retaining the successfully transitioned issue output', async () => {
    const valid = await createIssue();
    const missing = await createIssue();
    await deleteIssue(missing.key);

    const result = await runAction([valid.key, missing.key]);

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    const after = await readIssue(valid.key);
    expect(after.fields.status.name).toBe('In Progress');
    expect(result.outputs).toEqual([
      expect.objectContaining({ issue: valid.key, beforestatus: 'To Do', status: after.fields.status.name }),
    ]);
    expect(result.stdout).toContain(`Failed to process issue ${missing.key}`);
  });
});
