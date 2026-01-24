#!/usr/bin/env node
/**
 * Restore Jira E2E Docker volumes from snapshot files
 *
 * This restores tar.gz archives into Docker volumes, providing a
 * pre-configured Jira instance without needing to run setup.
 *
 * Usage:
 *   yarn e2e:snapshot:restore [--input-dir <dir>] [--force]
 *
 * Options:
 *   --input-dir  Directory containing snapshot files (default: e2e/snapshots)
 *   --force      Overwrite existing volumes without prompting
 *
 * Prerequisites:
 *   - Docker must be running
 *   - Containers should be stopped
 */
import { execSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

interface SnapshotMetadata {
  createdAt: string;
  jiraVersion: string;
  mysqlVersion?: string;
  postgresVersion?: string; // Legacy field for backwards compatibility
  volumes: {
    name: string;
    file: string;
  }[];
  notes?: string;
}

interface RestoreConfig {
  inputDir: string;
  force: boolean;
  composeProject: string;
}

const defaultConfig: RestoreConfig = {
  inputDir: path.join(__dirname, '..', 'snapshots'),
  force: false,
  composeProject: 'docker',
};

function getVolumeFullName(projectName: string, volumeName: string): string {
  return `${projectName}_${volumeName}`;
}

function checkDocker(): boolean {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function volumeExists(volumeName: string): boolean {
  try {
    const result = spawnSync('docker', ['volume', 'inspect', volumeName], {
      stdio: 'pipe',
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function removeVolume(volumeName: string): boolean {
  try {
    execSync(`docker volume rm ${volumeName}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function createVolume(volumeName: string): boolean {
  try {
    execSync(`docker volume create ${volumeName}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function stopContainers(): void {
  console.log('Stopping containers...');
  const composeDir = path.join(__dirname, '..', 'docker');

  try {
    execSync('docker compose stop', {
      cwd: composeDir,
      stdio: 'pipe',
    });
    console.log('Containers stopped');
  } catch {
    console.log('Note: Containers may not be running');
  }
}

function removeContainers(): void {
  console.log('Removing containers (keeping volumes)...');
  const composeDir = path.join(__dirname, '..', 'docker');

  try {
    execSync('docker compose rm -f', {
      cwd: composeDir,
      stdio: 'pipe',
    });
  } catch {
    // Ignore errors
  }
}

function restoreVolume(volumeName: string, snapshotPath: string): boolean {
  console.log(`Restoring volume ${volumeName} from ${path.basename(snapshotPath)}...`);

  try {
    // Use alpine container to untar the snapshot into the volume
    const cmd = [
      'docker',
      'run',
      '--rm',
      '-v',
      `${volumeName}:/data`,
      '-v',
      `${path.dirname(snapshotPath)}:/backup:ro`,
      'alpine',
      'sh',
      '-c',
      `"rm -rf /data/* /data/..?* /data/.[!.]* 2>/dev/null; tar xzf /backup/${path.basename(snapshotPath)} -C /data"`,
    ];

    execSync(cmd.join(' '), { stdio: 'inherit' });

    console.log(`  Restored successfully`);
    return true;
  } catch (error) {
    console.error(`  Failed to restore volume: ${error}`);
    return false;
  }
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function main(): Promise<void> {
  console.log('=== Jira E2E Snapshot Restore ===\n');

  // Parse arguments
  const args = process.argv.slice(2);
  const inputDirIndex = args.indexOf('--input-dir');
  const config = { ...defaultConfig };

  if (inputDirIndex !== -1 && args[inputDirIndex + 1]) {
    config.inputDir = path.resolve(args[inputDirIndex + 1]);
  }

  if (args.includes('--force')) {
    config.force = true;
  }

  // Check Docker
  if (!checkDocker()) {
    console.error('Error: Docker is not available');
    process.exit(1);
  }

  // Check snapshot directory exists
  if (!fs.existsSync(config.inputDir)) {
    console.error(`Error: Snapshot directory not found: ${config.inputDir}`);
    console.log('\nTo create a snapshot:');
    console.log('  1. Run: yarn e2e:all');
    console.log('  2. Run: yarn e2e:snapshot:save');
    process.exit(1);
  }

  // Load metadata
  const metadataPath = path.join(config.inputDir, 'snapshot-metadata.json');
  if (!fs.existsSync(metadataPath)) {
    console.error('Error: snapshot-metadata.json not found');
    console.log('The snapshot directory may be incomplete');
    process.exit(1);
  }

  const metadata: SnapshotMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  console.log(`Snapshot created: ${metadata.createdAt}`);
  console.log(`Jira version: ${metadata.jiraVersion}`);
  if (metadata.notes) {
    console.log(`Notes: ${metadata.notes}`);
  }
  console.log('');

  // Verify all snapshot files exist
  for (const volume of metadata.volumes) {
    const snapshotPath = path.join(config.inputDir, volume.file);
    if (!fs.existsSync(snapshotPath)) {
      console.error(`Error: Missing snapshot file: ${volume.file}`);
      process.exit(1);
    }
    const stats = fs.statSync(snapshotPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Found: ${volume.file} (${sizeMB} MB)`);
  }
  console.log('');

  // Stop and remove containers
  stopContainers();
  removeContainers();

  // Check for existing volumes
  const existingVolumes: string[] = [];
  for (const volume of metadata.volumes) {
    const fullName = getVolumeFullName(config.composeProject, volume.name);
    if (volumeExists(fullName)) {
      existingVolumes.push(fullName);
    }
  }

  if (existingVolumes.length > 0 && !config.force) {
    console.log('Warning: The following volumes already exist:');
    for (const vol of existingVolumes) {
      console.log(`  - ${vol}`);
    }
    console.log('');

    const proceed = await confirm('Do you want to overwrite them?');
    if (!proceed) {
      console.log('Restore cancelled');
      process.exit(0);
    }
  }

  // Remove and recreate volumes
  for (const volume of metadata.volumes) {
    const fullName = getVolumeFullName(config.composeProject, volume.name);

    if (volumeExists(fullName)) {
      console.log(`Removing existing volume: ${fullName}`);
      if (!removeVolume(fullName)) {
        console.error(`Error: Could not remove volume ${fullName}`);
        console.log('Make sure containers are stopped: yarn e2e:down');
        process.exit(1);
      }
    }

    console.log(`Creating volume: ${fullName}`);
    if (!createVolume(fullName)) {
      console.error(`Error: Could not create volume ${fullName}`);
      process.exit(1);
    }
  }

  // Restore each volume
  let allSuccess = true;
  for (const volume of metadata.volumes) {
    const fullName = getVolumeFullName(config.composeProject, volume.name);
    const snapshotPath = path.join(config.inputDir, volume.file);

    const success = restoreVolume(fullName, snapshotPath);
    if (!success) {
      allSuccess = false;
    }
  }

  if (allSuccess) {
    console.log('\n=== Snapshot restored successfully! ===');
    console.log('\nNext steps:');
    console.log('  1. Start Jira: yarn e2e:up');
    console.log('  2. Wait for ready: yarn e2e:wait');
    console.log('  3. Run tests: yarn e2e:test');
    console.log('\nOr run all at once: yarn e2e:up && yarn e2e:wait && yarn e2e:test');
  } else {
    console.error('\n=== Snapshot restore failed ===');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Snapshot restore failed:', error);
  process.exit(1);
});
