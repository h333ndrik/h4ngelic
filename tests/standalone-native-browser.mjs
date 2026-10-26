import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const external = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
  // This managed browser blocks file:// navigation. Execute the exact exported
  // bytes in an isolated document with all network access rejected instead.
  const html = await readFile(new URL('../artifacts/h4ngelic-preview.html', import.meta.url), 'utf8');
  await page.route(/^https?:/, route => route.abort());
  await page.evaluate(() => {
    location.hash = '/work';
    window.__offlineWebGL = 0;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (/webgl/i.test(type)) window.__offlineWebGL++;
      return getContext.call(this, type, ...args);
    };
  });
  await page.setContent(html, { waitUntil: 'load' });
  await page.locator('html[data-xray-ready][data-page="work"]').waitFor();
  await page.evaluate(() => {
    window.__offlineModeEvents = [];
    window.__offlineTapTrace = [];
    document.addEventListener('h4:modechange', event => window.__offlineModeEvents.push(event.detail));
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'scroll']) document.addEventListener(type, event => {
      if (type !== 'scroll' && !event.target.closest?.('[data-mobile-mode]')) return;
      window.__offlineTapTrace.push({ type, at: performance.now(), stamp: event.timeStamp,
        mode: document.documentElement.dataset.mode,
        transition: document.documentElement.hasAttribute('data-xray-transition'),
        captured: document.documentElement.hasAttribute('data-mode-snapshot'),
        taps: document.querySelector('[data-mobile-mode]')?.dataset.mobileTaps,
        trusted: event.isTrusted, prevented: event.defaultPrevented });
    }, { capture: false, passive: true });
  });
  await page.keyboard.down('4');
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray');
  await page.keyboard.up('4');
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'));
  await page.keyboard.type('333', { delay: 100 });
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal' && !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'));
  const mobileMode = page.locator('[data-mobile-mode]');
  assert.equal(await mobileMode.isVisible(), true);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Runtime.enable');
  await cdp.send('Runtime.addBinding', { name: '__h4OfflineNativeClick' });
  await page.evaluate(() => document.addEventListener('click', event => {
    if (event.target.closest?.('[data-mobile-mode]')) window.__h4OfflineNativeClick('mobile');
  }));
  async function shortTaps(count) {
    const box = await mobileMode.boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const inputs = [];
    for (let index = 0; index < count; index++) {
      const clicked = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cdp.off('Runtime.bindingCalled', listener);
          reject(new Error('Chromium did not emit a trusted mobile click.'));
        }, 10000);
        const listener = event => {
          if (event.name !== '__h4OfflineNativeClick') return;
          clearTimeout(timer);
          cdp.off('Runtime.bindingCalled', listener);
          resolve();
        };
        cdp.on('Runtime.bindingCalled', listener);
      });
      inputs.push(cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }));
      inputs.push(cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
      // Advance after the browser has emitted the real compatibility click,
      // rather than after its expensive compositor/protocol acknowledgement.
      // Sending all contacts at once incorrectly reorders clicks after ups.
      await clicked;
    }
    await Promise.all(inputs);
  }
  try {
    await shortTaps(4);
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray' && !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'));
    await shortTaps(3);
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal' && !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'));
  } catch (error) {
    console.error(JSON.stringify(await page.evaluate(() => ({ events: window.__offlineModeEvents, trace: window.__offlineTapTrace }))));
    throw error;
  }
  await cdp.send('Runtime.removeBinding', { name: '__h4OfflineNativeClick' });
  await cdp.detach();
  const result = await page.evaluate(() => ({ events: window.__offlineModeEvents,
    touchTrace: window.__offlineTapTrace,
    viewTransitionSupported: typeof document.startViewTransition === 'function',
    retainedMaps: document.querySelectorAll('.mode-snapshot-definitions feImage[href]').length,
    webglContexts: window.__offlineWebGL,
    gray: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor, gradient: getComputedStyle(document.documentElement).backgroundImage }));
  assert.equal(result.viewTransitionSupported, true);
  assert.deepEqual(result.events.map(event => event.mode), ['xray', 'normal', 'xray', 'normal']);
  assert.ok(result.events.every(event => event.captured), 'The actual offline file must use native captured page transitions.');
  assert.equal(result.retainedMaps, 0);
  assert.equal(result.webglContexts, 0, 'Direct offline Work must not initialize a hero scene.');
  assert.equal(result.gray, 'rgb(36, 36, 36)');
  assert.equal(result.body, 'rgba(0, 0, 0, 0)');
  assert.match(result.gradient, /rgb\(40, 40, 40\).*rgb\(36, 36, 36\).*rgb\(32, 32, 32\)/);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  const clicks = result.touchTrace.filter(event => event.type === 'click');
  assert.equal(clicks.length, 7);
  assert.ok(clicks.every(event => event.trusted));
  const gestureDurationsMs = [clicks[3].stamp - clicks[0].stamp, clicks[6].stamp - clicks[4].stamp];
  const deliveryDurationsMs = [clicks[3].at - clicks[0].at, clicks[6].at - clicks[4].at];
  assert.ok(gestureDurationsMs.every(duration => duration < 2000), 'Physical gestures must fit the unchanged two-second product window.');
  const report = { checkedAt: new Date().toISOString(), method: 'Exact exported HTML bytes executed with network rejected; managed browser blocks file:// navigation.',
    htmlSHA256: createHash('sha256').update(html).digest('hex'), htmlBytes: Buffer.byteLength(html),
    browser: browser.version(), rendering: 'Chromium ANGLE SwiftShader',
    width: 390, reducedMotion: false, gestureDurationsMs, deliveryDurationsMs, ...result, runtimeErrors: errors, externalHTTP: external };
  await writeFile(new URL('../artifacts/living-offline-native-results.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
