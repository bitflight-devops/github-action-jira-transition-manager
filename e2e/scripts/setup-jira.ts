#!/usr/bin/env node
/**
 * Automate Jira Data Center setup wizard for haxqer/jira Docker image
 * This script handles the initial setup of Jira DC so it's ready for API access
 */
import { execSync } from 'child_process';
import { getE2EConfig } from './e2e-config';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getServerIdFromSetupPage(baseUrl: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/secure/SetupLicense!default.jspa`);
    const html = await response.text();

    // Look for server ID in the page - it's typically shown in a form or data attribute
    const serverIdMatch = html.match(/name="sid"\s+value="([^"]+)"/);
    if (serverIdMatch) {
      return serverIdMatch[1];
    }

    // Alternative pattern
    const altMatch = html.match(/Server ID[:\s]*<[^>]*>([A-Z0-9-]+)</i);
    if (altMatch) {
      return altMatch[1];
    }

    // Try looking for data attribute
    const dataMatch = html.match(/data-server-id="([^"]+)"/);
    if (dataMatch) {
      return dataMatch[1];
    }

    // Try the serverId input field
    const inputMatch = html.match(/id="serverId"[^>]*value="([^"]+)"/);
    if (inputMatch) {
      return inputMatch[1];
    }

    console.log('Debug: Could not find server ID in HTML');
    return null;
  } catch (error) {
    console.log(`Error fetching setup page: ${(error as Error).message}`);
    return null;
  }
}

function generateLicense(serverId: string): string | null {
  try {
    // Run the atlassian-agent in the container to generate a license
    const cmd = `docker exec jira-e2e java -jar /var/agent/atlassian-agent.jar -d -p jira -m test@example.com -n test@example.com -o TestOrg -s ${serverId}`;
    console.log('Generating license...');
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });

    // The license is output as a multi-line string
    const lines = output.trim().split('\n');
    // Find the license block - it's the base64-encoded content
    const licenseLines: string[] = [];
    let inLicense = false;

    for (const line of lines) {
      // License starts with AAAB or similar base64 prefix
      if (line.match(/^[A-Za-z0-9+/=]{20,}$/)) {
        inLicense = true;
      }
      if (inLicense) {
        licenseLines.push(line);
      }
    }

    if (licenseLines.length > 0) {
      return licenseLines.join('\n');
    }

    // If we couldn't parse it, return the whole output trimmed
    console.log('License output:', output);
    return output.trim();
  } catch (error) {
    console.error(`Failed to generate license: ${(error as Error).message}`);
    return null;
  }
}

async function submitLicense(baseUrl: string, license: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/secure/SetupLicense.jspa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          setupLicenseKey: license,
          licenseToSetup: license,
        }).toString(),
      },
      30000,
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ License submitted successfully');
      return true;
    }

    console.log(`License submission returned status: ${response.status}`);
    return false;
  } catch (error) {
    console.error(`Failed to submit license: ${(error as Error).message}`);
    return false;
  }
}

async function configureDatabase(baseUrl: string): Promise<boolean> {
  // For haxqer/jira, configure MySQL database
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/secure/SetupDatabase.jspa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          databaseOption: 'external',
          databaseType: 'mysql8',
          jdbcHostname: 'mysql',
          jdbcPort: '3306',
          jdbcDatabase: 'jira',
          jdbcUsername: 'root',
          jdbcPassword: '123456',
        }).toString(),
      },
      60000, // Database setup can take time
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Database configured');
      return true;
    }

    console.log(`Database config returned status: ${response.status}`);
    // Try alternative method - direct JDBC URL
    return await configureDatabaseDirect(baseUrl);
  } catch (error) {
    console.error(`Database config error: ${(error as Error).message}`);
    return false;
  }
}

async function configureDatabaseDirect(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/secure/SetupDatabase.jspa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          databaseOption: 'external',
          databaseType: 'mysql8',
          jdbcString:
            'jdbc:mysql://mysql:3306/jira?useUnicode=true&characterEncoding=UTF8&sessionVariables=default_storage_engine=InnoDB',
          jdbcUsername: 'root',
          jdbcPassword: '123456',
        }).toString(),
      },
      60000,
    );

    return response.ok || response.status === 302 || response.status === 303;
  } catch {
    return false;
  }
}

async function configureAppProperties(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/secure/SetupApplicationProperties.jspa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          title: 'Jira E2E Test',
          mode: 'private',
          baseURL: baseUrl,
        }).toString(),
      },
      30000,
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Application properties configured');
      return true;
    }

    console.log(`App properties returned status: ${response.status}`);
    return false;
  } catch (error) {
    console.error(`App properties error: ${(error as Error).message}`);
    return false;
  }
}

async function createAdminAccount(baseUrl: string, username: string, password: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/secure/SetupAdminAccount.jspa`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: username,
          password: password,
          confirm: password,
          fullname: 'Admin User',
          email: 'admin@example.com',
        }).toString(),
      },
      30000,
    );

    if (response.ok || response.status === 302 || response.status === 303) {
      console.log('✓ Admin account created');
      return true;
    }

    console.log(`Admin account creation returned status: ${response.status}`);
    return false;
  } catch (error) {
    console.error(`Admin account error: ${(error as Error).message}`);
    return false;
  }
}

