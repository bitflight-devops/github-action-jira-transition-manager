import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, openSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, FILES, FORMAT, validateFixture } from './fixture.mjs';
import { baseUrl, seed, verify, waitForReady } from './jira.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.JIRA_E2E_ROOT || path.resolve('.cache/jira-e2e');
const fixture = path.join(root, 'fixture');
const artifacts = path.join(root, 'artifacts');
const images = JSON.parse(await readFile(path.join(directory, 'images.json'), 'utf8'));
const project =
  process.env.JIRA_E2E_PROJECT ||
  `jira-e2e-${process.env.GITHUB_RUN_ID || 'local'}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`;
assert.match(project, /^[a-z0-9][a-z0-9-]+$/, 'Invalid Compose project name');
const env = { ...process.env, JIRA_E2E_JIRA_IMAGE: images.jira, JIRA_E2E_POSTGRES_IMAGE: images.postgres };
const composeArgs = ['compose', '--project-name', project, '--file', path.join(directory, 'compose.yml')];
const docker = (args, options = {}) => execFileSync('docker', args, { env, stdio: 'inherit', ...options });
const compose = (args, options) => docker([...composeArgs, ...args], options);
const capture = (args) => docker(args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const composeCapture = (args) => capture([...composeArgs, ...args]);

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  console.log(`${name}=${value}`);
}

async function fingerprint() {
  const hash = createHash('sha256');
  const files = (await readdir(directory))
    .filter((name) => /\.(mjs|json|yml|txt)$/.test(name) && !name.endsWith('.test.mjs'))
    .sort();
  for (const file of files)
    hash
      .update(file)
      .update('\0')
      .update(await readFile(path.join(directory, file)));
  return hash.digest('hex');
}

async function init() {
  for (const child of ['images', 'fixture', 'artifacts']) await mkdir(path.join(root, child), { recursive: true });
  const imageKey = createHash('sha256').update(JSON.stringify(images)).digest('hex');
  const fixturePrefix = `jira-fixture-v${FORMAT}-${await fingerprint()}-${process.arch}-`;
  output('image-key', `jira-images-v1-${imageKey}-${process.arch}`);
  output('image-path', path.join(root, 'images'));
  output('fixture-prefix', fixturePrefix);
  output(
    'fixture-key',
    `${fixturePrefix}${process.env.GITHUB_RUN_ID || Date.now()}-${process.env.GITHUB_RUN_ATTEMPT || 1}`,
  );
  output('fixture-path', fixture);
  output('base-url', baseUrl);
  output('artifact-path', artifacts);
  if (process.env.GITHUB_ENV) {
    for (const [name, value] of Object.entries({
      JIRA_E2E_ROOT: root,
      JIRA_E2E_PROJECT: project,
      JIRA_E2E_HARNESS: path.join(directory, 'harness.mjs'),
      E2E_JIRA_BASE_URL: baseUrl,
      E2E_JIRA_USERNAME: 'admin',
      E2E_JIRA_PASSWORD: 'admin',
    })) {
      appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
    }
  }
}

async function prepareImages() {
  const archive = path.join(root, 'images', 'images.tar');
  const checksum = `${archive}.sha256`;
  let loaded = false;
  try {
    assert.equal(await digest(archive), (await readFile(checksum, 'utf8')).trim(), 'Image archive checksum mismatch');
    docker(['load', '--input', archive]);
    loaded = true;
  } catch (error) {
    console.log(`No usable image cache: ${error.message}`);
  }
  // Loading a docker-save archive does not reliably restore RepoDigests. Re-pulling
  // the immutable references verifies identity and reuses loaded layers.
  for (const name of ['jira', 'postgres']) {
    docker(['pull', '--platform', images.platform, images[name]]);
    docker(['tag', images[name], `jira-e2e-${name}:fixture`]);
  }
  if (loaded) return;
  docker(['save', '--output', `${archive}.tmp`, 'jira-e2e-jira:fixture', 'jira-e2e-postgres:fixture']);
  await rename(`${archive}.tmp`, archive);
  await writeFile(checksum, `${await digest(archive)}\n`);
}

async function checkContainers() {
  for (const service of ['jira', 'postgres']) {
    const id = composeCapture(['ps', '--all', '--quiet', service]);
    assert.ok(id, `${service} container is missing`);
    const state = JSON.parse(capture(['inspect', '--format', '{{json .State}}', id]));
    assert.ok(state.Running && !state.OOMKilled, `${service} stopped: ${JSON.stringify(state)}`);
  }
}

async function diagnostics() {
  await mkdir(artifacts, { recursive: true });
  for (const [name, args] of [
    ['compose.log', [...composeArgs, 'logs', '--no-color']],
    ['containers.json', [...composeArgs, 'ps', '--all', '--format', 'json']],
    ['stats.txt', ['stats', '--no-stream']],
  ]) {
    try {
      const text = capture(args);
      await writeFile(path.join(artifacts, name), text);
      console.log(text.slice(-16_000));
    } catch (error) {
      console.error(`Cannot collect ${name}: ${error.message}`);
    }
  }
}

