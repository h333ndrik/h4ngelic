import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { findCursorOffenders, cursorOf } from './helpers/cursor-contract.mjs';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_HERO_BOOT_ARTIFACTS || 'artifacts/v312/r3'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const heroModule = /\/src\/main\.js(?:\?|$)|\/assets\/main-[^/]+\.js(?:\?|$)/;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const save = () => writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, reports, failures }, null, 2) + '\n');

function seededContext(width, { touch = false, reduced = false } = {}) {
  return browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
    isMobile: touch, hasTouch: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
}

async function seedPage(context) {
  await context.addInitScript(() => {
    localStorage.setItem('h4ngelic.visits.v1', JSON.stringify({ count: 5, lastSeen: Date.now() }));
    localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 }));
    window.__h4HeroReady = false;
    document.addEventListener('h4:heroready', () => {
      window.__h4HeroReady = true;
      const stage = document.querySelector('#stage'), canvas = document.querySelector('#logo-canvas');
      const style = canvas ? getComputedStyle(canvas) : null;
      const matrix = style ? new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform) : null;
      window.__h4Entrance = { entering: Boolean(stage?.classList.contains('is-entering')),
        opacity: Number(style?.opacity || 0), transform: style?.transform || 'none', translateY: matrix?.m42 ?? 0,
        height: canvas?.getBoundingClientRect().height || 0,
        transitionProperty: style?.transitionProperty || 'none', transitionDuration: style?.transitionDuration || '0s',
        at: performance.now() };
    });
  });
}

async function bootState(page) {
  return page.evaluate(() => {
    const poster = document.querySelector('[data-hero-poster]');
    const stage = document.querySelector('#stage');
    const canvas = document.querySelector('#logo-canvas');
    const style = poster ? getComputedStyle(poster) : null;
    const canvasStyle = canvas ? getComputedStyle(canvas) : null;
    return { loading: document.documentElement.dataset.heroLoading, stage: stage?.className || '',
      build: document.documentElement.dataset.build || '', metaBuild: document.querySelector('meta[name="h4-build"]')?.content || '',
      status: document.querySelector('#scene-status')?.textContent || '',
      posterOpacity: Number(style?.opacity || 0), posterDisplay: style?.display || 'none',
      posterBackground: style?.backgroundImage || 'none', animation: style?.animationName || 'none', canvasDisplay: canvasStyle?.display || 'none',
      canvasOpacity: Number(canvasStyle?.opacity || 0), canvasAnimation: canvasStyle?.animationName || 'none',
      entering: Boolean(stage?.classList.contains('is-entering')),
      cursorClass: document.documentElement.classList.contains('h4-custom-cursor'),
      overlayNodes: document.querySelectorAll('[data-h4-cursor]').length,
      bodyCursor: getComputedStyle(document.body).cursor,
      entrance: window.__h4Entrance || null, heroReady: Boolean(window.__h4HeroReady), scrollY };
  });
}

async function returningLineState(page) {
  return page.locator('[data-returning-visitor]').evaluate(element => {
    const style = getComputedStyle(element), box = element.getBoundingClientRect();
    return { hidden: element.hidden, opacity: Number(style.opacity), visibility: style.visibility,
      text: element.textContent, width: box.width, height: box.height };
  });
}

async function scrollSection(page, selector) {
  await page.locator(selector).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await frames(page);
  await page.waitForFunction(target => document.querySelector(target)?.dataset.motionState === 'settled', selector, { timeout: 5000 });
}

