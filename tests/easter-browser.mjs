import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { easterSettings, visitorMessage } from '../src/data/easterSettings.js';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const route = (path) => new URL(path, baseURL).href;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});

async function ready(page, path = '/work') {
  await page.goto(route(path), { waitUntil: 'networkidle' });
  await page.locator('[data-artist-footer]').waitFor();
  if (path === '/') await page.locator('[data-visitor-hotspot]').waitFor();
}

async function assertLocalVisit(page, count = 1) {
  const record = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), easterSettings.visits.storageKey);
  assert.deepEqual(Object.keys(record).sort(), ['count', 'lastSeen'], 'Local memory contains a counter and activity time, without an identifier.');
  assert.equal(record.count, count);
  assert.ok(Number.isFinite(record.lastSeen));
  if (await page.locator('[data-visit-message]').count()) assert.equal(await page.locator('[data-visit-message]').first().textContent(), visitorMessage(count));
  if (await page.locator('[data-visit-number]').count()) assert.equal(await page.locator('[data-visit-number]').textContent(), `VISIT ${String(count).padStart(3, '0')}`);
  assert.equal(await page.locator('.page-footer [data-visit-message]').count(), 0, 'The returning message stays on the frontpage header.');
}

async function waitForNoMarks(page) {
  await page.waitForFunction(() => document.querySelectorAll('[data-ink-mark]').length === 0, null, { timeout: 13200 });
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
    pigments: [...new Set([...mark.querySelectorAll('[data-ink-pigment]')].map(path => getComputedStyle(path).fill))],
    filmImages: mark.querySelectorAll('image[data-ink-film]').length,
    lifetime: Number.parseFloat(mark.style.getPropertyValue('--ink-lifetime')),
    positioning: getComputedStyle(mark.closest('.ink-layer')).position,
  }));
  assert.equal(initial.tag, 'svg');
  assert.ok(initial.paths >= 3, 'Ink should have broken pigment fragments, not a generic dot.');
  assert.equal(initial.regularShapes, 0);
  assert.equal(initial.pointerEvents, 'none');
  assert.ok(initial.pigments.length >= 3, 'Both realities use multiple visible chemical colors, not monochrome ink.');
  assert.ok(initial.filmImages >= 4 && initial.filmImages <= 7, 'Actual film pixels are clipped into the contour and displaced bands.');
  assert.ok(initial.opacity > .1, 'A completed blank click/tap must create a visible imprint.');
  assert.ok(initial.lifetime >= 6000 && initial.lifetime <= 12000, 'Each mark lasts within the requested six-to-twelve-second interval.');
  assert.equal(initial.positioning, 'absolute');
  const anchored = await page.locator('[data-ink-mark]').evaluate((mark) => {
    const before = mark.getBoundingClientRect();
    const originalScroll = scrollY;
    const originalStyle = { left: mark.style.left, top: mark.style.top };
    const spacer = document.createElement('div');
    spacer.style.height = '1000px';
    document.body.append(spacer);
    scrollTo({ top: originalScroll + 150, behavior: 'instant' });
    const after = mark.getBoundingClientRect();
    const shifted = scrollY - originalScroll;
    const result = {
      shifted,
      documentBefore: before.y + before.height / 2 + originalScroll,
      documentAfter: after.y + after.height / 2 + scrollY,
      viewportDelta: after.y + after.height / 2 - before.y - before.height / 2,
      sameStyle: mark.style.left === originalStyle.left && mark.style.top === originalStyle.top,
    };
    scrollTo({ top: originalScroll, behavior: 'instant' });
    spacer.remove();
    return result;
  });
  assert.ok(anchored.shifted > 100);
  assert.ok(Math.abs(anchored.documentAfter - anchored.documentBefore) < .6, 'The imprint remains anchored to its original document position.');
  assert.ok(Math.abs(anchored.viewportDelta + anchored.shifted) < .6, 'Ink moves naturally with document scrolling instead of sticking to the viewport.');
  assert.equal(anchored.sameStyle, true);

  for (let index = 0; index < 14; index++) {
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  }
  assert.equal(await page.locator('[data-ink-mark]').count(), 12, 'The effect must cap concurrent DOM marks.');
  const silhouettes = await page.locator('[data-ink-mark] > [data-ink-pigment="base"]').evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
  assert.equal(silhouettes.length, 12, 'Each active mark has exactly one visible base contour; repeated clip/channel paths are not separate marks.');
  assert.equal(new Set(silhouettes).size, silhouettes.length, 'Every actual click must create new contour geometry, not rotate a stored silhouette.');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Ink near a viewport boundary must not enlarge the document.');
  await page.waitForTimeout(5000);
  assert.ok(await page.locator('[data-ink-mark]').count() > 0, 'Ink must remain present beyond the former short lifetime.');
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
    return opacity > .33 && opacity <= .36;
  }, await message.elementHandle());
  await page.waitForFunction((element) => Number(getComputedStyle(element).opacity) < .01, await message.elementHandle(), { timeout: 4200 });
  if (!touch) assert.equal(await button.evaluate((element) => element.matches(':hover')), true, 'Secrets expire even while the pointer stays inside.');
  await page.mouse.move(1, 1);
  if (touch) await button.tap(); else await button.hover();
  await page.waitForFunction((element) => Number(getComputedStyle(element).opacity) > .33, await message.elementHandle());
  await page.mouse.move(1, 1);
}

