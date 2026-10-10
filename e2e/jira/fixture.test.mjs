import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { digest, FILES, FORMAT, isRunning, validateFixture } from './fixture.mjs';

const directories = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'jira-fixture-test-'));
  directories.push(directory);
  const manifest = {
    format: FORMAT,
    fingerprint: 'expected',
    files: {},
    createdAt: new Date().toISOString(),
    roundTripVerified: true,
  };
  for (const name of FILES) {
    const file = path.join(directory, name);
    const contents = Buffer.from(`fixture content for ${name}`);
    await writeFile(file, contents);
    manifest.files[name] = { bytes: contents.length, sha256: await digest(file) };
  }
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  return { directory, manifest };
}

test('complete verified database/home pair can be restored', async () => {
  const { directory, manifest } = await fixture();
  assert.deepEqual(await validateFixture(directory, 'expected'), manifest);
});

test('a cached fixture for different setup or pinned images is rejected', async () => {
  const { directory } = await fixture();
  await assert.rejects(validateFixture(directory, 'changed'), /does not match/);
});

test('missing database or empty metadata cannot be mistaken for a cache hit', async () => {
  const { directory, manifest } = await fixture();
  manifest.files = {};
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(validateFixture(directory, 'expected'), /Incomplete/);
});

test('a same-length corrupt archive is rejected by checksum', async () => {
  const { directory } = await fixture();
  const file = path.join(directory, FILES[0]);
  const contents = await readFile(file);
  contents[0] ^= 1;
  await writeFile(file, contents);
  await assert.rejects(validateFixture(directory, 'expected'), /Checksum mismatch/);
});

test('truncated archives are rejected', async () => {
  const { directory } = await fixture();
  await writeFile(path.join(directory, FILES[1]), 'short');
  await assert.rejects(validateFixture(directory, 'expected'), /Truncated/);
});

test('snapshots are not usable until the producer proves a fresh-volume restore', async () => {
  const { directory, manifest } = await fixture();
  manifest.roundTripVerified = false;
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(validateFixture(directory, 'expected'), /fresh-volume restore/);
});

test('HTTP 200 alone does not mean Jira is ready', () => {
  for (const state of ['FIRST_RUN', 'STARTING', 'STOPPING', 'MAINTENANCE', undefined]) {
    assert.equal(isRunning(200, { state }), false);
  }
  assert.equal(isRunning(503, { state: 'RUNNING' }), false);
  assert.equal(isRunning(200, { state: 'RUNNING' }), true);
});