async function slashReport(page, width) {
  const canonical = await page.evaluate(() => {
    const heading = document.querySelector('#selected-work-title .kinetic-heading-text');
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    let node, offset = -1;
    while ((node = walker.nextNode())) {
      const index = node.textContent.indexOf('/');
      if (index >= 0) { offset = index; break; }
    }
    const range = document.createRange();
    range.setStart(node, offset); range.setEnd(node, offset + 1);
    const transform = getComputedStyle(heading).transform;
    const translation = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
    return { slash: range.getBoundingClientRect().left - translation,
      token: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slash-inset')) };
  });
  await scrollSection(page, '#selected-work');
  const works = await page.locator('.category-link .category-magnet span').first().evaluate(element => element.getBoundingClientRect().left);
  await scrollSection(page, '#about-preview');
  const about = await page.locator('.about-preview-copy').evaluate(element => element.getBoundingClientRect().left);
  const more = await page.locator('#about-preview .text-link').evaluate(element => element.getBoundingClientRect().left);
  await scrollSection(page, '#contact');
  const contact = await page.evaluate(() => ({
    intro: document.querySelector('.inquiry-intro').getBoundingClientRect().left,
    form: document.querySelector('.inquiry-form').getBoundingClientRect().left,
    pageWidth: document.documentElement.scrollWidth, innerWidth,
  }));
  const values = { works, about, more, intro: contact.intro, form: contact.form };
  const offsets = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value - canonical.slash]));
  for (const [key, offset] of Object.entries(offsets)) assert.ok(Math.abs(offset) <= 2, `${key} starts on the slash column at ${width}px: offset ${offset}`);
  assert.ok(contact.pageWidth <= contact.innerWidth + 1, `The ${width}px homepage has no horizontal page overflow.`);
  return { canonical, values, offsets, pageWidth: contact.pageWidth, innerWidth: contact.innerWidth };
}

async function wheelContract(page, width) {
  await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"]')?.classList.contains('is-drift-enhanced'));
  const carousel = page.locator('[data-horizontal-drift="tattoos"]');
  await carousel.scrollIntoViewIfNeeded(); await frames(page);
  const viewport = carousel.locator('.drift-viewport');
  const box = await viewport.boundingBox();
  const before = await page.evaluate(() => ({ scrollY, position: Number(document.querySelector('[data-horizontal-drift="tattoos"]').dataset.driftPosition) }));
  await page.mouse.move(box.x + Math.min(box.width * .6, box.width - 20), box.y + box.height * .5);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(650);
  const over = await page.evaluate(() => ({ scrollY, position: Number(document.querySelector('[data-horizontal-drift="tattoos"]').dataset.driftPosition) }));
  assert.ok(Math.abs(over.position - before.position) > 1, `Wheel over the carousel moves it horizontally at ${width}px: ${before.position} -> ${over.position}`);
  assert.ok(Math.abs(over.scrollY - before.scrollY) <= 1, `Wheel over the carousel does not scroll the page at ${width}px: ${before.scrollY} -> ${over.scrollY}`);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await frames(page);
  const outsideBefore = await page.evaluate(() => scrollY);
  await page.mouse.move(4, 400); await page.mouse.wheel(0, 520); await page.waitForTimeout(350);
  const outsideAfter = await page.evaluate(() => scrollY);
  assert.ok(outsideAfter > outsideBefore + 100, `Wheel outside the carousel scrolls the page vertically at ${width}px: ${outsideBefore} -> ${outsideAfter}`);
  return { before, over, outsideBefore, outsideAfter };
}

async function cursorAudit(page, route, width) {
  await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
  const report = await findCursorOffenders(page);
  assert.deepEqual(report.offenders, [], `All painted elements keep the h4 cursor on ${route} at ${width}px.`);
  return report;
}

async function cursorStates(page, selectors) {
  const states = [];
  for (const selector of selectors) {
    const target = page.locator(selector);
    if (!await target.count()) continue;
    await target.scrollIntoViewIfNeeded(); await frames(page);
    const rest = await cursorOf(target);
    assert.equal(rest.ok, true, `${selector} keeps the cursor image and hotspot at rest: ${rest.cursor}`);
    // B-F8 made the visit line a decorative ghost: it carries the cursor but
    // accepts no pointer interaction, so hover/focus/active do not apply.
    if (await target.evaluate(element => getComputedStyle(element).pointerEvents) === 'none') {
      states.push({ selector, rest: rest.cursor, hover: null, focus: null, active: null, note: 'decorative ghost' });
      continue;
    }
    await target.hover();
    const hover = await cursorOf(target);
    assert.equal(hover.ok, true, `${selector} keeps the cursor image and hotspot on hover: ${hover.cursor}`);
    await target.focus();
    const focus = await cursorOf(target);
    assert.equal(focus.ok, true, `${selector} keeps the cursor image and hotspot on focus: ${focus.cursor}`);
    let active = hover;
    if (await target.isDisabled()) { states.push({ selector, rest: rest.cursor, hover: hover.cursor, focus: focus.cursor, active: null }); continue; }
    const box = await target.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    active = await cursorOf(target);
    await page.mouse.move(4, 4); await page.mouse.up();
    assert.equal(active.ok, true, `${selector} keeps the cursor image and hotspot while active: ${active.cursor}`);
    states.push({ selector, rest: rest.cursor, hover: hover.cursor, focus: focus.cursor, active: active.cursor });
  }
  return states;
}

