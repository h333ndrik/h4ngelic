import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { creativeLandingURL } from '../src/routes.js';

// B-F28: INDEX "creative" is a real link to the same destination the rest of
// the site uses, rendered from one route constant — not a static span.
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/creative-landing/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const width of [1440, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      const hrefs = await page.evaluate(() => ({
        index: document.querySelector('[data-global-index] [data-index-page="creative"]')?.getAttribute('href') || '',
        indexTag: document.querySelector('[data-global-index] [data-index-page="creative"]')?.tagName || '',
      }));
      assert.equal(hrefs.index, creativeLandingURL, 'INDEX creative uses the route constant.');
      assert.equal(hrefs.indexTag, 'A', 'INDEX creative is a real link, not a static span.');

      await page.locator('[data-global-index] summary').click();
      await page.locator('[data-global-index] [data-index-page="creative"]').click();
      await page.waitForURL(url => url.pathname === creativeLandingURL, { timeout: 15000 });
      await page.waitForFunction(() => document.documentElement.dataset.page === 'work', null, { timeout: 15000 });
      const indexLanding = await page.evaluate(() => ({ path: location.pathname, page: document.documentElement.dataset.page }));

      assert.deepEqual(errors, []);
      reports.push({ width, hrefs, indexLanding, errors });
      await page.screenshot({ path: new URL(`landing-${width}.png`, output).pathname });
      console.log(`PASS creative landing ${width}px: INDEX "creative" reaches ${creativeLandingURL}.`);
    } catch (error) {
      await page.screenshot({ path: new URL(`failure-${width}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), creativeLandingURL, reports }, null, 2));
  await browser.close();
}
