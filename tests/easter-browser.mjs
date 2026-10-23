import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const route = (path) => new URL(path, baseURL).href;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});

async function instrumentStorage(context, observed) {
  await context.exposeBinding('__recordEasterStorage', (_source, operation) => observed.push(operation));
  await context.addInitScript(() => {
    const record = (storage, operation) => {
      const entry = { storage, operation, path: location.pathname };
      window.__H4_EASTER_STORAGE_LOG__.push(entry);
      window.__recordEasterStorage(entry).catch(() => {});
    };
    window.__H4_EASTER_STORAGE_LOG__ = [];
    for (const name of ['localStorage', 'sessionStorage']) {
      let owner = window;
      let descriptor;
      while (owner && !descriptor) { descriptor = Object.getOwnPropertyDescriptor(owner, name); owner = Object.getPrototypeOf(owner); }
      if (!descriptor?.get) throw new Error(`Cannot instrument ${name}'s native getter.`);
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() { record(name, 'getter'); return descriptor.get.call(this); },
      });
    }
    for (const name of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
      const original = Storage.prototype[name];
      Object.defineProperty(Storage.prototype, name, {
        configurable: true, writable: true,
        value(...argumentsList) { record('Storage.prototype', name); return Reflect.apply(original, this, argumentsList); },
      });
    }
  });
}

async function ready(page, path = '/work') {
  await page.goto(route(path), { waitUntil: 'networkidle' });
  await page.locator('[data-artist-footer]').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-visit-message]')?.textContent === 'nice to meet you.');
}

async function assertFallback(page) {
  assert.equal(await page.locator('[data-visit-message]').first().textContent(), 'nice to meet you.');
  assert.equal(await page.locator('[data-visit-number]').first().textContent(), 'visit 001');
  assert.deepEqual(await page.evaluate(() => window.__H4_EASTER_STORAGE_LOG__), [], 'Tested default browsing must not call browser storage getters or methods.');
}

async function waitForNoMarks(page) {
  await page.waitForFunction(() => document.querySelectorAll('[data-ink-mark]').length === 0, null, { timeout: 4200 });
}

async function blankPoint(page) {
  const blank = page.locator('.archive-empty');
  await blank.scrollIntoViewIfNeeded();
  const box = await blank.boundingBox();
  assert.ok(box && box.width > 80 && box.height > 60, 'The actual empty archive must provide a blank, noninteractive area.');
  return { x: box.x + box.width / 2, y: Math.max(20, Math.min(box.y + 24, (await page.viewportSize()).height - 30)) };
}

