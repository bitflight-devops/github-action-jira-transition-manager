/**
 * Jira Setup using Playwright (browser automation)
 *
 * This approach handles XSRF automatically since it uses a real browser.
 */
import { execSync } from 'child_process';
import { chromium, Page } from 'playwright';

const JIRA_URL = process.env.JIRA_URL || 'http://localhost:8080';
const CONTAINER_NAME = process.env.JIRA_CONTAINER || 'jira-e2e';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';
const SCREENSHOT_DIR = '/tmp/jira-setup';

/**
 * Log page state for debugging - call this before any action that might fail
 */
async function logPageState(page: Page, stepName: string): Promise<void> {
  const url = page.url();
  const title = await page.title();
  console.log(`  [${stepName}] URL: ${url}`);
  console.log(`  [${stepName}] Title: ${title}`);

  const screenshotPath = `${SCREENSHOT_DIR}/${stepName.replace(/\s+/g, '-').toLowerCase()}.png`;
  await page.screenshot({ path: screenshotPath });
  console.log(`  [${stepName}] Screenshot: ${screenshotPath}`);
}

/**
 * Dump all form inputs on the page (returns names for detection)
 */
async function dumpFormInputs(page: Page): Promise<string[]> {
  const inputs = await page.locator('input, textarea, select').all();
  const names: string[] = [];

  for (const input of inputs) {
    const name = await input.getAttribute('name');
    const id = await input.getAttribute('id');
    if (name || id) {
      names.push(name || id || 'unnamed');
    }
  }
  return names;
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
 * Watch Docker logs for plugin system restart completion
 */
function waitForPluginSystemRestart(timeoutMs: number): { ready: boolean; error?: string } {
  const startTime = Date.now();
  const startingPattern = /Starting the JIRA Plugin System/i;
  const readyPattern = /Plugin System Started/i;
  const errorPatterns = [
    { pattern: /FATAL|ERROR.*Exception/i, msg: 'Fatal error during restart' },
    { pattern: /OutOfMemoryError/i, msg: 'Out of memory' },
    { pattern: /Unable to start/i, msg: 'Startup failure' },
  ];

  let seenStarting = false;

  while (Date.now() - startTime < timeoutMs) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const logs = execQuiet(`docker logs --since 5s ${CONTAINER_NAME} 2>&1`);

    if (logs.trim()) {
      const lastLine = logs.trim().split('\n').pop() || '';
      const abbrev = lastLine.length > 100 ? lastLine.substring(0, 100) + '...' : lastLine;
      console.log(`  [${elapsed}s] ${abbrev}`);
    }

    for (const { pattern, msg } of errorPatterns) {
      if (pattern.test(logs)) {
        return { ready: false, error: msg };
      }
    }

    if (!seenStarting && startingPattern.test(logs)) {
      seenStarting = true;
      console.log(`  [${elapsed}s] ⏳ Plugin System restart initiated...`);
    }

    if (readyPattern.test(logs)) {
      console.log(`  [${elapsed}s] ✓ Plugin System Started`);
      return { ready: true };
    }

    execSync('sleep 2');
  }

  console.log('  === Docker logs at timeout ===');
  console.log(execQuiet(`docker logs --tail 20 ${CONTAINER_NAME} 2>&1`));
  console.log('  ==============================');

  return { ready: false, error: 'Timeout waiting for plugin system restart' };
}

/**
 * Generate license using atlassian-agent.jar
 */
