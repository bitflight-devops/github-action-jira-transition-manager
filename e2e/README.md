# E2E Testing Guide

This directory contains end-to-end (E2E) tests for the Jira Transition Manager GitHub Action using a dockerized Jira Data Center instance.

## Overview

The E2E test harness:

- Boots a local Jira Software Data Center instance in Docker
- Seeds it with minimal test data (project, versions, issues)
- Runs tests against the action logic
- Validates behavior via Jira REST API

This provides deterministic testing while being as Cloud-compatible as possible. The harness is designed to easily swap to Jira Cloud by changing configuration.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and Yarn
- At least 6GB of RAM available for Docker (Jira is memory-intensive)

## Quick Start

### Running E2E Tests Locally

1. **Start the Jira stack:**

   ```bash
   yarn e2e:up
   ```

   This starts PostgreSQL and Jira Software containers.

2. **Wait for Jira to be ready:**

   ```bash
   yarn e2e:wait
   ```

   This polls Jira until it responds to authenticated requests (may take 3-5 minutes on first run).

3. **Seed test data:**

   ```bash
   yarn e2e:seed
   ```

   This creates a test project (E2E), initial version (1.0.0), and test issue.

4. **Run the tests:**

   ```bash
   yarn e2e:test
   ```

5. **Stop the stack:**
   ```bash
   yarn e2e:down
   ```

### All-in-One Command

Run everything in sequence:

```bash
yarn e2e:all
```

### View Logs

To see Docker container logs:

```bash
yarn e2e:logs
```

## Directory Structure

```
e2e/
├── docker/
│   └── docker-compose.yml        # Docker Compose configuration
├── scripts/
│   ├── e2e-config.ts             # Central E2E configuration
│   ├── jira-client.ts            # Jira REST API client for tests
│   ├── wait-for-jira.ts          # Readiness check script
│   └── seed-jira.ts              # Test data seeding script
└── tests/
    ├── fixversion.e2e.test.ts    # FixVersion CRUD E2E tests
    └── transitions.e2e.test.ts   # Action integration E2E tests
```

## Configuration

E2E configuration is centralized in `scripts/e2e-config.ts`.

### Local Jira DC (default)

Uses basic authentication with admin credentials:

```bash
export E2E_JIRA_BASE_URL=http://localhost:8080
export E2E_JIRA_USERNAME=admin
export E2E_JIRA_PASSWORD=admin
```

### Future: Jira Cloud

To test against Jira Cloud, set these environment variables:

```bash
export E2E_JIRA_BASE_URL=https://your-instance.atlassian.net
export E2E_JIRA_EMAIL=your-email@example.com
export E2E_JIRA_API_TOKEN=your-api-token
```

The test harness will automatically detect Cloud auth and use email + API token.

## Test Coverage

The E2E tests cover:

### Action Integration Tests (`transitions.e2e.test.ts`)

- ✅ Issue creation and retrieval
- ✅ JQL search functionality
- ✅ Action construction with valid config
- ✅ Graceful handling of non-existent issues
- ✅ Jira client methods (getServerInfo, getMyself, etc.)
- ✅ Issue field updates

### FixVersion Management Tests (`fixversion.e2e.test.ts`)

- ✅ Project and version setup
- ✅ Creating new versions (patch, minor, major)
- ✅ Idempotent version creation (no duplicates)
- ✅ Creating issues with fixVersions
- ✅ Updating issue fixVersions
- ✅ Searching issues by fixVersion
- ✅ Edge cases (special characters, empty versions)

## Troubleshooting

### Jira takes too long to start

Jira Software can take 3-5 minutes to fully boot on first run. Subsequent runs are faster as Docker caches layers.

If it times out:

1. Increase available RAM for Docker
2. Check logs: `yarn e2e:logs`
3. Manually verify: `curl http://localhost:8080/status`

### Authentication failures

Make sure you're using the correct credentials. The default is:

- Username: `admin`
- Password: `admin`

These are set in the Docker environment and seeding scripts.

### Port conflicts

If port 8080 or 5432 are already in use:

1. Stop conflicting services
2. Or modify ports in `docker/docker-compose.yml`

### Out of memory

Jira requires at least 4GB RAM. If containers crash:

1. Check available Docker memory: `docker stats`
2. Increase Docker Desktop memory limits
3. Reduce JVM memory in docker-compose.yml (not recommended)

### Clean slate

To completely reset the environment:

```bash
yarn e2e:down
docker volume prune -f
yarn e2e:up
```

## CI/CD

E2E tests run automatically in GitHub Actions on pull requests. See `.github/workflows/e2e-jira.yml`.

The workflow:

1. Checks out code
2. Installs dependencies and builds
3. Starts Docker Compose
4. Waits for Jira
5. Seeds test data
6. Runs E2E tests
7. Uploads logs on failure

## Extending Tests

To add new E2E tests:

1. Create a new test file in `e2e/tests/`
2. Import the Jira client: `import { JiraE2EClient } from '../scripts/jira-client'`
3. Use Jest's standard test structure
4. Match the naming pattern: `*.e2e.test.ts`

Example:

```typescript
import { getE2EConfig } from '../scripts/e2e-config';
import { JiraE2EClient } from '../scripts/jira-client';

describe('My E2E Tests', () => {
  let client: JiraE2EClient;

  beforeAll(() => {
    const config = getE2EConfig();
    client = new JiraE2EClient(config);
  });

  it('should do something', async () => {
    // Your test logic
  });
});
```

## Design Notes

### Why Jira Data Center?

There's no supported way to run Jira Cloud locally. Jira Software Data Center in Docker is the closest substitute. It provides:

- Real Jira REST APIs (mostly compatible with Cloud)
- Deterministic test environment
- Fast local development

### Cloud Compatibility

The harness uses Jira REST API v2 endpoints that work in both Cloud and Data Center:

- `/rest/api/2/project`
- `/rest/api/2/version`
- `/rest/api/2/issue`
- `/rest/api/2/search`

Authentication is abstracted to support both basic auth (DC) and email+token (Cloud).

### Why Not UI Testing?

UI testing is brittle and slow. REST API testing is:

- Faster (no browser overhead)
- More reliable (no flaky UI interactions)
- Easier to debug (direct API responses)
- What the action actually uses

## Resources

- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v2/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Atlassian Docker Images](https://hub.docker.com/r/atlassian/jira-software)
