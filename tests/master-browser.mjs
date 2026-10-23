import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const phase = process.env.H4_TEST_PHASE || 'full';
if (!['motion', 'full'].includes(phase)) throw new Error('H4_TEST_PHASE must be motion or full.');
const motionOnly = phase === 'motion';
const route = (path) => new URL(path, baseURL).href;
const artifacts = new URL('../artifacts/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const categories = ['tattoos', 'jewellery', 'paintings'];
const errorsFor = (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
};
const frames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const transform = (locator) => locator.evaluate((element) => {
  const value = getComputedStyle(element).transform;
  const matrix = new DOMMatrixReadOnly(value === 'none' ? undefined : value);
  return { x: matrix.m41, y: matrix.m42, rotation: Math.atan2(matrix.m12, matrix.m11) * 180 / Math.PI };
});

async function captureHomepage(page, filename) {
  const before = await page.evaluate(() => window.__H4_TEST__?.snapshot().frameCount || 0);
  await page.evaluate(() => {
    document.activeElement?.blur();
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await frames(page);
  await page.waitForFunction((count) => !window.__H4_TEST__ || window.__H4_TEST__.snapshot().frameCount > count, before, { timeout: 10000 });
  await page.waitForFunction(() => scrollY === 0 && Number(getComputedStyle(document.getElementById('stage')).opacity) > .99);
  await frames(page);
  await page.screenshot({ path: new URL(filename, artifacts).pathname, fullPage: true });
}

async function pageKind(page, kind) {
  await page.waitForFunction((expected) => document.documentElement.dataset.page === expected, kind);
  await frames(page);
}

async function readyHome(page) {
  await page.goto(route('/?test=1'), { waitUntil: 'networkidle' });
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  await page.locator('.kinetic-heading').first().waitFor();
  if (!await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) await page.locator('[data-scroll-choreography]').waitFor();
  if (await page.locator('#pause-control').getAttribute('aria-pressed') === 'false') await page.locator('#pause-control').click();
  await page.evaluate(() => document.activeElement?.blur());
}

async function scrollProgress(page, selector, progress) {
  const position = await page.locator(selector).evaluate((section, value) => {
    const run = parseFloat(getComputedStyle(section).getPropertyValue('--motion-run'));
    if (!Number.isFinite(run) || run <= 0) throw new Error('A pinned section must expose its positive scroll run.');
    return section.getBoundingClientRect().top + scrollY + run * value;
  }, progress);
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), position);
  await frames(page);
  return position;
}

async function itemStates(page, selector) {
  return page.locator(`${selector} .kinetic-item`).evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item);
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    const box = item.getBoundingClientRect();
    return { x: matrix.m41, y: matrix.m42, opacity: Number(style.opacity), left: box.left, right: box.right };
  }));
}

function closeStates(actual, expected, message) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index++) {
    for (const property of ['x', 'y', 'opacity']) assert.ok(Math.abs(actual[index][property] - expected[index][property]) < .1, `${message}: item ${index}, ${property}.`);
  }
}

