import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { Quaternion, Vector3 } from 'three';
import { revealWeight } from '../src/reveal.js';

const yaw = (degrees) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), degrees * Math.PI / 180);
assert.ok(Math.abs(revealWeight(yaw(150)) - 1) < 1e-8, 'Artwork must be revealed at the configured angle.');
assert.ok(Math.abs(revealWeight(yaw(135)) - 0.5) < 1e-8, 'Artwork must fade smoothly near the reveal angle.');
assert.equal(revealWeight(yaw(0)), 0, 'Front-facing chrome must hide the artwork.');
assert.ok(Math.abs(revealWeight(yaw(80).multiply(yaw(70))) - 1) < 1e-8, 'Reveal must follow composed base and physical orientation.');
assert.ok(revealWeight(yaw(179), -179) > 0.98, 'Reveal must wrap smoothly across the yaw boundary.');

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const url = new URL('/?test=1', baseURL).href;
const artifacts = new URL('../artifacts/', import.meta.url);
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const magnitude = (values) => Math.hypot(...values);
const rotationAngle = (quaternion) => 2 * Math.acos(Math.min(1, Math.abs(quaternion[3])));
const snapshot = (page) => page.evaluate(() => window.__H4_TEST__.snapshot());

function collectErrors(page, { expectedWebGLFailure = false } = {}) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (expectedWebGLFailure && /^(?:THREE\.WebGLRenderer:\s*)+Error creating WebGL context\.?$/.test(text)) return;
    errors.push(text);
  });
  return errors;
}

async function ready(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__H4_TEST__?.snapshot().frameCount > 2);
}

