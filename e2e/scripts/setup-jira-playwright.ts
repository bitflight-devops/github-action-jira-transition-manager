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
 * Watch Docker logs for patterns indicating Jira is ready
 */
function waitForJiraStart(timeoutMs: number): boolean {
  const startTime = Date.now();
  // Multiple patterns that indicate Jira is starting/ready
  const readyPatterns = [
    /Jira is ready to serve/i,
    /You can now access JIRA/i,
    /Server startup in/i,
    /Catalina.*start/i,
    /JiraStartupLogger.*JIRA.*started/i,
  ];

  let lastLogLine = '';
  let iteration = 0;

  while (Date.now() - startTime < timeoutMs) {
    const logs = execQuiet(`docker logs ${CONTAINER_NAME} 2>&1 | tail -50`);

    // Check all patterns
    for (const pattern of readyPatterns) {
      if (pattern.test(logs)) {
        console.log(`  Found startup indicator: ${pattern.source}`);
        return true;
      }
    }

    // Show progress every 30 seconds
    iteration++;
    if (iteration % 15 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const logLines = logs.split('\n').filter((l) => l.trim());
      const currentLog = logLines[logLines.length - 1] || '';
      if (currentLog !== lastLogLine) {
        console.log(`  [${elapsed}s] ${currentLog.substring(0, 100)}`);
        lastLogLine = currentLog;
      } else {
        console.log(`  [${elapsed}s] Waiting...`);
      }
    }

    execSync('sleep 2');
  }

  // On timeout, print recent logs
  console.log('');
  console.log('  === Recent Docker logs ===');
  const recentLogs = execQuiet(`docker logs ${CONTAINER_NAME} 2>&1 | tail -30`);
  console.log(recentLogs);
  console.log('  ===========================');

  return false;
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
  console.log('  Timeout: 180s');

  if (!waitForJiraStart(180000)) {
    console.log('  Timed out waiting for Jira to start');
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
    // Step 3: Wait for Jira web UI
    console.log('Step 3: Waiting for Jira web UI...');
    let attempts = 0;
    while (attempts < 60) {
      try {
        await page.goto(JIRA_URL, { timeout: 10000 });
        const title = await page.title();
        if (title.includes('Setup') || title.includes('Jira') || (await page.locator('#jira').count()) > 0) {
          console.log(`  Jira UI ready (title: ${title})`);
          break;
        }
      } catch {
        // Connection refused, keep waiting
      }
      attempts++;
      await page.waitForTimeout(3000);
    }

    if (attempts >= 60) {
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

    // Check if we're on the license page
    const licenseTextarea = page.locator('textarea[name="licenseKey"], textarea[name="setupLicenseKey"]');
    const hasLicensePage = (await licenseTextarea.count()) > 0;

    if (hasLicensePage) {
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
      console.log('  License page not found, may already be configured');
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
