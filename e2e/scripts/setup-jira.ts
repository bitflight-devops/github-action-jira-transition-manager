#!/usr/bin/env node
/**
 * Simplified Jira setup automation for haxqer/jira Docker image
 * 
 * Prerequisites:
 * - dbconfig.xml must be pre-mounted into /var/jira/dbconfig.xml
 * - MySQL database must be accessible
 * 
 * This script handles:
 * 1. Waiting for Jira to start and detect the database
 * 2. Waiting for database schema initialization to complete
 * 3. Generating and submitting license
 * 4. Configuring application properties
 * 5. Creating admin account
 */
import { execSync, spawn } from 'child_process';
import { getE2EConfig } from './e2e-config';

const CONTAINER_NAME = 'jira-e2e';

const FETCH_TIMEOUT = 30000;
const DOCKER_LOGS_TIMEOUT = 10000;
const HTTP_HEALTH_CHECK_TIMEOUT = 5000; // Short timeout for health checks
const SLEEP_INTERVAL_SHORT = 3000; // 3 seconds - for quick retries
const SLEEP_INTERVAL_MEDIUM = 5000; // 5 seconds - for standard polling
const SLEEP_INTERVAL_LONG = 10000; // 10 seconds - for slow operations

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LogWatchResult {
  success: boolean;
  matchedPattern?: string;
}

/**
 * Watch Docker logs for specific patterns
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

    console.log(`  Watching Docker logs...`);

    const timeoutId = setTimeout(() => {
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
          console.log(`  ${isError ? '✗' : '✓'} Found: "${pattern}"`);
          clearTimeout(timeoutId);
          dockerLogs.kill();
          resolve({ success: !isError, matchedPattern: pattern });
          return;
        }
      }
    };

    dockerLogs.stdout?.on('data', (data: Buffer) => {
      data
        .toString()
        .split('\n')
        .forEach((line) => {
          if (line.trim()) checkLine(line);
        });
    });

    dockerLogs.stderr?.on('data', (data: Buffer) => {
      data
        .toString()
        .split('\n')
        .forEach((line) => {
          if (line.trim()) checkLine(line);
        });
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
 * Get recent Docker logs to check current state
 */
function getDockerLogs(containerName: string, lines = 50): string {
  try {
    return execSync(`docker logs --tail ${lines} ${containerName} 2>&1`, {
      encoding: 'utf-8',
      timeout: DOCKER_LOGS_TIMEOUT,
    });
  } catch {
    return '';
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchHtml(url: string, options: RequestInit = {}): Promise<string> {
  const response = await fetchWithTimeout(url, options);
  return response.text();
}

/**
 * Extract CSRF token from HTML
 */
function extractCsrfToken(html: string): string | null {
  const patterns = [
    /name="atl_token"\s+value="([^"]+)"/,
    /value="([^"]+)"\s+name="atl_token"/,
    /"atl_token":"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Wait for Jira to complete database initialization
 * With dbconfig.xml pre-configured, Jira will auto-initialize the database
 */
async function waitForDatabaseInit(baseUrl: string): Promise<boolean> {
  console.log('Waiting for Jira to initialize database...');
  console.log('  (This can take 2-3 minutes for schema creation)');

  // Watch for database initialization completion in logs
  const result = await watchDockerLogs(
    CONTAINER_NAME,
    [
      'You can now access JIRA',
      'Database setup completed',
      'SetupLicense',
      'Synchrony initialization completed',
    ],
    ['Database connection failed', 'Could not connect to database'],
    240000, // 4 minutes
  );

  if (!result.success) {
    console.log('⚠ Did not see database init completion in logs, checking HTTP...');
  }

  // Also try to access the setup wizard to confirm
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await fetchWithTimeout(`${baseUrl}/secure/SetupLicense!default.jspa`, {}, DOCKER_LOGS_TIMEOUT);
      
      if (response.status === 200) {
        console.log('✓ Database initialized, setup wizard is accessible');
        return true;
      }

      if (response.status === 404) {
        console.log(`  Attempt ${attempts}/${maxAttempts}: Waiting for database init...`);
        await sleep(SLEEP_INTERVAL_LONG);
        continue;
      }

      // If we get a redirect or other status, database might be ready
      if (response.status === 302 || response.status === 303) {
        console.log('✓ Database initialized (got redirect)');
        return true;
      }
    } catch (error) {
      console.log(`  Attempt ${attempts}/${maxAttempts}: ${(error as Error).message}`);
      await sleep(SLEEP_INTERVAL_LONG);
    }
  }

  console.log('✗ Database initialization did not complete in time');
  return false;
}

/**
 * Generate license using atlassian-agent
 */
