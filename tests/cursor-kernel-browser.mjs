import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55200';
const output = new URL('../docs/validation/CURSOR-KERN/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const report = { build: '', initial: null, jumps: [], pressed: null, hidden: {}, touch: null, passed: false };
try {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.build);
  report.build = await page.locator('html').getAttribute('data-build');
  report.initial = await page.locator('[data-h4-cursor]').evaluate(element => ({
    opacity: getComputedStyle(element).opacity,
    visibility: getComputedStyle(element).visibility,
    visible: element.dataset.h4CursorVisible || 'unset',
    transform: getComputedStyle(element).transform,
    transitionProperty: getComputedStyle(element).transitionProperty,
    transitionDuration: getComputedStyle(element).transitionDuration,
  }));
  assert.equal(report.initial.opacity, '0', 'The overlay never flashes at 0,0 before the first pointer sample.');
  assert.equal(report.initial.visibility, 'hidden');
  assert.doesNotMatch(report.initial.transitionProperty, /transform/);
  for (let index = 0; index < 20; index += 1) {
    const x = 120 + (index % 10) * 80;
    const y = 160 + Math.floor(index / 10) * 80;
    await page.mouse.move(x, y);
    const sample = await page.evaluate(({ x, y }) => new Promise(resolve => requestAnimationFrame(() => {
      const cursor = document.querySelector('[data-h4-cursor]');
      const box = cursor.getBoundingClientRect();
      const style = getComputedStyle(cursor);
      resolve({ x, y, dx: box.left + 9 - x, dy: box.top + 2 - y,
        opacity: style.opacity, visibility: style.visibility,
        transitionProperty: style.transitionProperty, visible: cursor.dataset.h4CursorVisible });
    })), { x, y });
    report.jumps.push(sample);
    assert.equal(sample.visible, 'true');
    assert.equal(sample.opacity, '1');
    assert.ok(Math.abs(sample.dx) <= .25 && Math.abs(sample.dy) <= .25, `Jump ${index} must be 0px at the first animation frame.`);
  }
  assert.equal(report.jumps.length, 20);
  await page.screenshot({ path: new URL('tracking-1440.png', output).pathname });

  await page.mouse.move(640, 420);
  await page.mouse.down();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor] .h4-cursor-glyph')).scale) >= 1.079, null, { timeout: 1000 });
  report.pressed = await page.locator('[data-h4-cursor]').evaluate(element => {
    const style = getComputedStyle(element), glyph = getComputedStyle(element.querySelector('.h4-cursor-glyph')), box = element.getBoundingClientRect();
    return { scale: Number(glyph.scale), transform: style.transform, origin: glyph.transformOrigin,
      transition: glyph.transition, pressed: element.classList.contains('is-pressed'), box: box.toJSON(),
      hotspot: { x: box.left + 9, y: box.top + 2 }, pointer: { x: 640, y: 420 } };
  });
  assert.equal(report.pressed.pressed, true);
  assert.ok(Math.abs(report.pressed.scale - 1.08) < .0001, `Pressed token must scale the logo to 108%: ${report.pressed.scale}`);
  assert.equal(report.pressed.origin, '9px 2px', 'The pressed scale keeps the hotspot fixed.');
  assert.match(report.pressed.transition, /scale 0\.1s/);
  assert.ok(Math.abs(report.pressed.hotspot.x - report.pressed.pointer.x) <= .25 && Math.abs(report.pressed.hotspot.y - report.pressed.pointer.y) <= .25,
    'Pressing must not shift the hotspot away from the pointer.');
  await page.screenshot({ path: new URL('pressed-1440.png', output).pathname });
  await page.mouse.up();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor] .h4-cursor-glyph')).scale) <= 1.001, null, { timeout: 1000 });
  assert.equal(Number(await page.locator('[data-h4-cursor] .h4-cursor-glyph').evaluate(element => getComputedStyle(element).scale)), 1);

  await page.mouse.move(810, 460);
  await page.waitForFunction(() => document.querySelector('[data-h4-cursor]')?.dataset.h4CursorVisible === 'true');
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, composed: true,
    pointerType: 'mouse', relatedTarget: null, clientX: -1, clientY: -1 })));
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity) <= .001, null, { timeout: 1000 });
  report.hidden.pointerout = await page.locator('[data-h4-cursor]').evaluate(element => ({
    opacity: Number(getComputedStyle(element).opacity), visibility: getComputedStyle(element).visibility,
    visible: element.dataset.h4CursorVisible }));
  assert.equal(report.hidden.pointerout.visible, 'false');
  assert.equal(report.hidden.pointerout.opacity, 0);
  assert.equal(report.hidden.pointerout.visibility, 'hidden');

  await page.evaluate(() => Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false }));
  await page.mouse.move(822, 472);
  await page.waitForFunction(() => document.querySelector('[data-h4-cursor]')?.dataset.h4CursorVisible === 'true');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity) <= .001, null, { timeout: 1600 });
  report.hidden.idleFallback = await page.locator('[data-h4-cursor]').evaluate(element => ({
    opacity: Number(getComputedStyle(element).opacity), visibility: getComputedStyle(element).visibility,
    visible: element.dataset.h4CursorVisible }));
  assert.equal(report.hidden.idleFallback.visible, 'false');
  assert.equal(report.hidden.idleFallback.opacity, 0);
  await page.evaluate(() => Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => true }));

  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerleave', { relatedTarget: null })));
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity) <= .001, null, { timeout: 1000 });
  report.hidden.leave = await page.locator('[data-h4-cursor]').evaluate(element => ({
    opacity: Number(getComputedStyle(element).opacity), visibility: getComputedStyle(element).visibility,
    visible: element.dataset.h4CursorVisible }));
  assert.equal(report.hidden.leave.visible, 'false');
  assert.equal(report.hidden.leave.opacity, 0);
  assert.equal(report.hidden.leave.visibility, 'hidden');

  await page.mouse.move(913, 517);
  await page.waitForFunction(() => document.querySelector('[data-h4-cursor]')?.dataset.h4CursorVisible === 'true');
  report.hidden.reveal = await page.evaluate(() => {
    const cursor = document.querySelector('[data-h4-cursor]'), box = cursor.getBoundingClientRect(), style = getComputedStyle(cursor);
    return { dx: box.left + 9 - 913, dy: box.top + 2 - 517, opacity: Number(style.opacity), visibility: style.visibility };
  });
  assert.ok(Math.abs(report.hidden.reveal.dx) <= .25 && Math.abs(report.hidden.reveal.dy) <= .25);
  assert.equal(report.hidden.reveal.opacity, 1);
  assert.equal(report.hidden.reveal.visibility, 'visible');

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity) <= .001, null, { timeout: 1000 });
  report.hidden.blur = await page.locator('[data-h4-cursor]').evaluate(element => ({ opacity: Number(getComputedStyle(element).opacity),
    visibility: getComputedStyle(element).visibility, visible: element.dataset.h4CursorVisible }));
  assert.equal(report.hidden.blur.visible, 'false');
  assert.equal(report.hidden.blur.opacity, 0);

  await page.mouse.move(744, 333);
  await page.waitForFunction(() => document.querySelector('[data-h4-cursor]')?.dataset.h4CursorVisible === 'true');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-h4-cursor]')).opacity) <= .001, null, { timeout: 1000 });
  report.hidden.visibility = await page.locator('[data-h4-cursor]').evaluate(element => ({ opacity: Number(getComputedStyle(element).opacity),
    visibility: getComputedStyle(element).visibility, visible: element.dataset.h4CursorVisible }));
  assert.equal(report.hidden.visibility.visible, 'false');
  assert.equal(report.hidden.visibility.visibility, 'hidden');

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchPage = await touch.newPage();
  await touchPage.goto(`${base}/`, { waitUntil: 'networkidle' });
  report.touch = await touchPage.locator('[data-h4-cursor]').evaluate(element => ({ display: getComputedStyle(element).display,
    opacity: Number(getComputedStyle(element).opacity) }));
  assert.equal(report.touch.display, 'none', 'Touch profiles never render the desktop overlay.');
  await touch.close();

  report.passed = true;
  console.log(`PASS cursor kernel ${report.build}: 20/20 zero-px jumps, 108% hotspot press, pointerout/idle/leave/blur/visibility hide, immediate repositioned reveal, touch off.`);
} finally {
  await writeFile(new URL('A1-tracking.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
