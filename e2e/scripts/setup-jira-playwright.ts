/**
 * Jira Setup using Playwright (browser automation)
 *
 * This approach handles XSRF automatically since it uses a real browser.
 */
import { execSync } from 'child_process';
import { chromium } from 'playwright';

// =============================================================================
// CONFIGURATION
// =============================================================================
const JIRA_URL = process.env.JIRA_URL || 'http://localhost:8080';
const CONTAINER_NAME = process.env.JIRA_CONTAINER || 'jira-e2e';
const ADMIN_USER = process.env.E2E_JIRA_USERNAME || 'admin';
const ADMIN_PASS = process.env.E2E_JIRA_PASSWORD || 'admin';
const SCREENSHOT_DIR = '/tmp/jira-setup';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function execQuiet(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return '';
  }
}

/**
 * Generate license using atlassian-agent.jar inside the container
 */
function generateLicense(serverId: string): string | null {
  console.log(`  Generating license for Server ID: ${serverId}...`);
  // Note: This command assumes your container has the agent jar at /var/agent/atlassian-agent.jar
  const cmd = `docker exec ${CONTAINER_NAME} java -jar /var/agent/atlassian-agent.jar -d -p jira -m test@example.com -n "Test" -o "Test Org" -s "${serverId}"`;

  try {
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 60000 });
    const lines = output.split('\n');
    const licenseLines: string[] = [];
    let inLicense = false;

    for (const line of lines) {
      if (line.includes('Your license code')) {
        inLicense = true;
        continue;
      }
      if (inLicense && line.trim()) {
        if (line.includes('====') || line.includes('license has been copied')) break;
        licenseLines.push(line.trim());
      }
    }
    return licenseLines.join('\n');
  } catch (e) {
    console.error(`  Error generating license: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Waits for the specific "Plugin System Started" log message
 * appearing AFTER a specific timestamp.
 */
function waitForPluginRestart(sinceTimestamp: string, timeoutMs: number): boolean {
  const startTime = Date.now();
  // We use the timestamp to ensure we don't match the INITIAL boot log.
  // Docker --since accepts ISO format (e.g., 2026-01-24T12:00:00Z)
  console.log(`  Watching Docker logs since ${sinceTimestamp} for restart...`);

  while (Date.now() - startTime < timeoutMs) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    // Fetch logs only from after the license button click
    const logs = execQuiet(`docker logs --since "${sinceTimestamp}" ${CONTAINER_NAME} 2>&1`);

    // Check for success
    if (logs.match(/Plugin System Started/i)) {
      console.log(`  [${elapsed}s] ✓ Plugin System Restart Detected.`);
      return true;
    }

    // Fail fast checks
    if (logs.match(/OutOfMemoryError/i)) throw new Error('Jira crashed: OutOfMemoryError');
    if (logs.match(/FATAL/i)) throw new Error('Jira crashed: FATAL error in logs');

    // Optional: Log progress
    if (logs.match(/Starting the JIRA Plugin System/i) && elapsed % 5 === 0) {
      console.log(`  [${elapsed}s] ⏳ Restart in progress...`);
    }

    execSync('sleep 2');
  }
  return false;
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('============================================================');
  console.log('Jira Setup (Playwright) - FINAL ROBUST VERSION');
  console.log('============================================================');
  console.log(`URL: ${JIRA_URL} | Container: ${CONTAINER_NAME}`);

  execQuiet(`mkdir -p ${SCREENSHOT_DIR}`);

  // 1. Wait for Jira to be responsive (Initial Boot)
  console.log('\nStep 1: Waiting for Jira to be ready...');
  let bootReady = false;
  for (let i = 0; i < 40; i++) {
    // 2 minutes
    const logs = execQuiet(`docker logs --tail 100 ${CONTAINER_NAME} 2>&1`);
    if (logs.match(/Jira is ready to serve/i) || logs.match(/Server startup in/i)) {
      bootReady = true;
      break;
    }
    execSync('sleep 3');
  }
  if (!bootReady) {
    console.log('  ⚠️ Warning: Startup log not found, trying to connect anyway...');
  } else {
    console.log('  ✓ Jira startup detected.');
  }

  // 2. Launch Browser
  console.log('\nStep 2: Launching Browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set a generous timeout for heavy Jira pages
  page.setDefaultTimeout(30000);

  try {
    // 3. Connect to UI
    console.log('\nStep 3: Connecting to Web UI...');
    let attempts = 0;
    while (attempts < 60) {
      try {
        await page.goto(JIRA_URL, { timeout: 10000 });
        const title = (await page.title()).toLowerCase();

        if (title.includes('initialis') || title.includes('loading')) {
          console.log(`  [${attempts}] Still initializing...`);
        } else if (title.includes('setup') || title.includes('dashboard') || title.includes('log in')) {
          console.log(`  ✓ UI Ready. Title: ${await page.title()}`);
          break;
        }
      } catch (e) {
        /* ignore connection refused */
      }

      attempts++;
      await page.waitForTimeout(2000);
    }
    if (attempts >= 60) throw new Error('Timeout waiting for Web UI');

    // 4. Application Properties
    console.log('\nStep 4: Application Properties...');
    const hasAppProps = await page
      .getByText(/set up application properties/i)
      .isVisible()
      .catch(() => false);
    if (hasAppProps) {
      console.log('  Setting properties...');
      await page.fill('input[name="title"]', 'Jira E2E');
      await page.locator('button:has-text("Next"), input[type="submit"]').first().click();
      await page.waitForLoadState('networkidle');
    } else {
      console.log('  Skipped (Not found).');
    }

    // 5. License (The Critical Step)
    console.log('\nStep 5: License Setup...');
    await page.waitForTimeout(1000);
    const licenseBox = page.locator('textarea[name="licenseKey"]');

    if (await licenseBox.isVisible()) {
      console.log('  License page found. Extracting Server ID...');
      const content = await page.content();
      const serverIdMatch =
        content.match(/Server ID[:\s]*<[^>]*>([A-Z0-9-]+)/i) ||
        content.match(/([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/);

      if (serverIdMatch) {
        const license = generateLicense(serverIdMatch[1]);
        if (!license) throw new Error('Failed to generate license');

        await licenseBox.fill(license);
        console.log('  License filled. Submitting...');

        // CAPTURE TIMESTAMP BEFORE CLICKING NEXT
        // This ensures we only look for logs generated AFTER this moment.
        const restartTimestamp = new Date().toISOString();

        await page.locator('button:has-text("Next"), input[type="submit"]').first().click();

        // WAIT FOR DOCKER RESTART (TIMESTAMP BASED)
        console.log(`  Waiting for Plugin System Restart (Logs since ${restartTimestamp})...`);
        const restarted = waitForPluginRestart(restartTimestamp, 120000); // 2 mins
        if (!restarted) throw new Error('Timed out waiting for Plugin System Restart');

        // WAIT FOR URL REDIRECT
        console.log('  Restart confirmed. Waiting for browser redirect...');
        await page.waitForURL((url) => !url.href.includes('SetupLicense'), { timeout: 60000 });
        console.log('  ✓ Redirect successful.');
      }
    } else {
      console.log('  License page not visible (Already done?).');
    }

    // 6. The Wizard Loop (State Machine)
    console.log('\nStep 6: Finalizing Setup Wizard...');

    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(2000); // Allow React to settle
      const url = page.url().toLowerCase();

      // SUCCESS CONDITION
      if (url.includes('dashboard') || url.includes('system') || url.includes('login')) {
        console.log('  ✓ Reached Dashboard/Login. Wizard Complete.');
        break;
      }

      // STATE DETECTION
      // We explicitly check visibility because hidden fields exist in the DOM
      const isEmailPage = await page
        .locator('input[name="noemail"]')
        .isVisible()
        .catch(() => false);
      const isPasswordVisible = await page
        .locator('input[name="password"]')
        .isVisible()
        .catch(() => false);

      // PRIORITY 1: Email Setup (Finish)
      // This must come before Admin check because Admin fields might be hidden on this page
      if (isEmailPage) {
        console.log('  [State: Email Setup] Selecting "Later"...');
        await page.locator('input[name="noemail"]').first().check();
        const finishBtn = page.locator('button:has-text("Finish"), input[value="Finish"]');
        if (await finishBtn.isVisible()) {
          await finishBtn.first().click();
        }
        await page.waitForLoadState('networkidle');
        continue;
      }

      // PRIORITY 2: Admin Creation
      if (isPasswordVisible) {
        console.log('  [State: Create Admin] Filling form...');
        // Fill fields if they exist/are visible
        if (await page.locator('input[name="username"]').isVisible())
          await page.locator('input[name="username"]').first().fill(ADMIN_USER);

        await page.locator('input[name="password"]').first().fill(ADMIN_PASS);

        if (await page.locator('input[name="confirm"]').isVisible())
          await page.locator('input[name="confirm"]').first().fill(ADMIN_PASS);

        if (await page.locator('input[name="fullname"]').isVisible())
          await page.locator('input[name="fullname"]').first().fill('Administrator');

        if (await page.locator('input[name="email"]').isVisible())
          await page.locator('input[name="email"]').first().fill('admin@example.com');

        await page.locator('button:has-text("Next"), input[type="submit"]').first().click();
        await page.waitForLoadState('networkidle');
        continue;
      }

      // PRIORITY 3: Fallback (Click Next/Finish)
      // If we are on an unknown page (e.g. "Welcome" or "Language"), try to advance.
      const anyNext = page.locator('button:has-text("Next"), button:has-text("Finish"), input[type="submit"]');
      if (await anyNext.isVisible()) {
        console.log('  [State: Unknown] Clicking generic Next/Finish...');
        await anyNext.first().click();
        await page.waitForLoadState('networkidle');
      } else {
        console.log('  [State: Unknown] No navigation buttons found. Waiting...');
      }
    }

    // 7. Final Verification
    console.log('\nStep 7: Verifying Login...');
    await page.goto(`${JIRA_URL}/login.jsp`, { timeout: 30000 });
    const loginVisible = await page
      .locator('input[name="os_username"]')
      .isVisible()
      .catch(() => false);
    const pageTitle = await page.title();

    if (loginVisible || pageTitle.includes('Dashboard') || pageTitle.includes('System')) {
      console.log('============================================================');
      console.log(`SUCCESS: Jira is Provisioned. Admin: ${ADMIN_USER} / ${ADMIN_PASS}`);
      console.log('============================================================');
    } else {
      throw new Error(`Verification failed. Ended on page: ${pageTitle}`);
    }
  } catch (err) {
    console.error(`\nFAILED: ${(err as Error).message}`);
    try {
      await page.screenshot({ path: `${SCREENSHOT_DIR}/error_final.png` });
      console.log(`Screenshot saved to ${SCREENSHOT_DIR}/error_final.png`);
    } catch (e) {
      /* ignore screenshot errors */
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