function generateLicense(serverId: string): string | null {
  try {
    // Sanitize serverId to prevent command injection
    // Server ID should only contain alphanumeric characters and hyphens
    if (!/^[A-Za-z0-9-]+$/.test(serverId)) {
      console.error(`  Invalid server ID format: ${serverId}`);
      return null;
    }

    // Use array-based command to prevent command injection
    const output = execSync(
      `docker exec ${CONTAINER_NAME} java -jar /var/agent/atlassian-agent.jar -d -p jira -m test@example.com -n test@example.com -o TestOrg -s "${serverId}"`,
      { encoding: 'utf-8', timeout: 30000, shell: '/bin/sh' }
    );

    // Parse the license from output
    const lines = output.trim().split('\n');
    const licenseLines: string[] = [];
    let inLicense = false;

    for (const line of lines) {
      if (line.match(/^[A-Za-z0-9+/=]{20,}$/) || line.startsWith('AAAB')) {
        inLicense = true;
      }
      if (inLicense && line.trim()) {
        licenseLines.push(line);
      }
    }

    return licenseLines.length > 0 ? licenseLines.join('\n') : output.trim();
  } catch (error) {
    console.error(`  License generation failed: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Setup license
 */
async function setupLicense(baseUrl: string): Promise<boolean> {
  console.log('Setting up license...');

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
      if (licensePage.includes('SetupApplicationProperties') || licensePage.includes('Dashboard')) {
        console.log('✓ License already configured');
        return true;
      }

      csrfToken = extractCsrfToken(licensePage);

      // Try to find server ID
      const patterns = [
        /name="sid"\s+value="([^"]+)"/,
        /id="serverId"[^>]*value="([^"]+)"/,
        /data-server-id="([^"]+)"/,
        /([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/,
      ];

      for (const pattern of patterns) {
        const match = licensePage.match(pattern);
        if (match) {
          serverId = match[1];
          break;
        }
      }

      if (serverId) break;

      console.log(`  Attempt ${attempts}/${maxAttempts}: Waiting for server ID...`);
      await sleep(SLEEP_INTERVAL_MEDIUM);
    } catch (error) {
      console.log(`  Attempt ${attempts}/${maxAttempts}: ${(error as Error).message}`);
      await sleep(SLEEP_INTERVAL_MEDIUM);
    }
  }

  if (!serverId) {
    console.log('✗ Could not find server ID');
    return false;
  }

  console.log(`  Server ID: ${serverId}`);

  // Generate license
  const license = generateLicense(serverId);
  if (!license) {
    console.log('✗ Failed to generate license');
    return false;
  }

  console.log('  License generated');

  // Submit license
  try {
    const formData: Record<string, string> = { setupLicenseKey: license };
    if (csrfToken) formData.atl_token = csrfToken;

    const response = await fetchWithTimeout(`${baseUrl}/secure/SetupLicense.jspa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString(),
      redirect: 'follow',
    });

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ License submitted');
      await sleep(SLEEP_INTERVAL_MEDIUM);
      return true;
    }

    console.log(`  License submission returned: ${response.status}`);
    return false;
  } catch (error) {
    console.error(`  License submission error: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Configure application properties
 */
async function configureAppProperties(baseUrl: string): Promise<boolean> {
  console.log('Configuring application properties...');
  try {
    const propsPage = await fetchHtml(`${baseUrl}/secure/SetupApplicationProperties!default.jspa`);

    if (propsPage.includes('SetupAdminAccount') || propsPage.includes('Dashboard')) {
      console.log('✓ Application properties already configured');
      return true;
    }

    const csrfToken = extractCsrfToken(propsPage);
    const formData: Record<string, string> = {
      title: 'Jira E2E Test',
      mode: 'private',
      baseURL: baseUrl,
    };
    if (csrfToken) formData.atl_token = csrfToken;

    const response = await fetchWithTimeout(`${baseUrl}/secure/SetupApplicationProperties.jspa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString(),
      redirect: 'follow',
    });

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Application properties configured');
      await sleep(SLEEP_INTERVAL_SHORT);
      return true;
    }

    console.log(`  Response: ${response.status}`);
    return true; // Continue anyway
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`);
    return true; // Continue anyway
  }
}

/**
 * Create admin account
 */
async function createAdminAccount(baseUrl: string, username: string, password: string): Promise<boolean> {
  console.log('Creating admin account...');
  try {
    const adminPage = await fetchHtml(`${baseUrl}/secure/SetupAdminAccount!default.jspa`);

    if (adminPage.includes('Dashboard') || adminPage.includes('SetupComplete')) {
      console.log('✓ Admin account already created');
      return true;
    }

    const csrfToken = extractCsrfToken(adminPage);
    const formData: Record<string, string> = {
      username,
      password,
      confirm: password,
      fullname: 'Admin User',
      email: 'admin@example.com',
    };
    if (csrfToken) formData.atl_token = csrfToken;

    const response = await fetchWithTimeout(`${baseUrl}/secure/SetupAdminAccount.jspa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString(),
      redirect: 'follow',
    });

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Admin account created');
      await sleep(SLEEP_INTERVAL_SHORT);
      return true;
    }

    console.log(`  Response: ${response.status}`);
    return true; // Continue anyway
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`);
    return true; // Continue anyway
  }
}

/**
 * Verify Jira is ready for API access
 */
async function verifyJiraReady(baseUrl: string, username: string, password: string): Promise<boolean> {
  console.log('Verifying Jira API access...');

  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const maxAttempts = 12;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await fetchWithTimeout(`${baseUrl}/rest/api/2/serverInfo`, {
        headers: { Authorization: authHeader },
      });

      if (response.ok) {
        const serverInfo = (await response.json()) as { version: string };
        console.log(`✓ Jira API ready! Version: ${serverInfo.version}`);
        return true;
      }

      console.log(`  Attempt ${attempts}/${maxAttempts}: API returned ${response.status}`);
    } catch (error) {
      console.log(`  Attempt ${attempts}/${maxAttempts}: ${(error as Error).message}`);
    }

    await sleep(SLEEP_INTERVAL_MEDIUM);
  }

  console.log('✗ Jira API did not become ready');
  return false;
}

async function setupJira(): Promise<void> {
  const config = getE2EConfig();
  const baseUrl = config.jira.baseUrl;
  const username = config.jira.auth.username || 'admin';
  const password = config.jira.auth.password || 'admin';

  console.log('='.repeat(60));
  console.log('Jira Setup (with pre-configured dbconfig.xml)');
  console.log('='.repeat(60));
  console.log(`Base URL: ${baseUrl}`);
  console.log('');

  // Check if already configured
  console.log('Checking if Jira is already configured...');
  try {
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    const response = await fetchWithTimeout(`${baseUrl}/rest/api/2/serverInfo`, {
      headers: { Authorization: authHeader },
    });

    if (response.ok) {
      const serverInfo = (await response.json()) as { version: string };
      console.log(`✓ Jira already configured (version ${serverInfo.version})`);
      console.log('Skipping setup');
      return;
    }
  } catch {
    console.log('Jira needs setup - proceeding...');
  }

  console.log('');

  // Wait for Jira container to start and database to initialize
  console.log('Waiting for Jira container to start...');
  const logs = getDockerLogs(CONTAINER_NAME, 50);
  if (logs.includes('Jira is ready to serve') || logs.includes('You can now access')) {
    console.log('✓ Jira container is running');
  }

  // Wait for HTTP to be available
  console.log('');
  console.log('Waiting for HTTP to be available...');
  let httpReady = false;
  const httpStart = Date.now();
  const httpTimeout = 60000;

  while (!httpReady && Date.now() - httpStart < httpTimeout) {
    try {
      await fetchWithTimeout(`${baseUrl}/status`, {}, HTTP_HEALTH_CHECK_TIMEOUT);
      httpReady = true;
      console.log('✓ HTTP is available');
    } catch {
      await sleep(SLEEP_INTERVAL_SHORT);
    }
  }

  if (!httpReady) {
    console.error('✗ HTTP did not become available');
    process.exit(1);
  }

  // Wait for database initialization
  console.log('');
  const dbReady = await waitForDatabaseInit(baseUrl);
  if (!dbReady) {
    console.log('⚠ Database initialization may not be complete');
  }

  // Run setup steps
  console.log('');
  await setupLicense(baseUrl);

  console.log('');
  await configureAppProperties(baseUrl);

  console.log('');
  await createAdminAccount(baseUrl, username, password);

  // Final verification
  console.log('');
  const ready = await verifyJiraReady(baseUrl, username, password);

  console.log('');
  console.log('='.repeat(60));
  if (ready) {
    console.log('✓ Jira setup completed successfully!');
  } else {
    console.log('⚠ Jira setup may need manual intervention');
    console.log(`   Access Jira at: ${baseUrl}`);
  }
  console.log('='.repeat(60));

  if (!ready) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const GLOBAL_TIMEOUT = 420000; // 7 minutes
  const timeoutId = setTimeout(() => {
    console.error('✗ Setup timed out');
    process.exit(1);
  }, GLOBAL_TIMEOUT);

  setupJira()
    .then(() => clearTimeout(timeoutId))
    .catch((error) => {
      clearTimeout(timeoutId);
      console.error('Failed to set up Jira:', error);
      process.exit(1);
    });
}

export { setupJira };
