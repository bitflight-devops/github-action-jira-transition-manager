import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';

const baseUrl = process.env.E2E_JIRA_BASE_URL;
assert.ok(baseUrl, 'The disposable Jira fixture must be prepared first');
async function api(endpoint, method = 'GET', body) {
  const response = await fetch(`${baseUrl}/rest/api/2${endpoint}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  assert.ok(response.ok, `${method} ${endpoint}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : undefined;
}
if (process.argv[2] === 'arrange') {
  const issue = await api('/issue', 'POST', {
    fields: {
      project: { key: 'E2E' },
      issuetype: { name: 'Task' },
      summary: 'Native action manifest smoke test',
    },
  });
  assert.match(issue.key, /^E2E-\d+$/);
  const before = await api(`/issue/${issue.key}?fields=status`);
  assert.equal(before.fields.status.name, 'To Do');
  appendFileSync(process.env.GITHUB_OUTPUT, `issue_key=${issue.key}\n`);
} else if (process.argv[2] === 'verify') {
  const key = process.env.ISSUE_KEY;
  assert.match(key, /^E2E-\d+$/);
  const issue = await api(`/issue/${key}?fields=status&expand=changelog`);
  assert.equal(issue.fields.status.name, 'In Progress');
  assert.ok(
    issue.changelog.histories.some((history) =>
      history.items.some(
        (item) => item.field === 'status' && item.fromString === 'To Do' && item.toString === 'In Progress',
      ),
    ),
  );
  const outputs = JSON.parse(process.env.ACTION_OUTPUTS);
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].issue, key);
  assert.equal(outputs[0].beforestatus, 'To Do');
  assert.equal(outputs[0].status, 'In Progress');
  console.log(`Verified native uses: ./ transition ${key}: To Do -> In Progress, changelog, and action output`);
} else throw new Error('Expected arrange or verify');
