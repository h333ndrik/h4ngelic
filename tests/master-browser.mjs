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
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const categories = ['tattoos', 'jewellery', 'paintings'];
const frames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const snapshot = (page) => page.evaluate(() => window.__H4_TEST__.snapshot());
const errorsFor = (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
};
async function readyHome(page) {
  await page.goto(route('/?test=1'), { waitUntil: 'networkidle' });
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  if (!await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) await page.locator('[data-scroll-choreography]').waitFor();
  if (await page.locator('#pause-control').getAttribute('aria-pressed') === 'false') await page.locator('#pause-control').click();
  await page.evaluate(() => document.activeElement?.blur());
  await frames(page);
}
async function pageKind(page, kind) {
  await page.waitForFunction((expected) => document.documentElement.dataset.page === expected, kind);
  await page.evaluate(async () => Promise.allSettled(document.getAnimations().filter((animation) => animation.effect?.pseudoElement?.startsWith('::view-transition')).map((animation) => animation.finished)));
  await frames(page);
}
async function scrollProgress(page, selector, progress) {
  const position = await page.locator(selector).evaluate(async (section, value) => {
    const { motionSettings } = await import('/src/data/motionSettings.js');
    const run = parseFloat(getComputedStyle(section).getPropertyValue('--motion-run'));
    if (!Number.isFinite(run) || run <= 0) throw new Error('A pinned section must expose a positive native scroll run.');
    const approach = innerHeight * motionSettings.approach;
    return section.getBoundingClientRect().top + scrollY - approach + (approach + run) * value;
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
    return { x: matrix.m41, y: matrix.m42, rotation: Math.atan2(matrix.m12, matrix.m11), opacity: Number(style.opacity), left: box.left, top: box.top, bottom: box.bottom };
  }));
}
async function echoStates(page, selector) {
  return page.locator(`${selector} .motion-echo`).evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item);
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    return { x: matrix.m41, opacity: Number(style.opacity) };
  }));
}
function closeStates(actual, expected, message) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index++) {
    for (const property of ['x', 'opacity', ...(actual[index].rotation === undefined ? [] : ['rotation'])]) assert.ok(Math.abs(actual[index][property] - expected[index][property]) < (property === 'x' ? .1 : .001), `${message}: item ${index}, ${property}.`);
  }
}
async function horizontal(page, selector, width) {
  const links = page.locator(selector);
  assert.equal(await links.count(), 3);
  const boxes = await Promise.all([0, 1, 2].map((index) => links.nth(index).boundingBox()));
  assert.ok(boxes.every(Boolean));
  assert.ok(Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y)) < 2, `Links must share one row at ${width}px.`);
  assert.ok(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No document overflow at ${width}px.`);
}
async function crispEchoes(page, selector) {
  assert.ok((await echoStates(page, selector)).every((echo) => echo.opacity < .001 && Math.abs(echo.x) < .01), 'The final/focused typography must have no remaining trail.');
}
async function normalPresentation(page) {
  await page.locator('html[data-xray-ready][data-mode="normal"]').waitFor();
  assert.equal(await page.locator('html').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(48, 48, 51)');
  assert.equal(await page.locator('[data-other-side-hint][data-mode-hold]').count(), 1, 'The activated mode has its subtle footer hold control.');
  assert.equal(await page.locator('[data-xray-hint-text]').textContent(), 'HOLD 4 TO SEE THE OTHER SIDE.');
  assert.equal(await page.locator('[data-visit-counter-hotspot]').count(), 1, 'The hidden visit count remains separate from the header greeting.');
}
async function captureHomepage(page, filename) {
  const before = await snapshot(page);
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
  await page.waitForFunction((frame) => window.__H4_TEST__.snapshot().frameCount > frame && Number(getComputedStyle(document.getElementById('stage')).opacity) > .99, before.frameCount, { timeout: 10000 });
  await frames(page);
  await page.screenshot({ path: new URL(filename, artifacts).pathname, fullPage: true });
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.__storageWrites = [];
    for (const method of ['setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) { window.__storageWrites.push({ method, key: String(args[0] || ''), value: args[1] }); return original.apply(this, args); };
    }
  });
  const page = await context.newPage();
  const errors = errorsFor(page);
  await readyHome(page);
  assert.equal((await page.locator('.identity').innerText()).replace(/\s+/g, ' ').trim(), 'art on skin & beyond');
  assert.deepEqual((await page.locator('.kinetic-heading').allTextContents()).map((text) => text.toUpperCase()), ['01 / SELECTED WORKS', '02 / ABOUT', '03 / CONTACT']);
  assert.equal(await page.locator('#page-content > .content-section').count(), 3);
  const headerLabels = await page.locator('.masthead h1, .masthead .edition').evaluateAll((items) => items.map((item) => {
    const box = item.getBoundingClientRect(); return { text: item.textContent.trim(), left: box.left, right: box.right };
  }));
  assert.deepEqual(headerLabels.map((item) => item.text), ['h4ngelic © 2026', 'berlin, de']);
  assert.ok(Math.abs(headerLabels[0].left - 35) < 1 && Math.abs(headerLabels[1].right - 1405) < 1, 'The original left and right masthead labels retain their desktop positions.');
  const headings = await page.locator('.kinetic-heading').evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item);
    return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing, style.color, style.textShadow, style.backgroundColor, style.marginTop, style.marginBottom];
  }));
  assert.deepEqual(headings[0], headings[1]); assert.deepEqual(headings[1], headings[2]);
  assert.ok(parseFloat(headings[0][1]) >= 48 && parseFloat(headings[0][1]) <= 88, 'All three editorial headings share the large, restrained type scale.');
  assert.equal(headings[0][6], 'none');
  assert.equal(headings[0][7], 'rgba(0, 0, 0, 0)');
  const surfaces = await page.locator('#page-content > .content-section,.category-strip,.category-link,.contact-links,.contact-link,.exhibition-footer-home').evaluateAll((items) => items.map((item) => {
    const s = getComputedStyle(item); return { borders: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth], background: s.backgroundColor, shadow: s.boxShadow };
  }));
  assert.ok(surfaces.every((surface) => surface.borders.every((border) => parseFloat(border) === 0) && surface.background === 'rgba(0, 0, 0, 0)' && surface.shadow === 'none'), 'Sections and links share one uninterrupted surface without divider lines, background panels or boxes.');
  const linkTypography = await page.locator('#selected-work .category-link,#contact .contact-link').evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item); return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing, style.padding];
  }));
  assert.ok(linkTypography.every((style) => JSON.stringify(style) === JSON.stringify(linkTypography[0])), 'Work and contact links share the same type scale and relative spacing.');
  assert.equal(await page.locator('#selected-work img,#selected-work picture,#contact .contact-link-primary').count(), 0);
  const header = await page.locator('[data-visitor-hotspot]').boundingBox();
  assert.ok(Math.abs(header.x + header.width / 2 - 720) < 1, 'The secret header region is centered on the viewport.');
  assert.ok(Number(await page.locator('[data-visit-message]').evaluate((element) => getComputedStyle(element).opacity)) < .01);
  const moreAbout = page.locator('.about-preview .text-link');
  assert.ok(parseFloat(await moreAbout.evaluate((element) => getComputedStyle(element).fontSize)) >= 24, 'MORE ABOUT has a prominent editorial size.');
  await normalPresentation(page);

  for (const selector of ['#selected-work', '#contact']) {
    await scrollProgress(page, selector, 0);
    const range = await page.locator(selector).evaluate((section) => ({ top: section.getBoundingClientRect().top / innerHeight, run: parseFloat(getComputedStyle(section).getPropertyValue('--motion-run')) / innerHeight }));
    assert.ok(range.top >= .8 && range.top <= .9, 'The entrance begins when its section reaches the lower 80–90% of the viewport.');
    assert.ok(range.run > 0 && range.run <= .75, 'Each native pin lasts less than three quarters of a viewport.');
    const initial = await itemStates(page, selector);
    assert.equal(initial.length, 3);
    assert.ok(initial.every((item) => item.left >= 1440 && item.x >= 1440), 'Every word begins fully beyond the right edge.');
    await scrollProgress(page, selector, .08);
    const early = await itemStates(page, selector);
    assert.ok(early[0].x < initial[0].x && early[0].opacity > 0, 'The fly-in must already move during the approach, before sticky pinning.');
    await scrollProgress(page, selector, .28);
    const midway = await itemStates(page, selector);
    const echoes = await echoStates(page, selector);
    assert.ok(midway[0].x < midway[1].x && midway[1].x < midway[2].x, 'The three arrivals remain staggered.');
    assert.ok(midway[0].top < 1000 && midway[0].bottom > 0 && midway[0].x > 5, 'The visitor sees a genuine moving word as the section enters.');
    assert.equal(echoes.length, 6, 'Each of the three real links has at most two decorative copies.');
    assert.ok(echoes.some((echo) => echo.opacity >= .1 && echo.opacity <= .25 && echo.x > 0));
    const semantics = await page.locator(`${selector} .motion-echo`).evaluateAll((items) => items.map((item) => ({ aria: item.getAttribute('aria-hidden'), text: item.textContent, label: item.dataset.echoText, generated: getComputedStyle(item, '::before').content, events: getComputedStyle(item).pointerEvents, blur: getComputedStyle(item).filter, color: getComputedStyle(item).color, controls: item.querySelectorAll('a,button,[tabindex]').length })));
    assert.ok(semantics.every((item) => item.aria === 'true' && item.text === '' && item.label && item.generated.includes(item.label) && item.events === 'none' && item.blur === 'none' && item.color === 'rgb(240, 239, 235)' && item.controls === 0), 'Monochrome echoes are empty decorative spans with generated text and no duplicate semantic text or interaction.');
    assert.ok((await page.locator(`${selector} .kinetic-item`).evaluateAll((items) => items.map((item) => item.querySelectorAll(':scope > .motion-echo').length))).every((count) => count <= 2), 'No moving label may receive more than two ghost layers.');
    const pinStart = await scrollProgress(page, selector, .68);
    const beforePin = await page.locator(`${selector} .section-pin`).boundingBox();
    await scrollProgress(page, selector, .74);
    const afterPin = await page.locator(`${selector} .section-pin`).boundingBox();
    assert.ok(Math.abs(beforePin.y - afterPin.y) < 2 && pinStart > 0, 'The shorter native pin remains active during the late stagger.');
    await scrollProgress(page, selector, 1);
    assert.ok((await itemStates(page, selector)).every((item) => Math.abs(item.x) < .1 && item.opacity > .99));
    await crispEchoes(page, selector);
    await horizontal(page, `${selector} ${selector === '#contact' ? '.contact-link' : '.category-link'}`, 1440);
    await scrollProgress(page, selector, .28);
    closeStates(await itemStates(page, selector), midway, 'Reverse text progress');
    closeStates(await echoStates(page, selector), echoes, 'Reverse echo progress');
    await page.waitForTimeout(180);
    closeStates(await echoStates(page, selector), echoes, 'Stopped echo progress');
    const startY = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 60);
    await page.waitForFunction((start) => scrollY > start + 20, startY);
    await scrollProgress(page, selector, 0);
    closeStates(await itemStates(page, selector), initial, 'Exact entrance restoration');
  }
  await scrollProgress(page, '#selected-work', .28);
  await page.screenshot({ path: new URL('master-motion-midway.png', artifacts).pathname });
  await page.locator('#selected-work .category-link').first().focus();
  assert.ok((await itemStates(page, '#selected-work')).every((item) => item.opacity > .99 && Math.abs(item.x) < .1));
  await crispEchoes(page, '#selected-work');
  await page.evaluate(() => document.activeElement?.blur());

  const aboutRange = await page.locator('[data-motion="about"]').evaluate(async (section) => {
    const { motionSettings } = await import('/src/data/motionSettings.js');
    const top = section.getBoundingClientRect().top + scrollY;
    return { start: top - innerHeight * motionSettings.about.approach, end: top - innerHeight * motionSettings.about.finish };
  });
  assert.equal(await page.locator('[data-motion="about"][data-motion-pin]').count(), 0);
  assert.ok(aboutRange.end - aboutRange.start <= 900, 'About stays within a short unpinned viewport approach.');
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), aboutRange.start);
  await frames(page);
  const aboutStart = await itemStates(page, '[data-motion="about"]');
  assert.ok(aboutStart.every((item) => item.left >= 1440), 'About copy and link also start fully to the right.');
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), (aboutRange.start + aboutRange.end) / 2);
  await frames(page);
  const aboutMidway = await itemStates(page, '[data-motion="about"]');
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), aboutRange.end);
  await frames(page);
  assert.ok((await itemStates(page, '[data-motion="about"]')).every((item) => Math.abs(item.x) < .1 && item.opacity > .99));
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), (aboutRange.start + aboutRange.end) / 2);
  await frames(page);
  closeStates(await itemStates(page, '[data-motion="about"]'), aboutMidway, 'About reversibility');

  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => window.__H4_TEST__.snapshot().camera.amount === 0);
  const originalHero = await snapshot(page);
  await page.evaluate(() => scrollTo({ top: innerHeight * .65, behavior: 'instant' }));
  await page.waitForFunction((frame) => window.__H4_TEST__.snapshot().frameCount > frame && window.__H4_TEST__.snapshot().camera.amount > .1, originalHero.frameCount);
  const depth = await snapshot(page);
  assert.ok(depth.camera.position[2] > originalHero.camera.position[2] && depth.camera.position[2] < originalHero.camera.position[2] * 1.09);
  assert.ok(depth.camera.fov > originalHero.camera.fov && depth.camera.fov <= originalHero.camera.fov + 1.01);
  assert.ok(Math.abs(depth.camera.position[0] / depth.camera.position[2]) < .02 && Math.abs(depth.camera.position[1] / depth.camera.position[2]) < .01);
  assert.deepEqual(depth.position, originalHero.position, 'Camera composition cannot overwrite the sculpture position.');
  assert.deepEqual(depth.orientation, originalHero.orientation, 'Camera composition cannot overwrite physical orientation.');
  assert.equal(depth.baseTime, originalHero.baseTime, 'Paused sculpture phase stays independent from scroll.');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => window.__H4_TEST__.snapshot().camera.amount === 0);
  const restored = await snapshot(page);
  assert.deepEqual(restored.camera, originalHero.camera, 'Upward scrolling restores the exact original camera.');
  await page.locator('#pause-control').click();
  await page.waitForFunction((time) => window.__H4_TEST__.snapshot().baseTime > time + .05, restored.baseTime);
  await page.locator('#pause-control').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await frames(page);
  assert.equal(await page.locator('.motion-echo').count(), 0);
  for (const pin of await page.locator('.section-pin').all()) assert.notEqual(await pin.evaluate((element) => getComputedStyle(element).position), 'sticky');
  await page.evaluate(() => scrollTo({ top: innerHeight * .65, behavior: 'instant' }));
  await page.waitForFunction(() => window.__H4_TEST__.snapshot().camera.amount === 0);
  await captureHomepage(page, 'master-home-normal.png');
  console.log('PASS master motion: divider-free headings, early visible stagger, decorative reversible trails, short pinning, camera depth composition and reduced-motion restoration.');

  if (!motionOnly) {
    // Browser-memory fixture only: no fabricated artwork is written to data files.
    await page.evaluate(async () => {
      const source = performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === '/src/data/artworks.js')?.name || '/src/data/artworks.js';
      const { artworks } = await import(source);
      artworks.push({ id: 'master-browser-fixture', slug: 'master-browser-fixture', category: 'tattoos', title: 'temporary browser fixture', description: 'Supplied reflection artwork used only in a browser test.', year: 2026,
        images: [{ src: '/assets/tattoo-texture.webp', alt: 'supplied artwork first test view', width: 1024, height: 1448 }, { src: '/assets/tattoo-texture.webp?detail=1', alt: 'supplied artwork second test view', width: 1024, height: 1448 }] });
    });
    await page.locator('#selected-work a[href="/work/tattoos"]').click();
    await pageKind(page, 'work');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const imageLink = page.locator('.project-image a[href="/work/tattoos/master-browser-fixture"]').first();
    const archiveImages = page.locator('#project-master-browser-fixture .project-image');
    assert.equal(await archiveImages.locator('button,[data-artwork-open]').count(), 0, 'Archive photos use real detail links rather than opening a route-less viewer.');
    assert.deepEqual(await archiveImages.locator('a[data-artwork-link]').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), ['/work/tattoos/master-browser-fixture', '/work/tattoos/master-browser-fixture#image-2']);
    await imageLink.locator('img').evaluate((image) => image.decode());
    await imageLink.scrollIntoViewIfNeeded();
    const galleryY = await page.evaluate(() => scrollY);
    await imageLink.click();
    await pageKind(page, 'artwork');
    assert.equal(new URL(page.url()).pathname, '/work/tattoos/master-browser-fixture');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://h4ngelic.com/work/tattoos/master-browser-fixture');
    assert.equal(await page.locator('h1:visible').textContent(), 'temporary browser fixture');
    assert.equal(await page.locator('.project-image img').count(), 2);
    const openers = page.locator('[data-artwork-open]');
    await openers.first().focus();
    await page.keyboard.press('Tab');
    assert.equal(await openers.last().evaluate((button) => button === document.activeElement), true);
    assert.ok(Number(await openers.last().locator('img').evaluate((image) => getComputedStyle(image).opacity)) > .99, 'Keyboard focus unmasks real detail images.');
    await page.goBack(); await pageKind(page, 'work');
    await page.waitForFunction((top) => Math.abs(scrollY - top) < 2, galleryY);
    await page.goForward(); await pageKind(page, 'artwork');
    await openers.first().click(); await waitViewer(page, 1);
    await page.keyboard.press('ArrowRight'); await waitViewer(page, 2);
    await page.keyboard.press('ArrowLeft'); await waitViewer(page, 1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.artwork-dialog').open);
    assert.equal(await openers.first().evaluate((button) => button === document.activeElement), true);
    await page.keyboard.press('4');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', 'A quick 4 press must not accidentally change realities.');
    await page.locator('a[href="/about"]:visible').first().click(); await pageKind(page, 'about');
    assert.match(await page.locator('main').textContent(), /h333ndrik/);
    await page.locator('a[href="/work"]:visible').first().click(); await pageKind(page, 'work');
    const blank = page.locator('.page-heading');
    const shapes = [];
    for (let index = 0; index < 3; index++) {
      await blank.click({ position: { x: 240 + index * 16, y: 35 } });
      await page.waitForFunction((count) => document.querySelectorAll('[data-ink-mark]').length >= count, index + 1);
      shapes.push(await page.locator('[data-ink-mark]').last().locator('path').first().getAttribute('d'));
    }
    assert.equal(new Set(shapes).size, 3, 'Separate blank-area clicks create genuinely different contours.');
    assert.equal(await page.locator('[data-ink-mark]').first().evaluate((mark) => getComputedStyle(mark).pointerEvents), 'none');
    const lifetimes = await page.locator('[data-ink-mark]').evaluateAll((marks) => marks.map((mark) => parseFloat(mark.style.getPropertyValue('--ink-lifetime'))));
    assert.ok(lifetimes.every((lifetime) => lifetime >= 6000 && lifetime <= 12000), 'The organic marks receive the requested six-to-twelve-second lifecycle.');
    const anchored = await page.locator('[data-ink-mark]').first().evaluate((mark) => ({ y: mark.getBoundingClientRect().top, scroll: scrollY }));
    await page.evaluate(() => scrollBy({ top: 140, behavior: 'instant' }));
    await frames(page);
    const scrolled = await page.locator('[data-ink-mark]').first().evaluate((mark) => ({ y: mark.getBoundingClientRect().top, scroll: scrollY }));
    assert.ok(scrolled.scroll > anchored.scroll + 20, 'The ink-position check must exercise actual document scrolling.');
    assert.ok(Math.abs(scrolled.y + scrolled.scroll - anchored.y - anchored.scroll) < 1, 'Ink stays at its exact document position while the viewport moves.');
    const count = await page.locator('[data-ink-mark]').count();
    await page.locator('.filter-link[aria-current="page"]').click(); await pageKind(page, 'work');
    assert.ok(await page.locator('[data-ink-mark]').count() <= count, 'Functional navigation must not add ink.');
    await page.waitForFunction(() => document.querySelectorAll('[data-ink-mark]').length === 0, null, { timeout: 13200 });
    await page.locator('.brand-link').click(); await pageKind(page, 'home');
    await page.locator('#stage.is-ready').waitFor();
    assert.equal(await page.locator('[data-visit-message]').textContent(), 'nice to meet you.');
    const remembered = await page.evaluate(() => JSON.parse(localStorage.getItem('h4ngelic.visits.v1')));
    assert.equal(remembered.count, 1, 'Route navigation belongs to the same local visit.');
    assert.deepEqual(Object.keys(remembered).sort(), ['count', 'lastSeen'], 'Visit memory stores only its count and last activity.');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-visit-message]').textContent(), 'nice to meet you.');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('h4ngelic.visits.v1')).count), 1, 'An immediate reload does not increment the visit counter.');
    const writes = await page.evaluate(() => window.__storageWrites);
    assert.ok(writes.some((entry) => entry.method === 'setItem' && entry.key === 'h4ngelic.visits.v1'));
    assert.ok(writes.every((entry) => entry.key === 'h4ngelic.visits.v1'), 'The default integration uses only its local visit record.');
    await normalPresentation(page);
    console.log('PASS master integration: semantic image-to-detail URLs/history, accessible viewer, document-anchored procedural ink, minimal local visit memory and safe short-key behavior.');
  }
  assert.deepEqual(errors, []);
  await context.close();

  for (const width of [320, 390, 768, 1920]) {
    const responsive = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, hasTouch: width < 600, isMobile: width < 600, reducedMotion: width < 600 ? 'no-preference' : 'reduce', deviceScaleFactor: 1 });
    const p = await responsive.newPage(); const errors = errorsFor(p);
    await readyHome(p);
    if (width < 600) {
      for (const selector of ['#selected-work', '#contact']) {
        await scrollProgress(p, selector, 0); const original = await itemStates(p, selector);
        assert.ok(original.every((item) => item.left >= width));
        await scrollProgress(p, selector, .28); const midway = await itemStates(p, selector); const ghosts = await echoStates(p, selector);
        if (width === 390 && selector === '#selected-work') await p.screenshot({ path: new URL('master-mobile-motion-midway.png', artifacts).pathname });
        await scrollProgress(p, selector, 1); await crispEchoes(p, selector);
        await scrollProgress(p, selector, .28);
        closeStates(await itemStates(p, selector), midway, `${width}px reverse text`);
        closeStates(await echoStates(p, selector), ghosts, `${width}px reverse ghosts`);
      }
      await p.emulateMedia({ reducedMotion: 'reduce' }); await frames(p);
    }
    await horizontal(p, '#selected-work .category-link', width);
    await horizontal(p, '#contact .contact-link', width);
    const responsiveHeadings = await p.locator('.kinetic-heading').evaluateAll((items) => items.map((item) => parseFloat(getComputedStyle(item).fontSize)));
    assert.ok(responsiveHeadings.every((size) => size >= 32 && size <= 88 && size === responsiveHeadings[0]), `The shared editorial heading scale remains legible at ${width}px.`);
    assert.deepEqual(await p.locator('#selected-work .category-link').evaluateAll((links) => links.map((link) => new URL(link.href).pathname)), categories.map((category) => `/work/${category}`));
    const visitor = await p.locator('[data-visitor-hotspot]').boundingBox();
    assert.ok(Math.abs(visitor.x + visitor.width / 2 - width / 2) < 1, `Header secret is viewport-centered at ${width}px.`);
    const gap = await p.locator('[data-footer-secret-space]').boundingBox();
    assert.ok(gap.height >= (width < 600 ? 844 : 1000) * .25);
    await normalPresentation(p);
    const layout = await p.evaluate(() => ({ tagline: document.querySelector('.identity').getBoundingClientRect().right, navigation: document.querySelector('.hero-nav').getBoundingClientRect().left }));
    assert.ok(layout.tagline < layout.navigation, `Tagline/navigation do not collide at ${width}px.`);
    if (width === 390) await captureHomepage(p, 'master-mobile-normal.png');
    assert.deepEqual(errors, []); await responsive.close();
    console.log(`PASS master responsive ${width}px: horizontal strips, reversible motion, centered hidden header, hidden mode instruction/count and reduced motion.`);
  }
} finally { await browser.close(); }