async function checkHeaderAndFooterSecrets(page, { touch }) {
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
  assert.equal(await message.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)), touch ? 14 : 16, 'The returning message is deliberately larger while preserving its location.');
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
  const hint = page.locator('[data-other-side-hint]');
  await hint.scrollIntoViewIfNeeded();
  assert.equal((await hint.textContent()).trim(), 'HOLD 4 TO SEE THE OTHER SIDE.');
  await revealCycle(page, hint, { touch });
  assert.notEqual(await page.locator('html').getAttribute('data-mode'), 'xray', 'Discovering the hint through hover or a short tap does not activate the mode.');
  await page.keyboard.press('Tab');
  await hint.focus();
  assert.equal(Number(await hint.locator('[data-secret-message]').evaluate((element) => getComputedStyle(element).opacity)), 1);
  assert.equal(await hint.evaluate((element) => element.matches(':focus-visible')), true);
  await hint.evaluate((element) => element.blur());
  const hintBox = await hint.boundingBox();
  const hintDocumentY = hintBox.y + await page.evaluate(() => scrollY);
  const spaceBox = await space.boundingBox();
  assert.ok(hintBox.width >= 44 && hintBox.height >= 44);
  assert.ok(Math.abs(hintBox.x + hintBox.width / 2 - width / 2) < .6);
  assert.ok(Math.abs((hintBox.y + hintBox.height / 2 - spaceBox.y) / spaceBox.height - .4) < .01, 'Instruction sits somewhat above the midpoint of the reserved area.');
  const counter = page.locator('[data-visit-counter-hotspot]');
  await counter.scrollIntoViewIfNeeded();
  assert.equal((await counter.textContent()).trim(), 'VISIT 001');
  await revealCycle(page, counter, { touch });
  const counterBox = await counter.boundingBox();
  assert.ok(Math.abs(counterBox.x + counterBox.width / 2 - width / 2) < .6);
  assert.ok(counterBox.y + await page.evaluate(() => scrollY) > hintDocumentY + hintBox.height + 30, 'Visit count and mode instruction remain spatially separated.');
  const row = await counter.evaluate(element => {
    const identity = element.closest('.footer-identity');
    const bounds = identity.getBoundingClientRect();
    const count = element.getBoundingClientRect();
    const left = identity.querySelector('.footer-brand').getBoundingClientRect();
    const right = identity.querySelector('.footer-location').getBoundingClientRect();
    return { parentIsIdentity: element.parentElement === identity,
      centerError: Math.abs(count.x + count.width / 2 - bounds.x - bounds.width / 2),
      leftGap: count.left - left.right, rightGap: right.left - count.right,
      verticalError: Math.max(Math.abs(count.y + count.height / 2 - left.y - left.height / 2), Math.abs(count.y + count.height / 2 - right.y - right.height / 2)) };
  });
  assert.equal(row.parentIsIdentity, true, 'The visit counter shares the copyright/location identity row.');
  assert.ok(row.centerError < .6 && row.verticalError < .6 && row.leftGap >= 0 && row.rightGap >= 0, 'The count is independently centered and aligned without colliding with either label.');
  const footer = await page.locator('[data-artist-footer]').boundingBox();
  assert.ok(footer.y + footer.height - (counterBox.y + counterBox.height) >= 12, 'The bottom count has an intentional small bottom inset.');
  assert.equal(await page.locator('.masthead [data-visit-number]').count(), 0);
  assert.equal(await page.locator('[data-controls] [data-mode-mute]').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.page-footer [data-mode-mute]').count(), 0, 'The footer cannot retain a duplicate sound control.');

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
    const settings = { ...easterSettings, ink: { ...easterSettings.ink, enabled: false }, visits: { ...easterSettings.visits, enabled: true, requireConsent: true, writeIntervalMs: 0 } };
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

async function checkIsolatedStorageFallbacks(page) {
  const result = await page.evaluate(async () => {
    const { initEasterEggs } = await import('/src/easter-eggs.js');
    const { easterSettings } = await import('/src/data/easterSettings.js');
    const fixture = document.createElement('section');
    fixture.hidden = true;
    fixture.innerHTML = '<span data-visit-message></span><span data-visit-number></span>';
    document.body.append(fixture);
    const base = { ...easterSettings, ink: { ...easterSettings.ink, enabled: false } };
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    let getterCalls = 0;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { getterCalls++; throw new DOMException('Storage unavailable', 'SecurityError'); },
    });
    const disabled = initEasterEggs(fixture, { settings: { ...base, visits: { ...base.visits, enabled: false } } });
    const disabledCalls = getterCalls;
    disabled();
    const denied = initEasterEggs(fixture, { settings: base });
    const deniedResult = { calls: getterCalls, message: fixture.querySelector('[data-visit-message]').textContent };
    denied();
    if (original) Object.defineProperty(window, 'localStorage', original); else delete window.localStorage;

    let repaired = null;
    const malformed = initEasterEggs(fixture, {
      settings: base,
      storage: { getItem: () => '{not valid JSON', setItem: (_key, value) => { repaired = JSON.parse(value); } },
    });
    const repairedResult = { record: repaired, message: fixture.querySelector('[data-visit-message]').textContent };
    malformed();
    let failedWrites = 0;
    const unwritable = initEasterEggs(fixture, {
      settings: base,
      storage: { getItem: () => null, setItem: () => { failedWrites++; throw new DOMException('Full', 'QuotaExceededError'); } },
    });
    fixture.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    const unwritableResult = { failedWrites, message: fixture.querySelector('[data-visit-message]').textContent };
    unwritable();
    fixture.remove();
    return { disabledCalls, deniedResult, repairedResult, unwritableResult };
  });
  assert.equal(result.disabledCalls, 0, 'An explicit opt-out does not access the browser storage getter.');
  assert.deepEqual(result.deniedResult, { calls: 1, message: 'nice to meet you.' });
  assert.equal(result.repairedResult.record.count, 1, 'Malformed storage resets to a usable first visit.');
  assert.deepEqual(Object.keys(result.repairedResult.record).sort(), ['count', 'lastSeen']);
  assert.equal(result.repairedResult.message, 'nice to meet you.');
  assert.deepEqual(result.unwritableResult, { failedWrites: 1, message: 'nice to meet you.' }, 'Unavailable storage falls back without repeated writes on interaction.');
}

