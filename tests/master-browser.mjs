import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { assertNormalTheme } from './helpers/normal-theme.mjs';
import { motionSettings } from '../src/data/motionSettings.js';

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
const categories = ['tattoos', 'jewellery', 'tools', 'more'];
const categoryPaths = ['/creative/tattoos', '/creative/jewellery', '/creative/tools', '/creative/more'];
const frames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const snapshot = (page) => page.evaluate(() => window.__H4_TEST__.snapshot());
const errorsFor = (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
};
async function readyHome(page) {
  await page.goto(route('/?test=1'), { waitUntil: 'networkidle' });
  await page.locator('#stage.is-ready, #stage.is-poster-static').first().waitFor({ timeout: 60000 });
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!reduced) await page.locator('[data-scroll-choreography]').waitFor();
  if (!reduced && await page.locator('#pause-control').getAttribute('aria-pressed') === 'false') await page.locator('#pause-control').click();
  await page.evaluate(() => document.activeElement?.blur());
  await frames(page);
}
async function pageKind(page, kind) {
  await page.waitForFunction((expected) => document.documentElement.dataset.page === expected, kind);
  await page.evaluate(async () => Promise.allSettled(document.getAnimations().filter((animation) => animation.effect?.pseudoElement?.startsWith('::view-transition')).map((animation) => animation.finished)));
  await frames(page);
}
async function indexNavigate(page, name) {
  await page.locator('[data-global-index] > summary').click();
  await page.locator(`[data-index-page="${name}"]`).click();
  await pageKind(page, name);
}
async function scrollProgress(page, selector, progress) {
  const position = await page.locator(selector).evaluate((section, { value, approachRatio }) => {
    const run = parseFloat(getComputedStyle(section).getPropertyValue('--motion-run'));
    if (!Number.isFinite(run) || run <= 0) throw new Error('A pinned section must expose a positive native scroll run.');
    const approach = innerHeight * approachRatio;
    return section.getBoundingClientRect().top + scrollY - approach + (approach + run) * value;
  }, { value: progress, approachRatio: motionSettings.approach });
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), position);
  await frames(page);
  return position;
}
async function itemStates(page, selector) {
  return page.locator(`${selector} .kinetic-item, ${selector} .inquiry-enter`).evaluateAll((items) => items.map((item) => {
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
  assert.equal(await links.count(), categories.length);
  const boxes = await Promise.all(categories.map((_, index) => links.nth(index).boundingBox()));
  assert.ok(boxes.every(Boolean));
  if (width < 600) {
    assert.ok(boxes[0].y < boxes[2].y && Math.abs(boxes[0].y - boxes[1].y) < 2
      && Math.abs(boxes[2].y - boxes[3].y) < 2, `Rubrics form a 2x2 grid at ${width}px.`);
    assert.ok(boxes[0].x < boxes[1].x && boxes[2].x < boxes[3].x);
  } else {
    assert.ok(Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y)) < 2, `Links must share one row at ${width}px.`);
    assert.ok(boxes.every((box, index) => index === 0 || boxes[index - 1].x < box.x));
  }
  assert.ok(boxes.every((box) => box.x >= 0 && box.x + box.width <= width + 1), `Every rubric stays inside ${width}px.`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No document overflow at ${width}px.`);
}
async function crispEchoes(page, selector) {
  assert.ok((await echoStates(page, selector)).every((echo) => echo.opacity < .001 && Math.abs(echo.x) < .01), 'The final/focused typography must have no remaining trail.');
}
async function normalPresentation(page) {
  await page.locator('html[data-xray-ready][data-mode="normal"]').waitFor();
  await assertNormalTheme(page);
  assert.equal(await page.locator('[data-other-side-hint][data-mode-hold]').count(), 1, 'The activated mode has its subtle footer hold control.');
  assert.equal(await page.locator('[data-xray-hint-text]').textContent(), 'hold 4 to see the other side.');
  assert.equal(await page.locator('[data-visit-counter-hotspot]').count(), 1, 'The permanent local count lives in the footer identity row.');
  assert.equal(await page.locator('[data-controls] [data-mode-mute]').count(), 1);
  assert.equal(await page.locator('.page-footer [data-mode-mute]').count(), 0);
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
  assert.equal(await page.locator('.identity').count(), 0, 'The hero tagline is removed entirely.');
  assert.deepEqual((await page.locator('.kinetic-heading').allTextContents()).map((text) => text.toUpperCase()), ['01/ CREATIVE', '02/ MORE ABOUT', '03/ CONTACT']);
  assert.equal(await page.locator('#page-content > .content-section').count(), 3);
  const headerLabels = await page.evaluate(() => [document.querySelector('.masthead h1'), document.querySelector('.global-index > summary')].map((item) => {
    const box = item.getBoundingClientRect(); return { text: item.textContent.trim(), left: box.left, right: box.right };
  }));
  assert.deepEqual(headerLabels.map((item) => item.text.replace(/\s+/g, ' ')), ['h4ngelic', '+']);
  assert.ok(Math.abs(headerLabels[0].left - 35) < 1 && Math.abs(headerLabels[1].right - 1418) < 1, 'Brand and compact INDEX retain the editorial header insets.');
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
  const linkTypography = await page.locator('#selected-work .category-link').evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item); return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing, style.padding];
  }));
  assert.equal(linkTypography.length, categories.length);
  assert.ok(linkTypography.every((style) => JSON.stringify(style) === JSON.stringify(linkTypography[0])), 'All frontpage rubrics share one type scale and spacing.');
  assert.equal(await page.locator('#selected-work .category-sublinks,#contact .contact-link').count(), 0, 'V6 keeps homepage sublabels out and replaces Contact links with the shared inquiry.');
  assert.equal(await page.locator('#contact [data-inquiry-form]').count(), 1);
  assert.equal(await page.locator('#selected-work img,#selected-work picture,#contact .contact-link-primary').count(), 0);
  const localCounter = await page.locator('[data-visit-counter-hotspot]').boundingBox();
  assert.ok(localCounter.x >= 0 && localCounter.x + localCounter.width < 720, 'The permanent local count sits in the left footer cluster.');
  assert.ok(Number(await page.locator('[data-visit-message]').evaluate((element) => getComputedStyle(element).opacity)) < .01);
  const moreAbout = page.locator('.about-preview .kinetic-heading');
  assert.ok(parseFloat(await moreAbout.evaluate((element) => getComputedStyle(element).fontSize)) >= 48, 'MORE ABOUT keeps the shared prominent editorial heading size.');
  await normalPresentation(page);

  const selectedWork = page.locator('#selected-work');
  assert.equal(await selectedWork.count(), 1);
  assert.equal(await selectedWork.locator('.category-link').count(), categories.length);
  assert.equal(await selectedWork.locator('.motion-echo').count(), 0, 'The retired decorative trails stay absent.');
  assert.equal(await selectedWork.evaluate((section) => section.hasAttribute('data-motion-pin')), false);
  assert.notEqual(await selectedWork.locator('.section-pin').evaluate((element) => getComputedStyle(element).position), 'sticky');
  await horizontal(page, '#selected-work .category-link', 1440);
  await page.locator('#selected-work .category-link').first().focus();
  assert.ok((await itemStates(page, '#selected-work')).every((item) => item.opacity > .99 && Math.abs(item.x) < .1));
  await page.evaluate(() => document.activeElement?.blur());

  const aboutRange = await page.locator('[data-motion="about"]').evaluate((section, settings) => {
    const top = section.getBoundingClientRect().top + scrollY;
    return { start: top - innerHeight * settings.approach, end: top - innerHeight * settings.finish };
  }, motionSettings.about);
  assert.equal(await page.locator('[data-motion="about"][data-motion-pin]').count(), 0);
  assert.ok(aboutRange.end - aboutRange.start <= 900, 'About stays within a short unpinned viewport approach.');
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), aboutRange.start);
  await frames(page);
  const aboutStart = await itemStates(page, '[data-motion="about"]');
  assert.ok(aboutStart.every((item) => item.opacity < .01 && item.x > 20), 'About copy and link begin with their measured calm inset.');
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), (aboutRange.start + aboutRange.end) / 2);
  await frames(page);
  const aboutMidway = await itemStates(page, '[data-motion="about"]');
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), aboutRange.end);
  await frames(page);
  assert.ok((await itemStates(page, '[data-motion="about"]')).every((item) => Math.abs(item.x) < .1 && item.opacity > .99));
  await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), (aboutRange.start + aboutRange.end) / 2);
  await frames(page);
  closeStates(await itemStates(page, '[data-motion="about"]'), aboutMidway, 'About reversibility');

  // The form has a separate later, unpinned entrance. It must not inherit the
  // old three-link pin/echo fixture or duplicate interactive fields as trails.
  const contactRange = await page.locator('#contact').evaluate(section => {
    const top = section.getBoundingClientRect().top + scrollY;
    return { start: top - innerHeight * .68, end: top - innerHeight * .10 };
  });
  assert.equal(await page.locator('#contact[data-motion-pin]').count(), 0);
  assert.equal(await page.locator('#contact .motion-echo').count(), 0);
  await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), contactRange.start);
  await frames(page);
  const contactStart = await itemStates(page, '#contact');
  assert.equal(contactStart.length, 1);
  assert.ok(contactStart[0].opacity < .01 && contactStart[0].x > 20);
  await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), (contactRange.start + contactRange.end) / 2);
  await frames(page);
  const contactMidway = await itemStates(page, '#contact');
  assert.ok(contactMidway[0].x < contactStart[0].x && contactMidway[0].opacity > .3);
  await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), contactRange.end);
  await frames(page);
  assert.ok((await itemStates(page, '#contact')).every(item => Math.abs(item.x) < .1 && item.opacity > .99));
  await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), (contactRange.start + contactRange.end) / 2);
  await frames(page);
  closeStates(await itemStates(page, '#contact'), contactMidway, 'Contact form reversibility');
  await page.locator('#contact input[name="name"]').focus();
  assert.ok((await itemStates(page, '#contact')).every(item => Math.abs(item.x) < .1 && item.opacity > .99),
    'Direct form focus bypasses the entrance immediately.');
  await page.evaluate(() => document.activeElement?.blur());

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
  console.log('PASS master motion: divider-free headings, calm unpinned entrances, no decorative trails, camera depth composition and reduced-motion restoration.');

  if (!motionOnly) {
    // Browser-memory fixture only: no fabricated artwork is written to data files.
    await page.evaluate(async () => {
      const source = performance.getEntriesByType('resource').find((entry) => new URL(entry.name).pathname === '/src/data/artworks.js')?.name || '/src/data/artworks.js';
      const { artworks } = await import(source);
      artworks.push({ id: 'master-browser-fixture', slug: 'master-browser-fixture', category: 'tattoos', title: 'temporary browser fixture', description: 'Supplied reflection artwork used only in a browser test.', year: 2026,
        images: [{ src: '/assets/tattoo-texture.webp', alt: 'supplied artwork first test view', width: 1024, height: 1448 }, { src: '/assets/tattoo-texture.webp?detail=1', alt: 'supplied artwork second test view', width: 1024, height: 1448 }] });
    });
    await page.locator('#selected-work .category-link[href="/creative/tattoos"]').click();
    await pageKind(page, 'work');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const imageButton = page.locator('[data-horizontal-drift="tattoos"] .drift-artwork').first();
    const archiveImages = page.locator('.drift-item[data-project-url="/creative/master-browser-fixture"] .project-image');
    assert.equal(await archiveImages.locator('button[data-artwork-open]').count(), 2, 'The spatial archive retains both actual photographs in its focused viewer.');
    await imageButton.locator('img').evaluate((image) => image.decode());
    await imageButton.evaluate((element) => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await frames(page);
    const focusedY = await page.evaluate(() => scrollY);
    await imageButton.click({ force: true });
    await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"] [data-inline-expanded]'));
    assert.equal(await imageButton.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('dialog[open]').count(), 0, 'Spatial enlargement stays inside the archive without a modal.');
    assert.equal(new URL(page.url()).pathname + new URL(page.url()).hash, '/creative/tattoos', 'Spatial enlargement keeps its archive and position mounted.');
    await page.keyboard.press('Escape');
    assert.equal(await imageButton.getAttribute('aria-pressed'), 'false');
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - focusedY) < 2, 'Closing spatial enlargement restores the exact archive scroll position.');
    assert.equal(await imageButton.evaluate(button => button === document.activeElement), true);
    const detailLink = page.locator('.drift-meta h2 a[href="/creative/master-browser-fixture"]');
    await detailLink.evaluate((element) => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await frames(page);
    const galleryY = await page.evaluate(() => scrollY);
    await detailLink.click({ force: true });
    await pageKind(page, 'artwork');
    assert.equal(new URL(page.url()).pathname, '/creative/master-browser-fixture');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://h4ngelic.com/creative/master-browser-fixture');
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
    assert.equal(await page.locator('.artwork-dialog').count(), 1);
    assert.equal(await page.locator('.artwork-dialog').evaluate((dialog) => dialog.open), false,
      'The detail viewer stays closed until explicit activation; viewer interaction is covered by artwork-transitions-browser.');
    await page.keyboard.press('4');
    assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', 'A quick 4 press must not accidentally change realities.');
    await indexNavigate(page, 'about');
    assert.match(await page.locator('main').textContent(), /hi, i'm hendrik\./);
    await page.goto(route('/creative'), { waitUntil: 'networkidle' }); await pageKind(page, 'work');
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
    const anchored = await page.locator('[data-ink-mark]').first().evaluate((mark) => {
      const box = mark.getBoundingClientRect();
      return { y: box.top + box.height / 2, scroll: scrollY };
    });
    await page.evaluate(() => scrollBy({ top: 140, behavior: 'instant' }));
    await frames(page);
    const scrolled = await page.locator('[data-ink-mark]').first().evaluate((mark) => {
      const box = mark.getBoundingClientRect();
      return { y: box.top + box.height / 2, scroll: scrollY };
    });
    assert.ok(scrolled.scroll > anchored.scroll + 20, 'The ink-position check must exercise actual document scrolling.');
    assert.ok(Math.abs(scrolled.y + scrolled.scroll - anchored.y - anchored.scroll) < 1, 'Ink stays at its exact document position while the viewport moves.');
    const count = await page.locator('[data-ink-mark]').count();
    await page.locator('.work-filters a[href="/creative/tattoos"]').click(); await pageKind(page, 'work');
    assert.ok(await page.locator('[data-ink-mark]').count() <= count, 'Functional navigation must not add ink.');
    await page.waitForFunction(() => document.querySelectorAll('[data-ink-mark]').length === 0, null, { timeout: 13200 });
    await page.locator('[data-floating-brand]').click(); await pageKind(page, 'home');
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
    assert.equal(await p.locator('#selected-work').evaluate((section) => section.hasAttribute('data-motion-pin')), false,
      `The frontpage rubric stays unpinned at ${width}px.`);
    assert.equal(await p.locator('#selected-work .motion-echo').count(), 0);
    if (width === 390) await p.screenshot({ path: new URL('master-mobile-rubric.png', artifacts).pathname });
    await horizontal(p, '#selected-work .category-link', width);
    assert.equal(await p.locator('#contact [data-inquiry-form]').count(), 1);
    const contactFields = await p.locator('#contact .inquiry-fields').boundingBox();
    assert.ok(contactFields.x >= 0 && contactFields.x + contactFields.width <= width + 1,
      `The inquiry fields fit the ${width}px viewport.`);
    const responsiveHeadings = await p.locator('.kinetic-heading').evaluateAll((items) => items.map((item) => parseFloat(getComputedStyle(item).fontSize)));
    assert.ok(responsiveHeadings.every((size) => size >= 32 && size <= 88 && size === responsiveHeadings[0]), `The shared editorial heading scale remains legible at ${width}px.`);
    assert.deepEqual(await p.locator('#selected-work .category-link').evaluateAll((links) => links.map((link) => new URL(link.href).pathname + new URL(link.href).hash)), categoryPaths);
    const visitor = await p.locator('[data-visit-counter-hotspot]').boundingBox();
    assert.ok(visitor.x >= 0 && visitor.x + visitor.width <= width + 1, `The local visit count stays inside the ${width}px viewport.`);
    const gap = await p.locator('[data-footer-secret-space]').boundingBox();
    assert.ok(gap.height >= (width < 600 ? 844 : 1000) * .25);
    await normalPresentation(p);
    const layout = await p.evaluate(() => {
      const navigation = document.querySelector('.hero-nav').getBoundingClientRect();
      return { inside: navigation.left >= 0 && navigation.right <= innerWidth + 1 && navigation.bottom <= innerHeight + 1 };
    });
    assert.ok(layout.inside, `Navigation stays inside the hero at ${width}px.`);
    if (width === 390) await captureHomepage(p, 'master-mobile-normal.png');
    assert.deepEqual(errors, []); await responsive.close();
    console.log(`PASS master responsive ${width}px: four-rubric grid, permanent footer count, mode instruction and reduced motion.`);
  }
} finally { await browser.close(); }
