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
        - eventName: pull_request
          action: opened
      'In Review':
        - eventName: pull_request
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

**Data Center fixture**: the shared fixture in `e2e/jira/` uses the Data Center REST contract (including the project `lead` username). Test fixture setup and independent state assertions use native HTTP; production action calls remain in `src/Jira.ts`.

## Commands

```bash
# Build (compiles to dist/index.js via Rollup in ESM format)
yarn build

# Lint and format (uses Biome)
yarn lint       # Check linting and formatting
yarn lint:fix   # Auto-fix linting and formatting issues
yarn format     # Format files only

# Markdown linting
yarn lint:markdown      # Check markdown syntax
yarn lint:markdown:fix  # Auto-fix markdown issues

# Unit tests (Vitest, mocked Jira)
yarn test
yarn test:watch
yarn test -- --testNamePattern="pattern" # Run specific test

# E2E tests (requires Docker Compose and Node 24.19+)
yarn e2e:prepare         # Restore or cold-prepare, seed, save, restore and verify Jira
yarn e2e:test            # Execute dist/index.js and check real Jira state
yarn e2e:logs            # Collect container diagnostics
yarn e2e:down            # Remove this environment and its writable volumes
yarn e2e:all             # Build, prepare, and test
yarn e2e:fixture:test    # Test corruption/readiness checks without Docker
yarn e2e:fixture:check   # Validate the saved fixture manifest and checksums
yarn e2e:fixture:restore # Require a saved fixture and restore it into fresh volumes
```

## Testing

### Unit Tests

Located in `__tests__/`. Uses Vitest with mocked Jira client via `vi.mock('../src/Jira')`. Mock data is inline in test files due to Vitest hoisting.

### E2E Tests

`e2e/jira/` is the canonical shared fixture for the Jira action repositories. It uses digest-pinned official Jira Software 10.3 LTS and PostgreSQL 16, with Atlassian's published three-hour host test license. Read `e2e/jira/README.md` for the fixture contract and local commands.

`e2e/tests/` executes the packaged `dist/index.js` with realistic GitHub webhook and runner files. Native HTTP prepares unique issues and independently checks status, changelog, failure outputs, ignored states, and idempotence. A separate workflow smoke test runs `uses: ./` and validates its effects.

The fixture lifecycle workflow proves cold setup and a required cache restore on a fresh runner. The action workflow restores a compatible fixture or builds a new one. Action assertion failures never trigger a setup retry. Bundled output must match a frozen install and fresh build.

## Build and TypeScript Configuration

- **Build System**: Rollup with TypeScript plugin (see `rollup.config.ts`)
- **Output Format**: ESM (`dist/index.js`)
- **tsconfig.json**: Main action code configured for ESM (`module: ESNext`, `moduleResolution: Bundler`)

## CI/CD Pipeline Monitoring

For monitoring GitHub Actions workflows, tracing errors, and collecting logs using the `gh` CLI, see:

@.claude/docs/gh-pipeline-monitoring.md

## Notes

- The action runs on Node 24; development and CI use Node 24.19+
- Pre-commit hooks run lint-staged, build, and doc generation
- Commits use conventional commit format (commitlint enforced)
