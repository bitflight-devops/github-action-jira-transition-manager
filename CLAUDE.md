# Claude Development Notes

This file documents the testing infrastructure and development setup for this GitHub Action.

## Testing Setup

### Unit Tests

**Status: Working**

Unit tests use **Vitest** (migrated from Jest) with mocked Jira API responses.

- Config: `vitest.config.ts`
- Tests: `__tests__/index.test.ts`
- Fixtures: `__tests__/fixtures/jira-fixtures.ts`

Run with:

```bash
yarn test
```

The Jira client is mocked using `vi.mock('../src/Jira')` to avoid real API calls. Mock data is defined inline in the test file due to Vitest's hoisting behavior.

### E2E Tests

**Status: In progress - testing pre-mounted config approach**

E2E tests use a Dockerized Jira Data Center instance via the `haxqer/jira` image.

#### Docker Setup

- Config: `e2e/docker/compose.yml`
- Image: `haxqer/jira:9.17.5` with MySQL 8.0
- Database config: `e2e/docker/jira-dbconfig.xml` (pre-mounted)
- The haxqer image includes `atlassian-agent.jar` for license generation

#### How It Works

1. **Database config is pre-mounted** via Docker Compose volume mount
   - `jira-dbconfig.xml` → `/var/jira/dbconfig.xml`
   - Jira reads this on startup and connects to MySQL automatically
   - No need to submit web forms for database setup

2. **setup-jira.ts handles the rest**:
   - Waits for Jira to start and initialize database schema
   - Gets server ID from license page
   - Generates license via `atlassian-agent.jar`
   - Submits license and completes admin setup

#### E2E Scripts

Located in `e2e/scripts/`:

| Script             | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `setup-jira.ts`    | Completes Jira setup (license, admin)     |
| `wait-for-jira.ts` | Waits for Jira API to be ready            |
| `seed-jira.ts`     | Creates test project and issues           |
| `snapshot-*.ts`    | Save/restore Docker volumes for faster CI |

#### CI Workflow

File: `.github/workflows/e2e-jira.yml`

The workflow has two paths:

1. **Fast path**: Restore from cached Docker volume snapshots
2. **Slow path**: Full Jira setup from scratch

## What Has Been Tried (E2E Setup)

### Previous Approach: Web Form Automation (Failed)

Tried to automate the Jira setup wizard via HTTP form submissions:

- **Problem**: 403 Forbidden errors due to CSRF token/session issues
- **Cause**: Node's `fetch` doesn't maintain cookies across requests
- **Attempted fixes**: Extract CSRF tokens, pass cookies manually
- **Result**: Still got 403 errors

### Current Approach: Pre-mounted Config (In Testing)

Instead of web form automation:

1. Mount `dbconfig.xml` directly into container via Docker Compose
2. Jira reads config on startup, skips database wizard step
3. Only need HTTP for license submission and admin setup

## Configuration Files

### ESLint

- Config: `eslint.config.mjs`
- Uses flat config format (ESLint 9+)
- Vitest globals defined manually (no `eslint-plugin-vitest`)

### TypeScript

- Main: `tsconfig.json`
- E2E: `e2e/tsconfig.json`
- ESLint: `tsconfig.eslint.json`

### Removed Dependencies

- Jest (replaced by Vitest)
- Babel (Vitest uses esbuild natively)
- `eslint-plugin-jest`

## Useful Commands

```bash
# Unit tests
yarn test
yarn test:watch

# E2E (local)
yarn e2e:up    # Start containers
yarn e2e:setup # Run setup wizard automation
yarn e2e:wait  # Wait for Jira API
yarn e2e:seed  # Create test data
yarn e2e:test  # Run E2E tests
yarn e2e:down  # Stop containers
yarn e2e:logs  # View Docker logs

# Build
yarn build     # Build action + E2E scripts
yarn build:e2e # Build only E2E scripts
```

## Links

- haxqer/jira image: https://github.com/haxqer/jira
- Jira setup wizard docs: https://confluence.atlassian.com/adminjiraserver/running-the-setup-wizard-938846872.html
