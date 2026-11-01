import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type RequestListener, type Server } from 'node:http';
import { createServer as createSecureServer, type Server as SecureServer } from 'node:https';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Duplex } from 'node:stream';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';

import { runPackagedAction } from '../e2e/tests/action-runner';

async function listen(server: Server | SecureServer): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP test listener');
  return address.port;
}

let certificateDirectory: string;
let certificate: Buffer;
let key: Buffer;

beforeAll(async () => {
  certificateDirectory = await mkdtemp(join(tmpdir(), 'jira-proxy-tls-'));
  // Generate an ephemeral test-only CA/server certificate. The action subprocess
  // trusts only this extra CA; TLS verification is never disabled.
  await promisify(execFile)('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout',
    join(certificateDirectory, 'key.pem'),
    '-out',
    join(certificateDirectory, 'cert.pem'),
  ]);
  [certificate, key] = await Promise.all([
    readFile(join(certificateDirectory, 'cert.pem')),
    readFile(join(certificateDirectory, 'key.pem')),
  ]);
});

afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  if (certificateDirectory) await rm(certificateDirectory, { recursive: true, force: true });
});

it.each([
  ['http', ''],
  ['http', '127.0.0.1'],
  ['https', ''],
  ['https', '127.0.0.1'],
])('packaged action honors %s proxy routing and NO_PROXY=%s', async (protocol, noProxy) => {
  let status = 'Open';
  const respond: RequestListener = (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url?.endsWith('/serverInfo')) {
      res.end(
        JSON.stringify({
          baseUrl: 'http://localhost',
          version: '10.3.26',
          versionNumbers: [10, 3, 26],
          deploymentType: 'Server',
        }),
      );
    } else if (req.method === 'POST') {
      status = 'In Progress';
      res.writeHead(204).end();
    } else if (req.url?.endsWith('/transitions')) {
      res.end(JSON.stringify({ transitions: [{ id: '21', name: 'Start', to: { name: 'In Progress' } }] }));
    } else {
      res.end(JSON.stringify({ key: 'TEST-1', fields: { status: { name: status } } }));
    }
  };
  const target = protocol === 'https' ? createSecureServer({ cert: certificate, key }, respond) : createServer(respond);
  const targetPort = await listen(target);
  let tunnels = 0;
  const sockets = new Set<Duplex>();
  const proxy = createServer();
  proxy.on('connect', (_req, socket, head) => {
    tunnels++;
    // This fixture can only forward to its own loopback target.
    const upstream = connect(targetPort, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    sockets.add(socket);
    sockets.add(upstream);
    socket.on('error', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
  });
  const proxyPort = await listen(proxy);
  try {
    vi.stubEnv('NODE_USE_ENV_PROXY', '0');
    vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '1');
    vi.stubEnv('NODE_EXTRA_CA_CERTS', join(certificateDirectory, 'cert.pem'));
    for (const key of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy']) {
      // The other protocol gets an unusable proxy, proving the selected variable is used.
      const selected = key.toLowerCase() === `${protocol}_proxy`;
      vi.stubEnv(key, `http://127.0.0.1:${selected ? proxyPort : 1}`);
    }
    for (const key of ['NO_PROXY', 'no_proxy']) vi.stubEnv(key, noProxy);
    const result = await runPackagedAction({
      issues: ['TEST-1'],
      baseUrl: `${protocol}://127.0.0.1:${targetPort}`,
      username: 'admin',
      password: 'test-password',
      transitionsYaml:
        'projects:\n  TEST:\n    ignored_states: []\n    to_state:\n      In Progress:\n        - eventName: pull_request\n          action: opened\n',
      payload: { action: 'opened', pull_request: { number: 42, merged: false } },
    });
    expect(result.code, result.stderr).toBe(0);
    expect(status).toBe('In Progress');
    expect(result.outputs[0]).toMatchObject({ issue: 'TEST-1', beforestatus: 'Open', status: 'In Progress' });
    expect(tunnels > 0).toBe(noProxy === '');
  } finally {
    for (const socket of sockets) socket.destroy();
    target.closeAllConnections();
    target.close();
    proxy.close();
  }
});
