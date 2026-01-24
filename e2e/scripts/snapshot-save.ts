#!/usr/bin/env node
/**
 * Save Jira E2E Docker volumes to snapshot files
 *
 * This creates tar.gz archives of the Jira and PostgreSQL data volumes,
 * allowing fast restoration of a pre-configured Jira instance.
 *
 * Usage:
 *   yarn e2e:snapshot:save [--output-dir <dir>]
 *
 * Prerequisites:
 *   - Docker must be running
 *   - Jira containers should be stopped (data volumes must exist)
 */
import { execSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface SnapshotConfig {
  outputDir: string;
  volumes: {
    name: string;
    file: string;
  }[];
  composeProject: string;
}

const defaultConfig: SnapshotConfig = {
  // Go up two levels: dist/scripts/ -> dist/ -> e2e/, then into snapshots/
  outputDir: path.join(__dirname, '..', '..', 'snapshots'),
  volumes: [
    { name: 'jira-data', file: 'jira-data-snapshot.tar.gz' },
    { name: 'mysql-data', file: 'mysql-data-snapshot.tar.gz' },
  ],
  composeProject: 'docker', // Docker Compose project name (from directory name)
};

function getVolumeFullName(projectName: string, volumeName: string): string {
  // Docker Compose v2 naming: <project>_<volume>
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

function stopContainers(): void {
  console.log('Stopping containers to ensure data consistency...');
  // Go up two levels: dist/scripts/ -> dist/ -> e2e/, then into docker/
  const composeDir = path.join(__dirname, '..', '..', 'docker');

  try {
    execSync('docker compose stop', {
      cwd: composeDir,
      stdio: 'inherit',
    });
    console.log('Containers stopped');
  } catch (_error) {
    console.log('Note: Could not stop containers (may not be running)');
  }
}

function saveVolume(volumeName: string, outputPath: string): boolean {
  console.log(`Saving volume ${volumeName} to ${path.basename(outputPath)}...`);

  try {
    // Use alpine container to tar the volume contents
    const cmd = [
      'docker',
      'run',
      '--rm',
      '-v',
      `${volumeName}:/data:ro`,
      '-v',
      `${path.dirname(outputPath)}:/backup`,
      'alpine',
      'tar',
      'czf',
      `/backup/${path.basename(outputPath)}`,
      '-C',
      '/data',
      '.',
    ];

    execSync(cmd.join(' '), { stdio: 'inherit' });

    // Verify the file was created
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  Saved: ${sizeMB} MB`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`  Failed to save volume: ${error}`);
    return false;
  }
}

function createMetadata(config: SnapshotConfig): void {
  const metadata = {
    createdAt: new Date().toISOString(),
    jiraVersion: '9.17.5',
    mysqlVersion: '8.0',
    volumes: config.volumes.map((v) => ({
      name: v.name,
      file: v.file,
    })),
    notes: 'Pre-configured Jira DC (haxqer image) with E2E project, admin/admin credentials',
  };

  const metadataPath = path.join(config.outputDir, 'snapshot-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`Metadata saved to ${metadataPath}`);
}

async function main(): Promise<void> {
  console.log('=== Jira E2E Snapshot Save ===\n');

  // Parse arguments
  const args = process.argv.slice(2);
  const outputDirIndex = args.indexOf('--output-dir');
  const config = { ...defaultConfig };

  if (outputDirIndex !== -1 && args[outputDirIndex + 1]) {
    config.outputDir = path.resolve(args[outputDirIndex + 1]);
  }

  // Check Docker
  if (!checkDocker()) {
    console.error('Error: Docker is not available');
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
    console.log(`Created output directory: ${config.outputDir}`);
  }

  // Stop containers for consistent snapshot
  stopContainers();

  // Check and save each volume
  let allSuccess = true;

  for (const volume of config.volumes) {
    const fullVolumeName = getVolumeFullName(config.composeProject, volume.name);
    const outputPath = path.join(config.outputDir, volume.file);

    if (!volumeExists(fullVolumeName)) {
      console.error(`Error: Volume ${fullVolumeName} does not exist`);
      console.log('  Have you run the E2E setup? Try: yarn e2e:all');
      allSuccess = false;
      continue;
    }

    const success = saveVolume(fullVolumeName, outputPath);
    if (!success) {
      allSuccess = false;
    }
  }

  if (allSuccess) {
    createMetadata(config);
    console.log('\n=== Snapshot saved successfully! ===');
    console.log(`Location: ${config.outputDir}`);
    console.log('\nFiles:');
    for (const volume of config.volumes) {
      console.log(`  - ${volume.file}`);
    }
    console.log('  - snapshot-metadata.json');
    console.log('\nTo restore: yarn e2e:snapshot:restore');
  } else {
    console.error('\n=== Snapshot save failed ===');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Snapshot save failed:', error);
  process.exit(1);
});
