#!/usr/bin/env node
/**
 * Automate Jira Data Center setup wizard for haxqer/jira Docker image
 * This script handles the initial setup of Jira DC so it's ready for API access
 *
 * Wizard flow:
 * 1. Setup mode selection (manual vs express)
 * 2. Database configuration
 * 3. License entry (with server ID)
 * 4. Application properties
 * 5. Admin account creation
 * 6. Setup complete
 */
import { execSync, spawn } from 'child_process';
import { getE2EConfig } from './e2e-config';

const CONTAINER_NAME = 'jira-e2e';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LogWatchResult {
  success: boolean;
  matchedPattern?: string;
  isError?: boolean;
}

/**
 * Watch Docker logs for success OR failure patterns
 * Returns as soon as either is matched
 */
async function watchDockerLogs(
  containerName: string,
  successPatterns: string[],
  errorPatterns: string[],
  timeoutMs: number,
): Promise<LogWatchResult> {
  return new Promise((resolve) => {
    const patterns = [
      ...successPatterns.map((p) => ({ pattern: p, isError: false })),
      ...errorPatterns.map((p) => ({ pattern: p, isError: true })),
    ];

    console.log(`  Watching Docker logs for:`);
    console.log(`    Success: ${successPatterns.join(', ')}`);
    if (errorPatterns.length > 0) {
      console.log(`    Errors: ${errorPatterns.join(', ')}`);
    }

    const timeoutId = setTimeout(() => {
      console.log(`  ⏱ Docker log watch timed out after ${timeoutMs / 1000}s`);
      dockerLogs.kill();
      resolve({ success: false });
    }, timeoutMs);

    const dockerLogs = spawn('docker', ['logs', '-f', '--since', '1s', containerName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;
    const checkLine = (line: string) => {
      if (resolved) return;

      for (const { pattern, isError } of patterns) {
        if (line.includes(pattern)) {
          resolved = true;
          console.log(`  ${isError ? '✗' : '✓'} Matched: "${pattern}"`);
          clearTimeout(timeoutId);
          dockerLogs.kill();
          resolve({ success: !isError, matchedPattern: pattern, isError });
          return;
        }
      }
    };

    dockerLogs.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) checkLine(line);
      }
    });

    dockerLogs.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) checkLine(line);
      }
    });

    dockerLogs.on('error', (err) => {
      if (!resolved) {
        console.log(`  Docker logs error: ${err.message}`);
        clearTimeout(timeoutId);
        resolve({ success: false });
      }
    });

    dockerLogs.on('close', () => {
      if (!resolved) {
        clearTimeout(timeoutId);
        resolve({ success: false });
      }
    });
  });
}

/**
 * Simple version: wait for a single message
 */
async function waitForDockerLogMessage(containerName: string, message: string, timeoutMs: number): Promise<boolean> {
  const result = await watchDockerLogs(containerName, [message], [], timeoutMs);
  return result.success;
}

/**
 * Get recent Docker logs to check current state
 */
