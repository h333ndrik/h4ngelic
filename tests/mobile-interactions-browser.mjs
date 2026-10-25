import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Phase 1 only. Contact's new tap-message Easter egg deliberately stays out
// of this fixture and must wait for the user's separate approval.
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/mobile-interactions/', import.meta.url);
const requested = (process.env.H4_MOBILE_PROFILES || '390,320,reduced,desktop').split(',');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
let failure;
const deadline = setTimeout(() => void browser.close(), 180000);
const url = path => new URL(path, base).href;

async function settled(page, expected) {
  await page.waitForFunction(value => document.documentElement.dataset.mode === value
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.activeViewTransition, expected, { timeout: 15000 });
}

async function installProbe(context) {
  await context.addInitScript(() => {
    window.__mobileProbe = { modes: [], audio: [], contexts: 0, webGL: 0, touchMarks: [], pointerCancels: 0 };
    const Native = window.AudioContext || window.webkitAudioContext;
    if (Native) window.AudioContext = class extends Native {
      constructor(...args) { super(...args); window.__mobileProbe.contexts++; }
      createBufferSource() {
        const source = super.createBufferSource(), start = source.start;
        source.start = function(...args) {
          window.__mobileProbe.audio.push({ mode: document.documentElement.dataset.mode,
            duration: source.buffer?.duration, time: performance.now() });
          return start.apply(this, args);
        };
        return source;
      }
    };
    const getContext = HTMLCanvasElement.prototype.getContext, seen = new WeakSet();
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const result = getContext.call(this, type, ...args);
      if (result && /webgl/.test(type) && !seen.has(result)) { seen.add(result); window.__mobileProbe.webGL++; }
      return result;
    };
    document.addEventListener('h4:modechange', event => window.__mobileProbe.modes.push({ ...event.detail, time: performance.now() }));
    document.addEventListener('pointercancel', () => window.__mobileProbe.pointerCancels++, { passive: true });
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType !== 1 || !node.matches?.('[data-ink-mark][data-touch-ink]')) continue;
          window.__mobileProbe.touchMarks.push({
            left: parseFloat(node.style.left), top: parseFloat(node.style.top),
            clientX: Number(node.dataset.touchClientX), clientY: Number(node.dataset.touchClientY),
            scrollX: Number(node.dataset.touchScrollX), scrollY: Number(node.dataset.touchScrollY),
            lifetime: parseFloat(node.style.getPropertyValue('--ink-lifetime')),
            time: performance.now(), primary: node.style.getPropertyValue('--ink-primary').trim(),
          });
        }
      }).observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  });
}

async function controlPoint(page) {
  const control = page.locator('[data-mobile-mode]');
  await control.waitFor({ state: 'visible' });
  const bounds = await control.boundingBox();
  assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, 'The fixed h4 has an accessible touch target.');
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function tap(cdp, point) {
  // Queue a real short contact without keeping the finger down while a slow
  // software renderer acknowledges the first protocol command.
  await Promise.all([
    cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }),
    cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  ]);
}

async function taps(page, cdp, count, { feedback = false } = {}) {
  const point = await controlPoint(page);
  for (let index = 0; index < count; index++) {
    await tap(cdp, point);
    if (feedback && index < count - 1) {
      assert.equal(Number(await page.locator('[data-mobile-mode]').getAttribute('data-mobile-taps')), index + 1,
        'Each real touch, including its compatibility click, advances the sequence exactly once.');
    }
    if (index < count - 1) await page.waitForTimeout(85);
  }
}

async function pan(cdp, page, point = { x: 70, y: 650 }, steps = 12) {
  const started = await page.evaluate(() => performance.now());
  const scrollBefore = await page.evaluate(() => scrollY);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  for (let index = 1; index <= steps; index++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + index % 3 * 2, y: point.y - index * 28 }] });
    await page.waitForTimeout(42);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(80);
  return page.evaluate(({ started, scrollBefore }) => ({ duration: performance.now() - started, scroll: scrollY - scrollBefore }), { started, scrollBefore });
}