async function checkInk(page, { touch }) {
  const point = await blankPoint(page);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => document.querySelectorAll('[data-ink-mark]').length === 1);
  const initial = await page.locator('[data-ink-mark]').evaluate((mark) => ({
    tag: mark.tagName.toLowerCase(), paths: mark.querySelectorAll('path').length,
    regularShapes: mark.querySelectorAll('circle, ellipse').length,
    pointerEvents: getComputedStyle(mark.closest('.ink-layer')).pointerEvents,
    opacity: Number(getComputedStyle(mark).opacity),
  }));
  assert.equal(initial.tag, 'svg');
  assert.ok(initial.paths >= 3, 'Ink should have broken pigment fragments, not a generic dot.');
  assert.equal(initial.regularShapes, 0);
  assert.equal(initial.pointerEvents, 'none');
  assert.ok(initial.opacity > .1, 'A completed blank click/tap must create a visible imprint.');
  for (let index = 0; index < 14; index++) {
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  }
  assert.equal(await page.locator('[data-ink-mark]').count(), 12, 'The effect must cap concurrent DOM marks.');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Ink near a viewport boundary must not enlarge the document.');
  await waitForNoMarks(page);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 35, point.y + 22, { steps: 3 });
  await page.mouse.up();
  assert.equal(await page.locator('[data-ink-mark]').count(), 0, 'A moved/dragged gesture must not create ink.');
  await page.evaluate(() => getSelection()?.removeAllRanges());

  // Temporary semantic controls exercise exclusions without adding any artwork
  // or changing the real archive's published content.
  await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.dataset.easterFixture = '';
    fixture.innerHTML = `<button data-fixture-button type="button">test control</button>
      <a data-fixture-link href="/about">test link</a>
      <canvas data-fixture-canvas width="160" height="80" aria-label="test interactive canvas"></canvas>
      <dialog data-fixture-dialog><p>dialog content</p><button type="button">close test dialog</button></dialog>`;
    document.querySelector('.portfolio-archive').append(fixture);
    window.__easterFixtureClicks = [];
    for (const [selector, name] of [['[data-fixture-button]', 'button'], ['[data-fixture-link]', 'link'], ['[data-fixture-canvas]', 'canvas']]) {
      fixture.querySelector(selector).addEventListener('click', (event) => { event.preventDefault(); window.__easterFixtureClicks.push(name); });
    }
    fixture.querySelector('dialog button').addEventListener('click', () => fixture.querySelector('dialog').close());
  });
  for (const selector of ['[data-fixture-button]', '[data-fixture-link]', '[data-fixture-canvas]']) await page.locator(selector).click();
  assert.deepEqual(await page.evaluate(() => window.__easterFixtureClicks), ['button', 'link', 'canvas'], 'The noninteractive effect layer must preserve control click handlers.');
  assert.equal(await page.locator('[data-ink-mark]').count(), 0, 'Controls, links and the canvas must never leave ink.');
  await page.locator('[data-fixture-dialog]').evaluate((dialog) => dialog.showModal());
  await page.locator('[data-fixture-dialog] p').click();
  assert.equal(await page.locator('[data-ink-mark]').count(), 0, 'Blank text within a modal dialog is excluded as a functional region.');
  await page.locator('[data-fixture-dialog] button').click();
  assert.equal(await page.locator('[data-ink-mark]').count(), 0);
  await page.locator('[data-easter-fixture]').evaluate((element) => element.remove());
}

async function checkTouchScroll(page, context) {
  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.dataset.easterScrollFixture = '';
    spacer.style.height = '1000px';
    document.body.append(spacer);
    scrollTo({ top: 0, behavior: 'instant' });
  });
  const point = await blankPoint(page);
  const startScroll = await page.evaluate(() => scrollY);
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
  for (let step = 1; step <= 6; step++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - step * 22 }] });
    await page.waitForTimeout(25);
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction((before) => scrollY > before + 20, startScroll);
  assert.equal(await page.locator('[data-ink-mark]').count(), 0, 'A native touch-scroll gesture must cancel the pending imprint.');
  await touch.detach();
  await page.locator('[data-easter-scroll-fixture]').evaluate((element) => element.remove());
}

async function checkHint(page, { hover }) {
  const button = page.locator('[data-xray-toggle]');
  const hint = page.locator('[data-xray-hint]');
  await button.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await button.evaluate((element) => element.blur());
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-xray-hint]')).opacity) < .01, null, { timeout: 4200 });
  if (hover) {
    await button.hover();
    await page.waitForFunction(() => {
      const opacity = Number(getComputedStyle(document.querySelector('[data-xray-hint]')).opacity);
      return opacity > .30 && opacity <= .36;
    });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-xray-hint]')).opacity) < .01, null, { timeout: 4200 });
    assert.equal(await button.evaluate((element) => element.matches(':hover')), true, 'The hint must expire while the pointer stays inside its hotspot.');
    await page.mouse.move(1, 1);
    await button.hover();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-xray-hint]')).opacity) > .30);
    await page.mouse.move(1, 1);
  }
  await page.locator('.work-filters a').last().focus();
  await page.keyboard.press('Tab');
  assert.equal(await button.evaluate((element) => element === document.activeElement), true, 'The hidden hotspot must remain part of keyboard navigation.');
  assert.equal(Number(await hint.evaluate((element) => getComputedStyle(element).opacity)), 1, 'Keyboard focus must make the instruction fully readable.');
  const focusStyle = await button.evaluate((element) => ({ visible: element.matches(':focus-visible'), outline: getComputedStyle(element).outlineStyle }));
  assert.equal(focusStyle.visible, true);
  assert.notEqual(focusStyle.outline, 'none');
  const box = await button.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, 'The discreet control must retain an accessible touch target.');
  assert.ok(box.x >= 0 && box.x + box.width <= (await page.viewportSize()).width + 1, 'The footer control must fit the viewport.');
  assert.match(await button.getAttribute('aria-label'), /toggle x-ray mode/);
}

