import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('../docs/validation/GATEPREP/BATCH-2.5/gallery/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), build: '', profiles: [], failures: [] };

const state = () => {
  const element = document.querySelector('[data-returning-visitor]');
  const style = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  return { text: element.textContent, hidden: element.hidden, display: style.display,
    opacity: Number(style.opacity), visibility: style.visibility, color: style.color,
    box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, height: box.height } };
};

try {
  for (const width of [1440, 390, 320]) {
    const height = width === 1440 ? 900 : 844;
    const touch = width < 600;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
      isMobile: touch, hasTouch: touch, reducedMotion: 'no-preference' });
    // Fresh origin: no returning-visitor memory, exactly like a preview domain.
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
      report.build ||= await page.locator('html').getAttribute('data-build');

      const rest = await page.evaluate(state);
      assert.equal(rest.hidden, false, 'The greeting node must stay revealable for a first visit.');
      assert.notEqual(rest.display, 'none', 'No hidden attribute may remove the node from layout.');
      assert.equal(rest.box.height, 44, 'The header row keeps its 44px height.');

      // Read the ghost value only after its 200ms opacity transition settled.
      const settledOpacity = async () => {
        let previous = null;
        for (let attempt = 0; attempt < 40; attempt++) {
          const value = await page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-returning-visitor]')).opacity));
          if (previous !== null && Math.abs(value - previous) < .0005) return value;
          previous = value;
          await page.waitForTimeout(50);
        }
        return previous;
      };

      if (touch) {
        const touchState = await page.evaluate(state);
        assert.equal(touchState.opacity, .35, 'Touch devices show the ghost greeting permanently.');
        assert.equal(touchState.visibility, 'visible');
        await page.screenshot({ path: new URL(`greeting-touch-${width}.png`, output).pathname,
          clip: { x: 0, y: 0, width, height: 120 } });
        report.profiles.push({ width, rest: touchState, touch: true, errors, passed: true });
        console.log(`PASS greeting ${width}px touch: ${touchState.text} visible at 35%.`);
      } else {
        assert.equal(rest.opacity, 0, 'Rest state stays invisible on desktop.');
        assert.equal(rest.visibility, 'hidden');
        await page.mouse.move(width / 2, 20);
        await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-returning-visitor]')).opacity) >= .34, null, { timeout: 2000 });
        await settledOpacity();
        const hover = await page.evaluate(state);
        assert.equal(hover.opacity, .35, 'Header hover reveals the ghost greeting.');
        assert.equal(hover.visibility, 'visible');
        assert.equal(hover.color, 'rgb(240, 239, 235)');
        await page.screenshot({ path: new URL(`greeting-hover-${width}.png`, output).pathname,
          clip: { x: 0, y: 0, width, height: 120 } });

        await page.mouse.move(width / 2, 420);
        await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-returning-visitor]')).opacity) <= .001, null, { timeout: 2000 });
        await page.locator('[data-floating-brand]').focus();
        await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-returning-visitor]')).opacity) >= .51, null, { timeout: 2000 });
        await settledOpacity();
        const focus = await page.evaluate(state);
        assert.equal(focus.opacity, .52, 'Keyboard focus reveals a slightly clearer greeting.');
        assert.equal(focus.visibility, 'visible');
        await page.screenshot({ path: new URL(`greeting-focus-${width}.png`, output).pathname,
          clip: { x: 0, y: 0, width, height: 120 } });

        const geometry = await page.evaluate(() => {
          const line = document.querySelector('[data-returning-visitor]').getBoundingClientRect();
          const brand = document.querySelector('[data-floating-brand]').getBoundingClientRect();
          const index = document.querySelector('[data-global-index] > summary').getBoundingClientRect();
          return { line: { left: line.left, right: line.right, top: line.top, bottom: line.bottom },
            brand: { right: brand.right, top: brand.top, bottom: brand.bottom, height: brand.height },
            index: { left: index.left, top: index.top, bottom: index.bottom, height: index.height } };
        });
        assert.ok(geometry.line.left >= geometry.brand.right - .5 && geometry.line.right <= geometry.index.left + .5,
          `Greeting never overlaps branding or INDEX: ${JSON.stringify(geometry)}`);
        assert.ok(Math.abs(geometry.line.top - Math.min(geometry.brand.top, geometry.index.top)) < 1,
          'Greeting shares the header row top.');
        assert.deepEqual(errors, []);
        report.profiles.push({ width, rest, hover, focus, geometry, touch: false, errors, passed: true });
        console.log(`PASS greeting ${width}px: ${rest.text} rest hidden, hover 35%, focus 52%, no overlap.`);
      }
    } catch (error) {
      report.failures.push({ width, error: error.stack, errors });
      await page.screenshot({ path: new URL(`failure-greeting-${width}.png`, output).pathname }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally {
  await writeFile(new URL('greeting.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
