#!/usr/bin/env node
/**
 * Automate Jira Data Center setup for haxqer/jira Docker image
 *
 * Database configuration is pre-mounted via Docker Compose (jira-dbconfig.xml).
 * This script handles the remaining setup:
 * 1. Wait for Jira to start and connect to database
 * 2. Generate and submit license
 * 3. Complete admin setup
 */
import { execSync, spawn } from 'node:child_process';

import { getE2EConfig } from './e2e-config';

const CONTAINER_NAME = 'jira-e2e';

/**
 * Pause execution for a specified duration.
 * @param ms - The number of milliseconds to sleep
 * @returns A promise that resolves after the specified delay
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a shell command synchronously with logging on failure.
 * @param cmd - The shell command to execute
 * @param timeout - Maximum execution time in milliseconds (default: 30000)
 * @returns The command's stdout as a string
 * @throws Re-throws the original error after logging command failure details
 */
function exec(cmd: string, timeout = 30000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    console.log(`  Command failed: ${err.message}`);
    if (err.stderr) console.log(`  stderr: ${err.stderr}`);
    throw error;
  }
}

/**
 * Execute a shell command synchronously, suppressing errors.
 * @param cmd - The shell command to execute
 * @param timeout - Maximum execution time in milliseconds (default: 30000)
 * @returns The command's stdout as a string, or empty string on failure
 */
function execQuiet(cmd: string, timeout = 30000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}

/**
 * Watch Docker container logs for a specific pattern.
 * Spawns a docker logs process and monitors stdout/stderr for the pattern.
 * @param pattern - The string pattern to search for in the logs
 * @param timeoutMs - Maximum time to wait in milliseconds before giving up
 * @returns True if the pattern was found, false if timeout occurred
 */
async function waitForLogPattern(pattern: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`  Watching for: "${pattern}" (timeout: ${timeoutMs / 1000}s)`);

    const timeoutId = setTimeout(() => {
      console.log(`  ⏱ Timed out waiting for pattern`);
      dockerLogs.kill();
      resolve(false);
    }, timeoutMs);

    const dockerLogs = spawn('docker', ['logs', '-f', '--since', '1s', CONTAINER_NAME], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let resolved = false;
    const checkLine = (line: string): void => {
      if (resolved) return;
      if (line.includes(pattern)) {
        resolved = true;
        console.log(`  ✓ Found: "${pattern}"`);
        clearTimeout(timeoutId);
        dockerLogs.kill();
        resolve(true);
      }
    };

    dockerLogs.stdout?.on('data', (data: Buffer) => {
      for (const line of data.toString().split('\n')) {
        if (line.trim()) checkLine(line);
      }
    });

    dockerLogs.stderr?.on('data', (data: Buffer) => {
      for (const line of data.toString().split('\n')) {
        if (line.trim()) checkLine(line);
      }
    });

    dockerLogs.on('close', () => {
      if (!resolved) {
        clearTimeout(timeoutId);
        resolve(false);
      }
    });
  });
}

/**
 * Retrieve recent log output from the Jira Docker container.
 * @param lines - Number of log lines to retrieve from the tail (default: 50)
 * @returns The container log output as a string, or empty string on failure
 */
function getDockerLogs(lines = 50): string {
  return execQuiet(`docker logs --tail ${lines} ${CONTAINER_NAME} 2>&1`);
}

/**
 * Wait for Jira HTTP endpoint to become available.
 * Polls the /status endpoint until it responds or timeout is reached.
 * @param baseUrl - The base URL of the Jira instance (e.g., http://localhost:8080)
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns True if HTTP became available, false if timeout occurred
 */
