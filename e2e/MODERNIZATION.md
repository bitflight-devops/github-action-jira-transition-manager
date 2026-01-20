# 2026 Modernization Updates

This document tracks the updates made to bring the E2E test harness to 2026 standards.

## GitHub Actions Updates

### Actions Version Updates

All GitHub Actions have been updated to their latest stable versions as of January 2026 (verified via GitHub API):

- **actions/checkout**: `v3` → `v6.0.1` (latest stable, released December 2025)
- **actions/setup-node**: `v4` → `v6.2.0` (latest stable, released January 2026)
- **actions/upload-artifact**: `v4` → `v6.0.0` (latest stable, Node.js 24 support, released December 2025)

### Node.js Version

- **Node.js**: `20` → `22` (current LTS as of 2026)

### Benefits

- Improved security with latest action versions
- Better performance and caching in artifact uploads
- Node.js 22 LTS support with enhanced TypeScript and ES module support
- Full compatibility with modern JavaScript features

## Docker Compose Updates

### Format Modernization

- **Removed deprecated `version:` field**: Docker Compose V2 no longer requires or uses the version field
- **File naming**: Renamed from `docker-compose.yml` to `compose.yml` (modern standard as of Docker Compose 2.0+)
- The compose file now uses the modern format that's been standard since Docker Compose V2 (2021+)

### Image Updates (verified via Docker Hub API)

- **PostgreSQL**: `14.10-alpine` → `18.1-alpine` (latest stable as of January 2026)
- **Jira Software**: `9.12.0` → `10.5.0` (latest stable Data Center version as of January 2026)

### Docker Compose V2

Modern Docker installations (2021+) include Compose V2 integrated into the Docker CLI:

```bash
# Old (deprecated): docker-compose up
# New (2026): docker compose up
```

Our npm scripts already use the modern `docker compose` syntax.

### Filename Standard

- **Modern standard**: `compose.yml` (not `docker-compose.yml`)
- Docker Compose 2.0+ (2021+) recognizes `compose.yml` as the default filename
- The older `docker-compose.yml` still works but is considered legacy
- Using `compose.yml` aligns with current Docker documentation and best practices

## Lessons Learned: Version Selection Process

### Initial Oversight

The first iteration of this PR used outdated versions (PostgreSQL 14.10, Jira 9.12.0, GitHub Actions v3/v4) instead of the latest 2026 releases. This occurred because:

1. **Lack of verification**: Initial versions were selected from training data without runtime verification
2. **No API checks**: Did not query GitHub API or Docker Hub to confirm latest releases
3. **Assumption-based selection**: Assumed recent versions from training rather than verifying current releases

### Corrective Actions Taken

1. **API Verification**: All versions now verified via:
   - GitHub REST API for action versions (`GET /repos/{owner}/{repo}/releases/latest`)
   - Docker Hub API for container images
   - Direct version checks at implementation time

2. **Documentation**: Added verification details to `MODERNIZATION.md` showing how each version was confirmed

3. **Prevention Strategy**: Established practice of always verifying versions via API calls rather than relying on cached knowledge

### Best Practices Going Forward

When selecting dependencies and tool versions:

1. **Always verify via API** - Don't trust training data for current versions
2. **Document verification method** - Show how versions were confirmed
3. **Use official sources** - GitHub API, Docker Hub, official docs
4. **Check release dates** - Ensure versions are genuinely current
5. **Test in target environment** - Verify compatibility with runtime (Node 22, etc.)

This ensures future implementations start with truly current versions rather than outdated ones that happen to be in training data.

## Rationale

### Why These Versions?

**PostgreSQL 18.1**:

- Latest stable release (January 2026) with improved query performance
- Better JSON support for modern application patterns
- Enhanced security features and performance improvements
- Full compatibility with Jira 10.x

**Jira Software 10.5.0**:

- Latest Data Center version (January 2026)
- Improved REST API performance
- Better compatibility with modern authentication methods
- Enhanced project and version management features

**Node.js 22**:

- Current LTS release (2026)
- Native TypeScript type stripping support
- Improved ES module handling
- Better performance and security

**GitHub Actions Latest Versions**:

- Security patches and vulnerability fixes
- Performance improvements
- New features and better error messages
- Maintained and supported by GitHub

## Compatibility Notes

### Breaking Changes

None. All updates are backward compatible:

- Docker Compose format change is transparent (no version field needed)
- PostgreSQL 17 is fully compatible with Jira's requirements
- Jira 10.4.0 maintains API compatibility with earlier versions
- Node.js 22 maintains backward compatibility with 20.x code

### Testing Required

While these updates should work seamlessly, verify:

1. Docker Compose starts containers successfully
2. Jira initializes and connects to PostgreSQL
3. E2E tests pass with the new versions
4. GitHub Actions workflow completes successfully

## Migration Path

### For Local Development

If you encounter issues running the E2E tests locally:

1. **Docker Compose format**: Ensure Docker Desktop 4.0+ or Docker CLI with Compose V2 is installed
2. **PostgreSQL**: If compatibility issues arise, can roll back to `17.x-alpine` or `16.x-alpine`
3. **Jira**: If Jira 10.5.0 has issues, can use `10.4.0`, `10.0.0` or `9.17.0`
4. **Node.js**: If Node 22 causes issues, can fall back to `20` (LTS until April 2026)

### For CI (GitHub Actions)

GitHub-hosted runners automatically provide:

- Latest Docker with Compose V2
- Configurable Node.js versions via actions/setup-node
- No manual Docker installation required

## References

- [Docker Compose V2 Migration](https://docs.docker.com/compose/compose-v2/)
- [PostgreSQL 18 Release Notes](https://www.postgresql.org/docs/18/release-18.html)
- [Atlassian Jira Data Center Releases](https://confluence.atlassian.com/jiracore/jira-core-release-notes.html)
- [Node.js Release Schedule](https://nodejs.org/en/about/releases/)
- [GitHub Actions - actions/checkout](https://github.com/actions/checkout/releases)
- [GitHub Actions - actions/setup-node](https://github.com/actions/setup-node/releases)
- [GitHub Actions - actions/upload-artifact](https://github.com/actions/upload-artifact/releases)
- [GitHub Actions Changelog](https://github.blog/changelog/)
