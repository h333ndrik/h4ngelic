import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_V20_ARTIFACTS || 'artifacts/v312/V20'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const width of [1440, 390, 320]) for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference',
      isMobile: width < 600, hasTouch: width < 600 });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/about', base).href, { waitUntil: 'networkidle' });
      const heading = page.locator('.about-page .page-heading');
      const state = await heading.evaluate(element => {
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
        return { text: element.textContent, lower: element.textContent === element.textContent.toLowerCase(),
          left: rect.left, right: rect.right, fontSize: style.fontSize, opacity: Number(style.opacity), transform: style.transform };
      });
      assert.equal(state.text, '03/ about');
      assert.equal(state.lower, true);
      assert.ok(state.left >= 0 && state.right <= width + 1);
      assert.equal(state.opacity, 1); assert.equal(state.transform, 'none');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`about-${width}-${reduced}.png`, output).pathname });
      reports.push({ width, reduced, state, errors });
      console.log(`PASS V20 about heading ${width}px reduced=${reduced}: 03/ about, lower-case, visible and contained.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2));
} finally { await browser.close(); }
