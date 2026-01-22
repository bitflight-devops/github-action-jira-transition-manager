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

**Status: Improved with dbconfig.xml pre-configuration**

E2E tests use a Dockerized Jira Data Center instance via the `haxqer/jira` image.

#### Docker Setup

- Config: `e2e/docker/compose.yml`
- Image: `haxqer/jira:9.17.5` with MySQL 8.0
- Pre-configured `dbconfig.xml` for database connection
- The haxqer image includes `atlassian-agent.jar` for license generation

#### E2E Scripts

Located in `e2e/scripts/`:

| Script             | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `setup-jira.ts`    | Automates post-database setup wizard steps |
| `wait-for-jira.ts` | Waits for Jira API to be ready            |
| `seed-jira.ts`     | Creates test project and issues           |
| `snapshot-*.ts`    | Save/restore Docker volumes for faster CI |

#### CI Workflow

File: `.github/workflows/e2e-jira.yml`

The workflow has two paths:

1. **Fast path**: Restore from cached Docker volume snapshots
2. **Slow path**: Full Jira setup from scratch with dbconfig.xml

## E2E Setup Approach

### Solution: Pre-configured dbconfig.xml

**Key Discovery**: The haxqer/jira image does NOT support environment variables for database configuration. The proper headless setup approach is to pre-configure the `dbconfig.xml` file.

**Implementation**:
1. `e2e/docker/dbconfig.xml` contains MySQL connection settings
2. Docker Compose mounts it to `/var/jira/dbconfig.xml` (read-only)
3. Jira auto-detects and uses it on first startup
4. Database schema is initialized automatically
5. Setup wizard skips the database configuration step

**Benefits**:
- Eliminates fragile HTTP form automation for database setup
- No need for CSRF token handling or session management for DB config
- Database initialization happens before accessing other wizard pages
- Fixes the 404 errors that occurred when trying to access license page before DB was ready

### Remaining Setup Steps

The `setup-jira.ts` script now handles only:
1. **License**: Waits for database init, generates and submits license
2. **Application Properties**: Sets title, mode, base URL
3. **Admin Account**: Creates the admin user

These steps still require web automation but are much simpler without the database configuration complexity.

### Previous Issues (Now Resolved)

1. **403 Forbidden on database form submissions** - Fixed by pre-configuring dbconfig.xml
2. **404 on license page** - Fixed by ensuring database is initialized before accessing wizard
3. **Session/Cookie handling** - Simplified by removing database configuration step

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