function getDockerLogs(containerName: string, lines = 50): string {
  try {
    return execSync(`docker logs --tail ${lines} ${containerName} 2>&1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
  } catch {
    return '';
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`  [DEBUG] Fetch timeout after ${timeoutMs}ms for ${url}`);
    controller.abort();
  }, timeoutMs);
  try {
    console.log(`  [DEBUG] Fetching: ${url}`);
    const response = await fetch(url, { ...options, signal: controller.signal });
    console.log(`  [DEBUG] Response: ${response.status} from ${url}`);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchHtml(url: string, options: RequestInit = {}): Promise<string> {
  const response = await fetchWithTimeout(url, options, 30000);
  return response.text();
}

/**
 * Extract CSRF token (atl_token) from HTML form
 */
function extractCsrfToken(html: string): string | null {
  // Try multiple patterns for CSRF token
  const patterns = [
    /name="atl_token"\s+value="([^"]+)"/,
    /name="atlassian-token"\s+value="([^"]+)"/,
    /data-atl-token="([^"]+)"/,
    /"atl_token":"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      console.log(`  [DEBUG] Found CSRF token: ${match[1].substring(0, 20)}...`);
      return match[1];
    }
  }
  return null;
}

/**
 * Extract form action URL from HTML and normalize it
 */
function extractFormAction(html: string, defaultAction: string): string {
  const match = html.match(/<form[^>]*action="([^"]+)"/);
  if (match) {
    let action = match[1];
    // Ensure the action starts with / if it's a relative path
    if (!action.startsWith('http') && !action.startsWith('/')) {
      action = '/' + action;
    }
    return action;
  }
  return defaultAction;
}

/**
 * Step 1: Select manual setup mode
 */
async function selectSetupMode(baseUrl: string): Promise<boolean> {
  console.log('Step 1: Selecting manual setup mode...');
  try {
    // First, check the current setup state and get CSRF token
    const setupPage = await fetchHtml(`${baseUrl}/secure/SetupMode!default.jspa`);

    // Check if we're already past setup mode
    if (setupPage.includes('SetupDatabase') || setupPage.includes('SetupLicense')) {
      console.log('✓ Already past setup mode selection');
      return true;
    }

    // Extract CSRF token
    const csrfToken = extractCsrfToken(setupPage);
    const formAction = extractFormAction(setupPage, `${baseUrl}/secure/SetupMode.jspa`);

    // Build form data
    const formData: Record<string, string> = {
      setupOption: 'classic',
    };
    if (csrfToken) {
      formData.atl_token = csrfToken;
    }

    // Submit the setup mode form (classic mode = manual setup)
    const response = await fetchWithTimeout(
      formAction.startsWith('http') ? formAction : `${baseUrl}${formAction}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString(),
        redirect: 'follow',
      },
      30000,
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Setup mode selected (manual/classic)');
      return true;
    }

    console.log(`Setup mode selection returned status: ${response.status}`);
    return true; // Continue anyway
  } catch (error) {
    console.log(`Setup mode error: ${(error as Error).message}`);
    return true; // Continue anyway, might already be configured
  }
}

/**
 * Step 2: Configure database connection
 */
