import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
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
    return section.getBoundingClientRect().top + scrollY - innerHeight * .85 + (innerHeight * .85 + run) * value;
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

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = errorsFor(page);
  await readyHome(page);
  assert.equal((await page.locator('.identity').innerText()).replace(/\s+/g, ' ').trim(), 'art on skin & beyond');
  assert.deepEqual((await page.locator('.kinetic-heading').allTextContents()).map((text) => text.toUpperCase()), ['01 / SELECTED WORKS', '02 / ABOUT', '03 / CONTACT']);
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
  const surfaces = await page.locator('.content-section, .category-strip, .category-link, .contact-links, .contact-link').evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { border: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].map((name) => parseFloat(style[name])), background: style.backgroundColor, shadow: style.boxShadow };
  }));
  assert.ok(surfaces.every((style) => style.border.every((value) => value === 0) && style.background === 'rgba(0, 0, 0, 0)' && style.shadow === 'none'), 'Homepage sections and typographic links must share one uninterrupted surface, without dividing lines or panels.');
  assert.equal(await page.locator('.motion-echo').count(), 12, 'Six flying links have at most two decorative echoes each.');
  assert.ok(await page.locator('.motion-echo').evaluateAll((echoes) => echoes.every((echo) => echo.getAttribute('aria-hidden') === 'true' && echo.textContent === '' && getComputedStyle(echo).pointerEvents === 'none')));


  for (const selector of ['#selected-work', '#contact']) {
    await scrollProgress(page, selector, 0);
    const initial = await itemStates(page, selector);
    assert.equal(initial.length, 3);
    assert.ok(initial.every((item) => item.left >= 1440), 'All category/contact labels start fully beyond the right viewport edge.');
    assert.ok(initial.every((item) => item.x >= 1440), 'The fly-in covers a substantial viewport-width distance.');
    const entry = await page.locator(selector).boundingBox();
    assert.ok(Math.abs(entry.y - 850) < 2, 'The entrance starts when the section reaches the lower 85% viewport threshold.');
    await scrollProgress(page, selector, .08);
    assert.ok((await itemStates(page, selector))[0].x < initial[0].x, 'The first word must already move before the sticky interval begins.');
    await scrollProgress(page, selector, .48);
    const midway = await itemStates(page, selector);
    assert.ok(midway.some((item) => item.x > 5) && midway.some((item) => item.x < initial[0].x), 'The timeline must expose a real intermediate state.');
    assert.ok(midway[0].x < midway[1].x && midway[1].x <= midway[2].x, 'The three arrivals must be scroll-staggered.');
    const echoState = () => page.locator(`${selector} .motion-echo`).evaluateAll((echoes) => echoes.map((echo) => ({ opacity: Number(getComputedStyle(echo).opacity), transform: getComputedStyle(echo).transform })));
    const midwayEchoes = await echoState();
    assert.ok(midwayEchoes.some((echo) => echo.opacity > .1 && echo.opacity <= .25), 'A flying word must show its restrained typographic afterimage.');
    await scrollProgress(page, selector, .68);
    const pinnedBefore = await page.locator(`${selector} .section-pin`).boundingBox();
    await scrollProgress(page, selector, .74);
    const pinnedAfter = await page.locator(`${selector} .section-pin`).boundingBox();
    assert.ok(Math.abs(pinnedBefore.y - pinnedAfter.y) < 2, 'The section stage stays pinned while its scroll timeline advances.');
    await scrollProgress(page, selector, 1);
    const settled = await itemStates(page, selector);
    assert.ok(settled.every((item) => Math.abs(item.x) < .1 && Math.abs(item.y) < .1 && item.opacity > .99), 'Links must finish fully visible in exact final positions.');
    await horizontal(page, `${selector} ${selector === '#contact' ? '.contact-link' : '.category-link'}`, 1440);
    assert.ok((await echoState()).every((echo) => echo.opacity === 0), 'Settled labels must be crisp without a persistent echo.');
    await scrollProgress(page, selector, .48);
    closeStates(await itemStates(page, selector), midway, 'Reverse scrolling must reproduce the same intermediate state');
    assert.deepEqual(await echoState(), midwayEchoes, 'Reversing must restore the same afterimage spacing and opacity.');
    await page.waitForTimeout(180);
    closeStates(await itemStates(page, selector), midway, 'Stopping scroll must stop the choreography');
    assert.deepEqual(await echoState(), midwayEchoes, 'Afterimages must remain tied to stopped scroll progress.');
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
  assert.equal(await page.locator('.motion-echo').count(), 0, 'Reduced motion removes decorative echoes entirely.');
  for (const pin of await page.locator('.section-pin').all()) assert.notEqual(await pin.evaluate((element) => getComputedStyle(element).position), 'sticky', 'Reduced motion disables nonessential pinning.');
  await captureHomepage(page, 'master-home-normal.png');
  console.log('PASS master motion: shared headings, extreme staggered fly-ins, native pinning, exact reverse/stop states, hero recession and reduced-motion fallback.');

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
      assert.equal(await responsivePage.locator('[data-ink-mark]:not([data-touch-ink])').count(), 0,
        'Native scrolling must not create an accidental click imprint.');
      assert.ok(await responsivePage.locator('[data-ink-mark][data-touch-ink]').count() <= 12,
        'The established sparse document-attached touch trail stays bounded.');
    }
    if (width === 390) await captureHomepage(responsivePage, 'master-mobile-normal.png');
    assert.deepEqual(responsiveErrors, []);
    await responsive.close();
    console.log(`PASS master responsive ${width}px: horizontal typographic strips, page bounds, reduced motion, native scrolling.`);
  }
} finally {
  await browser.close();
}
