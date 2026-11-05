import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { assertNormalTheme } from './helpers/normal-theme.mjs';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const route = (path) => new URL(path, baseURL).href;
const output = new URL(`../${process.env.H4_XRAY_ARTIFACTS || 'artifacts/v311/F15/xray'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const reports = [], failures = [];
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function waitMode(page, mode) {
  await page.waitForFunction((expected) => document.documentElement.hasAttribute('data-xray-ready')
    && document.documentElement.dataset.mode === expected
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot'), mode, { timeout: 15000 });
}

async function normalPresentation(page) {
  await waitMode(page, 'normal');
  // Lite devices skip the SVG/RAF treatment while the inexpensive CSS color
  // transition still finishes. Verify the visible restored state, not only
  // the controller's completed flag.
  await assertNormalTheme(page);
  const media = await page.locator('#logo-canvas,.project-image img,.about-portrait img').evaluateAll((items) => items.map((item) => getComputedStyle(item).filter));
  assert.ok(media.every((filter) => filter === 'none'), 'Normal Mode restores clean media without negative-image filters.');
  if (await page.locator('[data-xray-hint-text]').count()) assert.equal(await page.locator('[data-xray-hint-text]').textContent(), 'HOLD 4 TO SEE THE OTHER SIDE.');
}

async function reverseKeys(page, key = '3') {
  for (let index = 0; index < 3; index++) await page.keyboard.press(key);
  await waitMode(page, 'normal');
}

try {
  for (const profile of [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({
    label: `${width}px ${reduced ? 'reduced' : 'full'}`,
    viewport: { width, height: width < 600 ? 844 : 1000 },
    isMobile: width < 600, hasTouch: width < 600,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })))) {
    const { label, ...options } = profile;
    const context = await browser.newContext({ deviceScaleFactor: 1, ...options });
    const page = await context.newPage();
    const errors = [];
    try {
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(route('/work'), { waitUntil: 'networkidle' });
      await normalPresentation(page);
      await page.keyboard.press('4');
      await page.keyboard.press('Numpad4');
      await page.waitForTimeout(1100);
      await normalPresentation(page);

      // Use the real public controller, including on built preview servers.
      await page.evaluate(() => {
        window.__modeChanges = []; window.__modePreparations = []; window.__modeTransitions = [];
        document.addEventListener('h4:modechange', (event) => window.__modeChanges.push(event.detail.mode));
        document.addEventListener('h4:modeprepare', event => window.__modePreparations.push(event.detail.source));
        document.addEventListener('h4:transitionintent', event => { if (event.detail.kind === 'mode') window.__modeTransitions.push({ mode: event.detail.mode, duration: event.detail.duration }); });
      });
      await page.keyboard.down('4');
      const shortHold = await page.evaluate(async () => {
        await new Promise((resolve) => setTimeout(resolve, 850));
        return document.documentElement.dataset.mode;
      });
      assert.equal(shortHold, 'normal', 'An 850ms hold must not change realities.');
      await page.keyboard.up('4');
      await page.waitForTimeout(250);
      assert.deepEqual(await page.evaluate(() => window.__modeChanges), [], 'Release before one second cancels the pending transition.');

      await page.keyboard.down('4');
      await waitMode(page, 'xray');
      await page.keyboard.down('4');
      await page.waitForTimeout(1100);
      assert.deepEqual(await page.evaluate(() => window.__modeChanges), ['xray'], 'A continuous hold and native repeats toggle exactly once.');
      await page.keyboard.up('4');

      const beforeIgnored = await page.evaluate(() => ({ changes: window.__modeChanges.length, preparations: window.__modePreparations.length }));
      await page.keyboard.down('4'); await page.waitForTimeout(1250); await page.keyboard.up('4');
      const ignored = await page.evaluate(() => ({ changes: window.__modeChanges.length, preparations: window.__modePreparations.length,
        mode: document.documentElement.dataset.mode, holding: document.documentElement.hasAttribute('data-mode-holding'),
        transition: document.documentElement.hasAttribute('data-xray-transition'), snapshot: document.documentElement.hasAttribute('data-mode-snapshot'),
        preparing: document.documentElement.hasAttribute('data-memory-mosh-preparing') }));
      assert.deepEqual({ changes: ignored.changes, preparations: ignored.preparations }, beforeIgnored,
        'A fresh full 4 hold on The Other Side must not prepare or start any transition.');
      assert.equal(ignored.mode, 'xray'); assert.equal(ignored.holding, false); assert.equal(ignored.transition, false); assert.equal(ignored.snapshot, false); assert.equal(ignored.preparing, false);
      await page.keyboard.down('4'); await page.waitForTimeout(250);
      await page.keyboard.press('3'); await page.keyboard.press('3');
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'Two quick presses do not reverse.');
      await page.keyboard.press('3'); await waitMode(page, 'normal');
      await page.waitForTimeout(1100);
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', 'Triple-3 returns while an ignored 4 remains held, without leaking a new entry.');
      await page.keyboard.up('4');
      await page.keyboard.down('4');
      try { await waitMode(page, 'xray'); } finally { await page.keyboard.up('4'); }

      await page.locator('[data-global-index] summary').click();
      await page.locator('[data-index-page="about"]').click();
      await page.waitForURL((url) => url.pathname === '/about');
      await page.locator('.about-copy').waitFor();
      await waitMode(page, 'xray');
      assert.equal(await page.locator('#logo-canvas').isVisible(), false, 'Interior navigation stays lightweight in either reality.');
      assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0, 'Interior pages do not duplicate the relocated frontpage sound control.');
      assert.equal(await page.locator('.page-footer [data-mode-mute]').count(), 0);
      await page.locator('[data-floating-brand]').click();
      await page.waitForURL((url) => url.pathname === '/');
      await page.locator(options.reducedMotion === 'reduce' ? '#stage.is-poster-static' : '#stage.is-ready').waitFor({ timeout: 60000 });
      await waitMode(page, 'xray');
      const mute = page.locator('[data-controls] [data-mode-mute]');
      assert.equal(await mute.count(), 1, 'The sound control belongs to the upper wordmark controls.');
      assert.equal(await mute.isVisible(), true);
      if (await mute.isEnabled()) {
        await mute.click();
        assert.equal(await mute.getAttribute('aria-pressed'), 'true', 'The visible upper control exposes the muted state.');
      }
      const hint = page.locator('[data-other-side-hint][data-mode-hold]');
      const text = page.locator('[data-xray-hint-text]');
      assert.equal(await text.textContent(), 'press 3 times 3 to reverse');
      await hint.scrollIntoViewIfNeeded();
      await page.mouse.move(1, 1);
      await hint.evaluate(element => element.blur());
      await page.waitForTimeout(3400);
      const reverseStyle = await hint.evaluate(element => ({
        opacity: Number(getComputedStyle(element.querySelector('[data-secret-message]')).opacity),
        size: parseFloat(getComputedStyle(element).fontSize), color: getComputedStyle(element).color,
      }));
      assert.equal(reverseStyle.opacity, 0, 'The reverse instruction is also hidden after its discovery timer expires.');
      assert.equal(reverseStyle.color, 'rgb(255, 255, 255)');
      assert.ok(reverseStyle.size >= 15 && reverseStyle.size <= 24.1,
        'Retain the V6 responsive instruction, including its compact 15px size.');
      await hint.hover();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-secret-message][data-xray-hint]')).opacity) >= .34);
      assert.ok(await hint.evaluate(element => Number(getComputedStyle(element.querySelector('[data-secret-message]')).opacity)) <= .43, 'The revealed hint remains faint.');
      const beforePointerHold = await page.evaluate(() => ({ changes: window.__modeChanges.length, preparations: window.__modePreparations.length }));
      const hintBox = await hint.boundingBox();
      if (options.hasTouch) {
        const pointer = await context.newCDPSession(page);
        try {
          await pointer.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hintBox.x + hintBox.width / 2, y: hintBox.y + hintBox.height / 2 }] });
          await page.waitForTimeout(1250);
          await pointer.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await pointer.detach(); }
      } else {
        await page.mouse.move(hintBox.x + hintBox.width / 2, hintBox.y + hintBox.height / 2);
        await page.mouse.down(); await page.waitForTimeout(1250); await page.mouse.up();
      }
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'A footer hold is entry-only and cannot bypass triple-3 return.');
      assert.deepEqual(await page.evaluate(() => ({ changes: window.__modeChanges.length, preparations: window.__modePreparations.length })), beforePointerHold);
      await reverseKeys(page);
      await normalPresentation(page);
      await page.keyboard.down('4');
      try { await waitMode(page, 'xray'); } finally { await page.keyboard.up('4'); }
      const placement = await page.locator('[data-footer-secret-space]').evaluate((space) => {
        const area = space.getBoundingClientRect();
        const control = space.querySelector('[data-other-side-hint]').getBoundingClientRect();
        return { height: area.height, expectedHeight: Math.max(440, Math.min(innerHeight * .82, 960)), x: control.x + control.width / 2, width: innerWidth, y: (control.y + control.height / 2 - area.y) / area.height };
      });
      assert.ok(Math.abs(placement.height - placement.expectedHeight) < 1, 'The final h4 reveal retains its spacious, responsive end section.');
      assert.ok(Math.abs(placement.x - placement.width / 2) < 1 && placement.y > .25 && placement.y < .5, 'The instruction is centered horizontally and slightly above the middle.');
      const position = await hint.boundingBox();

      await reverseKeys(page, 'Numpad3');
      await normalPresentation(page);
      const restoredPosition = await hint.boundingBox();
      assert.ok(Math.abs(position.x + position.width / 2 - restoredPosition.x - restoredPosition.width / 2) < 1 && Math.abs(position.y + position.height / 2 - restoredPosition.y - restoredPosition.height / 2) < 1, 'Both instruction variants retain the same center even when their typography wraps.');

      if (options.hasTouch) {
        await hint.scrollIntoViewIfNeeded();
        await hint.tap();
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', 'A short mobile tap reveals the instruction without switching mode.');
        const box = await hint.boundingBox();
        const touch = await context.newCDPSession(page);
        try {
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
          await waitMode(page, 'xray');
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await touch.detach(); }
        const mobileReturn = page.locator('[data-mobile-mode]');
        await mobileReturn.tap(); await mobileReturn.tap();
        assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'Two h4 taps cannot return on touch.');
        await mobileReturn.tap(); await waitMode(page, 'normal');
      }
      await normalPresentation(page);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mode controls and effects cannot cause horizontal page overflow.');
      assert.deepEqual(errors, []);
      const modeTransitions = await page.evaluate(() => window.__modeTransitions);
      assert.ok(modeTransitions.every(event => event.duration === 900), 'Captured mode transitions use the approved 900ms duration.');
      if (options.reducedMotion === 'no-preference' && await page.evaluate(() => typeof document.startViewTransition === 'function')) {
        assert.ok(modeTransitions.length >= 2, 'Normal-motion native captures were exercised in both directions.');
      }
      reports.push({ label, width: options.viewport.width, reducedMotion: options.reducedMotion, ignored,
        modes: await page.evaluate(() => window.__modeChanges), modeTransitions, touchThreeTapReturn: options.hasTouch, errors });
      await save();
      console.log(`PASS F15 public realities (${label}): one-second entry, ignored reverse 4/hold without preparation, exact triple-3, recorded900ms captured transition metadata, INDEX/route continuity${options.hasTouch ? ', native touch three-tap return' : ''}, clean restoration and no errors/overflow.`);
    } catch (error) {
      failures.push({ label, error: error.stack, errors });
      await page.screenshot({ path: new URL(`failure-${label.replaceAll(' ', '-')}.png`, output).pathname }).catch(() => {});
      await save(); throw error;
    } finally { await context.close(); }
  }
} finally { await save(); await browser.close(); }
