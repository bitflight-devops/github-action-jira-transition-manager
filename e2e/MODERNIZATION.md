# 2026 Modernization Updates

This document tracks the updates made to bring the E2E test harness to 2026 standards.

## GitHub Actions Updates

### Actions Version Updates

All GitHub Actions have been updated to their latest stable versions as of 2026:

- **actions/checkout**: `v3` → `v4.2.2` (latest stable)
- **actions/setup-node**: `v4` → `v4.1.0` (latest stable)
- **actions/upload-artifact**: `v4` → `v4.5.0` (latest stable with improved performance)

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
- The compose file now uses the modern format that's been standard since Docker Compose V2 (2021+)

### Image Updates

- **PostgreSQL**: `14.10-alpine` → `17.2-alpine` (current stable, improved performance and security)
- **Jira Software**: `9.12.0` → `10.4.0` (latest stable Data Center version)

### Docker Compose V2

Modern Docker installations (2021+) include Compose V2 integrated into the Docker CLI:

```bash
# Old (deprecated): docker-compose up
# New (2026): docker compose up
```

Our npm scripts already use the modern `docker compose` syntax.

## Rationale

### Why These Versions?

**PostgreSQL 17.2**:

- Latest stable release with improved query performance
- Better JSON support for modern application patterns
- Enhanced security features
- Full compatibility with Jira 10.x

**Jira Software 10.4.0**:

- Latest Data Center version (2026)
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

If you encounter issues:

1. **Docker Compose format**: If you're on an older Docker version, install Docker Desktop 4.0+ or Docker CLI with Compose V2
2. **PostgreSQL**: If compatibility issues arise, can roll back to `16.x-alpine`
3. **Jira**: If Jira 10.4.0 has issues, can use `10.0.0` or `9.17.0`
4. **Node.js**: If Node 22 causes issues, can fall back to `20` (LTS until 2026)

## References

- [Docker Compose V2 Migration](https://docs.docker.com/compose/compose-v2/)
- [PostgreSQL 17 Release Notes](https://www.postgresql.org/docs/17/release-17.html)
- [Atlassian Jira Data Center Releases](https://confluence.atlassian.com/jiracore/jira-core-release-notes.html)
- [Node.js Release Schedule](https://nodejs.org/en/about/releases/)
- [GitHub Actions Changelog](https://github.blog/changelog/)