async function configureDatabase(baseUrl: string): Promise<boolean> {
  console.log('Step 2: Configuring database connection...');

  // Check if database is already configured via logs
  const recentLogs = getDockerLogs(CONTAINER_NAME, 50);
  if (recentLogs.includes('Database is already configured') || recentLogs.includes('Database Connection - OK')) {
    console.log('✓ Database already configured (detected from logs)');
    return true;
  }

  try {
    // Check current page and get CSRF token
    const dbPage = await fetchHtml(`${baseUrl}/secure/SetupDatabase!default.jspa`);

    if (dbPage.includes('SetupLicense') || dbPage.includes('SetupApplicationProperties')) {
      console.log('✓ Database already configured');
      return true;
    }

    // Extract CSRF token
    const csrfToken = extractCsrfToken(dbPage);
    const formAction = extractFormAction(dbPage, '/secure/SetupDatabase.jspa');

    // Start watching logs BEFORE submitting the form
    const logWatchPromise = watchDockerLogs(
      CONTAINER_NAME,
      ['Database Connection - OK', 'Database setup completed', 'SetupLicense'],
      ['Database Connection - FAILED', 'Cannot connect to database', 'Connection refused'],
      120000, // 2 minutes for DB schema creation
    );

    // Configure MySQL connection
    console.log('  Submitting database configuration...');
    const formData: Record<string, string> = {
      databaseOption: 'external',
      databaseType: 'mysql8',
      jdbcHostname: 'mysql',
      jdbcPort: '3306',
      jdbcDatabase: 'jira',
      jdbcUsername: 'root',
      jdbcPassword: '123456',
      schemaName: 'public',
    };
    if (csrfToken) {
      formData.atl_token = csrfToken;
    }

    const response = await fetchWithTimeout(
      formAction.startsWith('http') ? formAction : `${baseUrl}${formAction}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString(),
        redirect: 'follow',
      },
      30000,
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Database configuration submitted, waiting for schema creation...');
      const result = await logWatchPromise;
      if (result.isError) {
        console.log('✗ Database setup failed');
        return false;
      }
      return true;
    }

    // Try alternative with JDBC URL
    console.log(`  First attempt returned ${response.status}, trying with JDBC URL...`);
    return await configureDatabaseWithJdbcUrl(baseUrl, csrfToken);
  } catch (error) {
    console.log(`Database config error: ${(error as Error).message}`);
    return await configureDatabaseWithJdbcUrl(baseUrl, null);
  }
}

async function configureDatabaseWithJdbcUrl(baseUrl: string, csrfToken: string | null): Promise<boolean> {
  try {
    // Start watching logs
    const logWatchPromise = watchDockerLogs(
      CONTAINER_NAME,
      ['Database Connection - OK', 'Database setup completed'],
      ['Database Connection - FAILED', 'Cannot connect to database'],
      120000,
    );

    const formData: Record<string, string> = {
      databaseOption: 'external',
      databaseType: 'mysql8',
      jdbcString:
        'jdbc:mysql://mysql:3306/jira?useUnicode=true&characterEncoding=UTF8&sessionVariables=default_storage_engine=InnoDB',
      jdbcUsername: 'root',
      jdbcPassword: '123456',
    };
    if (csrfToken) {
      formData.atl_token = csrfToken;
    }

    const response = await fetchWithTimeout(
      `${baseUrl}/secure/SetupDatabase.jspa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString(),
        redirect: 'follow',
      },
      30000,
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Database configuration submitted (JDBC URL method)');
      console.log('  Waiting for schema creation...');
      const result = await logWatchPromise;
      return !result.isError;
    }

    console.log(`  JDBC URL method returned status: ${response.status}`);
    return false;
  } catch (error) {
    console.log(`  JDBC URL method error: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Step 3: Get server ID and submit license
 */
async function setupLicense(baseUrl: string): Promise<boolean> {
  console.log('Step 3: Setting up license...');

  // Get the license page to find server ID
  let serverId: string | null = null;
  let csrfToken: string | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (!serverId && attempts < maxAttempts) {
    attempts++;
    try {
      const licensePage = await fetchHtml(`${baseUrl}/secure/SetupLicense!default.jspa`);

      // Check if already licensed
      if (licensePage.includes('SetupApplicationProperties') || licensePage.includes('SetupAdminAccount')) {
        console.log('✓ License already configured');
        return true;
      }

      // Extract CSRF token
      csrfToken = extractCsrfToken(licensePage);

      // Try multiple patterns to find server ID
      // Pattern 1: sid input field
      let match = licensePage.match(/name="sid"\s+value="([^"]+)"/);
      if (match) {
        serverId = match[1];
        break;
      }

      // Pattern 2: serverId input
      match = licensePage.match(/id="serverId"[^>]*value="([^"]+)"/);
      if (match) {
        serverId = match[1];
        break;
      }

      // Pattern 3: data attribute
      match = licensePage.match(/data-server-id="([^"]+)"/);
      if (match) {
        serverId = match[1];
        break;
      }

      // Pattern 4: Server ID label followed by value
      match = licensePage.match(/Server\s*ID[:\s]*<[^>]*>?\s*([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/i);
      if (match) {
        serverId = match[1];
        break;
      }

      // Pattern 5: Just find anything that looks like a server ID
      match = licensePage.match(/([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/);
      if (match) {
        serverId = match[1];
        break;
      }

      console.log(`  Attempt ${attempts}/${maxAttempts}: Waiting for server ID...`);
      await sleep(5000);
    } catch (error) {
      console.log(`  Attempt ${attempts}/${maxAttempts}: ${(error as Error).message}`);
      await sleep(5000);
    }
  }

  if (!serverId) {
    console.log('✗ Could not find server ID');
    return false;
  }

  console.log(`  Found Server ID: ${serverId}`);

  // Generate license using atlassian-agent
  const license = generateLicense(serverId);
  if (!license) {
    console.log('✗ Failed to generate license');
    return false;
  }

  console.log('  License generated successfully');

  // Submit the license
  return await submitLicense(baseUrl, license, csrfToken);
}

function generateLicense(serverId: string): string | null {
  try {
    const cmd = `docker exec jira-e2e java -jar /var/agent/atlassian-agent.jar -d -p jira -m test@example.com -n test@example.com -o TestOrg -s ${serverId}`;
    console.log('  Running atlassian-agent to generate license...');
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });

    // Parse the license from output
    const lines = output.trim().split('\n');
    const licenseLines: string[] = [];
    let inLicense = false;

    for (const line of lines) {
      // License starts with base64-like content
      if (line.match(/^[A-Za-z0-9+/=]{20,}$/) || line.startsWith('AAAB')) {
        inLicense = true;
      }
      if (inLicense && line.trim()) {
        licenseLines.push(line);
      }
    }

    if (licenseLines.length > 0) {
      return licenseLines.join('\n');
    }

    // Return raw output if parsing failed
    console.log('  Raw license output:', output.substring(0, 200));
    return output.trim();
  } catch (error) {
    console.error(`  License generation failed: ${(error as Error).message}`);
    return null;
  }
}

async function submitLicense(baseUrl: string, license: string, csrfToken: string | null): Promise<boolean> {
  try {
    const formData: Record<string, string> = {
      setupLicenseKey: license,
    };
    if (csrfToken) {
      formData.atl_token = csrfToken;
    }

    const response = await fetchWithTimeout(
      `${baseUrl}/secure/SetupLicense.jspa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString(),
        redirect: 'follow',
      },
      60000,
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ License submitted successfully');
      await sleep(5000);
      return true;
    }

    console.log(`  License submission returned status: ${response.status}`);
    return false;
  } catch (error) {
    console.error(`  License submission error: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Step 4: Configure application properties
 */
async function configureAppProperties(baseUrl: string): Promise<boolean> {
  console.log('Step 4: Configuring application properties...');
  try {
    // Check if already past this step and get CSRF token
    const propsPage = await fetchHtml(`${baseUrl}/secure/SetupApplicationProperties!default.jspa`);

    if (propsPage.includes('SetupAdminAccount') || propsPage.includes('SetupComplete')) {
      console.log('✓ Application properties already configured');
      return true;
    }

    const csrfToken = extractCsrfToken(propsPage);
    const formData: Record<string, string> = {
      title: 'Jira E2E Test',
      mode: 'private',
      baseURL: baseUrl,
    };
    if (csrfToken) {
      formData.atl_token = csrfToken;
    }

    const response = await fetchWithTimeout(
      `${baseUrl}/secure/SetupApplicationProperties.jspa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString(),
        redirect: 'follow',
      },
      30000,
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Application properties configured');
      await sleep(3000);
      return true;
    }

    console.log(`  App properties returned status: ${response.status}`);
    return true; // Continue anyway
  } catch (error) {
    console.log(`  App properties error: ${(error as Error).message}`);
    return true; // Continue anyway
  }
}

