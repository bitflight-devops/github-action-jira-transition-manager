# Shared Jira Data Center fixture

This composite action prepares a real Jira Software instance for the transition, FixVersion, and issue-key actions. It owns provisioning only; each consumer executes its own packaged action and asserts the resulting behavior.

## Pinned environment

`images.json` is the image contract: official `atlassian/jira-software:10.3.26-ubuntu-jdk17-r1` and `postgres:16.15-bookworm`, both pinned to immutable multi-platform digests and run as Linux amd64. The fixture binds Jira to `127.0.0.1:8080`; PostgreSQL has no host port. Jira uses a 1 GiB initial and 2 GiB maximum heap.

The container receives Atlassian's documented PostgreSQL variables, including `ATL_DB_TYPE=postgres72`. PostgreSQL initializes the database with UTF-8 and C locale. Each run owns a named Compose project and fresh writable volumes.

The fixture contains only synthetic data: administrator `admin` / `admin`, project `E2E`, a standard Scrum Task workflow, editable Fix Version/s screens, and version `1.0.0`. Mail sending and fetching are disabled.

## Licensing

`license.txt` is an exact copy of Atlassian's public **10-user, three-hour Jira Software Data Center host product test license**, from the [official timebomb license page](https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/#data-center-host-product-licenses). The wizard enters this key normally. No license generator, agent JAR, database license edits, or production license is used.

Keep jobs within the published test period. Cached state is never assumed to have a usable license: authenticated issue creation, transition, and deletion must succeed after every restore. In `auto` mode, an unusable cached environment is replaced by a fresh setup. In `restore` mode, it fails visibly. The harness does not change the license or its timestamps to make an expired fixture usable.

## Lifecycle

1. Load cached Docker layers, then pull the exact digest references to verify image identity and restore Docker RepoDigests. Cache image layers before tests run.
2. Restore a fixture only when its format, setup/image fingerprint, exact two-file manifest, byte sizes, and SHA-256 checksums match.
3. On a cache miss, initialize Jira with the setup wizard and seed the baseline through Jira's API.
4. Check `GET /status` for HTTP 200 **and** `RUNNING`; verify administrator authentication and the expected Jira version. Create a Task with a real fixVersion, transition it, read it back, and delete it.
5. Stop Jira with a three-minute grace period. Reject running, OOM-killed, or forcibly killed state. Save a PostgreSQL custom-format logical dump and the matching Jira home archive while Jira is stopped.
6. Remove the live containers and volumes. Restore the dump into a fresh initialized PostgreSQL database and the home archive into a fresh Jira volume. Start Jira and repeat the functional checks.
7. Mark the manifest verified only after that round trip. Save the immutable fixture cache before consumer action tests, so a later action regression does not lose a good prepared environment.
8. Consumer tests run in a later workflow step; their failures cannot trigger a cold setup retry. Always collect failure diagnostics and remove the disposable environment.

A separate lifecycle workflow performs cold preparation, then requires the producer's exact cache key on another runner. That second job cannot fall back to cold setup. The first job also performs the in-job fresh-volume round trip before making its snapshot available.

## GitHub Actions usage

In this repository:

```yaml
- uses: actions/checkout@v7
- uses: actions/setup-node@v7
  with:
    node-version: '24.19.0'
- id: jira
  uses: ./e2e/jira
  with:
    mode: auto
- run: yarn e2e:test
- if: failure() && env.JIRA_E2E_HARNESS != ''
  run: node "$JIRA_E2E_HARNESS" logs
- if: always() && env.JIRA_E2E_HARNESS != ''
  run: node "$JIRA_E2E_HARNESS" down
```

Other repositories use `bitflight-devops/github-action-jira-transition-manager/e2e/jira@<reviewed-full-commit-sha>`. Pin the shared code revision when updating a consumer. The action exports `E2E_JIRA_BASE_URL`, `E2E_JIRA_USERNAME`, `E2E_JIRA_PASSWORD`, `JIRA_E2E_HARNESS`, and the owned working directory/project for later steps. Outputs include `fixture-source`, `fixture-key`, `base-url`, and `artifact-path`.

Modes are `auto`, `cold`, and `restore`. An explicit `fixture-key` requires `mode: restore` and must match the restored cache exactly. The normal lookup uses only the compatible fingerprint prefix. There is no broad fallback to an older format or different Jira version.

Caches are scoped by GitHub to their repository and ref. Each action repository therefore has its own image/fixture cache; the shared action centralizes the implementation. Default-branch runs create caches usable by later pull requests. A pull request's cache does not promote itself into the default branch. Cache keys include immutable images, all setup/seed/manifest logic, the public license, and the browser lockfile. Each new fixture gets a unique run key, allowing replacement of an unusable prior fixture without mutating an existing cache.

The old `e2e-snapshots` release and MySQL/haxqer format are not read by this harness.

## Local use and maintenance

From this repository, `yarn e2e:prepare` installs the locked setup browser, pulls images, and restores or creates a verified baseline. Then run `yarn e2e:test` and `yarn e2e:down`. `JIRA_E2E_MODE=cold` forces the wizard path. Set `JIRA_E2E_ROOT` to choose a separate cache/artifact directory and `JIRA_E2E_PROJECT` to choose an isolated Compose project. Port 8080 permits one instance per runner.

For consumers, check out the pinned fixture revision separately and use its `e2e/jira/harness.mjs` commands (`init`, `images`, `prepare`, `logs`, `down`) from the consumer working directory. Install the fixture's locked npm dependencies and Chromium as shown in the composite action. Consumer E2E tests need only the resulting URL and test account.

To update Jira or PostgreSQL, change `images.json` with verified image digests and the expected Jira version. The fingerprint automatically invalidates incompatible cached state. Run both the cold/required-cache lifecycle workflow and each consumer's actual action suite before updating shared-action pins.

On failure, upload the artifact directory. It includes Docker status/logs and setup HTML/screenshot when the browser wizard fails. A container exit or OOM fails readiness immediately; an HTTP200 setup or startup state is not readiness. The cache manifest is a diagnostic record of the source fingerprint, images, creation time, archive sizes, checksums, and successful round-trip verification.

## Primary references

- [Atlassian Jira container configuration and shutdown](https://atlassian.github.io/data-center-helm-charts/containers/JIRA/)
- [Jira supported platforms](https://support.atlassian.com/jira/kb/jira-databases-compatibility-matrix-data-center/)
- [Jira database configuration for PostgreSQL](https://confluence.atlassian.com/adminjiraserver/connecting-jira-applications-to-postgresql-938846851.html)
- [Atlassian's provisioning guidance](https://support.atlassian.com/jira/kb/how-to-automate-provisioning-jira-test-environment-with-an-orchestration-pipeline-like-ansible/)
- [Data Center project creation templates](https://support.atlassian.com/jira/kb/creating-projects-via-rest-api-in-jira-server-and-data-center/)
- [GitHub dependency cache behavior](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)

This fixture exercises a single Jira Data Center node. It is not a Jira Cloud emulator, a cluster failover test, or a production deployment template.
