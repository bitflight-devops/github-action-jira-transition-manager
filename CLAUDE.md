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

**Status: In progress - testing Playwright browser automation**

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

2. **Playwright browser automation** (`setup-jira-playwright.ts`):
   - Waits for Jira startup (monitors Docker logs for ready indicators)
   - Launches headless Chromium browser
   - Navigates through setup wizard (license, admin account)
   - Handles XSRF automatically (real browser session)

#### E2E Scripts

Located in `e2e/scripts/`:

| Script                     | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| `setup-jira-playwright.ts` | Browser-based setup (primary, handles XSRF)  |
| `setup-jira.ts`            | HTTP-based setup (fallback, has XSRF issues) |
| `wait-for-jira.ts`         | Waits for Jira API to be ready               |
| `seed-jira.ts`             | Creates test project and issues              |
| `snapshot-*.ts`            | Save/restore Docker volumes for faster CI    |

#### CI Workflow

File: `.github/workflows/e2e-jira.yml`

The workflow has two paths:

1. **Fast path**: Restore from cached Docker volume snapshots
2. **Slow path**: Full Jira setup from scratch (uses Playwright)

## What Has Been Tried (E2E Setup)

### Approach 1: HTTP Form Automation (Failed)

Tried to automate the Jira setup wizard via HTTP form submissions:

- **Problem**: 403 Forbidden errors due to CSRF token/session issues
- **Cause**: `X-Atlassian-Token: no-check` only works for REST APIs, not web forms
- **Attempted fixes**: Extract CSRF tokens, pass cookies manually, non-browser User-Agent
- **Result**: Still got 403 errors - web forms have strict XSRF protection

### Approach 2: Database License Insertion (Partial Success)

Bypassed web forms by inserting license directly into MySQL:

1. Mount `dbconfig.xml` directly into container via Docker Compose
2. Insert license into `productlicense` table
3. Restart Jira to pick up the license

- **Result**: License insertion worked, but still needed browser for admin setup

### Current Approach: Playwright Browser Automation (In Testing)

Uses headless Chromium to automate the setup wizard:

1. Mount `dbconfig.xml` for database config (skips DB wizard step)
2. Wait for Jira startup (monitor Docker logs for ready patterns)
3. Launch Playwright with headless Chromium
4. Navigate through setup wizard pages (license, admin account)
5. XSRF handled automatically by real browser session

#### Why Playwright?

- Real browser handles cookies, sessions, and XSRF tokens automatically
- More reliable than HTTP-based form submission
- Can take screenshots on failure for debugging
- Works with Jira's strict XSRF protection

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
yarn e2e:up         # Start containers
yarn e2e:setup      # Run Playwright setup (primary)
yarn e2e:setup:http # Run HTTP-based setup (fallback)
yarn e2e:wait       # Wait for Jira API
yarn e2e:seed       # Create test data
yarn e2e:test       # Run E2E tests
yarn e2e:down       # Stop containers
yarn e2e:logs       # View Docker logs

# Build
yarn build     # Build action + E2E scripts
yarn build:e2e # Build only E2E scripts
```

## Development Guidelines

### When Fixing Bugs

When you find and fix a bug, always:

1. **Search for similar patterns** - Use grep/glob to find other instances of the same anti-pattern
2. **Fix all occurrences** - Don't just fix the one that failed, fix all similar issues
3. **Document the pattern** - If it's a recurring issue, add it to a checklist below

### Common Playwright Issues (Checklist)

When writing or reviewing Playwright code, check for:

- [ ] **Multi-element selectors without `.first()`** - `page.click('a, b')` fails if both match
- [ ] **Case-sensitive text matching** - Use regex `/text/i` instead of exact strings
- [ ] **Ambiguous selectors** - Multiple elements with same name (visible + hidden)
- [ ] **Missing `.catch()` on `.isVisible()`** - Can throw if element doesn't exist
- [ ] **Hardcoded timeouts** - Use `waitForLoadState` or `waitForSelector` instead

## Links

- haxqer/jira image: https://github.com/haxqer/jira
- Jira setup wizard docs: https://confluence.atlassian.com/adminjiraserver/running-the-setup-wizard-938846872.html
