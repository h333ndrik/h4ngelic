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
  // B-F37: the "m" shortcut toggles the same state as the button, and stays
  // silent while typing or with a modifier held.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    const button = page.locator('[data-mode-mute]').first();
    await button.waitFor();
    const label = async () => ({ pressed: await button.getAttribute('aria-pressed'), text: (await button.textContent()).trim() });
    const before = await label();
    await page.keyboard.press('m');
    await page.waitForFunction(previous => document.querySelector('[data-mode-mute]')?.getAttribute('aria-pressed') !== previous,
      before.pressed, { timeout: 5000 });
    const afterKey = await label();
    assert.notEqual(afterKey.pressed, before.pressed, 'm toggles the mute state');
    assert.equal(afterKey.text, afterKey.pressed === 'true' ? 'sound on' : 'sound off', 'label follows the state');
    await page.keyboard.press('m');
    await page.waitForFunction(previous => document.querySelector('[data-mode-mute]')?.getAttribute('aria-pressed') === previous,
      before.pressed, { timeout: 5000 });
    assert.deepEqual(await label(), before, 'a second m returns to the start');
    const field = page.locator('[data-inquiry-form] input[name="name"]').first();
    await field.scrollIntoViewIfNeeded();
    await field.click();
    await page.keyboard.type('mmmail');
    await page.waitForTimeout(200);
    assert.equal(await field.inputValue(), 'mmmail', 'typing m stays in the field');
    assert.deepEqual(await label(), before, 'typing never mutes the page');
    await page.keyboard.press('Meta+m');
    await page.waitForTimeout(200);
    assert.deepEqual(await label(), before, 'a modifier keeps m for the browser');
    await context.close();
    console.log('PASS mute shortcut 1440px: m toggles, fields and modifiers are guarded.');
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
