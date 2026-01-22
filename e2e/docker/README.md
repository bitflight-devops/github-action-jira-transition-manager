# Jira E2E Test Environment

This directory contains the Docker Compose setup for running Jira Data Center in E2E tests.

## Components

### Docker Compose Services

- **jira**: haxqer/jira:9.17.5 image with Data Center edition
- **mysql**: MySQL 8.0 database

### Configuration Files

#### `dbconfig.xml`

Pre-configured database connection settings for Jira. This file is mounted into the Jira container at `/var/jira/dbconfig.xml`.

**Key features:**
- Configures connection to the MySQL container (host: `mysql`, port: `3306`)
- Uses root credentials (user: `root`, password: `123456`)
- Specifies the MySQL 8.0 JDBC driver (`com.mysql.cj.jdbc.Driver`)
- Includes connection pooling and validation settings

**Why this approach?**

The haxqer/jira Docker image does NOT support environment variables for database configuration. The proper way to achieve headless/unattended setup is to pre-configure the `dbconfig.xml` file before Jira starts for the first time.

When Jira starts with a pre-configured `dbconfig.xml`:
1. It automatically detects the file
2. Connects to the database
3. Initializes the database schema on first boot
4. Skips the database configuration step in the setup wizard

This eliminates the need for complex form automation and session handling to configure the database via HTTP POST requests.

#### `compose.yml`

Docker Compose configuration that:
- Sets up MySQL with the required database and credentials
- Mounts the `dbconfig.xml` file into the Jira container (read-only)
- Configures networking between services
- Sets up health checks and dependencies

## Setup Wizard Automation

Even with `dbconfig.xml` pre-configured, Jira still requires completing the setup wizard for:
- **License**: Generated using the included `atlassian-agent.jar`
- **Application Properties**: Title, mode, base URL
- **Admin Account**: Username, password, email

The `setup-jira.ts` script automates these remaining steps.

## Usage

```bash
# Start the containers
yarn e2e:up

# Run setup wizard automation
yarn e2e:setup

# Wait for Jira API to be ready
yarn e2e:wait

# Seed test data
yarn e2e:seed

# Run E2E tests
yarn e2e:test

# Stop containers
yarn e2e:down
```

## Database Configuration Details

The MySQL database is configured with:
- Character set: `utf8mb4`
- Collation: `utf8mb4_bin`
- Storage engine: InnoDB (via JDBC URL parameter)

These settings match Atlassian's requirements for Jira with MySQL 8.0.

## References

- [haxqer/jira Docker image](https://github.com/haxqer/jira)
- [Atlassian: Connecting Jira to MySQL 8.0](https://confluence.atlassian.com/jiracore/connecting-jira-to-mysql-8-0-1018272102.html)
- [Atlassian: dbconfig.xml documentation](https://support.atlassian.com/jira/kb/startup-check-creating-and-editing-the-dbconfigxml-file/)
