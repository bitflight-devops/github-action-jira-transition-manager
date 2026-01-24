#!/usr/bin/env node
/**
 * Check if Jira E2E snapshots exist and are valid
 *
 * This script validates snapshot files and provides status information.
 * Useful for CI/CD to decide whether to restore from snapshot or run full setup.
 *
 * Usage:
 *   yarn e2e:snapshot:check [--input-dir <dir>]
 *
 * Exit codes:
 *   0 - Snapshots exist and are valid
 *   1 - Snapshots missing or invalid
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Metadata describing a Jira E2E snapshot.
 * Stored in snapshot-metadata.json alongside volume tar files.
 */
interface SnapshotMetadata {
  /** ISO 8601 timestamp when the snapshot was created */
  createdAt: string;
  /** Jira version used when creating the snapshot (e.g., "9.17.5") */
  jiraVersion: string;
  /** MySQL version if using MySQL database */
  mysqlVersion?: string;
  /** PostgreSQL version if using PostgreSQL database (legacy field for backwards compatibility) */
  postgresVersion?: string;
  /** List of Docker volumes included in the snapshot */
  volumes: {
    /** Docker volume name */
    name: string;
    /** Filename of the tar archive for this volume */
    file: string;
  }[];
  /** Optional notes about the snapshot */
  notes?: string;
}

/**
 * Result of validating snapshot files.
 * Contains validation status and diagnostic information.
 */
interface CheckResult {
  /** Whether all required snapshot files exist and are readable */
  valid: boolean;
  /** Parsed snapshot metadata if available */
  metadata?: SnapshotMetadata;
  /** List of files that are missing or invalid */
  missingFiles: string[];
  /** Total size of all snapshot files in megabytes */
  totalSizeMB: number;
  /** Age of the snapshot in hours since creation */
  ageHours: number;
}

/**
 * Validates the existence and integrity of Jira E2E snapshot files.
 *
 * Checks for the presence of the metadata file and all referenced volume archives.
 * Calculates total size and age of the snapshot.
 *
 * @param inputDir - Directory containing snapshot files
 * @returns Validation result with status, metadata, and diagnostic information
 */
function checkSnapshots(inputDir: string): CheckResult {
  const result: CheckResult = {
    valid: false,
    missingFiles: [],
    totalSizeMB: 0,
    ageHours: 0,
  };

  // Check directory exists
  if (!fs.existsSync(inputDir)) {
    result.missingFiles.push('snapshot directory');
    return result;
  }

  // Check metadata file
  const metadataPath = path.join(inputDir, 'snapshot-metadata.json');
  if (!fs.existsSync(metadataPath)) {
    result.missingFiles.push('snapshot-metadata.json');
    return result;
  }

  // Load and parse metadata
  let metadata: SnapshotMetadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    result.metadata = metadata;
  } catch (_error) {
    result.missingFiles.push('snapshot-metadata.json (invalid JSON)');
    return result;
  }

  // Calculate age
  const createdAt = new Date(metadata.createdAt);
  const now = new Date();
  result.ageHours = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

  // Check each volume file
  for (const volume of metadata.volumes) {
    const filePath = path.join(inputDir, volume.file);
    if (!fs.existsSync(filePath)) {
      result.missingFiles.push(volume.file);
    } else {
      const stats = fs.statSync(filePath);
      result.totalSizeMB += stats.size / (1024 * 1024);
    }
  }

  result.valid = result.missingFiles.length === 0;
  return result;
}

/**
 * Formats a duration in hours as a human-readable relative time string.
 *
 * @param hours - Number of hours to format
 * @returns Human-readable string like "less than an hour ago", "5 hours ago", or "3 days ago"
 */
function formatAge(hours: number): string {
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/**
 * Main entry point for the snapshot check CLI.
 *
 * Parses command-line arguments, validates snapshots, and outputs status information.
 * Supports `--input-dir <dir>` to specify snapshot directory and `--quiet`/`-q` for silent mode.
 *
 * @returns Promise that resolves when check is complete
 * @throws Exits process with code 0 if snapshots are valid, 1 if invalid or missing
 */
async function main(): Promise<void> {
  // Parse arguments
  const args = process.argv.slice(2);
  const inputDirIndex = args.indexOf('--input-dir');
  // Go up two levels: dist/scripts/ -> dist/ -> e2e/, then into snapshots/
  let inputDir = path.join(__dirname, '..', '..', 'snapshots');

  if (inputDirIndex !== -1 && args[inputDirIndex + 1]) {
    inputDir = path.resolve(args[inputDirIndex + 1]);
  }

  const quiet = args.includes('--quiet') || args.includes('-q');

  const result = checkSnapshots(inputDir);

  if (!quiet) {
    console.log('=== Jira E2E Snapshot Check ===\n');
    console.log(`Directory: ${inputDir}`);
    console.log(`Status: ${result.valid ? 'VALID' : 'INVALID'}`);

    if (result.metadata) {
      console.log(`\nSnapshot Info:`);
      console.log(`  Created: ${formatAge(result.ageHours)} (${result.metadata.createdAt})`);
      console.log(`  Jira Version: ${result.metadata.jiraVersion}`);
      const dbVersion = result.metadata.mysqlVersion
        ? `MySQL: ${result.metadata.mysqlVersion}`
        : `PostgreSQL: ${result.metadata.postgresVersion}`;
      console.log(`  ${dbVersion}`);
      console.log(`  Total Size: ${result.totalSizeMB.toFixed(2)} MB`);

      if (result.metadata.notes) {
        console.log(`  Notes: ${result.metadata.notes}`);
      }

      console.log(`\nVolumes:`);
      for (const volume of result.metadata.volumes) {
        const filePath = path.join(inputDir, volume.file);
        const exists = fs.existsSync(filePath);
        const status = exists ? '  ' : 'MISSING';
        let sizeInfo = '';
        if (exists) {
          const stats = fs.statSync(filePath);
          sizeInfo = ` (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`;
        }
        console.log(`  [${status}] ${volume.file}${sizeInfo}`);
      }
    }

    if (result.missingFiles.length > 0) {
      console.log(`\nMissing files:`);
      for (const file of result.missingFiles) {
        console.log(`  - ${file}`);
      }
    }

    console.log('');

    if (result.valid) {
      console.log('Snapshots are ready to restore.');
      console.log('Run: yarn e2e:snapshot:restore');
    } else {
      console.log('Snapshots not available.');
      console.log('Run full setup: yarn e2e:all');
      console.log('Then save snapshot: yarn e2e:snapshot:save');
    }
  }

  // Exit with appropriate code
  process.exit(result.valid ? 0 : 1);
}

main().catch((error) => {
  console.error('Snapshot check failed:', error);
  process.exit(1);
});