function generateLicense(serverId: string): string {
  const cmd = `docker exec ${CONTAINER_NAME} java -jar /var/agent/atlassian-agent.jar -d -p jira -m test@example.com -n "Test" -o "Test Org" -s "${serverId}"`;
  const output = exec(cmd, 60000);

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
 * Watch Docker logs for Jira startup
 */
function waitForJiraStart(timeoutMs: number): { ready: boolean; error?: string } {
  const startTime = Date.now();
  const readyPatterns = [
    /Jira is ready to serve/i,
    /You can now access JIRA/i,
    /Server startup in \d+/i,
    /JiraStartupLogger.*started/i,
  ];
  const errorPatterns = [
    { pattern: /FATAL|ERROR.*Exception/i, msg: 'Fatal error in Jira startup' },
    { pattern: /Cannot connect to database/i, msg: 'Database connection failed' },
    { pattern: /Unable to start Jira/i, msg: 'Jira startup failed' },
    { pattern: /OutOfMemoryError/i, msg: 'Out of memory' },
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
  return { ready: false, error: 'Timeout waiting for Jira startup' };
}

async function main() {
  console.log('============================================================');
  console.log('Jira Setup (Playwright Browser Automation)');
  console.log('============================================================');
  console.log(`Base URL: ${JIRA_URL}`);

  execQuiet(`mkdir -p ${SCREENSHOT_DIR}`);

  // Step 1: Wait for Jira to start
  console.log('Step 1: Waiting for Jira to start...');
  const startResult = waitForJiraStart(120000);
  if (!startResult.ready) {
    console.log(`  ✗ ${startResult.error}`);
    process.exit(1);
  }
  console.log('✓ Jira startup detected\n');

  // Step 2: Launch browser
  console.log('Step 2: Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 3: Wait for Jira web UI
    console.log('Step 3: Waiting for Jira web UI...');
    let attempts = 0;
    while (attempts < 60) {
      try {
        await page.goto(JIRA_URL, { timeout: 10000 });
        const title = await page.title();
        const lowerTitle = title.toLowerCase();

        if (lowerTitle.includes('initialis') || lowerTitle.includes('loading')) {
          console.log(`  [${attempts}] Initializing...`);
          attempts++;
          await page.waitForTimeout(5000);
          continue;
        }

        if (
          lowerTitle.includes('setup') ||
          lowerTitle.includes('set up') ||
          lowerTitle.includes('dashboard') ||
          lowerTitle.includes('log in')
        ) {
          console.log(`  Jira UI ready (title: ${title})`);
          break;
        }
      } catch {
        // ignore connection errors
      }
      attempts++;
      await page.waitForTimeout(3000);
    }

    if (attempts >= 60) throw new Error('Jira web UI did not become available');
    console.log('');

    // Step 4: Handle "Set Application Properties"
    console.log('Step 4: Checking for Application Properties page...');
    const hasAppProperties = await page
      .getByText(/set up application properties/i)
      .isVisible()
      .catch(() => false);
    if (hasAppProperties) {
      console.log('  Setting Application Properties...');
      await page.fill('input[name="title"]', 'Jira E2E');
      await page.locator('#next, button:has-text("Next"), input[type="submit"]').first().click();
      await page.waitForLoadState('networkidle');
    }
    console.log('');

    // Step 5: Handle License page
    console.log('Step 5: Handling License page...');
    await page.waitForTimeout(2000);
    const licenseTextarea = page.locator('textarea[name="licenseKey"]');
    if ((await licenseTextarea.count()) > 0) {
      console.log('  License page found. Generating license...');
      const pageContent = await page.content();
      const serverIdMatch =
        pageContent.match(/Server ID[:\s]*<[^>]*>([A-Z0-9-]+)/i) ||
        pageContent.match(/([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/);

      if (serverIdMatch) {
        const license = generateLicense(serverIdMatch[1]);
        await licenseTextarea.fill(license);
        await page.locator('button:has-text("Next"), input[type="submit"]').first().click();
        console.log('  License submitted. Waiting for plugin restart...');

        const restartResult = waitForPluginSystemRestart(90000);
        if (!restartResult.ready) throw new Error(`Plugin restart failed: ${restartResult.error}`);

        // After "Plugin System Started", redirect happens within seconds
        await page.waitForURL((url) => !url.href.includes('SetupLicense'), { timeout: 15000 });
        console.log(`  Redirected to: ${page.url()}`);
      }
    } else {
      console.log('  License page skipped.');
    }
    console.log('');

    // Step 6: Wizard loop - handle remaining setup pages
    console.log('Step 6: Completing setup wizard...');

    for (let wizardStep = 0; wizardStep < 10; wizardStep++) {
      await logPageState(page, `wizard-step-${wizardStep}`);

      const url = page.url().toLowerCase();
      if (url.includes('login') || url.includes('dashboard')) {
        console.log('  Reached login/dashboard - wizard complete');
        break;
      }

      // Check what's actually VISIBLE on the page
      const isEmailPage = await page.locator('input[name="noemail"]').isVisible();
      const isPasswordVisible = await page.locator('input[name="password"]').isVisible();
      const inputNames = await dumpFormInputs(page);

      // --- CASE A: Email Setup ---
      if (isEmailPage) {
        console.log('  On Email Configuration page - selecting "Later"...');
        await page.locator('input[name="noemail"]').first().check();
        const finishBtn = page.locator('button:has-text("Finish"), input[value="Finish"]');
        if ((await finishBtn.count()) > 0) {
          await finishBtn.first().click();
        }
        await page.waitForLoadState('networkidle');
        continue;
      }

      // --- CASE B: Admin Account Creation ---
      if (isPasswordVisible) {
        console.log('  On Admin Account page - creating admin...');

        if (await page.locator('input[name="username"]').isVisible()) {
          await page.locator('input[name="username"]').first().fill(ADMIN_USER);
        }

        await page.locator('input[name="password"]').first().fill(ADMIN_PASS);

        if ((await page.locator('input[name="confirm"]').count()) > 0) {
          await page.locator('input[name="confirm"]').first().fill(ADMIN_PASS);
        }

        if (await page.locator('input[name="fullname"]').isVisible()) {
          await page.locator('input[name="fullname"]').first().fill('Administrator');
        }

        if (await page.locator('input[name="email"]').isVisible()) {
          await page.locator('input[name="email"]').first().fill('admin@example.com');
        }

        await page.locator('button:has-text("Next"), input[type="submit"]').first().click();
        await page.waitForLoadState('networkidle');
        console.log('  Admin account created.');
        continue;
      }

      // --- CASE C: Application Properties ---
      const hasTitleField = inputNames.some((n) => n.toLowerCase() === 'title');
      const hasBaseURLField = inputNames.some((n) => n.toLowerCase() === 'baseurl');
      if (hasTitleField && hasBaseURLField) {
        console.log('  On Application Properties page...');
        await page.fill('input[name="title"]', 'Jira E2E');
        await page.locator('button:has-text("Next"), input[type="submit"]').first().click();
        await page.waitForLoadState('networkidle');
        continue;
      }

      // --- CASE D: Unknown page - try Next/Finish ---
      console.log('  Unknown page - looking for Next/Finish button...');
      const anyButton = page.locator('button:has-text("Next"), button:has-text("Finish"), input[type="submit"]');
      if ((await anyButton.count()) > 0) {
        await anyButton.first().click();
        await page.waitForLoadState('networkidle');
      } else {
        console.log('  No navigation button found - breaking');
        break;
      }
    }
    console.log('');

    // Step 7: Final cleanup
    console.log('Step 7: Finalizing setup...');
    await page.waitForTimeout(2000);
    const finishButton = page.locator('button:has-text("Finish"), a:has-text("Finish")');
    if ((await finishButton.count()) > 0 && (await finishButton.first().isVisible())) {
      await finishButton.first().click();
    }

    // Step 8: Verify
    console.log('Step 8: Verifying setup...');
    await page.goto(`${JIRA_URL}/login.jsp`, { timeout: 30000 });
    const loginInput = page.locator('input[name="os_username"], #login-form-username');

    if ((await loginInput.count()) > 0) {
      console.log('============================================================');
      console.log(`SUCCESS: Jira setup complete! Login with ${ADMIN_USER} / ${ADMIN_PASS}`);
      console.log('============================================================');
    } else {
      const title = await page.title();
      if (title.includes('Dashboard') || title.includes('System')) {
        console.log(`SUCCESS: Already logged in. Title: ${title}`);
      } else {
        throw new Error(`Verification failed. Title: ${title}`);
      }
    }
  } catch (error) {
    console.log(`FAILED: ${(error as Error).message}`);
    await page.screenshot({ path: '/tmp/jira-setup-error.png' });
    process.exit(1);
  }

  await browser.close();
}

main();
