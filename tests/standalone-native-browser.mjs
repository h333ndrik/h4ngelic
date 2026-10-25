import assert from 'node:assert/strict';
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
    document.addEventListener('h4:modechange', event => window.__offlineModeEvents.push(event.detail));
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
  async function shortTaps(count) {
    const box = await mobileMode.boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    for (let index = 0; index < count; index++) {
      await Promise.all([
        cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }),
        cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
      ]);
      if (index < count - 1) await page.waitForTimeout(65);
    }
  }
  await shortTaps(4);
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray' && !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'));
  await shortTaps(3);
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal' && !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'));
  await cdp.detach();
  const result = await page.evaluate(() => ({ events: window.__offlineModeEvents,
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
  const report = { checkedAt: new Date().toISOString(), method: 'Exact exported HTML bytes executed with network rejected; managed browser blocks file:// navigation.', width: 390, reducedMotion: false, ...result, runtimeErrors: errors, externalHTTP: external };
  await writeFile(new URL('../artifacts/living-offline-native-results.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