async function footerCursorStates(page) {
  return cursorStates(page, ['.floating-brand', '.footer-brand', '[data-visit-count]',
    '.footer-smash', '.footer-instagram', '[data-naavi]']);
}

async function indexCursorStates(page) {
  const index = page.locator('[data-global-index]');
  if (!await index.evaluate(element => element.open)) await index.locator('summary').click();
  const links = await index.locator('[data-index-page]:is(a)').evaluateAll(nodes => nodes.map(node => node.dataset.indexPage));
  const states = await cursorStates(page, ['[data-global-index] summary', ...links.map(pageName => `[data-index-page="${pageName}"]`)]);
  await page.keyboard.press('Escape');
  return states;
}

try {
  for (const width of [1440, 390, 320]) {
    console.log(`CHECK V3.1.2-r3 browser suite ${width}px`);
    const context = await seededContext(width);
    await seedPage(context);
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [], messages = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { messages.push(message.text()); if (message.type() === 'error') errors.push(message.text()); });
    const route = async pending => { await delay(350); await pending.continue(); };
    await page.route(heroModule, route);
    try {
      await page.goto(new URL('/?test=1', base).href, { waitUntil: 'domcontentloaded' });
      const booting = await bootState(page);
      assert.match(booting.build, /^[a-f0-9]{7,40}$/i, 'Every document carries a non-empty build SHA.');
      assert.equal(booting.build, booting.metaBuild, 'html[data-build] and the h4-build meta agree.');
      assert.equal(booting.cursorClass, false, 'The native cursor needs no runtime class.');
      assert.equal(booting.overlayNodes, 0, 'The native cursor needs no overlay node.');
      assert.match(booting.bodyCursor, /h4ngelic-cursor\.svg["']?\)\s+8\s+2/,
        'The cursor is already effective before the hero module loads.');
      assert.equal(booting.loading, 'true');
      assert.doesNotMatch(booting.stage, /is-ready/);
      assert.ok(booting.posterDisplay !== 'none' && booting.posterOpacity >= .54, `The poster is immediately visible: ${JSON.stringify(booting)}`);
      assert.equal(booting.animation, 'hero-poster-breathe');
      assert.equal(booting.posterBackground, 'none', 'The boot surface contains no 2D wordmark artwork.');
      await page.screenshot({ path: new URL(`booting-${width}.png`, output).pathname, timeout: 10000, animations: 'disabled' }).catch(() => {});
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      await page.waitForFunction(() => !document.querySelector('#stage').classList.contains('is-entering'), null, { timeout: 3000 });
      const ready = await bootState(page);
      assert.equal(ready.loading, 'false');
      assert.equal(ready.heroReady, true);
      assert.equal(ready.posterOpacity, 0);
      assert.equal(ready.canvasDisplay, 'block');
      assert.equal(ready.canvasOpacity, 1);
      assert.equal(ready.entering, false, 'The entrance class clears after its 1100 ms block.');
      assert.equal(ready.entrance?.entering, true, 'The ready event starts the entrance class timeline.');
      assert.equal(ready.entrance?.opacity, 1, 'The logo arrives at constant opacity.');
      assert.ok(ready.entrance?.translateY < -ready.entrance?.height * .5, `The logo starts above the hero: ${JSON.stringify(ready.entrance)}`);
      assert.equal(ready.entrance?.transitionProperty, 'transform');
      assert.equal(ready.entrance?.transitionDuration, '1.1s');
      assert.ok(messages.some(text => text === `[h4ngelic] build ${booting.build}`), 'The dev/preview build marker is logged once.');
      assert.deepEqual(errors, [], `Normal boot emits no page errors at ${width}px.`);
      await page.screenshot({ path: new URL(`ready-${width}.png`, output).pathname });
      await page.unroute(heroModule, route);

      const slow = await context.newPage(); slow.setDefaultTimeout(60000);
      let heldRoute;
      await slow.route(heroModule, pending => { heldRoute = pending; });
      await slow.goto(new URL('/', base).href, { waitUntil: 'domcontentloaded' });
      await slow.waitForTimeout(6300);
      const slowState = await bootState(slow);
      assert.match(slowState.stage, /is-boot-slow/);
      assert.match(slowState.status, /taking longer than usual/);
      assert.ok(slowState.posterOpacity >= .54 && slowState.canvasDisplay !== 'none', 'The slow state keeps the atmospheric surface visible.');
      assert.equal(slowState.posterBackground, 'none', 'Slow loading never reveals the 2D wordmark.');
      await slow.screenshot({ path: new URL(`slow-${width}.png`, output).pathname, timeout: 10000, animations: 'disabled' }).catch(() => {});
      assert.ok(heldRoute, 'The slow fixture held the real hero module request.');
      await heldRoute.abort('failed');
      await slow.locator('#stage.is-boot-failed').waitFor({ timeout: 5000 });
      await slow.waitForTimeout(750);
      const slowFailed = await bootState(slow);
      assert.equal(slowFailed.loading, 'false');
      assert.equal(slowFailed.canvasDisplay, 'none');
      assert.equal(slowFailed.posterOpacity, 1);
      assert.match(slowFailed.posterBackground, /wordmark-fallback\.svg/);
      await slow.close();

      const failed = await context.newPage(); failed.setDefaultTimeout(30000);
      await failed.route(heroModule, pending => pending.abort('failed'));
      await failed.goto(new URL('/', base).href, { waitUntil: 'domcontentloaded' });
      await failed.locator('#stage.is-boot-failed').waitFor({ timeout: 5000 });
      await failed.waitForTimeout(750);
      const failedState = await bootState(failed);
      assert.equal(failedState.posterOpacity, 1);
      assert.match(failedState.posterBackground, /wordmark-fallback\.svg/, 'The failure path keeps the static text poster.');
      assert.equal(failedState.canvasDisplay, 'none');
      assert.equal(failedState.entering, false, 'Failure skips the entrance animation.');
      assert.equal(failedState.entrance, null);
      assert.match(failedState.status, /Static h4ngelic wordmark\. The interactive version could not be loaded\./);
      await failed.screenshot({ path: new URL(`failed-${width}.png`, output).pathname });
      await failed.locator('[data-global-index] summary').click();
      await failed.locator('[data-index-page="about"]').click();
      await failed.locator('html[data-page="about"]').waitFor();
      await failed.locator('[data-floating-brand]').click();
      await failed.locator('html[data-page="home"]').waitFor();
      await failed.locator('#stage.is-boot-failed').waitFor({ timeout: 5000 });
      const failedAgain = await bootState(failed);
      assert.equal(failedAgain.posterOpacity, 1, 'A failed hero stays failed after leaving and returning Home.');
      await failed.close();

      const auditedHome = await cursorAudit(page, '/', width);
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
      await page.mouse.move(width / 2, 420); await page.waitForTimeout(260);
      const lineRest = await returningLineState(page);
      assert.equal(lineRest.hidden, false, 'A returning visitor has a real greeting node with reserved placement.');
      assert.equal(lineRest.opacity, 0);
      assert.equal(lineRest.visibility, 'hidden');
      await page.mouse.move(width / 2, 30); await page.waitForTimeout(260);
      await page.waitForFunction(() => {
        const style = getComputedStyle(document.querySelector('[data-returning-visitor]'));
        return Number(style.opacity) >= .349 && style.visibility === 'visible';
      }, null, { timeout: 2000 });
      const lineHover = await returningLineState(page);
      assert.equal(lineHover.opacity, .35); assert.equal(lineHover.visibility, 'visible');
      await page.mouse.move(width / 2, 420); await page.waitForTimeout(260);
      await page.locator('[data-floating-brand]').focus(); await page.waitForTimeout(260);
      await page.waitForFunction(() => {
        const style = getComputedStyle(document.querySelector('[data-returning-visitor]'));
        return Number(style.opacity) >= .52 && style.visibility === 'visible';
      }, null, { timeout: 2000 });
      const lineFocus = await returningLineState(page);
      assert.equal(lineFocus.opacity, .52); assert.equal(lineFocus.visibility, 'visible');
      assert.ok(Math.abs(lineHover.height - lineRest.height) < .5, 'Revealing the fixed greeting never changes its box.');

      const slash = await slashReport(page, width);
      await page.screenshot({ path: new URL(`slash-contact-${width}.png`, output).pathname });
      const wheel = await wheelContract(page, width);
      const footerCursors = await footerCursorStates(page);
      const indexCursors = await indexCursorStates(page);
      const auditedWork = await findCursorOffenders(page);
      assert.deepEqual(auditedWork.offenders, [], `The whole Work page keeps one cursor at ${width}px.`);
      assert.equal(await page.locator('[data-h4-cursor]').count(), 0, 'The native strategy mounts no overlay element.');
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('h4-custom-cursor')), false,
        'The retired runtime class must not come back.');
      const auditedContact = await cursorAudit(page, '/contact', width);
      const formCursors = await cursorStates(page, ['.inquiry-field input[name="name"]',
        '.inquiry-field input[name="email"]', '.inquiry-field textarea[name="message"]',
        '[data-inquiry-submit]', '.inquiry-file-input']);

      const touchContext = await seededContext(width, { touch: true });
      await seedPage(touchContext);
      const touch = await touchContext.newPage(); touch.setDefaultTimeout(60000);
      await touch.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await touch.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true');
      const touchLine = await returningLineState(touch);
      assert.equal(touchLine.opacity, .35, 'Touch devices show the ghost greeting permanently.');
      assert.equal(touchLine.visibility, 'visible');
      await touch.screenshot({ path: new URL(`greeting-touch-${width}.png`, output).pathname });
      await touchContext.close();

      const reducedContext = await seededContext(width, { reduced: true });
      await seedPage(reducedContext);
      const reduced = await reducedContext.newPage(); reduced.setDefaultTimeout(60000);
      await reduced.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      await reduced.locator('#stage.is-poster-static').waitFor({ timeout: 10000 });
      const reducedState = await reduced.evaluate(() => ({
        poster: Number(getComputedStyle(document.querySelector('[data-hero-poster]')).opacity),
        animation: getComputedStyle(document.querySelector('[data-hero-poster]')).animationName,
        canvas: getComputedStyle(document.querySelector('#logo-canvas')).display,
      }));
      assert.equal(reducedState.poster, 1, 'Reduced motion shows the final poster immediately.');
      assert.equal(reducedState.animation, 'none');
      assert.equal(reducedState.canvas, 'none');
      await reducedContext.close();

      reports.push({ width, booting, ready, slow: slowState, slowFailed, failed: failedState,
        greeting: { rest: lineRest, hover: lineHover, focus: lineFocus, touch: touchLine }, slash, wheel,
        reduced: reducedState, cursor: { home: auditedHome, work: auditedWork, contact: auditedContact,
          footerStates: footerCursors, indexStates: indexCursors, formStates: formCursors }, messages, errors });
      console.log(`PASS ${width}px: build marker, entrance, cursor, greeting, slash ${slash.canonical.token.toFixed(2)}px, wheel contract.`);
    } catch (error) {
      failures.push({ width, error: error.stack, errors }); throw error;
    } finally {
      await context.close(); await save();
    }
  }
} catch (error) {
  failures.push({ error: error.stack }); throw error;
} finally {
  await save();
  await browser.close();
}
