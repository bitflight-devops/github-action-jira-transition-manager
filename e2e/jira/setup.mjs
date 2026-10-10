import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { baseUrl, request } from './jira.mjs';

// Public 10-user, 3-hour Jira Software Data Center HOST license, published by Atlassian:
// https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/
// This is deliberately not a Marketplace app license or a generated license.
export async function setup(artifactDirectory) {
  const license = (await readFile(new URL('./license.txt', import.meta.url), 'utf8')).replace(/\s/g, '');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const visible = async (selector) => page.locator(selector).first().isVisible();
  const fill = async (selector, value) => {
    if (await visible(selector)) await page.locator(selector).first().fill(value);
  };
  const advance = async () => {
    await page
      .locator(
        'button:has-text("Next"):visible, button:has-text("Continue"):visible, button:has-text("Finish"):visible, input[type="submit"]:visible',
      )
      .first()
      .click({ timeout: 120_000 });
    await delay(1500);
  };
  let licenseSubmitted = false;
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const deadline = Date.now() + 900_000;
    while (Date.now() < deadline) {
      console.log(`Jira setup: ${page.url()} | ${await page.title()}`);
      if (await visible('textarea[name="licenseKey"]')) {
        if (licenseSubmitted) {
          const errors = await page.locator('.error, .errorMessage, .aui-message-error').allTextContents();
          if (errors.some((error) => error.trim()))
            throw new Error(`Atlassian rejected the published test license: ${errors.join('; ')}`);
          await delay(5000);
          continue;
        }
        await fill('textarea[name="licenseKey"]', license);
        licenseSubmitted = true;
        await advance();
      } else if (await visible('input[name="title"]')) {
        await fill('input[name="title"]', 'Jira integration E2E');
        await fill('input[name="baseURL"], input[name="baseUrl"]', baseUrl);
        await advance();
      } else if (await visible('input[name="noemail"]')) {
        await page.locator('input[name="noemail"]').first().check();
        await advance();
      } else if (await visible('input[name="password"]')) {
        await fill('input[name="username"]', 'admin');
        await fill('input[name="password"]', 'admin');
        await fill('input[name="confirm"]', 'admin');
        await fill('input[name="fullname"]', 'E2E Administrator');
        await fill('input[name="email"]', 'admin@example.invalid');
        await advance();
      } else if (await visible('#jira-setupwizard')) {
        // Older Jira setup landing page offers custom setup rather than an evaluation database.
        const custom = page.getByLabel(/set it up myself|custom setup/i).first();
        if (await custom.isVisible()) await custom.check();
        await advance();
      } else {
        try {
          const user = await request('/rest/api/2/myself');
          if (user.name === 'admin') {
            console.log('Jira setup complete; administrator authentication verified');
            return;
          }
        } catch {
          /* The product may be restarting its plugin system after licensing. */
        }
        await delay(5000);
        if (/Setup|initializ|initialis|loading/i.test(await page.title())) continue;
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      }
    }
    throw new Error('Setup wizard did not reach authenticated readiness within 15 minutes');
  } catch (error) {
    await page.screenshot({ path: path.join(artifactDirectory, 'setup-failure.png'), fullPage: true }).catch(() => {});
    await writeFile(path.join(artifactDirectory, 'setup-failure.html'), await page.content());
    console.error((await page.locator('body').innerText()).slice(0, 5000));
    throw error;
  } finally {
    await browser.close();
  }
}
