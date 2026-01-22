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
import { execSync, spawn } from 'child_process';

import { getE2EConfig } from './e2e-config';

const CONTAINER_NAME = 'jira-e2e';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function execQuiet(cmd: string, timeout = 30000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}

/**
 * Watch Docker logs for a pattern
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
 * Get recent Docker logs
 */
function getDockerLogs(lines = 50): string {
  return execQuiet(`docker logs --tail ${lines} ${CONTAINER_NAME} 2>&1`);
}

/**
 * Wait for HTTP to be available
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
 * Get the server ID from Jira (needed for license generation)
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
 * Generate license using atlassian-agent
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
 * Parse Set-Cookie headers and return a Cookie header string
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
        if (nameValue && nameValue.includes('=')) {
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
 * Submit license via HTTP POST with cookie handling
 */
async function submitLicense(baseUrl: string, license: string): Promise<boolean> {
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

    // Submit with cookies
    const formData = new URLSearchParams();
    formData.append('setupLicenseKey', license);
    if (atl_token) {
      formData.append('atl_token', atl_token);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    console.log(`  [DEBUG] Submitting to: ${baseUrl}/secure/SetupLicense.jspa`);
    const response = await fetch(`${baseUrl}/secure/SetupLicense.jspa`, {
      method: 'POST',
      headers,
      body: formData.toString(),
      redirect: 'manual', // Don't auto-follow redirects so we can see the response
      signal: AbortSignal.timeout(30000),
    });

    console.log(`  [DEBUG] Response status: ${response.status}`);
    console.log(`  [DEBUG] Response location: ${response.headers.get('location') || 'none'}`);

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ License submitted');
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
 * Complete remaining setup steps via HTTP
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

      // Submit
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(step.data)) {
        formData.append(key, value);
      }
      if (atl_token) {
        formData.append('atl_token', atl_token);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
      }

      const response = await fetch(`${baseUrl}${step.url}`, {
        method: 'POST',
        headers,
        body: formData.toString(),
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      });

      console.log(`  ${step.name}: ${response.status}`);
    } catch (error) {
      console.log(`  ${step.name}: ${(error as Error).message}`);
    }

    await sleep(2000);
  }

  return true;
}

/**
 * Verify Jira is ready for API access
 */
async function verifyJiraReady(baseUrl: string, username: string, password: string): Promise<boolean> {
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  for (let attempt = 1; attempt <= 20; attempt++) {
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

      console.log(`  Attempt ${attempt}/20: API returned ${response.status}`);
    } catch (error) {
      console.log(`  Attempt ${attempt}/20: ${(error as Error).message}`);
    }

    await sleep(5000);
  }

  return false;
}

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
  await submitLicense(baseUrl, license);

  // Step 9: Complete remaining setup
  console.log('');
  console.log('Step 9: Completing setup...');
  await completeSetup(baseUrl, username, password);

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
