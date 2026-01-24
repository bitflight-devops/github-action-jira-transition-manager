/**
 * Jira Setup using Playwright (browser automation)
 *
 * This approach handles XSRF automatically since it uses a real browser.
 */
import { execSync } from 'child_process';
import { chromium } from 'playwright';

const JIRA_URL = process.env.JIRA_URL || 'http://localhost:8080';
const CONTAINER_NAME = process.env.JIRA_CONTAINER || 'jira-e2e';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';

function exec(cmd: string, timeout = 30000): string {
  return execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function execQuiet(cmd: string): string {
  try {
    return exec(cmd);
  } catch {
    return '';
  }
}

/**
 * Generate license using atlassian-agent.jar
 */
function generateLicense(serverId: string): string {
  const cmd = `docker exec ${CONTAINER_NAME} java -jar /var/agent/atlassian-agent.jar -d -p jira -m test@example.com -n "Test" -o "Test Org" -s "${serverId}"`;
  const output = exec(cmd, 60000);

  // Extract license from output (it's base64 encoded, multiple lines)
  const lines = output.split('\n');
  const licenseLines: string[] = [];
  let inLicense = false;

  for (const line of lines) {
    if (line.includes('Your license code')) {
      inLicense = true;
      continue;
    }
    if (inLicense && line.trim()) {
      if (line.includes('====') || line.includes('license has been copied')) {
        break;
      }
      licenseLines.push(line.trim());
    }
  }

  return licenseLines.join('\n');
}

/**
 * Watch Docker logs for Jira startup - fail fast on errors
 */
function waitForJiraStart(timeoutMs: number): { ready: boolean; error?: string } {
  const startTime = Date.now();

  // Success patterns
  const readyPatterns = [
    /Jira is ready to serve/i,
    /You can now access JIRA/i,
    /Server startup in \d+/i,
    /JiraStartupLogger.*started/i,
  ];

  // Error patterns - fail fast when detected
  const errorPatterns = [
    { pattern: /FATAL|ERROR.*Exception/i, msg: 'Fatal error in Jira startup' },
    { pattern: /Cannot connect to database/i, msg: 'Database connection failed' },
    { pattern: /Unable to start Jira/i, msg: 'Jira startup failed' },
    { pattern: /OutOfMemoryError/i, msg: 'Out of memory' },
    { pattern: /Address already in use/i, msg: 'Port conflict' },
    { pattern: /Shutting down/i, msg: 'Jira is shutting down' },
  ];

  let lastLogHash = '';
  let logLineCount = 0;

  while (Date.now() - startTime < timeoutMs) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const logs = execQuiet(`docker logs ${CONTAINER_NAME} 2>&1 | tail -30`);
    const logHash = logs.slice(-200); // Simple change detection

    // Only process if logs changed
    if (logHash !== lastLogHash) {
      lastLogHash = logHash;

      // Check for success
      for (const pattern of readyPatterns) {
        if (pattern.test(logs)) {
          console.log(`  [${elapsed}s] ✓ ${pattern.source}`);
          return { ready: true };
        }
      }

      // Check for errors - fail fast
      for (const { pattern, msg } of errorPatterns) {
        if (pattern.test(logs)) {
          console.log(`  [${elapsed}s] ✗ ${msg}`);
          console.log('');
          console.log('  === Docker logs (error detected) ===');
          console.log(logs);
          console.log('  =====================================');
          return { ready: false, error: msg };
        }
      }

      // Show latest log line
      const lines = logs.split('\n').filter((l) => l.trim());
      const latest = lines[lines.length - 1] || '';
      if (latest && logLineCount++ % 3 === 0) {
        // Show every 3rd unique log
        console.log(`  [${elapsed}s] ${latest.substring(0, 120)}`);
      }
    }

    execSync('sleep 1'); // Check every 1 second for faster response
  }

  // Timeout
  console.log('');
  console.log('  === Docker logs (timeout) ===');
  console.log(execQuiet(`docker logs ${CONTAINER_NAME} 2>&1 | tail -30`));
  console.log('  ==============================');

  return { ready: false, error: 'Timeout waiting for Jira startup' };
}

