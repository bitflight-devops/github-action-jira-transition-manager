import { afterEach, describe, expect, it, vi } from 'vitest';

import Jira from '../src/Jira';

const conf = { baseUrl: 'https://jira.example.test', email: 'user@example.test', token: 'test-token' };
const issue = { id: '10001', key: 'TEST-1', fields: { status: { name: 'Open' } } };
const transition = { id: '21', name: 'Start', to: { name: 'In Progress' } };

function serverInfo(deploymentType: string) {
  return { baseUrl: conf.baseUrl, version: '10.3.26', versionNumbers: [10, 3, 26], deploymentType };
}

function json(value: unknown) {
  return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('jira.js 6 transport', () => {
  it.each([
    ['Cloud', '3'],
    ['Server', '2'],
    ['Data Center', '2'],
  ])('uses the supported %s API and existing Basic credentials', async (deployment, apiVersion) => {
    const requests: { url: URL; init: RequestInit }[] = [];
    const fetch = vi.fn(async (url: string | URL, init: RequestInit) => {
      const parsed = new URL(url);
      requests.push({ url: parsed, init });
      if (parsed.pathname.endsWith('/serverInfo')) return json(serverInfo(deployment));
      if (init.method === 'POST') return new Response(null, { status: 204 });
      if (parsed.pathname.endsWith('/transitions')) return json({ transitions: [transition] });
      return json(issue);
    });
    vi.stubGlobal('fetch', fetch);
    const jira = new Jira(conf);
    const [result, transitions] = await Promise.all([
      jira.getIssue('TEST-1', { fields: ['status', 'summary'], expand: 'names' }),
      jira.getIssueTransitions('TEST-1'),
    ]);
    expect(result.fields?.status?.name).toBe('Open');
    expect(transitions.transitions?.[0].id).toBe('21');
    await jira.transitionIssue('TEST-1', transition);
    expect(requests.filter(({ url }) => url.pathname.endsWith('/serverInfo'))).toHaveLength(1);
    expect(requests[0].url.pathname).toBe('/rest/api/2/serverInfo');
    const read = requests.find(({ url }) => url.pathname.endsWith('/issue/TEST-1'));
    expect(read?.url.pathname).toBe(`/rest/api/${apiVersion}/issue/TEST-1`);
    expect(read?.url.searchParams.getAll('fields').flatMap((value) => value.split(','))).toEqual(['status', 'summary']);
    expect(read?.url.searchParams.get('expand')).toBe('names');
    const write = requests.find(({ init }) => init.method === 'POST');
    expect(write?.url.pathname).toBe(`/rest/api/${apiVersion}/issue/TEST-1/transitions`);
    expect(JSON.parse(write?.init.body as string)).toEqual({ transition: { id: '21' } });
    for (const { init } of requests) {
      expect(new Headers(init.headers).get('Authorization')).toBe(
        `Basic ${Buffer.from(`${conf.email}:${conf.token}`).toString('base64')}`,
      );
    }
  });

  it('propagates authentication failure without trying a different deployment', async () => {
    const fetch = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    await expect(new Jira(conf).getIssue('TEST-1')).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects HTTP 200 responses that report refused authentication', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(serverInfo('Cloud')), {
          headers: { 'content-type': 'application/json', 'X-Seraph-LoginReason': 'AUTHENTICATED_FAILED' },
        }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(new Jira(conf).getIssue('TEST-1')).rejects.toMatchObject({ status: 200 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown deployment types before requesting or changing issues', async () => {
    const fetch = vi.fn(async () => json(serverInfo('Unknown')));
    vi.stubGlobal('fetch', fetch);
    await expect(new Jira(conf).transitionIssue('TEST-1', transition)).rejects.toThrow(
      'Unsupported Jira deployment type',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects missing transition IDs without making requests', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(new Jira(conf).transitionIssue('TEST-1', {})).rejects.toThrow('Missing transition ID');
    expect(fetch).not.toHaveBeenCalled();
  });
});
