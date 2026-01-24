# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Action Does

A GitHub Action that transitions Jira issues between workflow states based on GitHub events. Given a list of issue keys (e.g., `PROJ-123,PROJ-456`), it reads a YAML configuration mapping GitHub events to Jira states and applies the appropriate transitions.

Configuration lives in `.github/github_event_jira_transitions.yml`:

```yaml
projects:
  PROJ:
    ignored_states:
      - Done
    to_state:
      'In Progress':
        - pull_request:
            action: opened
      'In Review':
        - pull_request:
            action: ready_for_review
```

## Architecture

### Core Classes (src/)

- **`Jira`** - Wrapper around `jira.js` Version2Client. All Jira API calls go through here.
- **`Issue`** - Represents a single Jira issue. Handles fetching issue data, determining available transitions, and applying transitions.
- **`TransitionEventManager`** - Loads YAML config and matches GitHub event context to target Jira states.
- **`Action`** - Entry point. Parses issue list, creates Issue objects, executes transitions in parallel.

### Key Dependency: jira.js

This project uses `jira.js` v5 for all Jira API interactions. When adding Jira functionality, use the existing `Version2Client` patterns in `src/Jira.ts` rather than raw HTTP calls. The library provides typed methods for issues, transitions, projects, versions, screens, etc.

```typescript
import { Version2Client } from 'jira.js';

const client = new Version2Client({
  host: 'https://company.atlassian.net',
  authentication: { basic: { email, apiToken } },
});

// Use client.issues, client.projects, client.projectVersions, etc.
```

## Commands

```bash
# Build (compiles to dist/ via ncc)
yarn build

# Lint and format
yarn lint
yarn format

# Unit tests (Vitest, mocked Jira)
yarn test
yarn test:watch
yarn test -- --testNamePattern="pattern" # Run specific test

# E2E tests (requires Docker)
yarn e2e:up    # Start Jira + MySQL containers
yarn e2e:setup # Run Playwright setup wizard automation
yarn e2e:wait  # Wait for Jira API ready
yarn e2e:seed  # Create test project/issues
yarn e2e:test  # Run E2E test suite
yarn e2e:down  # Stop containers
yarn e2e:all   # Full E2E sequence
```

## Testing

### Unit Tests

Located in `__tests__/`. Uses Vitest with mocked Jira client via `vi.mock('../src/Jira')`. Mock data is inline in test files due to Vitest hoisting.

### E2E Tests

Located in `e2e/`. Uses a Dockerized Jira Data Center instance (`haxqer/jira:9.17.5`).

**E2E Scripts** (`e2e/scripts/`):

- `setup-jira-playwright.ts` - Automates Jira setup wizard via headless Chromium (handles XSRF)
- `jira-client.ts` - E2E test client using jira.js (same library as main action)
- `seed-jira.ts` - Creates test project, versions, and issues
- `wait-for-jira.ts` - Polls until Jira API is ready

**CI Workflow** (`.github/workflows/e2e-jira.yml`):

- Fast path: Restore from cached Docker volume snapshots
- Slow path: Full Jira setup from scratch

## TypeScript Configuration

- `tsconfig.json` - Main action code
- `e2e/tsconfig.json` - E2E scripts (separate compilation to `e2e/dist/`)
- `tsconfig.eslint.json` - ESLint type checking

## Notes

- The action requires Node 22+
- Pre-commit hooks run lint-staged, build, and doc generation
- Commits use conventional commit format (commitlint enforced)