async function addBlankScrollSurface(page) {
  await page.evaluate(() => {
    const blank = document.createElement('div');
    blank.dataset.mobileInkFixture = '';
    blank.style.height = '2400px';
    blank.setAttribute('aria-label', 'Browser-only blank scroll surface');
    document.getElementById('page-content').append(blank);
    scrollTo({ top: blank.getBoundingClientRect().top + scrollY, behavior: 'instant' });
  });
  await page.waitForTimeout(100);
}

async function mobile(width, reduced = false) {
  const profile = reduced ? 'reduced' : String(width);
  const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await installProbe(context);
  const page = await context.newPage(), errors = [];
  const cdp = await context.newCDPSession(page);
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url('/work?test=1'), { waitUntil: 'networkidle' });
    await settled(page, 'normal');
    const control = page.locator('[data-mobile-mode]');
    assert.equal(await control.count(), 1);
    assert.equal(await control.evaluate(button => getComputedStyle(button).position), 'fixed');
    assert.match(await control.getAttribute('aria-label'), /4|four/i);
    assert.equal(await page.evaluate(() => window.__mobileProbe.webGL), 0);

    await taps(page, cdp, 3);
    assert.equal(Number(await control.getAttribute('data-mobile-taps')), 3);
    await page.screenshot({ path: new URL(`${profile}-progress.png`, output).pathname });
    await page.waitForTimeout(2250);
    assert.equal(Number(await control.getAttribute('data-mobile-taps')), 0, 'Incomplete sequences reset within the two-second window.');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal');
    assert.equal(await page.evaluate(() => window.__mobileProbe.audio.length), 0, 'Incomplete taps prime, but never play, transition audio.');

    // A press-drag and a long press cannot be counted as deliberate quick taps.
    const point = await controlPoint(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - 42, y: point.y - 50 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100);
    assert.equal(Number(await control.getAttribute('data-mobile-taps')), 0, 'A scrolling/swiping gesture is not a tap.');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await controlPoint(page)] });
    await page.waitForTimeout(750);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(Number(await control.getAttribute('data-mobile-taps')), 0, 'Holding the fixed h4 does not accidentally count as a quick tap.');
    assert.equal(await page.locator('[data-ink-mark]').count(), 0, 'h4 gestures never create ink.');

    await taps(page, cdp, 4, { feedback: true });
    await settled(page, 'xray');
    assert.equal(Number(await control.getAttribute('data-mobile-taps')), 0);
    assert.match(await control.getAttribute('aria-label'), /3|three/i);
    const first = await page.evaluate(() => window.__mobileProbe);
    assert.deepEqual(first.modes.map(event => event.mode), ['xray']);
    if (first.contexts) assert.deepEqual(first.audio.map(event => event.mode), ['xray']);
    assert.equal(await page.locator('[data-ink-mark]').count(), 0);
    await page.screenshot({ path: new URL(`${profile}-other.png`, output).pathname });
    await taps(page, cdp, 3, { feedback: true });
    await settled(page, 'normal');
    assert.deepEqual(await page.evaluate(() => window.__mobileProbe.modes.map(event => event.mode)), ['xray', 'normal']);

    // Two partial taps are tied to this page interaction and cannot cross a route.
    await taps(page, cdp, 2);
    await page.locator('.page-nav a[href="/about"]').tap();
    await page.waitForURL(value => value.pathname === '/about');
    await settled(page, 'normal');
    assert.equal(Number(await control.getAttribute('data-mobile-taps')), 0);
    assert.equal(await control.count(), 1);
    assert.equal(await control.isVisible(), true);
    assert.equal(await page.evaluate(() => window.__mobileProbe.webGL), 0);
    await taps(page, cdp, 4, { feedback: true });
    await settled(page, 'xray');
    await taps(page, cdp, 3, { feedback: true });
    await settled(page, 'normal');
    const repeated = await page.evaluate(() => window.__mobileProbe);
    assert.deepEqual(repeated.modes.map(event => event.mode), ['xray', 'normal', 'xray', 'normal']);
    if (repeated.contexts) {
      assert.equal(repeated.contexts, 1, 'Every route and direction shares the existing audio controller.');
      assert.deepEqual(repeated.audio.map(event => event.mode), repeated.modes.map(event => event.mode));
    }

    await page.locator('.page-nav a[href="/work"]').tap();
    await page.waitForURL(value => value.pathname === '/work');
    await settled(page, 'normal');
    await addBlankScrollSurface(page);
    const fixedBefore = await control.boundingBox();
    const motion = await pan(cdp, page);
    assert.ok(motion.scroll > 100, 'Real finger movement keeps native page scrolling.');
    await page.waitForFunction(() => document.querySelector('[data-ink-mark][data-touch-ink]'));
    const marks = await page.locator('[data-ink-mark][data-touch-ink]').evaluateAll(nodes => nodes.map(mark => ({
      tag: mark.tagName.toLowerCase(), paths: mark.querySelectorAll('path').length,
      circles: mark.querySelectorAll('circle,ellipse').length,
      lifetime: parseFloat(mark.style.getPropertyValue('--ink-lifetime')),
      primary: mark.style.getPropertyValue('--ink-primary').trim(),
      pigments: [...new Set([...mark.querySelectorAll('[data-ink-pigment]')].map(path => getComputedStyle(path).fill))],
      animation: getComputedStyle(mark).animationName,
      position: getComputedStyle(mark.closest('.ink-layer')).position,
    })));
    assert.ok(marks.length <= 12);
    for (const mark of marks) {
      assert.equal(mark.tag, 'svg');
      assert.ok(mark.paths >= 3 && mark.circles === 0, 'Touch traces retain the original irregular organic fragments.');
      assert.ok(mark.lifetime >= 6000 && mark.lifetime <= 10000);
      assert.equal(mark.position, 'absolute');
      assert.ok(['#8511ff', '#bcff16', '#ff3dbb', '#2266ff'].includes(mark.primary.toLowerCase()), 'Normal touch ink uses the requested violet/green/pink/blue palette.');
      assert.ok(mark.pigments.length >= 3);
      if (reduced) assert.equal(mark.animation, 'ink-fade', 'Reduced motion retains a gentle fade without fracture/scale.');
    }
    const actual = await page.evaluate(() => window.__mobileProbe.touchMarks);
    assert.ok(actual.length > 0 && actual.length <= Math.ceil(motion.duration / (reduced ? 320 : 180)) + 2,
      'Native movement produces occasional bounded traces, not one particle per input.');
    for (const mark of actual) {
      assert.ok([mark.clientX, mark.clientY, mark.scrollX, mark.scrollY].every(Number.isFinite));
      assert.ok(Math.abs(mark.left - mark.clientX - mark.scrollX) < 1 && Math.abs(mark.top - mark.clientY - mark.scrollY) < 1,
        'Every trace samples the actual finger coordinate plus document scroll at creation.');
    }
    const countAfterFinger = actual.length;
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.__mobileProbe.touchMarks.length), countAfterFinger, 'Inertial scroll after lifting a finger cannot fabricate new touch traces.');
    const fixedAfter = await control.boundingBox();
    assert.ok(Math.abs(fixedAfter.y - fixedBefore.y) < .6, 'The h4 remains fixed while the content and ink scroll.');
    const anchor = await page.locator('[data-ink-mark][data-touch-ink]').first().evaluate(mark => {
      const before = mark.getBoundingClientRect(), y = scrollY;
      scrollTo({ top: y + 150, behavior: 'instant' });
      const after = mark.getBoundingClientRect();
      return { documentDelta: after.top + scrollY - before.top - y, shifted: scrollY - y };
    });
    assert.ok(anchor.shifted > 100 && Math.abs(anchor.documentDelta) < .7, 'Ink belongs to the page instead of following the viewport.');
    await page.screenshot({ path: new URL(`${profile}-normal-ink.png`, output).pathname });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    await taps(page, cdp, 4);
    await settled(page, 'xray');
    await page.evaluate(() => {
      document.querySelectorAll('[data-ink-mark]').forEach(mark => mark.dispatchEvent(new Event('animationend')));
      scrollTo({ top: document.querySelector('[data-mobile-ink-fixture]').getBoundingClientRect().top + scrollY, behavior: 'instant' });
    });
    await pan(cdp, page);
    const otherMark = await page.locator('[data-ink-mark][data-touch-ink]').first().evaluate(mark => ({
      saturation: getComputedStyle(mark).filter,
      texture: Number(getComputedStyle(mark.querySelector('.ink-film')).opacity),
      channels: Number(getComputedStyle(mark.querySelector('.ink-channel')).opacity),
    }));
    assert.match(otherMark.saturation, /saturate/);
    assert.ok(otherMark.texture > .54 && otherMark.channels >= .9, 'Other Side gesture ink keeps stronger distressed material.');
    await taps(page, cdp, 3);
    await settled(page, 'normal');

    if (width === 390 && !reduced) {
      await page.waitForFunction(() => document.querySelectorAll('[data-ink-mark][data-touch-ink]').length === 0,
        null, { timeout: 11000 });
    }

    await taps(page, cdp, 1);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(Number(await control.getAttribute('data-mobile-taps')), 0);
    assert.equal(await page.locator('[data-ink-mark]').count(), 0, 'Hidden documents clear ink and sequence work.');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    if (reduced) {
      await control.focus();
      for (let index = 0; index < 4; index++) await page.keyboard.press('Enter');
      await settled(page, 'xray');
      for (let index = 0; index < 3; index++) await page.keyboard.press('Space');
      await settled(page, 'normal');
    }
    await page.locator('.brand-link').tap();
    await page.waitForURL(value => value.pathname === '/');
    await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
    assert.equal(await control.count(), 1);
    assert.equal(await control.isVisible(), true);
    assert.equal(await page.locator('[data-xray-hint-text]').textContent(), 'HOLD 4 TO SEE THE OTHER SIDE.', 'Phase 2 message has not been introduced.');
    assert.equal(await page.getByText('TAP HERE 4 TIMES.', { exact: true }).count(), 0);
    assert.equal(await page.getByText('TAP HERE 3 TIMES TO REVERSE.', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    reports.push({ profile, width, reduced, motion, marks: marks.length, sampledMarks: actual,
      repeatedModes: repeated.modes, audioStarts: repeated.audio.length, errors });
    console.log(`PASS mobile Phase 1 ${profile}: real 4/3 touch sequences, progressive feedback, cancellation, shared sound/mode controller, page-attached native-scroll ink, cleanup and route scope; Phase 2 untouched.`);
  } finally { await cdp.detach().catch(() => {}); await context.close(); }
}