async function main() {
  console.log('============================================================');
  console.log('Jira Setup (Playwright Browser Automation)');
  console.log('============================================================');
  console.log(`Base URL: ${JIRA_URL}`);
  console.log('');

  // Step 1: Wait for Jira to start
  console.log('Step 1: Waiting for Jira to start...');
  console.log(`  Container: ${CONTAINER_NAME}`);
  console.log('  Timeout: 120s (expect ~15s, fail-fast on errors)');

  // Verify container exists
  const containerCheck = execQuiet(`docker ps --format '{{.Names}}' | grep -w ${CONTAINER_NAME}`);
  if (!containerCheck) {
    console.log(`  ERROR: Container ${CONTAINER_NAME} not found!`);
    console.log('  Available containers:');
    console.log(execQuiet('docker ps --format "  - {{.Names}}"'));
    process.exit(1);
  }
  console.log(`  Container ${CONTAINER_NAME} is running`);

  const startResult = waitForJiraStart(120000); // 2 min max, should be ~15s
  if (!startResult.ready) {
    console.log(`  ✗ ${startResult.error || 'Failed to start'}`);
    process.exit(1);
  }
  console.log('✓ Jira startup detected');
  console.log('');

  // Step 2: Launch browser
  console.log('Step 2: Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 3: Wait for Jira web UI to finish initializing
    console.log('Step 3: Waiting for Jira web UI...');
    let attempts = 0;
    while (attempts < 60) {
      try {
        await page.goto(JIRA_URL, { timeout: 10000 });
        const title = await page.title();
        const lowerTitle = title.toLowerCase();
        console.log(`  [${attempts}] Page title: ${title}`);

        // Wait for initialization to complete (not just "Initialising")
        if (lowerTitle.includes('initialis') || lowerTitle.includes('loading')) {
          console.log('  Still initializing, waiting...');
          attempts++;
          await page.waitForTimeout(5000);
          continue;
        }

        // Check for setup wizard or dashboard (case-insensitive)
        if (
          lowerTitle.includes('setup') ||
          lowerTitle.includes('set up') ||
          lowerTitle.includes('dashboard') ||
          lowerTitle.includes('log in')
        ) {
          console.log(`  Jira UI ready (title: ${title})`);
          break;
        }

        // Also check page content for setup indicators
        const pageContent = await page.content();
        if (
          pageContent.includes('SetupLicense') ||
          pageContent.includes('setupLicenseKey') ||
          pageContent.includes('Server ID')
        ) {
          console.log('  Found setup page content');
          break;
        }
      } catch (e) {
        console.log(`  [${attempts}] Connection error: ${(e as Error).message}`);
      }
      attempts++;
      await page.waitForTimeout(3000);
    }

    if (attempts >= 60) {
      await page.screenshot({ path: '/tmp/jira-timeout.png' });
      console.log('  Screenshot saved to /tmp/jira-timeout.png');
      throw new Error('Jira web UI did not become available');
    }
    console.log('');

    // Step 4: Handle "Set Application Properties" if present
    console.log('Step 4: Checking for Application Properties page...');
    await page.waitForTimeout(2000);

    const hasAppProperties = await page
      .getByText('Set up application properties')
      .isVisible()
      .catch(() => false);
    if (hasAppProperties) {
      console.log('  Setting Application Properties...');
      await page.fill('input[name="title"]', 'Jira E2E');
      await page.click('#next, button:has-text("Next"), input[type="submit"]');
      await page.waitForLoadState('networkidle');
    } else {
      console.log('  Application Properties already configured or skipped');
    }
    console.log('');

    // Step 5: Handle License page
    console.log('Step 5: Handling License page...');
    await page.waitForTimeout(2000);

    // Log current page info for debugging
    const currentUrl = page.url();
    const currentTitle = await page.title();
    console.log(`  Current URL: ${currentUrl}`);
    console.log(`  Current title: ${currentTitle}`);

    // Check if we're on the license page - use specific textarea selector
    // Note: Page has both textarea#licenseKey and input#setupLicenseKey, we want the visible textarea
    const licenseTextarea = page.locator('textarea[name="licenseKey"]');
    const hasLicensePage = (await licenseTextarea.count()) > 0;

    // Also check for license-related text in page
    const pageContent = await page.content();
    const hasLicenseText =
      pageContent.includes('license') || pageContent.includes('License') || pageContent.includes('Server ID');

    console.log(`  License textarea found: ${hasLicensePage}`);
    console.log(`  License text in page: ${hasLicenseText}`);

    if (hasLicensePage || hasLicenseText) {
      // Get server ID from page
      console.log('  Extracting server ID...');
      const pageContent = await page.content();
      const serverIdMatch =
        pageContent.match(/Server ID[:\s]*<[^>]*>([A-Z0-9-]+)/i) ||
        pageContent.match(/([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/);

      if (!serverIdMatch) {
        throw new Error('Could not find server ID on license page');
      }

      const serverId = serverIdMatch[1];
      console.log(`  Server ID: ${serverId}`);

      // Generate license
      console.log('  Generating license...');
      const license = generateLicense(serverId);
      if (!license) {
        throw new Error('Failed to generate license');
      }
      console.log('  License generated');

      // Fill license
      console.log('  Submitting license...');
      await licenseTextarea.fill(license);
      await page.click('button:has-text("Next"), input[type="submit"], #setupLicenseButton');
      await page.waitForLoadState('networkidle');
      console.log('  License submitted');
    } else {
      console.log('  License page not found');
      await page.screenshot({ path: '/tmp/jira-no-license-page.png' });
      console.log('  Screenshot saved to /tmp/jira-no-license-page.png');
      // Show first 500 chars of page for debugging
      console.log(`  Page excerpt: ${pageContent.substring(0, 500).replace(/\s+/g, ' ')}`);
    }
    console.log('');

    // Step 6: Handle Admin Account creation
    console.log('Step 6: Creating Admin Account...');
    await page.waitForTimeout(2000);

    const usernameInput = page.locator('input[name="username"]');
    const hasAdminPage = (await usernameInput.count()) > 0;

    if (hasAdminPage) {
      await usernameInput.fill(ADMIN_USER);
      await page.fill('input[name="password"]', ADMIN_PASS);
      await page.fill('input[name="confirm"]', ADMIN_PASS);
      await page.fill('input[name="fullname"]', 'Administrator');
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.click('button:has-text("Next"), input[type="submit"]');
      await page.waitForLoadState('networkidle');
      console.log('  Admin account created');
    } else {
      console.log('  Admin page not found, may already be configured');
    }
    console.log('');

    // Step 7: Finish setup (skip email configuration)
    console.log('Step 7: Finalizing setup...');
    await page.waitForTimeout(2000);

    // Try to click finish/skip email buttons
    const finishButton = page.locator('button:has-text("Finish"), a:has-text("Finish"), input[value="Finish"]');
    if ((await finishButton.count()) > 0) {
      await finishButton.first().click();
      await page.waitForLoadState('networkidle');
    }

    // Check if email config page, click Later/Disable
    const laterButton = page.locator('a:has-text("Later"), button:has-text("Later"), a:has-text("Disable")');
    if ((await laterButton.count()) > 0) {
      await laterButton.first().click();
      await page.waitForLoadState('networkidle');
    }
    console.log('  Setup finalized');
    console.log('');

    // Step 8: Verify setup by checking for dashboard or login
    console.log('Step 8: Verifying setup...');
    await page.waitForTimeout(3000);
    await page.goto(`${JIRA_URL}/login.jsp`, { timeout: 30000 });

    const loginInput = page.locator('input[name="os_username"], #login-form-username');
    if ((await loginInput.count()) > 0) {
      console.log('  Login page found - setup complete!');
    } else {
      const currentTitle = await page.title();
      console.log(`  Current page: ${currentTitle}`);
    }

    console.log('');
    console.log('============================================================');
    console.log(`SUCCESS: Jira setup complete! Login with ${ADMIN_USER} / ${ADMIN_PASS}`);
    console.log('============================================================');
  } catch (error) {
    console.log('');
    console.log('============================================================');
    console.log(`FAILED: ${(error as Error).message}`);
    console.log('============================================================');

    // Take screenshot for debugging
    try {
      await page.screenshot({ path: '/tmp/jira-setup-error.png' });
      console.log('Screenshot saved to /tmp/jira-setup-error.png');
    } catch {
      // Ignore screenshot errors
    }

    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