async function checkIsolatedConsentGate(page) {
  const result = await page.evaluate(async () => {
    const { initEasterEggs } = await import('/src/easter-eggs.js');
    const { easterSettings } = await import('/src/data/easterSettings.js');
    const fixture = document.createElement('section');
    fixture.hidden = true;
    fixture.innerHTML = '<span data-visit-message></span><span data-visit-number></span>';
    document.body.append(fixture);
    const calls = [];
    let consent = false;
    let value = JSON.stringify({ count: 2, lastSeen: Date.now() - 31 * 60 * 1000 });
    const storage = {
      getItem() { calls.push('get'); return value; },
      setItem(_key, next) { calls.push('set'); value = next; },
      removeItem() { calls.push('remove'); value = null; },
    };
    const settings = { ...easterSettings, ink: { ...easterSettings.ink, enabled: false }, visits: { ...easterSettings.visits, enabled: true, writeIntervalMs: 0 } };
    const dispose = initEasterEggs(fixture, { settings, storage, hasVisitorConsent: () => consent });
    const beforeConsent = [...calls];
    consent = true;
    fixture.dispatchEvent(new CustomEvent('h4:privacychange'));
    const authorized = { calls: [...calls], message: fixture.querySelector('[data-visit-message]').textContent, record: JSON.parse(value) };
    fixture.dispatchEvent(new CustomEvent('h4:privacychange'));
    const duplicateConsent = [...calls];
    // The read/write gate must also notice withdrawal without relying on an
    // integration event. This isolated fixture uses a fake store, never disk.
    consent = false;
    fixture.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    const withdrawn = { calls: [...calls], value, message: fixture.querySelector('[data-visit-message]').textContent };
    dispose();
    fixture.remove();
    return { beforeConsent, authorized, duplicateConsent, withdrawn };
  });
  assert.deepEqual(result.beforeConsent, [], 'Even an enabled feature must not touch its supplied store before consent.');
  assert.deepEqual(result.authorized.calls, ['get', 'set']);
  assert.equal(result.authorized.message, "twice wasn't enough?");
  assert.equal(result.authorized.record.count, 3, 'A consented visit after separated inactivity should advance the count.');
  assert.deepEqual(result.duplicateConsent, ['get', 'set'], 'Repeated integration events must not create visits or unnecessary writes.');
  assert.deepEqual(result.withdrawn.calls, ['get', 'set', 'remove']);
  assert.equal(result.withdrawn.value, null);
  assert.equal(result.withdrawn.message, 'nice to meet you.');
}

try {
  for (const width of [1440, 390, 320]) {
    const touch = width <= 600;
    const context = await browser.newContext({
      viewport: { width, height: touch ? 844 : 1000 },
      hasTouch: touch,
      isMobile: touch,
      reducedMotion: width === 320 ? 'reduce' : 'no-preference',
    });
    const storageCalls = [];
    await instrumentStorage(context, storageCalls);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await ready(page);
    await assertFallback(page);
    await checkInk(page, { touch });
    if (touch) await checkTouchScroll(page, context);
    await checkHint(page, { hover: !touch });
    if (!touch) await checkIsolatedConsentGate(page);
    await assertFallback(page);
    await page.locator('.page-nav a[href="/about"]').click();
    await page.waitForURL(route('/about'));
    await assertFallback(page);
    await page.reload({ waitUntil: 'networkidle' });
    await assertFallback(page);
    await page.goBack({ waitUntil: 'networkidle' });
    await page.locator('.work-page').waitFor();
    await assertFallback(page);
    assert.deepEqual(errors, [], 'The tested Phase C flow must not throw browser errors.');
    assert.deepEqual(storageCalls, [], 'No browser storage getter/method access should be observed across tested navigation and reloads.');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Footer and effects must not overflow at ${width}px.`);
    console.log(`PASS easter eggs ${width}px: organic bounded ink/cleanup, functional control exclusions, ${touch ? 'native touch-scroll cancellation, ' : 'timed hidden hover discovery, isolated consent gating, '}keyboard/touch target, stable fallback visit copy and zero observed browser storage API access.`);
    await context.close();
  }
} finally {
  await browser.close();
}
