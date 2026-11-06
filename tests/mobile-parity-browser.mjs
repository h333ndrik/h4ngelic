import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// B-F32 mobile parity: a touch device gets no custom cursor and no invisible
// HOLD-4 focus target. Desktop keeps both.
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/mobile-parity/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const width of [390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      const state = await page.evaluate(() => {
        const secret = document.querySelector('.footer-secret');
        const brand = document.querySelector('.footer-brand');
        return { cursor: getComputedStyle(brand).cursor, secretDisplay: secret ? getComputedStyle(secret).display : 'absent',
          secretFocusable: secret ? secret.tabIndex >= 0 : false, secretPresent: Boolean(secret),
          space: Boolean(document.querySelector('[data-footer-secret-space]')) };
      });
      assert.equal(coarse, true, `[${width}] the emulated device reports a coarse pointer`);
      assert.equal(state.cursor, 'auto', `[${width}] a coarse pointer keeps the system cursor (${state.cursor})`);
      assert.equal(state.secretDisplay, 'none', `[${width}] the HOLD-4 hint leaves the layout`);
      assert.equal(state.space, true, `[${width}] the end-reveal space stays reachable`);
      assert.deepEqual(errors, []);
      reports.push({ width, coarse, ...state, errors });
      await page.screenshot({ path: new URL(`footer-${width}.png`, output).pathname, fullPage: false });
      console.log(`PASS mobile parity ${width}px: coarse pointer, system cursor, hold-4 hint not rendered.`);
    } finally {
      await context.close();
    }
  }
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  const wide = await page.evaluate(() => ({
    cursor: getComputedStyle(document.querySelector('.footer-brand')).cursor,
    secretDisplay: getComputedStyle(document.querySelector('.footer-secret')).display,
  }));
  assert.match(wide.cursor, /h4ngelic-cursor/, 'Desktop keeps the logo cursor');
  assert.notEqual(wide.secretDisplay, 'none', 'Desktop keeps the HOLD-4 hint');
  reports.push({ width: 1440, ...wide });
  console.log('PASS mobile parity 1440px: logo cursor and hold-4 hint unchanged.');
  await desktop.close();
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2));
  await browser.close();
}
