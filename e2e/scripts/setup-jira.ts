#!/usr/bin/env node
/**
 * Automate Jira Data Center setup wizard
 * This script handles the initial setup of Jira DC so it's ready for API access
 */
import { getE2EConfig } from './e2e-config';

interface SetupStep {
  name: string;
  url: string;
  method: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setupJira(): Promise<void> {
  const config = getE2EConfig();
  const baseUrl = config.jira.baseUrl;
  const username = config.jira.auth.username || 'admin';
  const password = config.jira.auth.password || 'admin';

  console.log('Starting Jira setup wizard automation...');
  console.log(`Base URL: ${baseUrl}`);

  // Wait for Jira to be HTTP accessible
  console.log('Waiting for Jira HTTP to be available...');
  let httpReady = false;
  const httpTimeout = 180000; // 3 minutes
  const httpStart = Date.now();

  while (!httpReady && Date.now() - httpStart < httpTimeout) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${baseUrl}/status`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        httpReady = true;
        console.log('✓ Jira HTTP is available');
      }
    } catch (error) {
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
    const response = await fetch(`${baseUrl}/rest/api/2/serverInfo`, {
      headers: { Authorization: authHeader },
    });

    if (response.ok) {
      const serverInfo = (await response.json()) as { version: string };
      console.log(`✓ Jira is already configured (version ${serverInfo.version})`);
      console.log('Skipping setup wizard');
      return;
    }
  } catch (error) {
    // Expected if not set up yet
    console.log('Jira needs to be set up');
  }

  // Perform setup wizard steps
  console.log('Starting automated setup wizard...');

  // Step 1: Check if setup wizard is accessible
  try {
    const setupResponse = await fetch(`${baseUrl}/secure/SetupMode!default.jspa`);
    if (setupResponse.status === 200) {
      console.log('✓ Setup wizard is accessible');
    }
  } catch (error) {
    console.log('Note: Setup wizard check failed, continuing...');
  }

  // Step 2: Configure database (already done via environment variables)
  console.log('✓ Database configuration is handled via environment variables');

  // Step 3: Set application properties
  console.log('Configuring application properties...');
  const setupSteps: SetupStep[] = [
    {
      name: 'Set application properties',
      url: `${baseUrl}/secure/SetupApplicationProperties.jspa`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        title: 'Jira E2E Test',
        mode: 'private',
        baseURL: baseUrl,
      },
    },
  ];

  // Step 4: Set up admin account
  console.log('Setting up admin account...');
  setupSteps.push({
    name: 'Create admin user',
    url: `${baseUrl}/secure/SetupAdminAccount.jspa`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: {
      username: username,
      password: password,
      confirm: password,
      fullname: 'Admin User',
      email: 'admin@example.com',
    },
  });

  // Execute setup steps with retry logic
  for (const step of setupSteps) {
    console.log(`Executing: ${step.name}...`);
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const headers = step.headers || {};
        let body: string | undefined;

        if (step.body) {
          if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
            body = new URLSearchParams(step.body as Record<string, string>).toString();
          } else {
            body = JSON.stringify(step.body);
            headers['Content-Type'] = 'application/json';
          }
        }

        const response = await fetch(step.url, {
          method: step.method,
          headers,
          body,
        });

        if (response.ok || response.status === 302 || response.status === 303) {
          console.log(`✓ ${step.name} completed`);
          break;
        } else {
          console.log(`Step returned status ${response.status}, attempting next step...`);
          break; // Continue to next step even if this one has issues
        }
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`Attempt ${attempts} failed, retrying...`);
          await sleep(2000);
        } else {
          console.log(`⚠ ${step.name} failed after ${maxAttempts} attempts, continuing...`);
        }
      }
    }
  }

  console.log('Setup wizard automation complete');
  console.log('Waiting for services to stabilize...');
  await sleep(10000); // Wait 10 seconds for changes to take effect

  // Final verification
  console.log('Verifying Jira is ready...');
  try {
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    const response = await fetch(`${baseUrl}/rest/api/2/serverInfo`, {
      headers: { Authorization: authHeader },
    });

    if (response.ok) {
      const serverInfo = (await response.json()) as { version: string };
      console.log(`✓ Jira is ready! Version: ${serverInfo.version}`);
    } else {
      console.log(`⚠ Jira API returned status ${response.status}`);
      console.log('Note: Manual setup may still be required. Access Jira at', baseUrl);
    }
  } catch (error) {
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
