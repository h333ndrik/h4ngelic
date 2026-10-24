import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Keep the existing command as a regression guard for the latest approved
// decision: the alternate mode and its public tease are deliberately postponed.
const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const deferredResource = (value) => {
  const path = new URL(value).pathname;
  return /\/(?:src\/|assets\/)(?:wordmark-xray|xray)(?:\.|-)/.test(path)
    || /\/assets\/xray-distress\./.test(path);
};

async function normalPresentation(page) {
  const state = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    ready: document.documentElement.hasAttribute('data-xray-ready'),
    background: getComputedStyle(document.documentElement).backgroundColor,
    overlays: document.querySelectorAll('.xray-distress,[data-xray-filters]').length,
    hint: document.querySelectorAll('[data-other-side-hint],[data-xray-toggle]').length,
    mediaFilters: [...document.querySelectorAll('#logo-canvas,.project-image img,.about-portrait img')].map((image) => getComputedStyle(image).filter),
  }));
  assert.notEqual(state.mode, 'xray', 'The postponed mode must not become public.');
  assert.equal(state.ready, false, 'No alternate-mode controller may initialize.');
  assert.equal(state.background, 'rgb(48, 48, 51)', 'The approved uninterrupted charcoal palette must remain in use.');
  assert.equal(state.overlays, 0, 'No distressed overlay or image-processing definitions may initialize.');
  assert.equal(state.hint, 0, 'The disabled public hint must not advertise an unavailable shortcut.');
  assert.ok(state.mediaFilters.every((filter) => filter === 'none'), 'Normal media must have no alternate color treatment.');
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
      const requests = [];
      const errors = [];
      page.on('request', (request) => requests.push(request.url()));
      page.on('pageerror', (error) => errors.push(error.message));
      for (const path of ['/work', '/about', '/']) {
        await page.goto(new URL(path === '/' ? '/?test=1' : path, baseURL).href, { waitUntil: 'networkidle' });
        if (path === '/') await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
        await normalPresentation(page);
        await page.keyboard.press('4');
        await page.keyboard.press('Numpad4');
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await normalPresentation(page);
        if (path === '/') {
          const gap = await page.locator('[data-footer-secret-space]').boundingBox();
          assert.ok(gap.height >= options.viewport.height * .25 && gap.height <= options.viewport.height * .35 + 2, 'The reserved hidden-footer area remains spacious without publishing the postponed hint.');
          if (await page.evaluate(() => Boolean(window.__H4_TEST__))) {
            assert.equal(await page.evaluate(() => window.__H4_TEST__.snapshot().xrayAmount), 0, 'The dormant shader must not modify the original chrome.');
          }
        }
      }
      assert.deepEqual(requests.filter(deferredResource), [], 'The deferred controller, color shader and texture must not download.');
      assert.deepEqual(errors, []);
      console.log(`PASS postponed the other side (${label}): Normal palette, inert 4/numpad, no public tease, no controller/shader/texture requests and reserved footer space.`);
    } finally { await context.close(); }
  }

  // Exercise the postponed controller only after every real browsing profile
  // has proved that the public flag never downloads or initializes it.
  const controllerSource = await fetch(new URL('/src/xray.js', baseURL)).catch(() => null);
  const fixtureAvailable = controllerSource?.ok && /^(?:text|application)\/(?:javascript|ecmascript)(?:;|$)/i.test(controllerSource.headers.get('content-type') || '');
  if (fixtureAvailable) await verifyDormantControllerFixture();
  else console.log('SKIP dev-only dormant controller fixture on built server');
} finally { await browser.close(); }

async function verifyDormantControllerFixture() {
  const fixture = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  try {
    const page = await fixture.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(new URL('/work', baseURL).href, { waitUntil: 'networkidle' });
    await normalPresentation(page);
    await page.evaluate(async () => {
      const { initXRay } = await import('/src/xray.js');
      window.__xrayFixtureChanges = [];
      let pressedAt = 0;
      const down = (event) => { if (event.key === '4' && !event.repeat) pressedAt = performance.now(); };
      const change = (event) => window.__xrayFixtureChanges.push({ mode: event.detail.mode, heldFor: performance.now() - pressedAt });
      document.addEventListener('keydown', down, true);
      document.addEventListener('h4:modechange', change);
      window.__xrayFixtureDispose = initXRay();
      window.__xrayFixtureCleanup = () => {
        window.__xrayFixtureDispose();
        document.removeEventListener('keydown', down, true);
        document.removeEventListener('h4:modechange', change);
      };
    });
    const changes = () => page.evaluate(() => window.__xrayFixtureChanges);
    await page.keyboard.down('4');
    const shortHold = await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 850));
      return document.documentElement.dataset.mode;
    });
    assert.equal(shortHold, 'normal', 'An 850ms hold must not activate the postponed mode.');
    await page.keyboard.up('4');
    await page.waitForTimeout(250);
    assert.deepEqual(await changes(), [], 'Releasing before one second cancels activation.');

    await page.keyboard.down('4');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray', null, { timeout: 2500 });
    assert.deepEqual((await changes()).map((entry) => entry.mode), ['xray']);
    assert.ok((await changes())[0].heldFor >= 1000, 'A real keyboard hold activates only after one full second.');
    await page.keyboard.down('4'); // A second down while held is native key repeat.
    await page.waitForTimeout(1100);
    assert.deepEqual((await changes()).map((entry) => entry.mode), ['xray'], 'A held or repeated key toggles exactly once.');
    await page.keyboard.up('4');
    await page.keyboard.down('4');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'normal', null, { timeout: 2500 });
    assert.deepEqual((await changes()).map((entry) => entry.mode), ['xray', 'normal'], 'Release followed by a new full hold returns to Normal.');
    assert.ok((await changes())[1].heldFor >= 1000);
    await page.keyboard.up('4');

    await page.keyboard.down('4');
    await page.waitForTimeout(400);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(850);
    assert.equal((await changes()).length, 2, 'Losing window focus cancels the pending hold.');
    await page.keyboard.up('4');

    await page.keyboard.down('4');
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__xrayFixtureDispose());
    await page.waitForTimeout(850);
    assert.equal((await changes()).length, 2, 'Disposal cancels a pending hold.');
    await page.keyboard.up('4');
    await normalPresentation(page);
    await page.keyboard.down('4');
    await page.waitForTimeout(1100);
    await page.keyboard.up('4');
    assert.equal((await changes()).length, 2, 'A disposed controller leaves no keyboard shortcut listener.');
    await normalPresentation(page);
    await page.evaluate(() => window.__xrayFixtureCleanup());
    assert.deepEqual(errors, []);
    console.log('PASS isolated dormant controller: 850ms/release cancellation, one-second real key hold, repeat latch, release/new hold, blur cancellation and disposal cleanup; public feature flag unchanged.');
  } finally { await fixture.close(); }
}
