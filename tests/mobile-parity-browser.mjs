import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// B-F32 mobile parity: a touch device gets no custom cursor and no invisible
// HOLD-4 focus target. Desktop keeps both.
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/mobile-parity/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
try {
  for (const width of [390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    try {
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
      const state = await page.evaluate(() => {
        const secret = document.querySelector('.footer-secret');
        const brand = document.querySelector('.footer-brand');
        return { cursor: getComputedStyle(brand).cursor, secretDisplay: secret ? getComputedStyle(secret).display : 'absent',
          secretFocusable: secret ? secret.tabIndex >= 0 : false, secretPresent: Boolean(secret),
          space: Boolean(document.querySelector('[data-footer-secret-space]')) };
      });
      assert.equal(coarse, true, `[${width}] the emulated device reports a coarse pointer`);
      assert.equal(state.cursor, 'auto', `[${width}] a coarse pointer keeps the system cursor (${state.cursor})`);
      assert.notEqual(state.secretDisplay, 'none', `[${width}] the HOLD-4 hint stays on touch (B-F32 revert)`);
      assert.equal(state.space, true, `[${width}] the end-reveal space stays reachable`);
      assert.deepEqual(errors, []);
      reports.push({ width, coarse, ...state, errors });
      await page.screenshot({ path: new URL(`footer-${width}.png`, output).pathname, fullPage: false });
      console.log(`PASS mobile parity ${width}px: coarse pointer, system cursor, hold-4 hint present.`);
    } finally {
      await context.close();
    }
  }
  // B-F33: a tap writes a pressed state on the link itself and the link still
  // navigates immediately afterwards.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    const link = page.locator('.hero-nav a').first();
    await link.scrollIntoViewIfNeeded();
    const box = await link.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const during = await link.evaluate(element => ({ pressed: element.classList.contains('is-pressed'),
      highlight: getComputedStyle(element).webkitTapHighlightColor }));
    await page.mouse.up();
    const after = await link.evaluate(element => element.classList.contains('is-pressed'));
    assert.equal(during.pressed, true, 'pointerdown marks the link as pressed');
    assert.equal(during.highlight, 'rgba(0, 0, 0, 0)', 'no native tap highlight on top of it');
    assert.equal(after, false, 'pointerup clears the pressed state');
    // The press state only ever touches classList: no preventDefault, no delay.
    // (A synthetic click is cancelled by the router, so the assertion is the
    // untouched destination instead.)
    const href = await link.getAttribute('href');
    assert.ok(href.startsWith('/'), 'the destination is unchanged');
    console.log('PASS press state 390px: class on pointerdown, cleared on pointerup, navigation unaffected.');
    await context.close();
  }
  // B-F36: below 600px the bottom bar reads top to bottom as nav, controls,
  // counter, with no overlap and no scroll container in the footer clusters.
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const rows = await page.evaluate(() => {
      const box = selector => { const element = document.querySelector(selector); const rect = element.getBoundingClientRect();
        return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), height: Math.round(rect.height) }; };
      const nav = box('.hero-nav'), controls = box('.controls'), naavi = box('[data-naavi]');
      const left = document.querySelector('.footer-left'), details = document.querySelector('.footer-details');
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return { nav, controls, naavi, controlsOpacity: Number(getComputedStyle(document.querySelector('.controls')).opacity),
        order: nav.bottom <= controls.top && controls.bottom <= naavi.top,
        overlaps: overlap(nav, controls) || overlap(controls, naavi) || overlap(nav, naavi),
        clusters: [{ sw: left.scrollWidth, cw: left.clientWidth }, { sw: details.scrollWidth, cw: details.clientWidth }],
        pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    assert.equal(rows.order, true, `[${width}] nav, controls and counter stack top to bottom`);
    assert.equal(rows.overlaps, false, `[${width}] no row overlaps another`);
    assert.ok(rows.controlsOpacity < 1, `[${width}] the controls read as the secondary row`);
    assert.equal(rows.nav.height >= 44 && rows.controls.height >= 44 && rows.naavi.height >= 44, true, `[${width}] 44px targets`);
    for (const cluster of rows.clusters) assert.equal(cluster.sw, cluster.cw, `[${width}] no footer scroll container`);
    assert.ok(rows.pageWidth <= rows.viewport + 1, `[${width}] no horizontal page overflow`);
    await context.close();
    console.log(`PASS mobile rows ${width}px: nav -> controls -> counter, no overlap, no footer scroll container.`);
  }
  // B-F37: the "m" shortcut toggles the same state as the button, and stays
  // silent while typing or with a modifier held.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    const button = page.locator('[data-mode-mute]').first();
    await button.waitFor();
    const label = async () => ({ pressed: await button.getAttribute('aria-pressed'), text: (await button.textContent()).trim() });
    const before = await label();
    await page.keyboard.press('m');
    await page.waitForFunction(previous => document.querySelector('[data-mode-mute]')?.getAttribute('aria-pressed') !== previous,
      before.pressed, { timeout: 5000 });
    const afterKey = await label();
    assert.notEqual(afterKey.pressed, before.pressed, 'm toggles the mute state');
    assert.equal(afterKey.text, afterKey.pressed === 'true' ? 'sound on' : 'sound off', 'label follows the state');
    await page.keyboard.press('m');
    await page.waitForFunction(previous => document.querySelector('[data-mode-mute]')?.getAttribute('aria-pressed') === previous,
      before.pressed, { timeout: 5000 });
    assert.deepEqual(await label(), before, 'a second m returns to the start');
    const field = page.locator('[data-inquiry-form] input[name="name"]').first();
    await field.scrollIntoViewIfNeeded();
    await field.click();
    await page.keyboard.type('mmmail');
    await page.waitForTimeout(200);
    assert.equal(await field.inputValue(), 'mmmail', 'typing m stays in the field');
    assert.deepEqual(await label(), before, 'typing never mutes the page');
    await page.keyboard.press('Meta+m');
    await page.waitForTimeout(200);
    assert.deepEqual(await label(), before, 'a modifier keeps m for the browser');
    await context.close();
    console.log('PASS mute shortcut 1440px: m toggles, fields and modifiers are guarded.');
  }
  // B-F40: the very first pointer press on MUTE has to land. refresh() used to
  // rewrite the button's text nodes on every audio state change — including the
  // document's first pointerdown, the one that unlocks the audio context — so
  // the browser never dispatched `click` and the button stayed where it was.
  // A real mouse press (not the "m" key) is the only input that hits that path.
  {
    for (const delay of [500, 1500]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
      const button = page.locator('[data-controls] [data-mode-mute]').first();
      await button.waitFor();
      await page.waitForTimeout(delay);
      const before = await button.getAttribute('aria-pressed');
      await button.click();
      await page.waitForFunction(previous => document.querySelector('[data-controls] [data-mode-mute]')?.getAttribute('aria-pressed') !== previous,
        before, { timeout: 4000 }).catch(() => {});
      const after = await button.getAttribute('aria-pressed');
      assert.notEqual(after, before, `the first mouse press on MUTE flips it (${delay} ms after load: ${before} -> ${after})`);
      const label = (await button.textContent()).trim();
      assert.equal(label, after === 'true' ? 'sound on' : 'sound off', 'the label follows the first press');
      reports.push({ muteFirstClick: { delay, before, after, label } });
      await context.close();
    }
    console.log('PASS mute first click 1440px: the first real pointer press lands at 500 and 1500 ms after load.');
  }
  // B-F39a: the digital archive rests in the tattoo carousel's card slot on a
  // phone — same width and same ratio, from the shared carousel tokens.
  // B-F39b: archive sections arrive once when they scroll in (entry, not
  // scroll direction), and go back to that behaviour after a route change.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const cardOf = async selector => page.locator(selector).first().evaluate(img => {
      const rect = img.getBoundingClientRect();
      return { width: rect.width, height: rect.height, ratio: rect.width / rect.height };
    });
    await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const card = await cardOf('[data-horizontal-drift="tattoos"] [data-artwork-open] img');
    const reveals = () => page.evaluate(() => [...document.querySelectorAll('[data-section-reveal]')].map(section => ({
      id: section.id,
      pending: section.classList.contains('is-section-reveal-pending'),
      revealed: section.classList.contains('is-section-revealed'),
      opacity: Number(getComputedStyle(section).opacity),
    })));
    const initial = await reveals();
    const below = initial.find(section => section.id === 'flashes');
    assert.ok(below, 'the section list marks the below-fold archive section');
    assert.equal(below.pending, true, 'a below-fold section waits for its entrance');
    assert.equal(below.opacity, 0, 'the waiting section is not painted');
    assert.equal(initial.find(section => section.id === 'onskin').opacity, 1, 'the section already on screen stays visible (no load flash)');
    for (let step = 0; step < 40; step++) {
      await page.evaluate(() => scrollBy(0, 120));
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(800);
    const after = await reveals();
    assert.equal(after.every(section => section.revealed && section.opacity === 1), true,
      `every archive section reaches its end state after scrolling (${JSON.stringify(after)})`);
    assert.equal(after.every(section => !section.pending), true, 'no reveal is left armed');

    await page.goto(new URL('/creative/more', base).href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const digital = await cardOf('[data-archive-category="digital-artworks"] .artwork-open img');
    assert.ok(Math.abs(digital.width - card.width) <= 2,
      `digital artwork uses the tattoo card width (${digital.width} vs ${card.width})`);
    assert.ok(Math.abs(digital.ratio - card.ratio) <= .01,
      `digital artwork uses the tattoo card ratio (${digital.ratio.toFixed(3)} vs ${card.ratio.toFixed(3)})`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
      'the wider digital card never widens the page');
    await page.screenshot({ path: new URL('digital-390.png', output).pathname });

    // Route lifecycle through the router: leave for another rubric, come back,
    // and the reveal still runs from the same helper (observer disconnected on
    // leave, re-armed on return).
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.locator('.work-filters a[href="/creative/tattoos"]').click();
    await page.waitForFunction(() => location.pathname === '/creative/tattoos');
    await page.waitForTimeout(900);
    const back = await reveals();
    const backBelow = back.find(section => section.id === 'flashes');
    assert.equal(backBelow.pending, true, 'the reveal re-arms after a route change');
    for (let step = 0; step < 40; step++) {
      await page.evaluate(() => scrollBy(0, 120));
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(800);
    const backAfter = await reveals();
    assert.equal(backAfter.every(section => section.revealed && section.opacity === 1), true,
      'the reveal still completes after /about and back');
    console.log('PASS B-F39 390px: digital card matches the tattoo slot, sections reveal on entry and re-arm across routes.');
    await context.close();
  }
  // B-F35: both archive strips move by themselves, follow a real touch drag,
  // keep the page scrollable vertically, and come to rest on a whole card.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    for (const category of ['tattoos', 'flashes']) {
      const drift = page.locator(`[data-horizontal-drift="${category}"]`);
      await drift.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const touchAction = await drift.locator('.drift-viewport').evaluate(element => getComputedStyle(element).touchAction);
      assert.match(touchAction, /pan-y/, `[${category}] the strip keeps vertical page scrolling`);
      const ambient = await drift.evaluate(element => Number(element.dataset.driftPosition));
      const step = await drift.evaluate(element => {
        const card = element.querySelector('[data-drift-item]');
        return (card?.offsetWidth || 0) + (Number.parseFloat(getComputedStyle(element).getPropertyValue('--carousel-spacing')) || 0);
      });
      assert.ok(step > 0, `[${category}] the card step is measurable`);
      const box = await drift.locator('.drift-viewport').boundingBox();
      const y = box.y + Math.min(120, box.height / 2);
      const startX = box.x + box.width * .8;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
      for (let move = 1; move <= 6; move++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - move * 25, y }] });
        await page.waitForTimeout(16);
      }
      const whileDragging = await drift.getAttribute('data-carousel-phase');
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const frames = await page.evaluate(category => new Promise(resolve => {
        const section = document.querySelector(`[data-horizontal-drift="${category}"]`);
        const rows = [];
        const start = performance.now();
        const tick = () => {
          const items = [...section.querySelectorAll('[data-drift-item]')].map(element => element.getBoundingClientRect());
          rows.push({
            phase: section.dataset.carouselPhase,
            position: Number(section.dataset.driftPosition),
            full: items.some(rect => rect.left >= -1 && rect.right <= innerWidth + 1),
          });
          if (performance.now() - start < 6000) requestAnimationFrame(tick);
          else resolve(rows);
        };
        requestAnimationFrame(tick);
      }), category);
      const phases = new Set(frames.map(frame => frame.phase));
      assert.equal(whileDragging, 'dragging', `[${category}] the touch drag is tracked`);
      assert.ok(phases.has('settling'), `[${category}] the release settles on a card slot (${[...phases]})`);
      assert.ok(phases.has('momentum'), `[${category}] the release carries momentum (${[...phases]})`);
      await page.waitForFunction(category => document.querySelector(`[data-horizontal-drift="${category}"]`)?.dataset.carouselPhase === 'drift',
        category, { timeout: 15000 });
      assert.ok(frames.some(frame => frame.full && frame.phase !== 'dragging'),
        `[${category}] a whole card is visible when the drag comes to rest`);
      assert.ok(frames.some(frame => frame.phase === 'settling' && Math.abs(frame.position - Math.round(frame.position / step) * step) < 2),
        `[${category}] the settle lands on the measured card step (${step}px)`);
      assert.notEqual(await drift.evaluate(element => Number(element.dataset.driftPosition)), ambient,
        `[${category}] the drag moves the real strip`);
    }
    // A vertical swipe over the strip still scrolls the page.
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(250);
    const before = await page.evaluate(() => scrollY);
    const strip = page.locator('[data-horizontal-drift="tattoos"] .drift-viewport');
    await strip.scrollIntoViewIfNeeded();
    const box = await strip.boundingBox();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: box.y + 120 }] });
    for (let step = 1; step <= 6; step++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: box.y + 120 - step * 30 }] });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => scrollY) > before, 'a vertical swipe over the strip scrolls the page');
    console.log('PASS B-F35 390px: both strips drag, settle on a whole card and resume drift; pan-y still scrolls the page.');
    await context.close();
  }
  // reduced motion: the same sections are in their end state immediately.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(new URL('/creative/tattoos', base).href, { waitUntil: 'networkidle' });
    const states = await page.evaluate(() => [...document.querySelectorAll('[data-section-reveal]')].map(section => ({
      pending: section.classList.contains('is-section-reveal-pending'),
      opacity: Number(getComputedStyle(section).opacity),
      transition: getComputedStyle(section).transitionDuration,
    })));
    assert.equal(states.every(state => !state.pending && state.opacity === 1), true,
      `reduced motion shows the end state at once (${JSON.stringify(states)})`);
    console.log('PASS B-F39 reduced motion: no pending reveal, end state immediate.');
    await context.close();
  }
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  const wide = await page.evaluate(() => ({
    cursor: getComputedStyle(document.querySelector('.footer-brand')).cursor,
    secretDisplay: getComputedStyle(document.querySelector('.footer-secret')).display,
  }));
  assert.match(wide.cursor, /h4ngelic-cursor/, 'Desktop keeps the logo cursor');
  assert.notEqual(wide.secretDisplay, 'none', 'Desktop keeps the HOLD-4 hint');
  reports.push({ width: 1440, ...wide });
  console.log('PASS mobile parity 1440px: logo cursor and hold-4 hint unchanged.');
  await desktop.close();
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2));
  await browser.close();
}
