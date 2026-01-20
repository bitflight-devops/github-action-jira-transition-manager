# E2E Test Harness Verification Guide

This document outlines the verification steps performed during development and recommended verification procedures for each stage of the E2E test harness.

## What Was Tested During Implementation

### 1. Code Compilation and Type Checking

**Verification Performed:**

```bash
# TypeScript compilation check
npx tsc --skipLibCheck --noEmit e2e/scripts/*.ts e2e/tests/*.ts

# Full project build
yarn build
```

**Result:** All TypeScript files compile without errors. The main issue encountered was @types/node version compatibility (resolved with skipLibCheck).

### 2. Code Linting and Formatting

**Verification Performed:**

```bash
# Format all files
yarn format

# Lint the codebase
yarn lint
```

**Result:** All files pass prettier formatting and ESLint rules.

### 3. Code Review

**Verification Performed:**

- Automated code review using code review tool
- Addressed 5 feedback items:
  - Removed non-standard JIRA_SETUP_SKIP env var
  - Fixed unnecessary optional chaining
  - Added fallback for lead field
  - Updated project template to widely available one
  - Reduced CI timeout from 30 to 25 minutes

**Result:** All code review feedback addressed and committed.

## What Was NOT Tested During Implementation

Due to environment constraints, the following were NOT tested during implementation:

### ❌ Docker Stack Execution

- Docker Compose up/down operations
- Jira container startup and readiness
- PostgreSQL container initialization
- Network connectivity between containers

### ❌ Jira REST API Integration

- Actual API calls to Jira instance
- Authentication with admin credentials
- Project/version/issue creation
- JQL search functionality

### ❌ E2E Test Execution

- Running the actual test suites
- Test assertions against live Jira
- Action integration with real Jira instance

### ❌ CI Workflow

- GitHub Actions workflow execution
- Artifact upload on failure
- End-to-end CI pipeline

## Recommended Verification Procedure

To properly verify the E2E test harness, follow these stages:

### Stage 1: Static Analysis (Done ✅)

**What to verify:**

- TypeScript compilation
- Code linting
- Code formatting
- Automated code review

**Commands:**

```bash
yarn build
yarn lint
yarn format
```

**Expected Result:** No errors, all files compile and pass linting.

### Stage 2: Docker Stack Verification (TODO)

**What to verify:**

- Docker Compose starts successfully
- PostgreSQL becomes healthy
- Jira container starts and responds
- Health checks pass

**Commands:**

```bash
# Start the stack
yarn e2e:up

# Check container status
docker ps

# Check logs for errors
yarn e2e:logs

# Verify PostgreSQL
docker exec jira-e2e-postgres pg_isready -U jirauser -d jiradb

# Verify Jira HTTP is up
curl -I http://localhost:8080/status
```

**Expected Result:**

- Both containers running and healthy
- No error messages in logs
- PostgreSQL accepting connections
- Jira responding to HTTP requests (may return 503 during setup)

**Troubleshooting:**

- If Jira fails to start: Check Docker has at least 6GB RAM allocated
- If ports conflict: Ensure 8080 and 5432 are not in use
- Check logs: `docker logs jira-e2e` and `docker logs jira-e2e-postgres`

### Stage 3: Readiness Script Verification (TODO)

**What to verify:**

- wait-for-jira.ts can connect to Jira
- Authentication works with admin/admin credentials
- Polling logic handles Jira startup correctly
- Timeout is sufficient (300 seconds = 5 minutes)

**Commands:**

```bash
# After starting Docker stack
yarn e2e:wait
```

**Expected Result:**

- Script polls Jira every 5 seconds
- Eventually gets HTTP 200 from /status
- Successfully authenticates and gets server info
- Completes with "✓ Jira is ready!" message

**Troubleshooting:**

- If timeout occurs: Jira may need more RAM or longer timeout
- If auth fails: Check Jira setup wizard - may need manual completion
- Monitor progress: Script prints status every 5 seconds

**Note:** First run takes 3-5 minutes as Jira initializes database schema.

### Stage 4: Data Seeding Verification (TODO)

**What to verify:**

- seed-jira.ts can create project
- Version creation works
- Issue creation succeeds
- Idempotency works (can re-run without errors)

**Commands:**

```bash
# After Jira is ready
yarn e2e:seed

# Verify data was created
curl -u admin:admin http://localhost:8080/rest/api/2/project/E2E
curl -u admin:admin http://localhost:8080/rest/api/2/project/E2E/versions
curl -u admin:admin "http://localhost:8080/rest/api/2/search?jql=project=E2E"

# Test idempotency - run again
yarn e2e:seed
```

**Expected Result:**

- Script creates project "E2E" (or finds existing)
- Creates version "1.0.0" (or finds existing)
- Creates test issue (or finds existing)
- Second run completes without errors

**Troubleshooting:**

- If project creation fails: May need to complete Jira setup wizard manually
- If template not found: Project template may not be available in this Jira version
- Check API responses: Add debug logging to jira-client.ts if needed

### Stage 5: E2E Test Execution (TODO)

**What to verify:**

- fixversion.e2e.test.ts runs successfully
- transitions.e2e.test.ts runs successfully
- All test assertions pass
- Tests can connect to Jira and execute API calls

**Commands:**