async function waitForHttp(baseUrl: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/status`, { signal: AbortSignal.timeout(5000) });
      if (response.status > 0) {
        return true;
      }
    } catch {
      // Keep trying
    }
    await sleep(3000);
  }
  return false;
}

/**
 * Retrieve the Jira server ID required for license generation.
 * Attempts to fetch via REST API first, then falls back to parsing the setup page HTML.
 * @param baseUrl - The base URL of the Jira instance
 * @returns The server ID string (format: XXXX-XXXX-XXXX-XXXX), or null if not found
 */
async function getServerId(baseUrl: string): Promise<string | null> {
  // Try REST API first
  try {
    const response = await fetch(`${baseUrl}/rest/api/2/serverInfo`, {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const info = (await response.json()) as { serverId?: string };
      if (info.serverId) {
        console.log(`  Found via API: ${info.serverId}`);
        return info.serverId;
      }
    }
  } catch {
    // API not available yet
  }

  // Try setup page
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/secure/SetupLicense!default.jspa`, {
        signal: AbortSignal.timeout(10000),
      });
      const html = await response.text();

      // Look for server ID in various patterns
      const patterns = [
        /name="sid"\s+value="([^"]+)"/,
        /id="serverId"[^>]*value="([^"]+)"/,
        /data-server-id="([^"]+)"/,
        /Server\s*ID[:\s]*([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/i,
        /([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          console.log(`  Found via HTML: ${match[1]}`);
          return match[1];
        }
      }

      console.log(`  Attempt ${attempt}/10: Server ID not found yet...`);
    } catch (error) {
      console.log(`  Attempt ${attempt}/10: ${(error as Error).message}`);
    }
    await sleep(5000);
  }

  return null;
}

/**
 * Generate a Jira license using the atlassian-agent tool inside the Docker container.
 * @param serverId - The Jira server ID to generate the license for
 * @returns The generated license string, or null if generation failed
 */
