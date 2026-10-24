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
  if (path === '/') await page.locator('[data-visitor-hotspot]').waitFor();
}

async function assertFallback(page) {
  if (await page.locator('[data-visit-message]').count()) assert.equal(await page.locator('[data-visit-message]').first().textContent(), 'nice to meet you.');
  assert.equal(await page.locator('[data-visit-number]').count(), 0);
  assert.equal(await page.locator('.page-footer [data-visit-message]').count(), 0);
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
    color: getComputedStyle(mark).color,
    fill: getComputedStyle(mark.querySelector('path')).fill,
  }));
  assert.equal(initial.tag, 'svg');
  assert.ok(initial.paths >= 3, 'Ink should have broken pigment fragments, not a generic dot.');
  assert.equal(initial.regularShapes, 0);
  assert.equal(initial.pointerEvents, 'none');
  assert.equal(initial.fill, initial.color, 'Pigment paths must use their configured off-white ink color.');
  assert.ok(initial.opacity > .1, 'A completed blank click/tap must create a visible imprint.');
  for (let index = 0; index < 14; index++) {
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  }
  assert.equal(await page.locator('[data-ink-mark]').count(), 12, 'The effect must cap concurrent DOM marks.');
  const silhouettes = await page.locator('[data-ink-mark] path:first-child').evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
  assert.equal(new Set(silhouettes).size, silhouettes.length, 'Every actual click must create new contour geometry, not rotate a stored silhouette.');
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

async function revealCycle(page, button, { touch }) {
  const message = button.locator('[data-secret-message]');
  await page.mouse.move(1, 1);
  await button.evaluate((element) => element.blur());
  await page.waitForFunction((element) => Number(getComputedStyle(element).opacity) < .01, await message.elementHandle(), { timeout: 4200 });
  if (touch) await button.tap(); else await button.hover();
  await page.waitForFunction((element) => {
    const opacity = Number(getComputedStyle(element).opacity);
    return opacity > .28 && opacity <= .31;
  }, await message.elementHandle());
  await page.waitForFunction((element) => Number(getComputedStyle(element).opacity) < .01, await message.elementHandle(), { timeout: 4200 });
  if (!touch) assert.equal(await button.evaluate((element) => element.matches(':hover')), true, 'Secrets expire even while the pointer stays inside.');
  await page.mouse.move(1, 1);
  if (touch) await button.tap(); else await button.hover();
  await page.waitForFunction((element) => Number(getComputedStyle(element).opacity) > .28, await message.elementHandle());
  await page.mouse.move(1, 1);
}

async function checkHeaderAndFutureHint(page, { touch }) {
  await page.locator('.brand-link').click();
  await page.waitForFunction(() => document.documentElement.dataset.page === 'home');
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
  const button = page.locator('[data-visitor-hotspot]');
  const message = button.locator('[data-visit-message]');
  const labels = await page.locator('.masthead h1, .masthead .edition').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  const box = await button.boundingBox();
  const width = (await page.viewportSize()).width;
  const originalInset = width <= 600 ? 22 : 35;
  assert.ok(Math.abs(labels[0].x - originalInset) < .6, 'The left header label keeps its original viewport inset.');
  assert.ok(Math.abs(labels[1].x + labels[1].width - (width - originalInset)) < .6, 'The right header label keeps its original viewport inset.');
  assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < .6, 'Visitor target is centered against the viewport independently of label lengths.');
  const copy = await message.boundingBox();
  assert.ok(Math.abs(copy.x + copy.width / 2 - width / 2) < .6, 'Visitor copy itself remains exactly centered.');
  assert.ok(box.width >= 44 && box.height >= 44, 'Secret target remains usable by touch.');
  assert.equal(Number(await message.evaluate((element) => getComputedStyle(element).opacity)), 0);
  if (touch) {
    assert.ok(copy.y >= labels[0].y + labels[0].height, 'Mobile visitor copy uses its own visual row, without covering the original labels.');
    assert.ok(copy.y + copy.height < (await page.locator('.controls').boundingBox()).y, 'Visitor copy must not collide with the hero controls.');
  }
  await revealCycle(page, button, { touch });
  assert.deepEqual(await page.locator('.masthead h1, .masthead .edition').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  })), labels, 'Revealing a secret must not shift original header labels.');
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Tab');
  assert.equal(await button.evaluate((element) => element === document.activeElement), true);
  assert.equal(Number(await message.evaluate((element) => getComputedStyle(element).opacity)), 1, 'Keyboard focus keeps the secret legible.');
  await button.evaluate((element) => element.blur());
  const space = page.locator('[data-footer-secret-space]');
  const proportion = await space.evaluate((element) => element.getBoundingClientRect().height / innerHeight);
  assert.ok(proportion >= .29 && proportion <= .31, 'Homepage reserves approximately30vh for the quiet secret area.');
  assert.equal(await page.locator('[data-other-side-hint], [data-xray-toggle]').count(), 0, 'A postponed shortcut must not be publicly advertised.');

  // Enable only the reusable hint markup in this browser fixture. The actual
  // public mode flag remains false, so a touch reveals copy without a theme.
  await page.evaluate(async () => {
    const { renderFooter } = await import('/src/footer.js');
    const template = document.createElement('template');
    template.innerHTML = renderFooter({ home: true, otherSideEnabled: true });
    document.querySelector('[data-footer-secret-space]').replaceWith(template.content.querySelector('[data-footer-secret-space]'));
  });
  const futureHint = page.locator('[data-other-side-hint]');
  await futureHint.scrollIntoViewIfNeeded();
  assert.equal((await futureHint.textContent()).trim(), 'press 4 for the other side.');
  await revealCycle(page, futureHint, { touch });
  assert.notEqual(await page.locator('html').getAttribute('data-mode'), 'xray', 'Discovering a hint never activates the postponed mode.');
  await page.keyboard.press('Tab');
  await futureHint.focus();
  assert.equal(Number(await futureHint.locator('[data-secret-message]').evaluate((element) => getComputedStyle(element).opacity)), 1);
  assert.equal(await futureHint.evaluate((element) => element.matches(':focus-visible')), true);
  const hintBox = await futureHint.boundingBox();
  assert.ok(hintBox.width >= 44 && hintBox.height >= 44);
  assert.ok(Math.abs(hintBox.x + hintBox.width / 2 - (await page.viewportSize()).width / 2) < .6);
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
    if (!touch) await checkIsolatedConsentGate(page);
    await checkHeaderAndFutureHint(page, { touch });
    await assertFallback(page);
    await page.evaluate(() => document.querySelector('.hero-nav a[href="/about"]').click());
    await page.waitForURL(route('/about'));
    await assertFallback(page);
    await page.reload({ waitUntil: 'networkidle' });
    await assertFallback(page);
    await page.evaluate(() => document.querySelector('.page-nav a[href="/work"]').click());
    await page.locator('.work-page').waitFor();
    await assertFallback(page);
    assert.deepEqual(errors, [], 'The tested refinement flow must not throw browser errors.');
    assert.deepEqual(storageCalls, [], 'No browser storage getter/method access should be observed across tested navigation and reloads.');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Footer and effects must not overflow at ${width}px.`);
    console.log(`PASS hidden messages/ink ${width}px: exact header center, untouched labels, timed hover/tap rediscovery, gated future footer hint, unique procedural contours, cleanup/exclusions and zero default storage access.`);
    await context.close();
  }
} finally {
  await browser.close();
}