/**
 * Step 5: Create admin account
 */
async function createAdminAccount(baseUrl: string, username: string, password: string): Promise<boolean> {
  console.log('Step 5: Creating admin account...');
  try {
    // Check if already past this step and get CSRF token
    const adminPage = await fetchHtml(`${baseUrl}/secure/SetupAdminAccount!default.jspa`);

    if (adminPage.includes('SetupComplete') || adminPage.includes('Dashboard')) {
      console.log('✓ Admin account already created');
      return true;
    }

    const csrfToken = extractCsrfToken(adminPage);
    const formData: Record<string, string> = {
      username: username,
      password: password,
      confirm: password,
      fullname: 'Admin User',
      email: 'admin@example.com',
    };
    if (csrfToken) {
      formData.atl_token = csrfToken;
    }

    const response = await fetchWithTimeout(
      `${baseUrl}/secure/SetupAdminAccount.jspa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString(),
        redirect: 'follow',
      },
      30000,
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Admin account created');
      await sleep(3000);
      return true;
    }

    console.log(`  Admin account returned status: ${response.status}`);
    return true; // Continue anyway
  } catch (error) {
    console.log(`  Admin account error: ${(error as Error).message}`);
    return true; // Continue anyway
  }
}

/**
 * Step 6: Complete setup
 */
async function completeSetup(baseUrl: string): Promise<boolean> {
  console.log('Step 6: Finalizing setup...');
  try {
    // Try to access setup complete page
    const response = await fetchWithTimeout(`${baseUrl}/secure/SetupComplete.jspa`, {
      method: 'POST',
      redirect: 'follow',
    });

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Setup complete submitted');
    }
  } catch {
    // Ignore errors - setup might auto-complete
  }

  // Wait for Jira to finalize
  console.log('  Waiting for Jira to finalize setup...');
  await sleep(5000); // Reduced from 10s
  return true;
}

/**
 * Verify Jira is ready for API access
 */
async function verifyJiraReady(baseUrl: string, username: string, password: string): Promise<boolean> {
  console.log('Verifying Jira is ready for API access...');

  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const maxAttempts = 12; // ~1 minute with 5s intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await fetchWithTimeout(`${baseUrl}/rest/api/2/serverInfo`, {
        headers: { Authorization: authHeader },
      });

      if (response.ok) {
        const serverInfo = (await response.json()) as { version: string; baseUrl: string };
        console.log(`✓ Jira is ready! Version: ${serverInfo.version}`);
        return true;
      }

      console.log(`  Attempt ${attempts}/${maxAttempts}: API returned ${response.status}`);
    } catch (error) {
      console.log(`  Attempt ${attempts}/${maxAttempts}: ${(error as Error).message}`);
    }

    await sleep(5000);
  }

  console.log('✗ Jira did not become ready in time');
  return false;
}

async function setupJira(): Promise<void> {
  const config = getE2EConfig();
  const baseUrl = config.jira.baseUrl;
  const username = config.jira.auth.username || 'admin';
  const password = config.jira.auth.password || 'admin';

  console.log('='.repeat(60));
  console.log('Jira Setup Wizard Automation (haxqer/jira)');
  console.log('='.repeat(60));
  console.log(`Base URL: ${baseUrl}`);
  console.log('');

  // Check Docker logs to see current Jira state
  console.log('Checking Jira container status via Docker logs...');
  const recentLogs = getDockerLogs(CONTAINER_NAME, 100);

  if (recentLogs.includes('Jira is ready to serve')) {
    console.log('✓ Jira container reports ready to serve');
  } else if (recentLogs.includes('Starting the JIRA Plugin System')) {
    console.log('  Jira is starting up, waiting for ready state...');
    const ready = await waitForDockerLogMessage(CONTAINER_NAME, 'Jira is ready to serve', 120000);
    if (!ready) {
      console.log('⚠ Did not see ready message in logs, continuing anyway...');
    }
  } else {
    console.log('  Jira container starting, waiting...');
    await waitForDockerLogMessage(CONTAINER_NAME, 'Jira is ready to serve', 180000);
  }

  // Now wait for HTTP to be available
  console.log('Waiting for Jira HTTP to be available...');
  let httpReady = false;
  const httpTimeout = 60000; // 1 minute (reduced since we know container is ready)
  const httpStart = Date.now();

  while (!httpReady && Date.now() - httpStart < httpTimeout) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/status`, {}, 5000);
      if (response.status > 0) {
        httpReady = true;
        console.log(`✓ Jira HTTP is available (status: ${response.status})`);
      }
    } catch (error) {
      const elapsed = Math.round((Date.now() - httpStart) / 1000);
      console.log(`  Waiting... (${elapsed}s) - ${(error as Error).message}`);
      await sleep(3000);
    }
  }

  if (!httpReady) {
    console.error('✗ Jira HTTP did not become available in time');
    // Show recent logs for debugging
    console.log('Recent Docker logs:');
    console.log(getDockerLogs(CONTAINER_NAME, 30));
    process.exit(1);
  }

  // Check if Jira is already fully configured
  console.log('');
  console.log('Checking if Jira is already configured...');
  try {
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    const response = await fetchWithTimeout(`${baseUrl}/rest/api/2/serverInfo`, {
      headers: { Authorization: authHeader },
    });

    if (response.ok) {
      const serverInfo = (await response.json()) as { version: string };
      console.log(`✓ Jira is already configured (version ${serverInfo.version})`);
      console.log('Skipping setup wizard');
      return;
    }
  } catch {
    console.log('Jira needs to be set up - proceeding with wizard automation');
  }

  console.log('');

  // Give Jira a moment to fully initialize the setup wizard
  await sleep(5000);

  // Run setup steps in order
  await selectSetupMode(baseUrl);
  console.log('');

  const dbConfigured = await configureDatabase(baseUrl);
  if (!dbConfigured) {
    console.log('⚠ Database configuration may have issues, continuing...');
  }
  console.log('');

  const licenseConfigured = await setupLicense(baseUrl);
  if (!licenseConfigured) {
    console.log('⚠ License configuration may have issues, continuing...');
  }
  console.log('');

  await configureAppProperties(baseUrl);
  console.log('');

  await createAdminAccount(baseUrl, username, password);
  console.log('');

  await completeSetup(baseUrl);
  console.log('');

  // Final verification
  const ready = await verifyJiraReady(baseUrl, username, password);
  console.log('');

  if (ready) {
    console.log('='.repeat(60));
    console.log('✓ Jira setup completed successfully!');
    console.log('='.repeat(60));
  } else {
    console.log('='.repeat(60));
    console.log('⚠ Jira setup may require manual intervention');
    console.log(`   Access Jira at: ${baseUrl}`);
    console.log('='.repeat(60));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  // Add global timeout to prevent hanging forever
  const GLOBAL_TIMEOUT = 300000; // 5 minutes max
  const timeoutId = setTimeout(() => {
    console.error('✗ Setup timed out after 5 minutes');
    process.exit(1);
  }, GLOBAL_TIMEOUT);

  setupJira()
    .then(() => {
      clearTimeout(timeoutId);
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      console.error('Failed to set up Jira:', error);
      process.exit(1);
    });
}

export { setupJira };
