# Jira integration E2E tests

These tests execute the packaged GitHub Action against a real, disposable Jira Data Center instance. The assertions read Jira independently; helper API success alone cannot pass an action test.

## Run locally

Use Node 24.19+, Yarn 1.22.22, and Docker with Compose v2 on Linux amd64. The Jira JVM uses a 2 GiB maximum heap; allow additional memory and disk for PostgreSQL, Docker layers, and the test runner.

```bash
yarn install --frozen-lockfile
yarn build
yarn e2e:prepare
yarn e2e:test
yarn e2e:down
```

For a guaranteed cold setup, run `JIRA_E2E_MODE=cold yarn e2e:prepare`. For a required warm restore, run `yarn e2e:fixture:restore`. `yarn e2e:logs` saves diagnostics under `.cache/jira-e2e/artifacts`. Always remove the disposable environment after testing; the saved fixture remains available for a later restore.

## What is verified

- Real transitions through `dist/index.js`, including multiple issues and before/after outputs.
- Correct GitHub webhook event/action/payload matching.
- Already-target and ignored-state idempotence, checked against unchanged Jira timestamps and changelog.
- Unavailable transitions, actual Jira 404s, strict/nonfatal errors, and partial batch success.
- A native `uses: ./` invocation, followed by independent status, changelog, and action-output assertions.
- Frozen dependency installation and committed-bundle parity.

Tests create unique disposable issues. They never use production credentials. The shared fixture provides project `E2E`, a standard Scrum workflow, and `admin` / `admin` on loopback port 8080.

## Fixture lifecycle and caching

See [the shared fixture documentation](jira/README.md). It describes the official images and license, cold preparation, paired database/home snapshots, archive validation, fresh-volume restore, cache ownership, and failure diagnostics.

CI keeps setup fallback separate from the tests. A failed action assertion is always a failed job. The fixture producer also requires its exact saved cache on a separate fresh runner, without a cold fallback.

This lane validates Jira Data Center REST v2 behavior. Jira Cloud authentication, Cloud-only fields, organization policy, and webhooks require a separate real Cloud test site.
