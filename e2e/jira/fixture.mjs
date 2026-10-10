import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const FORMAT = 1;
export const FILES = ['database.dump', 'jira-home.tar.gz'];

export async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function validateFixture(directory, fingerprint) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.format, FORMAT, 'Unsupported fixture format');
  assert.equal(manifest.fingerprint, fingerprint, 'Fixture does not match images, setup, and seed');
  assert.deepEqual(Object.keys(manifest.files).sort(), [...FILES].sort(), 'Incomplete fixture');
  assert.ok(Number.isFinite(Date.parse(manifest.createdAt)), 'Missing creation timestamp');
  assert.ok(manifest.roundTripVerified === true, 'Fixture has not passed a fresh-volume restore');
  for (const name of FILES) {
    const file = path.join(directory, name);
    const metadata = manifest.files[name];
    const info = await stat(file);
    assert.ok(info.isFile() && info.size > 0, `Empty or invalid ${name}`);
    assert.equal(info.size, metadata.bytes, `Truncated ${name}`);
    assert.equal(await digest(file), metadata.sha256, `Checksum mismatch: ${name}`);
  }
  return manifest;
}

export function isRunning(response, status) {
  return response === 200 && status?.state === 'RUNNING';
}
