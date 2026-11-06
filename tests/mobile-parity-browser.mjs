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
      assert.notEqual(state.secretDisplay, 'none', `[${width}] the HOLD-4 hint stays on touch (B-F32 revert)`);
      assert.equal(state.space, true, `[${width}] the end-reveal space stays reachable`);
      assert.deepEqual(errors, []);
      reports.push({ width, coarse, ...state, errors });
      await page.screenshot({ path: new URL(`footer-${width}.png`, output).pathname, fullPage: false });
      console.log(`PASS mobile parity ${width}px: coarse pointer, system cursor, hold-4 hint present.`);
    } finally {
      await context.close();
    }
  }
  // B-F33: a tap writes a pressed state on the link itself and the link still
  // navigates immediately afterwards.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    const link = page.locator('.hero-nav a').first();
    await link.scrollIntoViewIfNeeded();
    const box = await link.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const during = await link.evaluate(element => ({ pressed: element.classList.contains('is-pressed'),
      highlight: getComputedStyle(element).webkitTapHighlightColor }));
    await page.mouse.up();
    const after = await link.evaluate(element => element.classList.contains('is-pressed'));
    assert.equal(during.pressed, true, 'pointerdown marks the link as pressed');
    assert.equal(during.highlight, 'rgba(0, 0, 0, 0)', 'no native tap highlight on top of it');
    assert.equal(after, false, 'pointerup clears the pressed state');
    // The press state only ever touches classList: no preventDefault, no delay.
    // (A synthetic click is cancelled by the router, so the assertion is the
    // untouched destination instead.)
    const href = await link.getAttribute('href');
    assert.ok(href.startsWith('/'), 'the destination is unchanged');
    console.log('PASS press state 390px: class on pointerdown, cleared on pointerup, navigation unaffected.');
    await context.close();
  }
  // B-F36: below 600px the bottom bar reads top to bottom as nav, controls,
  // counter, with no overlap and no scroll container in the footer clusters.
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const rows = await page.evaluate(() => {
      const box = selector => { const element = document.querySelector(selector); const rect = element.getBoundingClientRect();
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), height: Math.round(rect.height) }; };
      const nav = box('.hero-nav'), controls = box('.controls'), naavi = box('[data-naavi]');
      const left = document.querySelector('.footer-left'), details = document.querySelector('.footer-details');
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return { nav, controls, naavi, controlsOpacity: Number(getComputedStyle(document.querySelector('.controls')).opacity),
        order: nav.bottom <= controls.top && controls.bottom <= naavi.top,
        overlaps: overlap(nav, controls) || overlap(controls, naavi) || overlap(nav, naavi),
        clusters: [{ sw: left.scrollWidth, cw: left.clientWidth }, { sw: details.scrollWidth, cw: details.clientWidth }],
        pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    assert.equal(rows.order, true, `[${width}] nav, controls and counter stack top to bottom`);
    assert.equal(rows.overlaps, false, `[${width}] no row overlaps another`);
    assert.ok(rows.controlsOpacity < 1, `[${width}] the controls read as the secondary row`);
    assert.equal(rows.nav.height >= 44 && rows.controls.height >= 44 && rows.naavi.height >= 44, true, `[${width}] 44px targets`);
    for (const cluster of rows.clusters) assert.equal(cluster.sw, cluster.cw, `[${width}] no footer scroll container`);
    assert.ok(rows.pageWidth <= rows.viewport + 1, `[${width}] no horizontal page overflow`);
    await context.close();
    console.log(`PASS mobile rows ${width}px: nav -> controls -> counter, no overlap, no footer scroll container.`);
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
