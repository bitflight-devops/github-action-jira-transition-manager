import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { isRunning } from './fixture.mjs';

export const baseUrl = 'http://127.0.0.1:8080';
const authorization = `Basic ${Buffer.from('admin:admin').toString('base64')}`;

export async function request(endpoint, { method = 'GET', body, allow404 = false } = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: { authorization, 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  if (allow404 && response.status === 404) return null;
  assert.ok(response.ok, `${method} ${endpoint}: HTTP ${response.status}: ${text.slice(0, 1500)}`);
  return text ? JSON.parse(text) : undefined;
}

export async function waitForReady(checkContainers, { initial = false, timeout = 600_000 } = {}) {
  const deadline = Date.now() + timeout;
  let last = 'No HTTP response';
  while (Date.now() < deadline) {
    await checkContainers();
    try {
      const response = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(5000) });
      const text = await response.text();
      last = `${response.status} ${text.slice(0, 150)}`;
      let status;
      try {
        status = JSON.parse(text);
      } catch {
        /* The servlet may still be initializing. */
      }
      if (initial && response.ok && ['FIRST_RUN', 'RUNNING'].includes(status?.state)) return;
      if (isRunning(response.status, status)) {
        const user = await request('/rest/api/2/myself');
        assert.equal(user.name, 'admin', 'Jira authenticated as an unexpected user');
        return;
      }
    } catch (error) {
      last = error.message;
    }
    console.log(`Waiting for Jira${initial ? ' setup' : ' authenticated readiness'}: ${last}`);
    await delay(5000);
  }
  throw new Error(`Jira readiness timeout: ${last}`);
}

export async function seed() {
  let project = await request('/rest/api/2/project/E2E', { allow404: true });
  if (!project) {
    project = await request('/rest/api/2/project', {
      method: 'POST',
      body: {
        key: 'E2E',
        name: 'Integration E2E',
        projectTypeKey: 'software',
        projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-scrum-template',
        lead: 'admin',
        assigneeType: 'PROJECT_LEAD',
        description: 'Disposable integration fixture',
      },
    });
  }
  // The action under test must be able to edit fixVersions using normal Jira screens.
  const screens = await request('/rest/api/2/screens');
  for (const screen of Array.isArray(screens) ? screens : screens.values) {
    const tabs = await request(`/rest/api/2/screens/${screen.id}/tabs`);
    for (const tab of tabs) {
      const fields = await request(`/rest/api/2/screens/${screen.id}/tabs/${tab.id}/fields`);
      if (!fields.some((field) => field.id === 'fixVersions')) {
        await request(`/rest/api/2/screens/${screen.id}/tabs/${tab.id}/fields`, {
          method: 'POST',
          body: { fieldId: 'fixVersions' },
        });
      }
    }
  }
  const versions = await request('/rest/api/2/project/E2E/versions');
  if (!versions.some((version) => version.name === '1.0.0')) {
    await request('/rest/api/2/version', {
      method: 'POST',
      body: { project: 'E2E', name: '1.0.0', released: false },
    });
  }
  console.log(`Seeded project E2E (${project.id}), Task workflow, editable fixVersions, and version 1.0.0`);
}

export async function verify(version) {
  const info = await request('/rest/api/2/serverInfo');
  assert.equal(info.version, version, 'Unexpected Jira image/version');
  const versions = await request('/rest/api/2/project/E2E/versions');
  const baseline = versions.find((candidate) => candidate.name === '1.0.0');
  assert.ok(baseline?.id, 'Baseline version is missing');
  const issue = await request('/rest/api/2/issue', {
    method: 'POST',
    body: {
      fields: {
        project: { key: 'E2E' },
        issuetype: { name: 'Task' },
        summary: 'Fixture authenticated write probe',
        fixVersions: [{ id: baseline.id }],
      },
    },
  });
  assert.match(issue.key, /^E2E-\d+$/);
  try {
    const before = await request(`/rest/api/2/issue/${issue.key}?fields=status,fixVersions`);
    assert.equal(before.fields.status.name, 'To Do', 'Wrong baseline workflow');
    assert.deepEqual(
      before.fields.fixVersions.map((item) => item.id),
      [baseline.id],
    );
    const { transitions } = await request(`/rest/api/2/issue/${issue.key}/transitions`);
    const target = transitions.find((transition) => transition.to.name === 'In Progress');
    assert.ok(target?.id, 'Required In Progress transition is unavailable');
    await request(`/rest/api/2/issue/${issue.key}/transitions`, {
      method: 'POST',
      body: { transition: { id: target.id } },
    });
    const after = await request(`/rest/api/2/issue/${issue.key}?fields=status`);
    assert.equal(after.fields.status.name, 'In Progress');
  } finally {
    await request(`/rest/api/2/issue/${issue.key}`, { method: 'DELETE' });
  }
  console.log(
    `Jira ${version}: authentication, fixture, issue creation, fixVersions, transition, and deletion verified`,
  );
}