function generateLicense(serverId: string): string | null {
  try {
    const output = exec(
      `docker exec ${CONTAINER_NAME} java -jar /var/agent/atlassian-agent.jar ` +
        `-d -p jira -m test@example.com -n test@example.com -o TestOrg -s ${serverId}`,
      30000,
    );

    // Extract license from output
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

    if (licenseLines.length > 0) {
      console.log('✓ License generated');
      return licenseLines.join('\n');
    }

    // Return raw output if parsing failed
    return output.trim();
  } catch (error) {
    console.log(`✗ License generation failed: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Parse Set-Cookie headers from a fetch Response and return a Cookie header string.
 * Handles both modern getSetCookie() method and legacy header parsing.
 * @param response - The fetch Response object containing Set-Cookie headers
 * @returns A semicolon-separated cookie string suitable for the Cookie header
 */
function parseCookies(response: Response): string {
  const cookies: string[] = [];

  // Try getSetCookie() first (Node 18.14.1+)
  if ('getSetCookie' in response.headers && typeof response.headers.getSetCookie === 'function') {
    const setCookies = response.headers.getSetCookie();
    for (const cookie of setCookies) {
      // Extract just name=value (before the first ;)
      const nameValue = cookie.split(';')[0].trim();
      if (nameValue) cookies.push(nameValue);
    }
  } else {
    // Fallback: parse set-cookie header manually
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      // Multiple cookies might be comma-separated (though technically incorrect)
      // Each cookie's attributes are semicolon-separated
      // We need to be careful: "expires=Thu, 01 Jan..." contains a comma
      // Best effort: split on ", " followed by a word that looks like a cookie name
      const parts = setCookie.split(/,\s*(?=[A-Za-z_][A-Za-z0-9_]*=)/);
      for (const part of parts) {
        const nameValue = part.split(';')[0].trim();
        if (nameValue?.includes('=')) {
          cookies.push(nameValue);
        }
      }
    }
  }

  const cookieHeader = cookies.join('; ');
  if (cookieHeader) {
    console.log(`  [DEBUG] Cookies: ${cookieHeader.substring(0, 100)}...`);
  }
  return cookieHeader;
}

/**
 * Insert the license directly into the MySQL database.
 * This bypasses XSRF protection issues that can occur with HTTP submission.
 * @param license - The license string to insert
 * @returns True if the license was successfully inserted and verified, false otherwise
 */
function insertLicenseViaDatabase(license: string): boolean {
  try {
    // Escape single quotes in the license string for SQL
    const escapedLicense = license.replace(/'/g, "''");

    // First check if the productlicense table exists
    const tableExists = execQuiet(
      `docker exec jira-e2e-mysql mysql -uroot -p123456 -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='jira' AND table_name='productlicense'" 2>/dev/null`,
    );

    if (!tableExists.trim() || tableExists.trim() === '0') {
      console.log('  productlicense table does not exist yet');
      console.log('  Jira schema may not be initialized - checking tables...');
      const tables = execQuiet(
        `docker exec jira-e2e-mysql mysql -uroot -p123456 -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='jira'" 2>/dev/null`,
      );
      console.log(`  Tables in jira database: ${tables.trim() || '0'}`);
      return false;
    }

    // Check if the table has any entries
    const checkResult = execQuiet(
      `docker exec jira-e2e-mysql mysql -uroot -p123456 -N -e "SELECT COUNT(*) FROM jira.productlicense" 2>/dev/null`,
    );
    const existingCount = Number.parseInt(checkResult.trim(), 10);

    if (existingCount > 0) {
      // Update existing license
      console.log('  Updating existing license in database...');
      exec(
        `docker exec jira-e2e-mysql mysql -uroot -p123456 -e "UPDATE jira.productlicense SET LICENSE='${escapedLicense}' WHERE ID=(SELECT MIN(ID) FROM (SELECT ID FROM jira.productlicense) AS t)" 2>/dev/null`,
      );
    } else {
      // Insert new license
      console.log('  Inserting license into database...');
      exec(
        `docker exec jira-e2e-mysql mysql -uroot -p123456 -e "INSERT INTO jira.productlicense (ID, LICENSE) VALUES (10000, '${escapedLicense}')" 2>/dev/null`,
      );
    }

    // Verify the license was inserted
    const verifyResult = execQuiet(
      `docker exec jira-e2e-mysql mysql -uroot -p123456 -N -e "SELECT COUNT(*) FROM jira.productlicense WHERE LICENSE IS NOT NULL" 2>/dev/null`,
    );
    const verifiedCount = Number.parseInt(verifyResult.trim(), 10);

    if (verifiedCount > 0) {
      console.log('✓ License inserted into database');
      return true;
    }

    console.log('  ✗ License verification failed');
    return false;
  } catch (error) {
    console.log(`  Database license insertion error: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Submit the license via HTTP POST to the Jira setup endpoint.
 * Handles CSRF token extraction and cookie management.
 * @param baseUrl - The base URL of the Jira instance
 * @param license - The license string to submit
 * @returns True if submission succeeded (2xx or redirect), false otherwise
 */
async function submitLicenseViaHttp(baseUrl: string, license: string): Promise<boolean> {
  // Get the license page to extract any tokens and cookies
  try {
    const getResponse = await fetch(`${baseUrl}/secure/SetupLicense!default.jspa`, {
      signal: AbortSignal.timeout(10000),
    });

    const cookieHeader = parseCookies(getResponse);
    const html = await getResponse.text();

    // Extract CSRF token
    let atl_token = '';
    const tokenMatch = html.match(/name="atl_token"\s+value="([^"]+)"/);
    if (tokenMatch) {
      atl_token = tokenMatch[1];
      console.log(`  [DEBUG] CSRF token: ${atl_token.substring(0, 20)}...`);
    } else {
      console.log('  [DEBUG] No CSRF token found in form');
    }

    // Submit with cookies - use non-browser User-Agent
    const formData = new URLSearchParams();
    formData.append('setupLicenseKey', license);
    if (atl_token) {
      formData.append('atl_token', atl_token);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'curl/7.88.1', // Non-browser User-Agent
      'X-Atlassian-Token': 'no-check',
    };
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    console.log(`  [DEBUG] Submitting to: ${baseUrl}/secure/SetupLicense.jspa`);
    const response = await fetch(`${baseUrl}/secure/SetupLicense.jspa`, {
      method: 'POST',
      headers,
      body: formData.toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });

    console.log(`  [DEBUG] Response status: ${response.status}`);
    console.log(`  [DEBUG] Response location: ${response.headers.get('location') || 'none'}`);

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ License submitted via HTTP');
      return true;
    }

    // If 403, show more details
    if (response.status === 403) {
      const body = await response.text();
      console.log(`  [DEBUG] 403 response body (first 500 chars): ${body.substring(0, 500)}`);
    }

    console.log(`  License submission returned: ${response.status}`);
    return response.status < 500;
  } catch (error) {
    console.log(`  License submission error: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Submit the license to Jira using the most reliable method available.
 * Tries database insertion first (more reliable), then falls back to HTTP submission.
 * @param baseUrl - The base URL of the Jira instance
 * @param license - The license string to submit
 * @returns Object with success status and whether database method was used
 */
async function submitLicense(baseUrl: string, license: string): Promise<{ success: boolean; usedDatabase: boolean }> {
  // Try database insertion first (more reliable, avoids XSRF issues)
  console.log('  Trying database insertion method...');
  if (insertLicenseViaDatabase(license)) {
    return { success: true, usedDatabase: true };
  }

  // Fall back to HTTP method
  console.log('  Database method failed, trying HTTP submission...');
  const httpSuccess = await submitLicenseViaHttp(baseUrl, license);
  return { success: httpSuccess, usedDatabase: false };
}

/**
 * Restart the Jira Docker container to apply configuration changes.
 * Used after database license insertion to force Jira to reload the license.
 * @returns True if restart command succeeded, false otherwise
 */
async function restartJiraContainer(): Promise<boolean> {
  try {
    console.log('  Restarting Jira container...');
    exec(`docker restart ${CONTAINER_NAME}`, 60000);
    console.log('  Waiting for Jira to restart...');
    await sleep(10000); // Give it time to start the shutdown/startup cycle
    return true;
  } catch (error) {
    console.log(`  Restart failed: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Complete the remaining Jira setup wizard steps via HTTP.
 * Handles application properties, admin account creation, and setup finalization.
 * @param baseUrl - The base URL of the Jira instance
 * @param username - The admin username to create
 * @param password - The admin password to set
 * @returns True after attempting all setup steps
 */
async function completeSetup(baseUrl: string, username: string, password: string): Promise<boolean> {
  const steps = [
    {
      name: 'App Properties',
      url: '/secure/SetupApplicationProperties.jspa',
      data: { title: 'Jira E2E', mode: 'private', baseURL: baseUrl },
    },
    {
      name: 'Admin Account',
      url: '/secure/SetupAdminAccount.jspa',
      data: { username, password, confirm: password, fullname: 'Admin', email: 'admin@example.com' },
    },
    { name: 'Setup Complete', url: '/secure/SetupComplete.jspa', data: {} },
  ];

  for (const step of steps) {
    try {
      // Get page for cookies/tokens
      const getResponse = await fetch(`${baseUrl}${step.url.replace('.jspa', '!default.jspa')}`, {
        headers: { 'User-Agent': 'curl/7.88.1' },
        signal: AbortSignal.timeout(10000),
      });

      const cookieHeader = parseCookies(getResponse);
      const html = await getResponse.text();

      // Check if already past this step
      if (html.includes('Dashboard') || html.includes('login')) {
        console.log(`  ${step.name}: Already complete`);
        continue;
      }

      // Extract CSRF token
      let atl_token = '';
      const tokenMatch = html.match(/name="atl_token"\s+value="([^"]+)"/);
      if (tokenMatch) {
        atl_token = tokenMatch[1];
      }

      // Submit with non-browser User-Agent
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(step.data)) {
        formData.append(key, value);
      }
      if (atl_token) {
        formData.append('atl_token', atl_token);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'curl/7.88.1', // Non-browser User-Agent to bypass XSRF checks
        'X-Atlassian-Token': 'no-check',
      };
      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      const response = await fetch(`${baseUrl}${step.url}`, {
        method: 'POST',
        headers,
        body: formData.toString(),
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      });

      console.log(`  ${step.name}: ${response.status}`);

      // If 403, log details
      if (response.status === 403) {
        const body = await response.text();
        console.log(`  [DEBUG] ${step.name} 403 body: ${body.substring(0, 300)}`);
      }
    } catch (error) {
      console.log(`  ${step.name}: ${(error as Error).message}`);
    }

    await sleep(2000);
  }

  return true;
}

/**
 * Verify that Jira is fully configured and the REST API is accessible.
 * Polls the serverInfo endpoint with authentication until successful or timeout.
 * @param baseUrl - The base URL of the Jira instance
 * @param username - The admin username for authentication
 * @param password - The admin password for authentication
 * @returns True if API is accessible and authenticated, false after max attempts
 */
async function verifyJiraReady(baseUrl: string, username: string, password: string): Promise<boolean> {
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  let consecutive503 = 0;
  const maxConsecutive503 = 3; // Fail fast after 3 consecutive 503s

  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/rest/api/2/serverInfo`, {
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const info = (await response.json()) as { version: string; baseUrl: string };
        console.log(`✓ Jira API ready! Version: ${info.version}`);
        return true;
      }

      console.log(`  Attempt ${attempt}/12: API returned ${response.status}`);

      // Track consecutive 503s and fail fast
      if (response.status === 503) {
        consecutive503++;
        if (consecutive503 >= maxConsecutive503) {
          console.log(`  ✗ Got ${maxConsecutive503} consecutive 503 errors - Jira setup likely incomplete`);
          return false;
        }
      } else {
        consecutive503 = 0;
      }
    } catch (error) {
      console.log(`  Attempt ${attempt}/12: ${(error as Error).message}`);
      consecutive503 = 0;
    }

    await sleep(5000);
  }

  return false;
}

/**
 * Main entry point for automating Jira Data Center setup.
 * Orchestrates the complete setup process including:
 * - Verifying database configuration mount
 * - Waiting for Jira to start and HTTP to become available
 * - Retrieving server ID and generating license
 * - Submitting license (via database or HTTP)
 * - Completing admin account setup
 * - Verifying API accessibility
 *
 * @throws Exits process with code 1 if any critical step fails
 */
async function setupJira(): Promise<void> {
  const config = getE2EConfig();
  const baseUrl = config.jira.baseUrl;
  const username = config.jira.auth.username || 'admin';
  const password = config.jira.auth.password || 'admin';

  console.log('='.repeat(60));
  console.log('Jira Setup (Pre-mounted DB Config)');
  console.log('='.repeat(60));
  console.log(`Base URL: ${baseUrl}`);
  console.log('');

  // Step 1: Verify dbconfig.xml is mounted
  console.log('Step 1: Verifying database config mount...');
  const dbconfigContent = execQuiet(`docker exec ${CONTAINER_NAME} cat /var/jira/dbconfig.xml 2>&1`);
  if (dbconfigContent.includes('mysql')) {
    console.log('  ✓ dbconfig.xml is mounted and contains MySQL config');
  } else if (dbconfigContent.includes('No such file')) {
    console.log('  ✗ dbconfig.xml is NOT mounted!');
    console.log('  Checking /var/jira contents:');
    console.log(execQuiet(`docker exec ${CONTAINER_NAME} ls -la /var/jira/ 2>&1`));
  } else {
    console.log('  ? dbconfig.xml status unclear:');
    console.log(dbconfigContent.substring(0, 500));
  }

  // Step 2: Wait for Jira to start
  console.log('');
  console.log('Step 2: Waiting for Jira to start...');
  const recentLogs = getDockerLogs(100);

  if (recentLogs.includes('Jira is ready to serve')) {
    console.log('  ✓ Jira container is running');
  } else {
    const ready = await waitForLogPattern('Jira is ready to serve', 180000);
    if (!ready) {
      console.log('✗ Jira did not start');
      console.log('');
      console.log('=== Recent Docker Logs ===');
      console.log(getDockerLogs(50));
      process.exit(1);
    }
  }

  // Step 3: Wait for HTTP
  console.log('');
  console.log('Step 3: Waiting for HTTP...');
  const httpReady = await waitForHttp(baseUrl, 60000);
  if (!httpReady) {
    console.log('✗ HTTP not available');
    console.log('');
    console.log('=== Recent Docker Logs ===');
    console.log(getDockerLogs(50));
    process.exit(1);
  }
  console.log('✓ HTTP is available');

  // Step 4: Check if API is already working (fully configured)
  console.log('');
  console.log('Step 4: Checking if already configured...');
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  try {
    const response = await fetch(`${baseUrl}/rest/api/2/serverInfo`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const info = (await response.json()) as { version: string };
      console.log(`✓ Jira is already fully configured (version ${info.version})`);
      console.log('');
      console.log('='.repeat(60));
      console.log('✓ Setup complete!');
      console.log('='.repeat(60));
      return;
    }
  } catch {
    console.log('  Not yet configured, continuing setup...');
  }

  // Step 5: Wait for database initialization (mounted config should trigger this)
  console.log('');
  console.log('Step 5: Waiting for database initialization...');
  console.log('  (Database config is pre-mounted via Docker Compose)');

  // Check logs for database connection
  const dbReady = await waitForLogPattern('Database Connection - OK', 180000);
  if (dbReady) {
    console.log('✓ Database initialized');
  } else {
    // Check if we're on the license page (DB config might have worked differently)
    console.log('  Database status unclear, checking license page...');
  }

  // Step 6: Get server ID
  console.log('');
  console.log('Step 6: Getting server ID...');
  const serverId = await getServerId(baseUrl);
  if (!serverId) {
    console.log('✗ Could not get server ID');
    console.log('');
    console.log('=== Recent Docker Logs ===');
    console.log(getDockerLogs(50));
    process.exit(1);
  }

  // Step 7: Generate and submit license
  console.log('');
  console.log('Step 7: Generating license...');
  const license = generateLicense(serverId);
  if (!license) {
    console.log('✗ License generation failed');
    process.exit(1);
  }

  console.log('');
  console.log('Step 8: Submitting license...');
  const licenseResult = await submitLicense(baseUrl, license);
  if (!licenseResult.success) {
    console.log(`✗ License submission failed for ${baseUrl}`);
    console.log('');
    console.log('=== Recent Docker Logs ===');
    console.log(getDockerLogs(50));
    process.exit(1);
  }

  // If we used database insertion, restart Jira to pick up the license
  if (licenseResult.usedDatabase) {
    console.log('');
    console.log('Step 8b: Restarting Jira to apply license from database...');
    await restartJiraContainer();

    // Wait for Jira to come back up
    console.log('  Waiting for Jira to restart...');
    const httpReadyAfterRestart = await waitForHttp(baseUrl, 180000);
    if (!httpReadyAfterRestart) {
      console.log('✗ Jira did not come back up after restart');
      console.log('');
      console.log('=== Recent Docker Logs ===');
      console.log(getDockerLogs(50));
      process.exit(1);
    }
    console.log('✓ Jira is back up');
  }

  // Step 9: Complete remaining setup
  console.log('');
  console.log('Step 9: Completing setup...');
  const setupCompleted = await completeSetup(baseUrl, username, password);
  if (!setupCompleted) {
    console.log(`✗ Setup completion failed for ${baseUrl} (user: ${username})`);
    console.log('');
    console.log('=== Recent Docker Logs ===');
    console.log(getDockerLogs(50));
    process.exit(1);
  }

  // Step 10: Final verification
  console.log('');
  console.log('Step 10: Final verification...');
  const ready = await verifyJiraReady(baseUrl, username, password);

  console.log('');
  if (ready) {
    console.log('='.repeat(60));
    console.log('✓ Jira setup completed successfully!');
    console.log('='.repeat(60));
  } else {
    console.log('='.repeat(60));
    console.log('✗ Jira setup failed');
    console.log('='.repeat(60));
    console.log('');
    console.log('=== Recent Docker Logs ===');
    console.log(getDockerLogs(50));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
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