async function desktop() {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await installProbe(context);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url('/work?test=1'), { waitUntil: 'networkidle' });
    await settled(page, 'normal');
    assert.equal(await page.locator('[data-mobile-mode]:visible').count(), 0, 'Desktop does not gain a mobile overlay.');
    await page.keyboard.down('4');
    await page.waitForTimeout(800);
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal');
    await page.keyboard.up('4');
    await page.keyboard.down('4');
    try { await settled(page, 'xray'); } finally { await page.keyboard.up('4'); }
    for (let index = 0; index < 3; index++) await page.keyboard.press('3');
    await settled(page, 'normal');
    assert.deepEqual(await page.evaluate(() => window.__mobileProbe.modes.map(event => event.mode)), ['xray', 'normal']);
    assert.equal(await page.evaluate(() => window.__mobileProbe.webGL), 0);
    assert.deepEqual(errors, []);
    reports.push({ profile: 'desktop', keyboardPreserved: true, errors });
    console.log('PASS mobile Phase 1 desktop preservation: mobile control hidden; one-second 4 and released 333 retained.');
  } finally { await context.close(); }
}

try {
  for (const profile of requested) {
    if (profile === 'desktop') await desktop();
    else if (profile === 'reduced') await mobile(320, true);
    else await mobile(Number(profile));
  }
} catch (error) { failure = error; }
finally {
  clearTimeout(deadline);
  await browser.close();
  await writeFile(new URL('results.json', output), JSON.stringify({ testedAt: new Date().toISOString(), base,
    passed: !failure, requested, reports, failure: failure?.stack || null }, null, 2));
}
if (failure) throw failure;