async function setupJira(): Promise<void> {
  const config = getE2EConfig();
  const baseUrl = config.jira.baseUrl;
  const username = config.jira.auth.username || 'admin';
  const password = config.jira.auth.password || 'admin';

  console.log('Starting Jira setup wizard automation (haxqer/jira image)...');
  console.log(`Base URL: ${baseUrl}`);

  // Wait for Jira to be HTTP accessible
  console.log('Waiting for Jira HTTP to be available...');
  let httpReady = false;
  const httpTimeout = 300000; // 5 minutes
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
      console.log(`⏳ Waiting for HTTP... (${elapsed}s) - ${(error as Error).message}`);
      await sleep(5000);
    }
  }

  if (!httpReady) {
    console.error('✗ Jira HTTP did not become available in time');
    process.exit(1);
  }

  // Check if Jira is already set up
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
    console.log('Jira needs to be set up');
  }

  // Give Jira a moment to fully initialize the setup wizard
  console.log('Waiting for setup wizard to initialize...');
  await sleep(10000);

  // Step 1: Get server ID from setup page
  console.log('Getting server ID from setup page...');
  let serverId: string | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (!serverId && attempts < maxAttempts) {
    serverId = await getServerIdFromSetupPage(baseUrl);
    if (!serverId) {
      attempts++;
      console.log(`Attempt ${attempts}/${maxAttempts} - waiting for server ID...`);
      await sleep(5000);
    }
  }

  if (!serverId) {
    console.log('⚠ Could not get server ID - Jira may already be past the license page');
    // Try to continue with other setup steps
  } else {
    console.log(`✓ Server ID: ${serverId}`);

    // Step 2: Generate license using atlassian-agent
    const license = generateLicense(serverId);
    if (license) {
      console.log('✓ License generated');

      // Step 3: Submit license
      await submitLicense(baseUrl, license);
      await sleep(5000);
    } else {
      console.log('⚠ Failed to generate license');
    }
  }

  // Step 4: Configure database
  console.log('Configuring database connection...');
  await configureDatabase(baseUrl);
  await sleep(10000); // Database setup takes time

  // Step 5: Set application properties
  console.log('Configuring application properties...');
  await configureAppProperties(baseUrl);
  await sleep(3000);

  // Step 6: Create admin account
  console.log('Creating admin account...');
  await createAdminAccount(baseUrl, username, password);
  await sleep(5000);

  console.log('Setup wizard automation complete');
  console.log('Waiting for Jira to finalize...');
  await sleep(30000); // Give Jira time to complete setup

  // Final verification
  console.log('Verifying Jira is ready...');
  let verified = false;
  const verifyStart = Date.now();
  const verifyTimeout = 120000; // 2 minutes

  while (!verified && Date.now() - verifyStart < verifyTimeout) {
    try {
      const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      const response = await fetchWithTimeout(`${baseUrl}/rest/api/2/serverInfo`, {
        headers: { Authorization: authHeader },
      });

      if (response.ok) {
        const serverInfo = (await response.json()) as { version: string };
        console.log(`✓ Jira is ready! Version: ${serverInfo.version}`);
        verified = true;
      } else {
        const elapsed = Math.round((Date.now() - verifyStart) / 1000);
        console.log(`⏳ Waiting for API (${elapsed}s) - status: ${response.status}`);
        await sleep(5000);
      }
    } catch (error) {
      const elapsed = Math.round((Date.now() - verifyStart) / 1000);
      console.log(`⏳ Waiting for API (${elapsed}s) - ${(error as Error).message}`);
      await sleep(5000);
    }
  }

  if (!verified) {
    console.log('⚠ Could not verify Jira readiness');
    console.log('Note: Manual setup may still be required. Access Jira at', baseUrl);
  }
}

// Run if called directly
if (require.main === module) {
  setupJira().catch((error) => {
    console.error('Failed to set up Jira:', error);
    process.exit(1);
  });
}

export { setupJira };
