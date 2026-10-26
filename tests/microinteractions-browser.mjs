import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const route = (path) => new URL(path, baseURL).href;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function readyHome(page) {
  await page.goto(route('/?test=1'), { waitUntil: 'networkidle' });
  await page.locator('#selected-work .category-magnet').first().waitFor();
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__H4_TEST__?.snapshot().frameCount > 0);
  await page.locator('[data-scroll-choreography]').waitFor();
}

async function settleSection(page, section) {
  await section.evaluate((element) => {
    // A previous keyboard check deliberately reveals the row through focus.
    // Release that override before sampling the ordinary scroll timeline again.
    document.activeElement?.blur();
    scrollTo({ top: element.getBoundingClientRect().top + scrollY + parseFloat(getComputedStyle(element).getPropertyValue('--motion-run')), behavior: 'instant' });
  });
  await page.waitForFunction((element) => element.dataset.motionState === 'settled', await section.elementHandle());
  const states = await section.locator('.kinetic-item').evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item);
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    return { x: matrix.m41, opacity: Number(style.opacity) };
  }));
  assert.ok(states.every((item) => Math.abs(item.x) < .1 && item.opacity > .99), 'The entire link row must be crisp and aligned before testing its interactions.');
}

const snapshot = (page) => page.evaluate(() => window.__H4_TEST__.snapshot());
const translation = (locator) => locator.evaluate((element) => {
  const transform = getComputedStyle(element).transform;
  const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
  return { x: matrix.m41, y: matrix.m42 };
});

async function nativeCursor(page, locator) {
  const cursor = await locator.evaluate((element) => getComputedStyle(element).cursor);
  const url = cursor.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
  assert.ok(url, `A native cursor image must be present: ${cursor}`);
  const asset = await page.evaluate(async (source) => {
    const document = new DOMParser().parseFromString(await (await fetch(source)).text(), 'image/svg+xml');
    const svg = document.documentElement;
    return {
      width: Number(svg.getAttribute('width')),
      height: Number(svg.getAttribute('height')),
      paths: [...document.querySelectorAll('path')].map((path) => path.outerHTML),
      viewBox: svg.getAttribute('viewBox'),
    };
  }, url);
  return { cursor, url, ...asset };
}

