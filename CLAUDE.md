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

**Status: Not yet working - setup wizard automation failing**

E2E tests use a Dockerized Jira Data Center instance via the `haxqer/jira` image.

#### Docker Setup

- Config: `e2e/docker/compose.yml`
- Image: `haxqer/jira:9.17.5` with MySQL 8.0
- The haxqer image includes `atlassian-agent.jar` for license generation

#### E2E Scripts

Located in `e2e/scripts/`:

| Script             | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `setup-jira.ts`    | Automates the Jira setup wizard           |
| `wait-for-jira.ts` | Waits for Jira API to be ready            |
| `seed-jira.ts`     | Creates test project and issues           |
| `snapshot-*.ts`    | Save/restore Docker volumes for faster CI |

#### CI Workflow

File: `.github/workflows/e2e-jira.yml`

The workflow has two paths:

1. **Fast path**: Restore from cached Docker volume snapshots
2. **Slow path**: Full Jira setup from scratch

## What Has Been Tried (E2E Setup)

### Problem: Jira Setup Wizard Automation

The `setup-jira.ts` script attempts to automate the Jira DC setup wizard by:

1. Selecting manual setup mode
2. Configuring MySQL database connection
3. Generating and submitting license via `atlassian-agent.jar`
4. Setting application properties
5. Creating admin account

### Issues Encountered

1. **403 Forbidden on form submissions**
   - Jira requires CSRF tokens (`atl_token`) for all POST requests
   - Added token extraction from HTML forms
   - Still getting 403 - may need cookie/session handling

2. **URL path parsing**
   - Form actions were missing leading `/` (e.g., `SetupMode.jspa` instead of `/SetupMode.jspa`)
   - Fixed with `extractFormAction()` normalization

3. **Setup wizard flow**
   - The wizard returns 404 for later steps if earlier steps haven't completed
   - Database must be configured before license page is available

### Current Debug Output

The script now logs:

- All form fields found in HTML
- CSRF tokens extracted
- Hidden input fields
- HTTP response status codes

### What's Needed to Progress

1. **Session/Cookie handling**: The 403 errors may require maintaining a session cookie across requests. Node's `fetch` doesn't automatically handle cookies.

2. **Verify form field names**: Need to capture the actual HTML from the setup pages to see exact field names Jira expects. The debug logging should help with this.

3. **Alternative approach**: Consider using Puppeteer/Playwright for browser automation instead of raw HTTP requests, as this would handle cookies, JavaScript, and redirects automatically.

4. **Pre-configured image**: Another option is to create a pre-configured Jira Docker image with setup already completed, avoiding the wizard entirely.

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