function archiveCommand(args, file, restore = false) {
  const descriptor = openSync(file, restore ? 'r' : 'w');
  try {
    docker(args, { stdio: restore ? [descriptor, 'inherit', 'inherit'] : ['ignore', descriptor, 'inherit'] });
  } finally {
    closeSync(descriptor);
  }
}

async function save() {
  compose(['stop', '--timeout', '180', 'jira']);
  const id = composeCapture(['ps', '--all', '--quiet', 'jira']);
  const state = JSON.parse(capture(['inspect', '--format', '{{json .State}}', id]));
  assert.equal(state.Status, 'exited', 'Jira must stop before saving its home and database');
  assert.ok(!state.OOMKilled && [0, 143].includes(state.ExitCode), 'Jira did not shut down cleanly');
  const temporary = path.join(root, 'fixture-new');
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  archiveCommand(
    [
      ...composeArgs,
      'exec',
      '-T',
      'postgres',
      'pg_dump',
      '-U',
      'jira',
      '-d',
      'jira',
      '--format=custom',
      '--no-owner',
      '--no-acl',
    ],
    path.join(temporary, 'database.dump'),
  );
  archiveCommand(
    [
      'run',
      '--rm',
      '--user',
      '0',
      '--entrypoint',
      'tar',
      '--volume',
      `${project}_jira-home:/jira:ro`,
      images.postgres,
      '--numeric-owner',
      '--exclude=./log',
      '-C',
      '/jira',
      '-czf',
      '-',
      '.',
    ],
    path.join(temporary, 'jira-home.tar.gz'),
  );
  const manifest = {
    format: FORMAT,
    fingerprint: await fingerprint(),
    createdAt: new Date().toISOString(),
    images,
    files: {},
    roundTripVerified: false,
  };
  for (const file of FILES)
    manifest.files[file] = {
      bytes: (await stat(path.join(temporary, file))).size,
      sha256: await digest(path.join(temporary, file)),
    };
  await writeFile(path.join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(fixture, { recursive: true, force: true });
  await rename(temporary, fixture);
  return manifest;
}

async function restore({ verifyManifest = true } = {}) {
  if (verifyManifest) await validateFixture(fixture, await fingerprint());
  // Every restore starts with new writable volumes, never cached live database files.
  compose(['down', '--volumes', '--remove-orphans']);
  compose(['up', '--detach', '--wait', '--wait-timeout', '120', 'postgres']);
  archiveCommand(
    [
      ...composeArgs,
      'exec',
      '-T',
      'postgres',
      'pg_restore',
      '-U',
      'jira',
      '-d',
      'jira',
      '--exit-on-error',
      '--no-owner',
      '--no-acl',
    ],
    path.join(fixture, 'database.dump'),
    true,
  );
  docker(['volume', 'create', `${project}_jira-home`]);
  archiveCommand(
    [
      'run',
      '--rm',
      '-i',
      '--user',
      '0',
      '--entrypoint',
      'tar',
      '--volume',
      `${project}_jira-home:/jira`,
      images.postgres,
      '--numeric-owner',
      '-C',
      '/jira',
      '-xzf',
      '-',
    ],
    path.join(fixture, 'jira-home.tar.gz'),
    true,
  );
  compose(['up', '--detach', 'jira']);
  await waitForReady(checkContainers);
  await verify(images.jiraVersion);
}

async function prepare() {
  const mode = process.env.JIRA_E2E_MODE || 'auto';
  assert.ok(['auto', 'cold', 'restore'].includes(mode), 'Mode must be auto, cold, or restore');
  if (mode !== 'cold') {
    try {
      await restore();
      output('fixture-source', 'cache');
      output('save-fixture', 'false');
      return;
    } catch (error) {
      if (mode === 'restore') throw error;
      console.log(`Cached fixture unavailable or unusable; cold setup required: ${error.message}`);
      await diagnostics();
    }
  }
  // This catch boundary covers preparation only. The action test suite runs in
  // a later workflow step and can never be converted into a cache miss.
  compose(['down', '--volumes', '--remove-orphans']);
  compose(['up', '--detach']);
  await waitForReady(checkContainers, { initial: true });
  const { setup } = await import('./setup.mjs');
  await setup(artifacts);
  await waitForReady(checkContainers);
  await seed();
  await verify(images.jiraVersion);
  const manifest = await save();
  await restore({ verifyManifest: false });
  manifest.roundTripVerified = true;
  await writeFile(path.join(fixture, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await validateFixture(fixture, await fingerprint());
  output('fixture-source', 'cold');
  output('save-fixture', 'true');
}

await mkdir(artifacts, { recursive: true });
try {
  const command = process.argv[2];
  if (command === 'init') await init();
  else if (command === 'images') await prepareImages();
  else if (command === 'prepare') await prepare();
  else if (command === 'verify') await verify(images.jiraVersion);
  else if (command === 'restore') await restore();
  else if (command === 'check') await validateFixture(fixture, await fingerprint());
  else if (command === 'logs') await diagnostics();
  else if (command === 'down') compose(['down', '--volumes', '--remove-orphans']);
  else throw new Error('Usage: node harness.mjs init|images|prepare|verify|restore|check|logs|down');
} catch (error) {
  console.error(error.stack || error);
  if (!['init', 'check', 'down', 'logs'].includes(process.argv[2])) await diagnostics();
  process.exitCode = 1;
}