async function assertHorizontal(page, width) {
  const links = page.locator('#selected-work .category-link');
  const boxes = await Promise.all([0, 1, 2].map((index) => links.nth(index).boundingBox()));
  assert.ok(boxes.every(Boolean));
  assert.ok(Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y)) < 2, `Categories must remain horizontal at ${width}px.`);
  assert.ok(Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width)) < 2, 'Category hit areas must stay equal.');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `The page must not overflow at ${width}px.`);
  await links.first().focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await links.last().evaluate((element) => document.activeElement === element), true, 'The last category must remain keyboard reachable.');
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  const errors = collectErrors(page);
  await readyHome(page);
  assert.equal((await page.locator('.identity').innerText()).replace(/\s+/g, ' ').trim(), 'mixed media', 'V6 supplies the approved replacement tagline.');
  if (await page.locator('#pause-control').getAttribute('aria-pressed') === 'false') await page.locator('#pause-control').click();

  const firstSection = page.locator('#selected-work');
  assert.ok(Number(await firstSection.locator('.kinetic-item').first().evaluate((element) => getComputedStyle(element).opacity)) < .05, 'The fly-in begins outside the viewport until scroll progress advances it.');
  const layoutTop = await firstSection.evaluate((element) => element.offsetTop);
  const keyboardReveal = await page.evaluate(() => {
    const section = document.querySelector('.about-preview');
    const scrollBefore = scrollY;
    section.querySelector('a').focus({ preventScroll: true });
    return { opacity: Number(getComputedStyle(section.querySelector('[data-motion-item="copy"]')).opacity), scrollBefore, scrollAfter: scrollY };
  });
  assert.equal(keyboardReveal.opacity, 1, 'Keyboard focus must immediately make faded content visible.');
  assert.equal(keyboardReveal.scrollBefore, keyboardReveal.scrollAfter);
  await page.evaluate(() => document.activeElement?.blur());

  await settleSection(page, firstSection);
  assert.equal(await firstSection.evaluate((element) => element.offsetTop), layoutTop, 'The reveal must preserve the reserved layout.');
  await assertHorizontal(page, 1440);
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.activeElement?.blur());
  const defaultCursor = await nativeCursor(page, page.locator('body'));
  const link = page.locator('.category-link').first();
  const magnet = link.locator('.category-magnet');
  const before = await link.boundingBox();
  await page.mouse.move(before.x + before.width * .8, before.y + before.height * .65);
  await page.waitForFunction(() => {
    const transform = getComputedStyle(document.querySelector('#selected-work .category-magnet')).transform;
    const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
    return Math.hypot(matrix.m41, matrix.m42) > .15;
  });
  const moved = await translation(magnet);
  assert.ok(Math.abs(moved.x) <= 3.1 && Math.abs(moved.y) <= 3.1, 'Magnetic movement must stay restrained to a few pixels.');
  await page.waitForFunction(() => {
    const visual = document.querySelector('#selected-work .category-magnet');
    const matrix = new DOMMatrixReadOnly(getComputedStyle(visual).transform);
    return matrix.m11 >= 1.18;
  });
  const luminous = await magnet.evaluate((element) => ({ transform: new DOMMatrixReadOnly(getComputedStyle(element).transform).m11, filter: getComputedStyle(element).filter }));
  assert.ok(luminous.transform <= 1.25, 'The large category label magnifies strongly within its reserved hit area.');
  assert.ok((luminous.filter.match(/drop-shadow/g) || []).length >= 3 && luminous.filter.includes('255, 255, 255'), 'Normal hover produces an intense bounded white glow.');
  const after = await link.boundingBox();
  for (const property of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[property] - after[property]) < .25, 'Only the label/arrow wrapper may move, preserving the clickable area.');
  const hoverCursor = await nativeCursor(page, magnet);
  assert.ok(hoverCursor.width > defaultCursor.width && hoverCursor.width < defaultCursor.width * 1.1, 'Hover cursor feedback must be small.');
  assert.deepEqual(hoverCursor.paths, defaultCursor.paths, 'Cursor feedback must retain the exact original symbol.');
  assert.equal(hoverCursor.viewBox, defaultCursor.viewBox);
  await link.evaluate((element) => element.addEventListener('click', (event) => event.preventDefault(), { once: true }));
  await page.mouse.down();
  const pressedCursor = await nativeCursor(page, magnet);
  assert.ok(pressedCursor.width < defaultCursor.width && pressedCursor.width > defaultCursor.width * .9, 'Click cursor feedback must be small.');
  assert.deepEqual(pressedCursor.paths, defaultCursor.paths);
  await page.mouse.up();
  await page.mouse.move(1, 1);
  await page.waitForFunction(() => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#selected-work .category-magnet')).transform);
    return Math.hypot(matrix.m41, matrix.m42) < .05;
  });
  await link.focus();
  assert.ok(Math.hypot(...Object.values(await translation(magnet))) < .05, 'Keyboard focus must not trigger magnetic movement.');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('.content-section')].every((element) => Number(getComputedStyle(element).opacity) === 1));
  await page.waitForFunction(() => document.querySelectorAll('.motion-echo').length === 0 && !document.documentElement.hasAttribute('data-scroll-choreography'));
  await page.mouse.move(before.x + before.width * .8, before.y + before.height * .65);
  assert.ok(Math.hypot(...Object.values(await translation(magnet))) < .05);
  assert.equal(await magnet.evaluate((element) => {
    const value = getComputedStyle(element).transform;
    return value === 'none' ? 1 : new DOMMatrixReadOnly(value).m11;
  }), 1, 'Reduced motion disables the new hover magnification.');
  const reducedCursor = await nativeCursor(page, magnet);
  assert.equal(reducedCursor.width, defaultCursor.width, 'Reduced motion must disable cursor scaling.');
  await page.evaluate(() => document.activeElement?.blur());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('[data-scroll-choreography]').waitFor();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#selected-work .kinetic-item')).opacity) < .05);
  assert.ok(Number(await firstSection.locator('.kinetic-item').first().evaluate((element) => getComputedStyle(element).opacity)) < .05, 'The master brief requires the timeline to reverse when scrolling back to the hero.');
  if (await page.locator('#pause-control').getAttribute('aria-pressed') === 'true') await page.locator('#pause-control').click();
  let state = await snapshot(page);
  await page.waitForFunction((frame) => window.__H4_TEST__.snapshot().frameCount > frame, state.frameCount, { timeout: 10000 });
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.hero').getBoundingClientRect().bottom <= 0);
  await page.waitForTimeout(200);
  const outside = await snapshot(page);
  await page.waitForTimeout(250);
  assert.equal((await snapshot(page)).frameCount, outside.frameCount, 'Offscreen hero must not render WebGL frames.');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction((frame) => window.__H4_TEST__.snapshot().frameCount > frame, outside.frameCount, { timeout: 10000 });

  // Headless Chromium does not consistently expose native tab visibility. This
  // controlled visibilitychange exercises the application's real hidden-state
  // branch, without using a browser lifecycle freeze that would pause any app.
  await page.evaluate(() => {
    window.__visibilityDescriptors = {
      hidden: Object.getOwnPropertyDescriptor(document, 'hidden'),
      state: Object.getOwnPropertyDescriptor(document, 'visibilityState'),
    };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await snapshot(page);
  await page.waitForTimeout(250);
  assert.equal((await snapshot(page)).frameCount, hidden.frameCount, 'A hidden document must not render WebGL frames.');
  await page.evaluate(() => {
    const original = window.__visibilityDescriptors;
    if (original.hidden) Object.defineProperty(document, 'hidden', original.hidden); else delete document.hidden;
    if (original.state) Object.defineProperty(document, 'visibilityState', original.state); else delete document.visibilityState;
    delete window.__visibilityDescriptors;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction((frame) => window.__H4_TEST__.snapshot().frameCount > frame, hidden.frameCount, { timeout: 10000 });
  assert.deepEqual(errors, []);
  await desktop.close();
  console.log('PASS microinteractions desktop: strong luminous hover with stable hit areas, restrained magnet, reversible choreography, keyboard/reduced motion, exact native cursor feedback and offscreen/hidden-state WebGL pause.');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mobilePage = await mobile.newPage();
  const mobileErrors = collectErrors(mobilePage);
  await readyHome(mobilePage);
  const mobileState = await snapshot(mobilePage);
  if (mobileState.pixelRatio !== undefined) assert.ok(mobileState.pixelRatio <= 1.5, 'Mobile render resolution must be capped.');
  for (const width of [390, 320]) {
    await mobilePage.setViewportSize({ width, height: 844 });
    // Resize updates the native run in the next scheduled animation frame.
    await mobilePage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await settleSection(mobilePage, mobilePage.locator('#selected-work'));
    await assertHorizontal(mobilePage, width);
    const mobileMagnet = mobilePage.locator('#selected-work .category-magnet').first();
    assert.ok(Math.hypot(...Object.values(await translation(mobileMagnet))) < .05, 'Touch devices must not receive magnetic movement.');
    assert.doesNotMatch(await mobileMagnet.evaluate((element) => getComputedStyle(element).cursor), /h4ngelic-cursor/);
    const footer = await mobilePage.evaluate(() => {
      const tagline = document.querySelector('.identity').getBoundingClientRect(), navigation = document.querySelector('.hero-nav').getBoundingClientRect();
      return { separated: tagline.right < navigation.left || tagline.top >= navigation.bottom || tagline.bottom <= navigation.top };
    });
    assert.ok(footer.separated, `The coordinated tagline and navigation must not overlap at ${width}px.`);
  }
  assert.deepEqual(mobileErrors, []);
  await mobile.close();
  console.log('PASS microinteractions mobile: 390/320px horizontal categories, keyboard reachability, no magnetic/custom-pointer feedback, tagline spacing and mobile DPR cap.');
} finally {
  await browser.close();
}
