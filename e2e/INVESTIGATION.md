# Jira E2E Headless Setup - Investigation Summary

## Problem Statement

The E2E tests were failing during Jira setup wizard automation. The setup-jira.ts script was attempting to automate the web-based configuration wizard via HTTP POST requests but encountering:
- 403 Forbidden errors on form submissions
- 404 errors when trying to access the license page
- Session/cookie handling issues
- CSRF token management complexity

Reference: https://github.com/bitflight-devops/github-action-jira-transition-manager/actions/runs/21236711296/job/61106135402

## Investigation

### Research Conducted

1. **haxqer/jira Docker image documentation**
   - GitHub repository: https://github.com/haxqer/jira
   - Docker Hub: https://hub.docker.com/r/haxqer/jira
   - Examined Dockerfile and docker-compose.yml

2. **Atlassian Jira configuration documentation**
   - dbconfig.xml file format and usage
   - MySQL 8.0 connection requirements
   - Unattended installation options

### Key Discoveries

1. **No Environment Variable Support for Database**
   - The haxqer/jira image does NOT support environment variables for database configuration
   - Unlike some other images, you cannot pass DB_HOST, DB_PORT, DB_NAME, etc.
   - The Dockerfile doesn't include any scripts to generate dbconfig.xml from environment variables

2. **Pre-configured dbconfig.xml is the Standard Approach**
   - Jira detects and uses `/var/jira/dbconfig.xml` on first startup
   - When present, Jira automatically:
     - Connects to the configured database
     - Initializes the database schema
     - Skips the database configuration step in the setup wizard
   - This is the official Atlassian-documented approach for headless database setup

3. **Wizard Automation Still Required (But Simpler)**
   - Even with dbconfig.xml, the setup wizard still requires:
     - License entry (generated via atlassian-agent.jar)
     - Application properties (title, mode, base URL)
     - Admin account creation
   - However, the database step is completely eliminated

4. **Root Cause of 404 Errors**
   - The license page (SetupLicense.jspa) returns 404 if database isn't initialized
   - The old approach tried to access this page before database setup completed
   - Pre-configuring dbconfig.xml ensures DB is ready before wizard automation starts

## Solution Implemented

### 1. Created dbconfig.xml

**File**: `e2e/docker/dbconfig.xml`

Pre-configured database connection for MySQL 8.0:
- Host: `mysql` (container name)
- Port: `3306`
- Database: `jira`
- User: `root`
- Password: `123456`
- Driver: `com.mysql.cj.jdbc.Driver` (MySQL 8.0 connector)
- Includes connection pooling and validation settings per Atlassian recommendations

### 2. Updated Docker Compose

**File**: `e2e/docker/compose.yml`

Added volume mount to inject dbconfig.xml:
```yaml
volumes:
  - jira-data:/var/jira
  - ./dbconfig.xml:/var/jira/dbconfig.xml:ro  # Read-only mount
```

### 3. Simplified Setup Script

**File**: `e2e/scripts/setup-jira.ts`

New approach:
1. **Wait for Database Init**: Monitors Docker logs and HTTP endpoints to confirm database schema creation is complete
2. **License Setup**: Extracts server ID and generates/submits license via atlassian-agent.jar
3. **App Properties**: Configures title, mode, and base URL
4. **Admin Account**: Creates the admin user
5. **Verification**: Confirms API access with authenticated request

Key improvements:
- Removed all database configuration logic (no longer needed)
- Simplified error handling
- Better logging and progress indicators
- Increased timeouts for database initialization (can take 2-4 minutes)
- More robust pattern matching for server ID extraction

### 4. Documentation

**File**: `e2e/docker/README.md`

Comprehensive documentation covering:
- Why dbconfig.xml approach is used
- What the haxqer/jira image supports/doesn't support
- How the setup process works
- Database configuration details
- Usage instructions

## Benefits of New Approach

1. **Eliminates Fragile Form Automation**
   - No more CSRF token extraction for database setup
   - No session/cookie handling for DB configuration
   - Database form POST requests completely removed

2. **Fixes 404 Errors**
   - Database is initialized before accessing wizard pages
   - Setup wizard flow is more predictable

3. **Faster and More Reliable**
   - Database configuration happens automatically during Jira startup
   - No HTTP requests until database is ready
   - Reduced potential for race conditions

4. **More Maintainable**
   - Follows official Atlassian documentation
   - Clearer separation of concerns
   - Better error messages and logging

5. **Aligns with Docker Best Practices**
   - Configuration as code (dbconfig.xml in version control)
   - Declarative setup via docker-compose volumes
   - No runtime configuration complexity

## Testing Next Steps

The implementation has been committed but not yet tested in CI. Next steps:

1. **Build E2E Scripts**: The new setup-jira.ts needs to be compiled (requires Node.js 22)
2. **Run E2E Workflow**: Trigger the e2e-jira.yml workflow to test the complete flow
3. **Verify Database Init**: Confirm dbconfig.xml is properly detected and used
4. **Check Setup Completion**: Ensure license, app properties, and admin account are created
5. **Validate API Access**: Confirm Jira API is accessible after setup
6. **Update Snapshots**: If setup succeeds, create new volume snapshots for fast CI path

## References

- haxqer/jira: https://github.com/haxqer/jira
- Atlassian dbconfig.xml: https://support.atlassian.com/jira/kb/startup-check-creating-and-editing-the-dbconfigxml-file/
- MySQL 8.0 with Jira: https://confluence.atlassian.com/jiracore/connecting-jira-to-mysql-8-0-1018272102.html
- Unattended Installation: https://confluence.atlassian.com/adminjiraserver/unattended-installation-1489806907.html

## Conclusion

The proper headless setup approach for haxqer/jira is to:
1. Pre-configure dbconfig.xml with database connection details
2. Mount it into the container at /var/jira/dbconfig.xml
3. Let Jira auto-initialize the database on first startup
4. Automate only the remaining wizard steps (license, app properties, admin account)

This approach is simpler, more reliable, and follows Atlassian's documented best practices for unattended Jira installation.
