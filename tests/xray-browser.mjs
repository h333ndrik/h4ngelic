import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { assertNormalTheme } from './helpers/normal-theme.mjs';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const route = (path) => new URL(path, baseURL).href;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function waitMode(page, mode) {
  await page.waitForFunction((expected) => document.documentElement.hasAttribute('data-xray-ready')
    && document.documentElement.dataset.mode === expected
    && !document.documentElement.hasAttribute('data-xray-transition'), mode, { timeout: 6000 });
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
  for (const profile of [
    { label: 'desktop', viewport: { width: 1440, height: 1000 } },
    { label: '390px touch', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    { label: 'reduced motion', viewport: { width: 1000, height: 760 }, reducedMotion: 'reduce' },
  ]) {
    const { label, ...options } = profile;
    const context = await browser.newContext({ deviceScaleFactor: 1, ...options });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(route('/work'), { waitUntil: 'networkidle' });
      await normalPresentation(page);
      await page.keyboard.press('4');
      await page.keyboard.press('Numpad4');
      await page.waitForTimeout(1100);
      await normalPresentation(page);

      // Use the real public controller, including on built preview servers.
      await page.evaluate(() => {
        window.__modeChanges = [];
        document.addEventListener('h4:modechange', (event) => window.__modeChanges.push(event.detail.mode));
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

      await page.locator('.page-nav a[href="/about"]').click();
      await page.waitForURL((url) => url.pathname === '/about');
      await page.locator('.about-copy').waitFor();
      await waitMode(page, 'xray');
      assert.equal(await page.locator('#logo-canvas').isVisible(), false, 'Interior navigation stays lightweight in either reality.');
      assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0, 'Interior pages do not duplicate the relocated frontpage sound control.');
      assert.equal(await page.locator('.page-footer [data-mode-mute]').count(), 0);
      await page.locator('.brand-link').click();
      await page.waitForURL((url) => url.pathname === '/');
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
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
      assert.equal(await text.textContent(), 'PRESS 3 THREE TIMES TO REVERSE.');
      await hint.scrollIntoViewIfNeeded();
      await page.mouse.move(1, 1);
      await hint.evaluate(element => element.blur());
      await page.waitForTimeout(2700);
      const reverseStyle = await hint.evaluate(element => ({
        opacity: Number(getComputedStyle(element.querySelector('[data-secret-message]')).opacity),
        size: parseFloat(getComputedStyle(element).fontSize), color: getComputedStyle(element).color,
      }));
      assert.equal(reverseStyle.opacity, 1, 'The reverse instruction remains visible without hover after the normal secret expiry.');
      assert.equal(reverseStyle.color, 'rgb(255, 255, 255)');
      assert.ok(reverseStyle.size >= (options.hasTouch ? 18 : 20) && reverseStyle.size <= 24.1);
      await page.keyboard.down('4');
      await page.waitForTimeout(1100);
      await page.keyboard.up('4');
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'A fresh 4 hold cannot invoke the removed legacy reverse shortcut.');
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
        await reverseKeys(page);
      }
      await normalPresentation(page);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mode controls and effects cannot cause horizontal page overflow.');
      assert.deepEqual(errors, []);
      console.log(`PASS public realities (${label}): short-hold cancellation, repeat latch, keyboard/numpad entry and distinct 333 return, mode-preserving navigation, upper sound control, persistent reverse instruction${options.hasTouch ? ', real touch hold' : ''} and clean Normal restoration.`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
