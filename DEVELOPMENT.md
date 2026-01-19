# Development and Testing

## Running Tests

This project includes both unit tests and end-to-end (e2e) tests.

### Unit Tests

Run unit tests with:

```bash
yarn test
```

Or with CI reporter:

```bash
yarn test-ci
```

### E2E Tests with Jira Container

The e2e tests run against a real Jira instance in a Docker container to validate the module's functionality.

#### Prerequisites

- Docker and Docker Compose installed
- Node.js 16+ and Yarn

#### Running E2E Tests Locally

1. Start the Jira container:

```bash
docker compose up -d
```

2. Wait for Jira to be ready (this can take 2-3 minutes):

```bash
# Check container health
docker compose ps

# Check logs
docker compose logs -f jira
```

3. Seed the Jira instance with test data:

```bash
export JIRA_BASE_URL=http://localhost:8080
export JIRA_USER_EMAIL=admin@example.com
export JIRA_API_TOKEN=admin
npx tsx __tests__/fixtures/seed-jira.ts
```

4. Run the e2e tests:

```bash
export JIRA_TEST_ISSUES=DVPS-1,DVPS-2
yarn test __tests__/e2e.test.ts
```

5. Stop the Jira container when done:

```bash
docker compose down -v
```

#### E2E Test Architecture

- **Docker Compose**: Spins up an Atlassian Jira Software container
- **Seed Script**: `__tests__/fixtures/seed-jira.ts` creates test projects (DVPS, UNICORN) and issues
- **E2E Tests**: `__tests__/e2e.test.ts` validates transitions and workflows against the real Jira instance
- **CI Integration**: `.github/workflows/e2e_tests.yml` runs the full e2e suite in GitHub Actions

#### Test Data

The seed script creates:

- **Projects**: DVPS (DevOps Project), UNICORN (Unicorn Project)
- **Issues**: Multiple tasks, bugs, and stories across both projects
- **Workflows**: Standard Jira workflows with various transition states

## Building

Build the action:

```bash
yarn build
```

This compiles TypeScript and bundles with `ncc` to `dist/index.js`.

## Linting and Formatting

```bash
# Format code
yarn format

# Run linters
yarn lint

# Fix linting issues
yarn lint:fix
```