async function grab(page) {
  // The logo may move slightly between locating the mesh and mouse-down.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const hit = await page.evaluate(() => window.__H4_TEST__.hitPoint());
    assert.ok(hit, 'The visible mesh must offer a raycast target.');
    await page.mouse.move(hit.x, hit.y);
    await page.mouse.down();
    if ((await snapshot(page)).isDragging) return hit;
    await page.mouse.up();
  }
  assert.fail('Pointer-down on the displayed wordmark must begin a drag.');
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  const desktopErrors = collectErrors(page);
  await ready(page);

  assert.match(await page.locator('body').evaluate((element) => getComputedStyle(element).cursor), /h4ngelic-cursor\.svg/);
  assert.equal(await page.locator('#reveal-control').isDisabled(), false, 'The supplied tattoo artwork must enable the reveal control.');
  const revealBefore = await page.locator('#reveal-control').getAttribute('aria-pressed');
  await page.locator('#reveal-control').click();
  assert.notEqual(await page.locator('#reveal-control').getAttribute('aria-pressed'), revealBefore, 'Reveal must toggle independently of animation.');
  await page.locator('#reveal-control').click();
  const first = await snapshot(page);
  await page.waitForTimeout(300);
  const animated = await snapshot(page);
  assert.ok(animated.frameCount > first.frameCount, 'WebGL must render frames.');
  assert.ok(animated.baseTime > first.baseTime, 'The base animation must advance.');
  for (const values of [animated.position, animated.offset, animated.orientation]) {
    assert.ok(values.every(Number.isFinite), 'Displayed transforms must remain finite.');
  }

  await page.locator('#pause-control').click();
  assert.equal(await page.locator('#pause-control').getAttribute('aria-pressed'), 'true');
  const paused = await snapshot(page);
  await page.waitForTimeout(250);
  assert.ok(Math.abs((await snapshot(page)).baseTime - paused.baseTime) < 0.001, 'Pause must stop the base clock.');
  await page.locator('#speed-control').click();
  assert.equal(await page.locator('#speed-control').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#speed-control').textContent(), 'Fast');
  await page.screenshot({ path: new URL('desktop.png', artifacts).pathname, fullPage: true });

  // Enter the canvas first, then cross a raycast-confirmed face without pressing
  // a button. This exercises the actual pointermove -> raycast -> impulse path.
  let pushed;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.mouse.move(1, 1);
    const hit = await page.evaluate(() => window.__H4_TEST__.hitPoint());
    assert.ok(hit, 'The paused wordmark must have a visible surface to push.');
    await page.mouse.move(hit.x - 28, hit.y + 6);
    await page.waitForTimeout(25);
    await page.mouse.move(hit.x, hit.y);
    pushed = await snapshot(page);
    if (magnitude(pushed.velocity) > 0.001) break;
  }
  assert.equal(pushed.isDragging, false, 'Hover pushing must not require grabbing.');
  assert.ok(magnitude(pushed.velocity) > 0.001, 'Cursor movement into the wordmark must create linear velocity.');
  assert.ok(magnitude(pushed.angularVelocity) > 0.001, 'An off-center cursor impact must create angular velocity.');
  await page.waitForTimeout(150);
  assert.ok(magnitude((await snapshot(page)).offset) > 0.001, 'An unpressed cursor impact must visibly displace the wordmark.');
  await page.mouse.move(1, 1);
  await page.waitForFunction(() => {
    const state = window.__H4_TEST__.snapshot();
    return Math.hypot(...state.offset) < 0.02 && Math.hypot(...state.velocity) < 0.02;
  }, null, { timeout: 10000 });

  const point = await grab(page);
  await page.mouse.move(point.x + 90, point.y - 40, { steps: 6 });
  await page.waitForTimeout(100);
  const dragging = await snapshot(page);
  assert.equal(dragging.isDragging, true);
  assert.ok(magnitude(dragging.offset) > 0.01, 'Dragging must displace the mesh.');
  await page.mouse.up();
  const released = await snapshot(page);
  assert.equal(released.isDragging, false);
  assert.ok(magnitude(released.velocity) > 0.001, 'Release must preserve linear momentum.');
  assert.ok(magnitude(released.angularVelocity) > 0.001, 'An off-center drag must create angular momentum.');

  await page.locator('#pause-control').click();
  const resumed = await snapshot(page);
  await page.waitForTimeout(300);
  assert.ok((await snapshot(page)).baseTime > resumed.baseTime, 'Base animation must continue independently of physical displacement.');
  await page.waitForTimeout(6200);
  const settled = await snapshot(page);
  assert.ok(magnitude(settled.offset) < 0.04, `Physics must return to its base path; offset=${magnitude(settled.offset)}.`);
  assert.ok(rotationAngle(settled.orientation) < 0.06, 'Additional rotation must settle back to the underlying rotation.');
  assert.deepEqual(desktopErrors, [], 'Desktop must not throw JavaScript errors.');
  await desktop.close();
  console.log('PASS desktop: render, original cursor, controls, cursor push, drag, release momentum, independent motion, smooth return.');

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  const mobileErrors = collectErrors(mobilePage);
  await ready(mobilePage);
  assert.doesNotMatch(await mobilePage.locator('body').evaluate((element) => getComputedStyle(element).cursor), /h4ngelic-cursor/);
  assert.equal(await mobilePage.locator('#logo-canvas').evaluate((element) => getComputedStyle(element).touchAction), 'pan-y');
  await mobilePage.locator('#pause-control').click();
  await mobilePage.screenshot({ path: new URL('mobile.png', artifacts).pathname, fullPage: true });

  // This temporary spacer supplies scrollable content without changing the app.
  await mobilePage.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.style.height = '800px';
    document.body.append(spacer);
  });
  const mobileHit = await mobilePage.evaluate(() => window.__H4_TEST__.hitPoint());
  assert.ok(mobileHit, 'Mobile wordmark must be visible and pickable.');
  const touch = await mobile.newCDPSession(mobilePage);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mobileHit.x, y: mobileHit.y }] });
  for (let step = 1; step <= 6; step += 1) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mobileHit.x, y: mobileHit.y - step * 24 }] });
    await mobilePage.waitForTimeout(30);
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobilePage.waitForTimeout(250);
  assert.ok(await mobilePage.evaluate(() => window.scrollY) > 50, 'A vertical swipe over the wordmark must scroll the page.');
  assert.equal((await snapshot(mobilePage)).isDragging, false, 'Browser scroll cancellation must release the wordmark.');
  assert.deepEqual(mobileErrors, [], 'Mobile must not throw JavaScript errors.');
  await mobile.close();
  console.log('PASS mobile: WebGL render, normal cursor, touch scroll over the logo, drag cancellation.');

  const reduced = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  const reducedErrors = collectErrors(reducedPage);
  await ready(reducedPage);
  assert.equal(await reducedPage.locator('#pause-control').getAttribute('aria-pressed'), 'true');
  const reducedStart = await snapshot(reducedPage);
  await reducedPage.waitForTimeout(300);
  assert.ok(Math.abs((await snapshot(reducedPage)).baseTime - reducedStart.baseTime) < 0.001, 'Reduced motion must default to a still logo.');
  assert.deepEqual(reducedErrors, []);
  await reduced.close();
  console.log('PASS accessibility: reduced motion defaults to paused.');

  const fallback = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const fallbackPage = await fallback.newPage();
  const fallbackErrors = collectErrors(fallbackPage, { expectedWebGLFailure: true });
  await fallbackPage.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (/^webgl/i.test(type)) return null;
      return original.call(this, type, ...args);
    };
  });
  await fallbackPage.goto(url, { waitUntil: 'networkidle' });
  await fallbackPage.locator('#stage.is-fallback').waitFor();
  assert.equal(await fallbackPage.locator('#fallback').isVisible(), true, 'WebGL failure must leave a visible static wordmark.');
  assert.equal(await fallbackPage.locator('#logo-canvas').isVisible(), false);
  assert.deepEqual(fallbackErrors, [], 'Unavailable WebGL must be handled without an uncaught exception.');
  await fallback.close();
  console.log('PASS fallback: disabled WebGL produces an accessible static wordmark.');
  console.log(`Screenshots: ${new URL('desktop.png', artifacts).pathname}, ${new URL('mobile.png', artifacts).pathname}`);
} finally {
  await browser.close();
}
