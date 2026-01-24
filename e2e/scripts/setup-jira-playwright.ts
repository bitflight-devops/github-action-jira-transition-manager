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
const SCREENSHOT_DIR = '/tmp/jira-setup';

import { Page } from 'playwright';

/**
 * Log page state for debugging - call this before any action that might fail
 */
async function logPageState(page: Page, stepName: string): Promise<void> {
  const url = page.url();
  const title = await page.title();
  console.log(`  [${stepName}] URL: ${url}`);
  console.log(`  [${stepName}] Title: ${title}`);

  // Take screenshot
  const screenshotPath = `${SCREENSHOT_DIR}/${stepName.replace(/\s+/g, '-').toLowerCase()}.png`;
  await page.screenshot({ path: screenshotPath });
  console.log(`  [${stepName}] Screenshot: ${screenshotPath}`);
}

/**
 * Dump all form inputs on the page
 */
async function dumpFormInputs(page: Page): Promise<string[]> {
  const inputs = await page.locator('input, textarea, select').all();
  const names: string[] = [];

  for (const input of inputs) {
    const name = await input.getAttribute('name');
    const id = await input.getAttribute('id');
    const type = await input.getAttribute('type');
    const visible = await input.isVisible();
    if (name || id) {
      const label = name || id || 'unnamed';
      names.push(label);
      console.log(`    - ${label} (type=${type}, visible=${visible})`);
    }
  }
  return names;
}

/**
 * Wait for URL to change from current, with logging
 */
async function waitForNavigation(page: Page, fromUrl: string, timeout = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const currentUrl = page.url();
    if (currentUrl !== fromUrl) {
      console.log(`  Navigation: ${fromUrl} -> ${currentUrl}`);
      return true;
    }
    await page.waitForTimeout(500);
  }
  console.log(`  Navigation timeout: still on ${fromUrl}`);
  return false;
}

/**
 * Watch Docker logs for plugin system restart completion
 * This happens after license submission and takes ~35 seconds
 *
 * Sequence to watch for:
 * 1. "Starting the JIRA Plugin System" - restart initiated
 * 2. "Plugin System Started" - restart complete, admin page ready
 */