async function checkSeparatedReturn() {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 760 }, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{
      name: easterSettings.visits.storageKey,
      value: JSON.stringify({ count: 4, lastSeen: Date.now() - 31 * 60 * 1000 }),
    }] }] },
  });
  try {
    const page = await context.newPage();
    await ready(page, '/');
    await assertLocalVisit(page, 5);
    await page.reload({ waitUntil: 'networkidle' });
    await assertLocalVisit(page, 5);
    await page.evaluate(() => document.querySelector('.hero-nav a[href="/work"]').click());
    await page.locator('.work-page').waitFor();
    await assertLocalVisit(page, 5);
  } finally { await context.close(); }
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
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await ready(page);
    await assertLocalVisit(page);
    await checkInk(page, { touch });
    if (touch) await checkTouchScroll(page, context);
    if (!touch) {
      await checkIsolatedConsentGate(page);
      await checkIsolatedStorageFallbacks(page);
    }
    await checkHeaderAndFooterSecrets(page, { touch });
    await assertLocalVisit(page);
    await page.evaluate(() => document.querySelector('.hero-nav a[href="/about"]').click());
    await page.waitForURL(route('/about'));
    await assertLocalVisit(page);
    await page.reload({ waitUntil: 'networkidle' });
    await assertLocalVisit(page);
    await page.evaluate(() => document.querySelector('.page-nav a[href="/work"]').click());
    await page.locator('.work-page').waitFor();
    await assertLocalVisit(page);
    if (!touch) await checkSeparatedReturn();
    assert.deepEqual(errors, [], 'The tested refinement flow must not throw browser errors.');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Footer and effects must not overflow at ${width}px.`);
    console.log(`PASS hidden messages/ink ${width}px: exact header center, untouched labels, timed hover/tap rediscovery, mode hint and independently centered identity-row count, document-anchored procedural blots, cleanup/exclusions and local visit continuity.`);
    await context.close();
  }
} finally {
  await browser.close();
}