async function horizontal(page, selector, width) {
  const items = page.locator(selector);
  assert.equal(await items.count(), 3);
  const boxes = await Promise.all([0, 1, 2].map((index) => items.nth(index).boundingBox()));
  assert.ok(boxes.every(Boolean));
  assert.ok(Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y)) < 2, `Three links must share a row at ${width}px: ${selector}.`);
  assert.ok(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x, 'Link order must remain left to right.');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No page-level horizontal overflow at ${width}px.`);
}

async function mode(page, expected) {
  await page.evaluate(() => document.activeElement?.blur());
  if (await page.locator('html').getAttribute('data-mode') !== expected) await page.keyboard.press('4');
  await waitMode(page, expected);
}

async function waitMode(page, expected) {
  await page.waitForFunction((value) => document.documentElement.dataset.mode === value && !document.documentElement.hasAttribute('data-xray-transition'), expected);
}

async function waitViewer(page, number) {
  await page.waitForFunction((index) => {
    const dialog = document.querySelector('.artwork-dialog');
    const image = dialog?.querySelector('.artwork-viewer-image');
    return dialog?.open && image?.complete && image.naturalWidth > 0
      && dialog.querySelector('.artwork-viewer-count').textContent === `${index} / 2`
      && dialog.querySelector('.artwork-viewer-status').textContent === `image ${index} of 2`
      && !dialog.querySelector('.artwork-viewer-stage').classList.contains('is-switching');
  }, number);
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    window.__storageWrites = [];
    for (const method of ['setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        window.__storageWrites.push({ method, key: String(args[0] || '') });
        return original.apply(this, args);
      };
    }
  });
  const page = await context.newPage();
  const errors = errorsFor(page);
  await readyHome(page);
  assert.equal((await page.locator('.identity').innerText()).replace(/\s+/g, ' ').trim(), 'art on skin & beyond');
  assert.deepEqual(await page.locator('.kinetic-heading').allTextContents(), ['01 / selected works', '02 / about', '03 / contact']);
  assert.equal(await page.locator('#page-content > .content-section').count(), 3, 'The homepage contains exactly three major sections.');
  const headingStyles = await page.locator('.kinetic-heading').evaluateAll((headings) => headings.map((heading) => {
    const style = getComputedStyle(heading);
    return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing];
  }));
  assert.deepEqual(headingStyles[0], headingStyles[1]);
  assert.deepEqual(headingStyles[1], headingStyles[2]);
  assert.ok(parseFloat(headingStyles[0][1]) >= 48, 'Desktop section headings must be intentionally large.');
  assert.equal(await page.locator('#selected-work img, #selected-work picture').count(), 0);
  assert.equal(await page.locator('#contact .contact-link-primary').count(), 0, 'Contact must not duplicate a get-in-touch heading.');

  for (const selector of ['#selected-work', '#contact']) {
    await scrollProgress(page, selector, 0);
    const initial = await itemStates(page, selector);
    assert.equal(initial.length, 3);
    assert.ok(initial.every((item) => item.left >= 1440), 'All category/contact labels start fully beyond the right viewport edge.');
    assert.ok(initial.every((item) => item.x >= 1440), 'The fly-in covers a substantial viewport-width distance.');
    await scrollProgress(page, selector, .48);
    const midway = await itemStates(page, selector);
    assert.ok(midway.some((item) => item.x > 5) && midway.some((item) => item.x < initial[0].x), 'The timeline must expose a real intermediate state.');
    assert.ok(midway[0].x < midway[1].x && midway[1].x <= midway[2].x, 'The three arrivals must be scroll-staggered.');
    const pinnedBefore = await page.locator(`${selector} .section-pin`).boundingBox();
    await scrollProgress(page, selector, .55);
    const pinnedAfter = await page.locator(`${selector} .section-pin`).boundingBox();
    assert.ok(Math.abs(pinnedBefore.y - pinnedAfter.y) < 2, 'The section stage stays pinned while its scroll timeline advances.');
    await scrollProgress(page, selector, 1);
    const settled = await itemStates(page, selector);
    assert.ok(settled.every((item) => Math.abs(item.x) < .1 && Math.abs(item.y) < .1 && item.opacity > .99), 'Links must finish fully visible in exact final positions.');
    await horizontal(page, `${selector} ${selector === '#contact' ? '.contact-link' : '.category-link'}`, 1440);
    await scrollProgress(page, selector, .48);
    closeStates(await itemStates(page, selector), midway, 'Reverse scrolling must reproduce the same intermediate state');
    await page.waitForTimeout(180);
    closeStates(await itemStates(page, selector), midway, 'Stopping scroll must stop the choreography');
    const wheelStart = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 60);
    await page.waitForFunction((before) => scrollY > before + 20, wheelStart);
    await scrollProgress(page, selector, 0);
    closeStates(await itemStates(page, selector), initial, 'Reversing to the start must restore the original fly-in state');
  }

  await scrollProgress(page, '#selected-work', .48);
  await page.setViewportSize({ width: 1024, height: 800 });
  await frames(page);
  await scrollProgress(page, '#selected-work', 1);
  assert.ok((await itemStates(page, '#selected-work')).every((item) => Math.abs(item.x) < .1));
  await horizontal(page, '#selected-work .category-link', 1024);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await frames(page);

  const aboutRange = await page.locator('[data-motion="about"]').evaluate(async (section) => {
    const { motionSettings } = await import('/src/data/motionSettings.js');
    const top = section.getBoundingClientRect().top + scrollY;
    return { start: top - innerHeight * motionSettings.about.approach, end: top - innerHeight * motionSettings.about.finish };
  });
  assert.equal(await page.locator('[data-motion="about"][data-motion-pin]').count(), 0, 'About stays in normal document flow.');
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), aboutRange.start);
  await frames(page);
  const aboutStart = await itemStates(page, '[data-motion="about"]');
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), (aboutRange.start + aboutRange.end) / 2);
  await frames(page);
  const aboutMiddle = await itemStates(page, '[data-motion="about"]');
  assert.ok(aboutMiddle[0].x < aboutStart[0].x && aboutMiddle[1].x > aboutMiddle[0].x, 'About copy enters first and its link follows.');
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), aboutRange.end);
  await frames(page);
  assert.ok((await itemStates(page, '[data-motion="about"]')).every((item) => Math.abs(item.x) < .1 && item.opacity > .99));
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), (aboutRange.start + aboutRange.end) / 2);
  await frames(page);
  closeStates(await itemStates(page, '[data-motion="about"]'), aboutMiddle, 'The calmer About sequence must also reverse');

  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await frames(page);
  const heroStart = await transform(page.locator('#stage'));
  const startOpacity = Number(await page.locator('#stage').evaluate((element) => getComputedStyle(element).opacity));
  await page.evaluate(() => scrollTo({ top: innerHeight * .65, behavior: 'instant' }));
  await frames(page);
  const stageScale = await page.locator('#stage').evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m11);
  assert.ok(stageScale < 1 && stageScale > .5, 'The hero recedes modestly during the hero-to-work transition.');
  assert.ok(Number(await page.locator('#stage').evaluate((element) => getComputedStyle(element).opacity)) < startOpacity);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await frames(page);
  assert.ok(Math.abs((await transform(page.locator('#stage'))).x - heroStart.x) < .1);
  assert.ok(Math.abs(Number(await page.locator('#stage').evaluate((element) => getComputedStyle(element).opacity)) - startOpacity) < .01);

  await scrollProgress(page, '#selected-work', .48);
  await page.screenshot({ path: new URL('master-motion-midway.png', artifacts).pathname });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await frames(page);
  assert.ok((await itemStates(page, '#selected-work')).every((item) => Math.abs(item.x) < .1 && item.opacity > .99));
  for (const pin of await page.locator('.section-pin').all()) assert.notEqual(await pin.evaluate((element) => getComputedStyle(element).position), 'sticky', 'Reduced motion disables nonessential pinning.');
  await captureHomepage(page, 'master-home-normal.png');
  console.log('PASS master motion: shared headings, extreme staggered fly-ins, native pinning, exact reverse/stop states, hero recession and reduced-motion fallback.');

  if (!motionOnly) {
  // Changes stay in browser memory only. No fixture is written to artist data.
  await page.evaluate(async () => {
    const source = performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === '/src/data/artworks.js')?.name || '/src/data/artworks.js';
    window.__masterFixtureModuleURL = source;
    const { artworks } = await import(source);
    artworks.push({
      id: 'master-browser-fixture', slug: 'master-browser-fixture', category: 'tattoos', title: 'temporary browser fixture',
      description: 'This temporary test uses the artwork already supplied for the logo reflection.', year: 2026,
      images: [
        { src: '/assets/tattoo-texture.webp', alt: 'supplied tattoo artwork test view', width: 1024, height: 1448 },
        { src: '/assets/tattoo-texture.webp?detail=1', alt: 'supplied artwork second test view', width: 1024, height: 1448 },
      ],
    });
  });
  await page.locator('#selected-work a[href="/work/tattoos"]').click();
  await pageKind(page, 'work');
  assert.equal(new URL(page.url()).pathname, '/work/tattoos');
  const detailLink = page.locator('a[href="/work/tattoos/master-browser-fixture"]');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await detailLink.first().click();
  await pageKind(page, 'artwork');
  assert.equal(await page.locator('h1:visible').textContent(), 'temporary browser fixture');
  assert.equal(await page.locator('.project-image img').count(), 2);
  assert.equal(await page.locator('.project-image img[alt=""]').count(), 0);
  await page.locator('.project-image img').first().evaluate((image) => image.decode());
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.project-image img')).opacity) > .99);
  const lazyImage = page.locator('.project-image img[loading="lazy"]').last();
  assert.ok(Number(await lazyImage.evaluate((image) => getComputedStyle(image).opacity)) < .01, 'An actual below-fold image begins its mask/reveal hidden.');
  assert.match(await lazyImage.evaluate((image) => getComputedStyle(image).transitionProperty), /transform/, 'The image rise/scale must transition as well as its opacity.');
  await page.locator('[data-artwork-open]').first().focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-artwork-open]').last().evaluate((button) => button === document.activeElement), true);
  assert.ok(Number(await lazyImage.evaluate((image) => getComputedStyle(image).opacity)) > .99, 'Keyboard focus immediately reveals a previously masked image.');
  const maskScale = await page.locator('[data-artwork-open]').last().evaluate((button) => {
    const value = getComputedStyle(button, '::after').transform;
    return value === 'none' ? 0 : new DOMMatrixReadOnly(value).m22;
  });
  assert.ok(Math.abs(maskScale) < .01, 'The keyboard-focused artwork must not remain under its reveal mask.');
  await page.goBack();
  await pageKind(page, 'work');
  assert.equal(new URL(page.url()).pathname, '/work/tattoos');
  await page.goForward();
  await pageKind(page, 'artwork');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mode(page, 'normal');
  const originalFilter = await page.locator('.project-image img').first().evaluate((image) => getComputedStyle(image).filter);
  await page.keyboard.press('4');
  assert.equal(await page.locator('html').getAttribute('data-xray-transition'), 'entering', 'Normal-motion mode activation has a bounded transition state.');
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray' && !document.documentElement.hasAttribute('data-xray-transition'));
  assert.match(await page.locator('.project-image img').first().evaluate((image) => getComputedStyle(image).filter), /h4-xray/);
  assert.equal(await page.locator('[data-xray-filters]').count(), 1);
  assert.equal(await page.locator('.xray-distress').count(), 1);
  await page.locator('[data-artwork-open]').first().click();
  await waitViewer(page, 1);
  assert.match(await page.locator('.artwork-viewer-image').evaluate((image) => getComputedStyle(image).filter), /h4-xray/, 'Large artwork receives the same semantic-image treatment.');
  await page.keyboard.press('ArrowRight');
  await waitViewer(page, 2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.artwork-dialog').open);
  assert.equal(await page.locator('[data-artwork-open]').first().evaluate((button) => button === document.activeElement), true);
  await page.locator('a[href="/about"]:visible').first().click();
  await pageKind(page, 'about');
  assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'Internal navigation preserves the alternate exhibition.');
  assert.match(await page.locator('main').textContent(), /h333ndrik/);
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter((animation) => animation.effect?.pseudoElement?.startsWith('::view-transition')).map((animation) => animation.finished));
    document.activeElement?.blur();
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await frames(page);
  await page.screenshot({ path: new URL('master-about-xray.png', artifacts).pathname, fullPage: true });
  await page.keyboard.press('Tab');
  await page.locator('[data-xray-toggle]').focus();
  assert.ok(Number(await page.locator('[data-xray-hint]').evaluate((element) => getComputedStyle(element).opacity)) > .9, 'Keyboard users can read the hidden hint.');
  await page.keyboard.press('4');
  await mode(page, 'normal');
  await page.keyboard.press('Numpad4');
  await waitMode(page, 'xray');

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'master-typing-fixture';
    input.setAttribute('aria-label', 'temporary keyboard test');
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.type('4');
  assert.equal(await page.locator('#master-typing-fixture').inputValue(), '4');
  assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'Typing 4 in a field must not activate the shortcut.');
  await page.evaluate(() => document.getElementById('master-typing-fixture').remove());
  for (const kind of ['textarea', 'editable']) {
    await page.evaluate((type) => {
      const element = document.createElement(type === 'textarea' ? 'textarea' : 'div');
      element.id = 'master-typing-fixture';
      if (type === 'editable') element.contentEditable = 'true';
      element.setAttribute('aria-label', 'temporary editing test');
      document.body.append(element);
      element.focus();
    }, kind);
    await page.keyboard.type('4');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', `The shortcut must ignore a focused ${kind} field.`);
    await page.evaluate(() => document.getElementById('master-typing-fixture').remove());
  }
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', code: 'Digit4', repeat: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', code: 'Digit4', ctrlKey: true, bubbles: true }));
  });
  assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray');
  for (let index = 0; index < 10; index++) await page.keyboard.press('4');
  await waitMode(page, 'xray');
  await mode(page, 'normal');
  assert.equal(await page.locator('[data-xray-filters]').count(), 1, 'Repeated toggles cannot accumulate filter nodes.');
  assert.equal(await page.locator('.xray-distress').count(), 1, 'Repeated toggles cannot accumulate distress layers.');
  await page.goBack();
  await pageKind(page, 'artwork');
  assert.equal(await page.locator('.project-image img').first().evaluate((image) => getComputedStyle(image).filter), originalFilter, 'Returning to normal removes image treatment completely.');
  await page.locator('a[href="/work"]:visible').first().click();
  await pageKind(page, 'work');
  await page.evaluate(async () => {
    const { artworks } = await import(window.__masterFixtureModuleURL);
    const index = artworks.findIndex((project) => project.id === 'master-browser-fixture');
    if (index >= 0) artworks.splice(index, 1);
    delete window.__masterFixtureModuleURL;
  });
  console.log('PASS master navigation/The Other Side: real artwork URL with browser-only fixture, history, semantic image and viewer treatment, keyboard guards, mode continuity and repeated clean restoration.');

  await page.goto(route('/work'), { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.archive-empty').textContent(), 'archive in progress.');
  assert.equal(await page.locator('[data-visit-message]').textContent(), 'nice to meet you.');
  const blank = page.locator('.archive-empty');
  await blank.click({ position: { x: 30, y: 35 } });
  await page.waitForFunction(() => document.querySelectorAll('[data-ink-mark]').length === 1);
  const ink = page.locator('[data-ink-mark]').first();
  assert.equal(await ink.evaluate((mark) => getComputedStyle(mark).pointerEvents), 'none');
  assert.ok((await ink.locator('path').first().getAttribute('d')).length > 50, 'The imprint must have an irregular drawn boundary rather than a generic circle.');
  const neutralInk = await ink.evaluate((mark) => getComputedStyle(mark).color);
  const beforeControl = await page.locator('[data-ink-mark]').count();
  await page.locator('[data-xray-toggle]').click();
  assert.equal(await page.locator('[data-ink-mark]').count(), beforeControl, 'Functional controls must not create ink.');
  assert.notEqual(await ink.evaluate((mark) => getComputedStyle(mark).color), neutralInk, 'Existing ink automatically adopts the alternate pigment palette.');
  await page.locator('.filter-link[aria-current="page"]').click();
  await pageKind(page, 'work');
  assert.ok(await page.locator('[data-ink-mark]').count() <= beforeControl, 'Navigation must not create ink.');
  for (let index = 0; index < 18; index++) await blank.click({ position: { x: 30 + index, y: 35 } });
  assert.ok(await page.locator('[data-ink-mark]').count() <= 12, 'The finite effect layer must cap simultaneous marks.');
  await page.waitForFunction(() => document.querySelectorAll('[data-ink-mark]').length === 0, null, { timeout: 5000 });
  assert.deepEqual(await page.evaluate(() => window.__storageWrites), [], 'Default visitor feedback must not write local/session storage.');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-visit-message]').textContent(), 'nice to meet you.', 'Reload does not fabricate another persistent visit.');
  assert.deepEqual(await page.evaluate(() => window.__storageWrites), []);
  const hiddenControl = page.locator('[data-xray-toggle]');
  const hiddenHint = page.locator('[data-xray-hint]');
  assert.ok(Number(await hiddenHint.evaluate((element) => getComputedStyle(element).opacity)) < .01);
  await hiddenControl.hover();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-xray-hint]')).opacity) > .2);
  assert.ok(Number(await hiddenHint.evaluate((element) => getComputedStyle(element).opacity)) <= .36);
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-xray-hint]')).opacity) < .01, null, { timeout: 5000 });
  await hiddenControl.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await hiddenControl.evaluate((button) => button === document.activeElement), true);
  assert.ok(Number(await hiddenHint.evaluate((element) => getComputedStyle(element).opacity)) > .9, 'Keyboard discovery stays readable even after the timed hover reveal has ended.');
  assert.deepEqual(errors, []);
  console.log('PASS master ink/privacy: organic blank-area imprints, excluded controls/navigation, finite cap/expiry, nonpersistent default visitor feedback and zero storage writes.');
  }
  assert.deepEqual(errors, []);
  await context.close();

  for (const width of [320, 390, 768, 1920]) {
    const responsive = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 1000 },
      hasTouch: width < 600, isMobile: width < 600, reducedMotion: width < 600 ? 'no-preference' : 'reduce',
    });
    const responsivePage = await responsive.newPage();
    const responsiveErrors = errorsFor(responsivePage);
    await readyHome(responsivePage);
    if (width < 600) {
      for (const selector of ['#selected-work', '#contact']) {
        await scrollProgress(responsivePage, selector, 0);
        const start = await itemStates(responsivePage, selector);
        assert.ok(start.every((item) => item.left >= width), `Mobile labels begin outside the viewport at ${width}px.`);
        await scrollProgress(responsivePage, selector, .48);
        const midway = await itemStates(responsivePage, selector);
        if (width === 390 && selector === '#selected-work') await responsivePage.screenshot({ path: new URL('master-mobile-motion-midway.png', artifacts).pathname });
        await scrollProgress(responsivePage, selector, 1);
        assert.ok((await itemStates(responsivePage, selector)).every((item) => Math.abs(item.x) < .1 && item.opacity > .99));
        await scrollProgress(responsivePage, selector, .48);
        closeStates(await itemStates(responsivePage, selector), midway, `Mobile reverse scrolling at ${width}px`);
      }
      await responsivePage.emulateMedia({ reducedMotion: 'reduce' });
      await frames(responsivePage);
    }
    await horizontal(responsivePage, '#selected-work .category-link', width);
    await horizontal(responsivePage, '#contact .contact-link', width);
    assert.deepEqual(await responsivePage.locator('#selected-work .category-link').evaluateAll((links) => links.map((link) => new URL(link.href).pathname)), categories.map((category) => `/work/${category}`));
    if (!motionOnly) {
    const footerButton = responsivePage.locator('[data-xray-toggle]');
    await footerButton.scrollIntoViewIfNeeded();
    const touchTarget = await footerButton.boundingBox();
    assert.ok(touchTarget.width >= 44 && touchTarget.height >= 44);
    if (width < 600) await footerButton.tap(); else await footerButton.click();
    await waitMode(responsivePage, 'xray');
    assert.equal(await footerButton.getAttribute('aria-pressed'), 'true');
    assert.doesNotMatch(await responsivePage.locator('#contact').evaluate((element) => getComputedStyle(element).filter), /invert|h4-xray/, 'Readable UI must be protected from image processing.');
    if (width < 600) {
      const filter = await responsivePage.evaluate(async () => {
        const figure = document.createElement('figure');
        figure.className = 'project-image';
        figure.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;pointer-events:none';
        const image = new Image();
        image.alt = 'temporary supplied-art processing fixture';
        image.src = '/assets/tattoo-texture.webp';
        figure.append(image);
        document.body.append(figure);
        await image.decode();
        const computed = getComputedStyle(image).filter;
        figure.remove();
        return { image: computed, hero: getComputedStyle(document.getElementById('logo-canvas')).filter, quality: document.documentElement.dataset.xrayQuality };
      });
      assert.equal(filter.quality, 'lite');
      assert.match(filter.image, /h4-xray-lite/, 'Mobile photographs must use the reduced-cost solarization filter.');
      assert.doesNotMatch(filter.hero, /url\(/, 'Animated mobile WebGL stays out of the multi-pass SVG pipeline.');
    }
    }
    await responsivePage.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    const layout = await responsivePage.evaluate(() => ({
      tagline: document.querySelector('.identity').getBoundingClientRect().right,
      navigation: document.querySelector('.hero-nav').getBoundingClientRect().left,
      pageWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(layout.pageWidth <= width + 1);
    assert.ok(layout.tagline < layout.navigation, `Tagline and navigation must not collide at ${width}px.`);
    if (width === 390) {
      const contact = responsivePage.locator('#contact');
      await contact.scrollIntoViewIfNeeded();
      const touchPoint = await responsivePage.locator('#contact .kinetic-heading').boundingBox();
      const before = await responsivePage.evaluate(() => ({ y: scrollY, marks: document.querySelectorAll('[data-ink-mark]').length }));
      const touch = await responsive.newCDPSession(responsivePage);
      const x = touchPoint.x + 12;
      const y = Math.min(760, Math.max(150, touchPoint.y + 20));
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let index = 1; index <= 4; index++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + index * 30 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await responsivePage.waitForTimeout(150);
      assert.ok(await responsivePage.evaluate(() => scrollY) < before.y - 20, 'A real touch swipe through typography must retain normal page scrolling.');
      assert.equal(await responsivePage.locator('[data-ink-mark]').count(), before.marks, 'A scroll gesture must not leave an ink mark.');
    }
    if (!motionOnly) {
      if (width === 390) await captureHomepage(responsivePage, 'master-mobile-xray.png');
      await mode(responsivePage, 'normal');
    }
    if (width === 390) await captureHomepage(responsivePage, 'master-mobile-normal.png');
    assert.deepEqual(responsiveErrors, []);
    await responsive.close();
    console.log(`PASS master responsive ${width}px: horizontal typographic strips, page bounds, reduced motion${motionOnly ? ', native scrolling' : ', footer touch target and The Other Side control'}.`);
  }
} finally {
  await browser.close();
}