```bash
# Run E2E tests
yarn e2e:test

# Run specific test file
NODE_ENV=testing jest e2e/tests/fixversion.e2e.test.ts
NODE_ENV=testing jest e2e/tests/transitions.e2e.test.ts

# Run with verbose output
NODE_ENV=testing jest --verbose e2e/tests/fixversion.e2e.test.ts
```

**Expected Result:**

- All tests pass
- No connection errors
- API calls return expected data
- Assertions validate Jira state correctly

**Troubleshooting:**

- If tests timeout: Increase test timeout in jest config
- If auth fails: Verify admin/admin credentials work in browser
- If API errors: Check Jira logs and API responses
- Use `--verbose` flag to see detailed test output

### Stage 6: Full Integration Test (TODO)

**What to verify:**

- Complete workflow from start to finish
- Teardown works correctly
- Can run multiple times

**Commands:**

```bash
# Full workflow
yarn e2e:all

# Manual workflow
yarn e2e:up
yarn e2e:wait
yarn e2e:seed
yarn e2e:test
yarn e2e:down

# Verify cleanup
docker ps -a | grep jira-e2e
docker volume ls | grep jira
```

**Expected Result:**

- Complete workflow succeeds
- Tests pass
- Cleanup removes containers and volumes
- Can repeat the process

### Stage 7: CI Workflow Verification (TODO)

**What to verify:**

- GitHub Actions workflow runs successfully
- All steps complete without errors
- Artifacts are uploaded on failure
- Timeout settings are appropriate

**How to verify:**

1. Push branch to GitHub
2. Observe workflow run in GitHub Actions UI
3. Verify each step completes successfully
4. Check timing of each step
5. Intentionally break a test to verify failure handling and artifact upload

**Expected Result:**

- Workflow completes in under 25 minutes
- All steps succeed
- On failure: Docker logs are uploaded as artifacts
- Workflow badge shows passing status

## Manual Testing Checklist

Use this checklist when manually testing the E2E harness:

### Prerequisites

- [ ] Docker Desktop installed and running
- [ ] Docker has at least 6GB RAM allocated
- [ ] Ports 8080 and 5432 are available
- [ ] Node.js 18+ installed
- [ ] Yarn installed

### Testing Steps

1. [ ] Clone repository
2. [ ] Install dependencies: `yarn install`
3. [ ] Build project: `yarn build` (should succeed)
4. [ ] Start Docker stack: `yarn e2e:up` (should start containers)
5. [ ] Wait for Jira: `yarn e2e:wait` (should complete in 3-5 minutes)
6. [ ] Seed data: `yarn e2e:seed` (should create project/version/issue)
7. [ ] Run tests: `yarn e2e:test` (all tests should pass)
8. [ ] Verify idempotency: `yarn e2e:seed` again (should succeed)
9. [ ] Check logs: `yarn e2e:logs` (should show no errors)
10. [ ] Teardown: `yarn e2e:down` (should remove containers)
11. [ ] Verify cleanup: `docker ps -a | grep jira` (should be empty)

### Browser Verification (Optional)

1. [ ] Navigate to http://localhost:8080
2. [ ] Login with admin/admin
3. [ ] Verify project "E2E" exists
4. [ ] Verify version "1.0.0" exists in project
5. [ ] Verify test issues exist in project

## Known Limitations

### Environment Limitations

- **No Docker Access**: Development environment didn't have Docker, so actual execution wasn't tested
- **No Jira Instance**: Couldn't validate against real Jira REST APIs
- **No CI Execution**: Couldn't verify GitHub Actions workflow end-to-end

### What This Means

- Code is syntactically correct and type-safe ✅
- Code follows best practices and passes review ✅
- Logic is sound based on Jira REST API documentation ✅
- Actual runtime behavior is untested ❌

### Mitigation

To ensure the system works:

1. Run manual testing checklist above
2. Monitor first CI run closely
3. Check Docker logs if any issues occur
4. Verify each stage independently before proceeding
5. Test idempotency of all operations

## Debugging Tips

### If Docker fails to start:

```bash
docker compose -f e2e/docker/docker-compose.yml config  # Validate compose file
docker system df  # Check available disk space
docker system prune  # Clean up unused resources
```

### If Jira won't start:

```bash
docker logs jira-e2e --tail 100  # Check recent logs
docker stats jira-e2e  # Check resource usage
docker exec jira-e2e ps aux  # Check running processes
```

### If tests fail:

```bash
# Add debug logging to jira-client.ts
console.log('Request:', url, options);
console.log('Response:', response.status, await response.text());

# Run single test
NODE_ENV=testing jest -t "should create a new patch version"

# Check Jira API directly
curl -u admin:admin http://localhost:8080/rest/api/2/serverInfo | jq
```

## Recommended Next Steps

1. **Immediate**: Run Stage 2-6 verification on a machine with Docker
2. **Before Merge**: Ensure CI workflow (Stage 7) passes on GitHub
3. **After Merge**: Monitor first few CI runs for any issues
4. **Ongoing**: Add this verification checklist to PR template

## Questions or Issues?

If you encounter issues during verification:

1. Check logs: `yarn e2e:logs`
2. Review troubleshooting sections above
3. Consult e2e/README.md for additional guidance
4. Check Docker container status: `docker ps -a`
5. Verify environment meets prerequisites
