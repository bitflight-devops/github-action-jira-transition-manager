#!/usr/bin/env node
/**
 * Automate Jira Data Center setup for haxqer/jira Docker image
 *
 * This script configures Jira by:
 * 1. Writing dbconfig.xml directly to the container
 * 2. Restarting Jira to apply database config
 * 3. Using REST API and simple HTTP for remaining setup
 *
 * This approach bypasses session/cookie issues with form submissions.
 */
import { execSync, spawn } from 'child_process';

import { getE2EConfig } from './e2e-config';

const CONTAINER_NAME = 'jira-e2e';
const JIRA_HOME = '/var/jira';

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
 * Check if database is already configured
 */
function isDatabaseConfigured(): boolean {
  const dbconfig = execQuiet(`docker exec ${CONTAINER_NAME} cat ${JIRA_HOME}/dbconfig.xml 2>/dev/null`);
  return dbconfig.includes('<database-type>') && dbconfig.includes('mysql');
}

/**
 * Write database configuration directly to the container
 */
function writeDbConfig(): void {
  console.log('Writing database configuration...');

  const dbconfig = `<?xml version="1.0" encoding="UTF-8"?>
<jira-database-config>
  <name>defaultDS</name>
  <delegator-name>default</delegator-name>
  <database-type>mysql8</database-type>
  <schema-name></schema-name>
  <jdbc-datasource>
    <url>jdbc:mysql://mysql:3306/jira?useUnicode=true&amp;characterEncoding=UTF8&amp;sessionVariables=default_storage_engine=InnoDB</url>
    <driver-class>com.mysql.cj.jdbc.Driver</driver-class>
    <username>root</username>
    <password>123456</password>
    <pool-min-size>20</pool-min-size>
    <pool-max-size>20</pool-max-size>
    <pool-max-wait>30000</pool-max-wait>
    <validation-query>select 1</validation-query>
    <min-evictable-idle-time-millis>60000</min-evictable-idle-time-millis>
    <time-between-eviction-runs-millis>300000</time-between-eviction-runs-millis>
    <pool-max-idle>20</pool-max-idle>
    <pool-remove-abandoned>true</pool-remove-abandoned>
    <pool-remove-abandoned-timeout>300</pool-remove-abandoned-timeout>
    <pool-test-on-borrow>false</pool-test-on-borrow>
    <pool-test-while-idle>true</pool-test-while-idle>
  </jdbc-datasource>
</jira-database-config>`;

  // Write config to a temp file in the container
  exec(`docker exec ${CONTAINER_NAME} sh -c 'cat > ${JIRA_HOME}/dbconfig.xml << "DBCONFIG"
${dbconfig}
DBCONFIG'`);

  console.log('✓ Database configuration written');
}

/**
 * Restart Jira container to apply database config
 */
async function restartJira(): Promise<void> {
  console.log('Restarting Jira to apply database configuration...');

  exec(`docker restart ${CONTAINER_NAME}`, 60000);

  // Wait for Jira to come back up
  console.log('  Waiting for Jira to restart...');
  await sleep(10000); // Initial wait

  const ready = await waitForLogPattern('Jira is ready to serve', 180000);
  if (!ready) {
    console.log('⚠ Did not see ready message, checking status...');
  }
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
  console.log('Getting server ID...');

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
  console.log('Generating license...');

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
 * Submit license via HTTP POST with cookie handling
 */
async function submitLicense(baseUrl: string, license: string): Promise<boolean> {
  console.log('Submitting license...');

  // Get the license page to extract any tokens and cookies
  try {
    const getResponse = await fetch(`${baseUrl}/secure/SetupLicense!default.jspa`, {
      signal: AbortSignal.timeout(10000),
    });

    const cookies = getResponse.headers.get('set-cookie') || '';
    const html = await getResponse.text();

    // Extract CSRF token
    let atl_token = '';
    const tokenMatch = html.match(/name="atl_token"\s+value="([^"]+)"/);
    if (tokenMatch) {
      atl_token = tokenMatch[1];
    }

    // Submit with cookies
    const formData = new URLSearchParams();
    formData.append('setupLicenseKey', license);
    if (atl_token) {
      formData.append('atl_token', atl_token);
    }

    const response = await fetch(`${baseUrl}/secure/SetupLicense.jspa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.split(',')[0] || '',
      },
      body: formData.toString(),
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ License submitted');
      return true;
    }

    console.log(`  License submission returned: ${response.status}`);
    return response.status < 500; // Treat client errors as "maybe ok"
  } catch (error) {
    console.log(`  License submission error: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Complete remaining setup steps via HTTP
 */
async function completeSetup(baseUrl: string, username: string, password: string): Promise<boolean> {
  console.log('Completing setup...');

  // Try each setup page in sequence
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

      const cookies = getResponse.headers.get('set-cookie') || '';
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

      const response = await fetch(`${baseUrl}${step.url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.split(',')[0] || '',
        },
        body: formData.toString(),
        redirect: 'follow',
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
  console.log('Verifying Jira API access...');

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
  console.log('Jira Setup (Direct Configuration Method)');
  console.log('='.repeat(60));
  console.log(`Base URL: ${baseUrl}`);
  console.log('');

  // Step 1: Check if already configured
  console.log('Step 1: Checking current state...');
  const recentLogs = getDockerLogs(100);

  if (recentLogs.includes('Jira is ready to serve')) {
    console.log('  Jira container is running');
  } else {
    console.log('  Waiting for Jira to start...');
    await waitForLogPattern('Jira is ready to serve', 180000);
  }

  // Check if database is configured
  if (isDatabaseConfigured()) {
    console.log('  Database is already configured');
  } else {
    console.log('  Database not yet configured');

    // Step 2: Write database config
    console.log('');
    console.log('Step 2: Configuring database...');
    writeDbConfig();

    // Step 3: Restart Jira
    console.log('');
    console.log('Step 3: Restarting Jira...');
    await restartJira();
  }

  // Step 4: Wait for HTTP
  console.log('');
  console.log('Step 4: Waiting for HTTP...');
  const httpReady = await waitForHttp(baseUrl, 60000);
  if (!httpReady) {
    console.log('✗ HTTP not available');
    console.log('');
    console.log('=== Recent Docker Logs ===');
    console.log(getDockerLogs(50));
    process.exit(1);
  }
  console.log('✓ HTTP is available');

  // Step 5: Check if API is already working
  console.log('');
  console.log('Step 5: Checking API access...');
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
    console.log('  API not ready, continuing setup...');
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

  await submitLicense(baseUrl, license);

  // Step 8: Complete remaining setup
  console.log('');
  console.log('Step 8: Completing setup...');
  await completeSetup(baseUrl, username, password);

  // Step 9: Wait for database initialization
  console.log('');
  console.log('Step 9: Waiting for database initialization...');
  console.log('  This may take a few minutes for schema creation...');

  // Watch for database completion
  const dbReady = await waitForLogPattern('Database Connection - OK', 180000);
  if (dbReady) {
    console.log('✓ Database initialized');
  } else {
    console.log('  Database initialization status unclear, checking API...');
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