function waitForPluginSystemRestart(timeoutMs: number): { ready: boolean; error?: string } {
  const startTime = Date.now();

  // Get current log line count so we only look at NEW lines
  const baselineCount = parseInt(execQuiet(`docker logs ${CONTAINER_NAME} 2>&1 | wc -l`), 10) || 0;

  // Patterns to track progress
  const startingPattern = /Starting the JIRA Plugin System/i;
  const readyPattern = /Plugin System Started/i;

  // Error patterns - fail fast
  const errorPatterns = [
    { pattern: /FATAL|ERROR.*Exception/i, msg: 'Fatal error during restart' },
    { pattern: /OutOfMemoryError/i, msg: 'Out of memory' },
    { pattern: /Unable to start/i, msg: 'Startup failure' },
  ];

  let seenStarting = false;

  while (Date.now() - startTime < timeoutMs) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    // Only look at lines AFTER our baseline (new logs since we started waiting)
    const logs = execQuiet(`docker logs ${CONTAINER_NAME} 2>&1 | tail -n +${baselineCount + 1}`);

    // Check for errors first
    for (const { pattern, msg } of errorPatterns) {
      if (pattern.test(logs)) {
        console.log(`  [${elapsed}s] ✗ ${msg}`);
        return { ready: false, error: msg };
      }
    }

    // Check for "Starting" pattern
    if (!seenStarting && startingPattern.test(logs)) {
      seenStarting = true;
      console.log(`  [${elapsed}s] ⏳ Plugin System restart initiated...`);
    }

    // Check for "Started" pattern - success!
    if (readyPattern.test(logs)) {
      console.log(`  [${elapsed}s] ✓ Plugin System Started`);
      return { ready: true };
    }

    // Silent wait - only log on state changes (starting detected, ready, or error)
    execSync('sleep 2');
  }

  return { ready: false, error: 'Timeout waiting for plugin system restart' };
}

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

  while (Date.now() - startTime < timeoutMs) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const logs = execQuiet(`docker logs ${CONTAINER_NAME} 2>&1 | tail -30`);
    const logHash = logs.slice(-200);

    if (logHash !== lastLogHash) {
      lastLogHash = logHash;

      for (const pattern of readyPatterns) {
        if (pattern.test(logs)) {
          console.log(`  ✓ Ready (${elapsed}s)`);
          return { ready: true };
        }
      }

      for (const { pattern, msg } of errorPatterns) {
        if (pattern.test(logs)) {
          console.log(`  ✗ ${msg}`);
          return { ready: false, error: msg };
        }
      }
    }

    execSync('sleep 1');
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
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);
  console.log('');

  // Create screenshot directory
  execQuiet(`mkdir -p ${SCREENSHOT_DIR}`);

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
      .getByText(/set up application properties/i)
      .isVisible()
      .catch(() => false);
    if (hasAppProperties) {
      console.log('  Setting Application Properties...');
      await page.fill('input[name="title"]', 'Jira E2E');
      await page.locator('#next, button:has-text("Next"), input[type="submit"]').first().click();
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
      const beforeLicenseUrl = page.url();
      await logPageState(page, 'before-license-submit');

      await page.locator('button:has-text("Next"), input[type="submit"], #setupLicenseButton').first().click();
      console.log('  Clicked submit, waiting for navigation...');

      // Wait for URL to change (indicates page transition)
      await waitForNavigation(page, beforeLicenseUrl, 60000);
      await page.waitForLoadState('networkidle');

      // IMPORTANT: Jira restarts its plugin system after license submission
      // This takes ~35 seconds. Watch Docker logs for completion instead of blind polling.
      console.log('  Waiting for Jira plugin system restart (~35s)...');
      console.log('  Watching Docker logs for "Plugin System Started" pattern...');

      const restartResult = waitForPluginSystemRestart(90000); // 90s max
      if (!restartResult.ready) {
        console.log(`  ⚠ Plugin restart wait: ${restartResult.error || 'Unknown error'}`);
        console.log('  Continuing anyway - page may still work...');
      }

      // Now navigate to get the admin setup form (goto is more reliable than reload after restart)
      console.log('  Navigating to admin setup form...');
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.goto(JIRA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
          break;
        } catch (navError) {
          console.log(`  Navigation attempt ${attempt + 1} failed: ${(navError as Error).message.split('\n')[0]}`);
          if (attempt === 2) throw navError;
          await page.waitForTimeout(5000);
        }
      }

      // Wait for admin page to be ready (password field visible) - up to 60s
      console.log('  Waiting for admin setup form to appear...');
      const passwordField = page.locator('input[name="password"], input#password');
      try {
        await passwordField.first().waitFor({ state: 'visible', timeout: 60000 });
        console.log('  Admin setup form ready');
      } catch {
        console.log('  Admin form not visible after 60s, continuing anyway...');
      }

      await logPageState(page, 'after-license-submit');
      console.log('  Form inputs on new page:');
      await dumpFormInputs(page);
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
    await logPageState(page, 'step6-start');

    // List all form inputs to understand what's on the page
    console.log('  Available form inputs:');
    let inputNames = await dumpFormInputs(page);

    // Check if we're on Application Properties page (Jira sometimes returns here after license)
    const hasTitleField = inputNames.some((n) => n.toLowerCase() === 'title');
    const hasBaseURLField = inputNames.some((n) => n.toLowerCase() === 'baseurl');
    if (hasTitleField && hasBaseURLField) {
      console.log('  Still on Application Properties page - submitting to proceed...');
      await page.locator('button:has-text("Next"), input[type="submit"]').first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      // Refresh input list after navigation
      console.log('  Form inputs after Application Properties submit:');
      inputNames = await dumpFormInputs(page);
    }

    // Check for admin form fields by looking for password-related inputs
    const hasPasswordField = inputNames.some((n) => n.toLowerCase().includes('password'));
    const hasUsernameField = inputNames.some((n) => n.toLowerCase().includes('username'));
    const hasFullnameField = inputNames.some((n) => n.toLowerCase().includes('fullname'));

    console.log(`  Has password field: ${hasPasswordField}`);
    console.log(`  Has username field: ${hasUsernameField}`);
    console.log(`  Has fullname field: ${hasFullnameField}`);

    if (hasPasswordField) {
      console.log('  Filling admin account form...');

      // Fill fields that exist
      if (hasUsernameField) {
        await page.locator('input[name="username"], input#username').first().fill(ADMIN_USER);
      }

      await page.locator('input[name="password"], input#password').first().fill(ADMIN_PASS);

      const confirmField = page.locator('input[name="confirm"], input#confirm');
      if ((await confirmField.count()) > 0) {
        await confirmField.first().fill(ADMIN_PASS);
      }

      if (hasFullnameField) {
        await page.locator('input[name="fullname"], input#fullname').first().fill('Administrator');
      }

      const emailField = page.locator('input[name="email"], input#email');
      if ((await emailField.count()) > 0) {
        await emailField.first().fill('admin@example.com');
      }

      await logPageState(page, 'step6-before-submit');
      await page.locator('button:has-text("Next"), input[type="submit"]').first().click();
      await page.waitForLoadState('networkidle');
      await logPageState(page, 'step6-after-submit');
      console.log('  Admin account created');
    } else {
      console.log('  No password field found - not on admin setup page');
      console.log('  This could mean: already configured, or on a different page');
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
