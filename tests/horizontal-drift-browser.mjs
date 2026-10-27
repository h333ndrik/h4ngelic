import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = new URL('../artifacts/native-carousel/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const deadline = setTimeout(() => void browser.close(), 180000);
const section = page => page.locator('[data-horizontal-drift="tattoos"]');
const viewport = page => section(page).locator('.drift-viewport');
async function state(page) {
  return section(page).evaluate(element => {
    const scroller = element.querySelector('.drift-viewport');
    return { left: scroller.scrollLeft, travel: Number(element.dataset.driftTravel),
      index: Number(element.dataset.carouselIndex), scrollY, height: element.offsetHeight,
      inlineHeight: element.style.height, sticky: getComputedStyle(scroller).position,
      count: element.querySelector('[data-drift-count]').textContent,
      maximum: document.documentElement.scrollWidth, viewport: innerWidth };
  });
}
async function atIndex(page, index) {
  await page.waitForFunction(index => {
    const element = document.querySelector('[data-horizontal-drift="tattoos"]');
    return Number(element.dataset.carouselIndex) === index;
  }, index);
  await page.waitForFunction(() => {
    const left = document.querySelector('[data-horizontal-drift="tattoos"] .drift-viewport').scrollLeft;
    const now = performance.now();
    if (!window.__carouselRest || Math.abs(window.__carouselRest.left - left) > .25) window.__carouselRest = { left, at: now };
    return now - window.__carouselRest.at > 140;
  });
  return state(page);
}
async function home(page) {
  await section(page).focus();
  await page.keyboard.press('Home');
  await atIndex(page, 0);
}
async function showSection(page) {
  await section(page).evaluate(element => {
    const navigation = document.querySelector('.work-filters');
    const clearance = navigation ? (parseFloat(getComputedStyle(navigation).top) || 0) + navigation.offsetHeight + 16 : 80;
    scrollTo({ top: element.getBoundingClientRect().top + scrollY - Math.max(80, clearance), behavior: 'instant' });
  });
}
try {
  for (const width of (process.env.H4_DRIFT_WIDTHS || '1000,390,320').split(',').map(Number)) {
    console.log(`START native carousel ${width}px`);
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: width === 320 ? 'reduce' : 'no-preference',
      hasTouch: width < 600, isMobile: width < 600 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/work/tattoos?test=1', base).href, { waitUntil: 'networkidle' });
    assert.equal(await section(page).count(), 1, 'Empty real archives retain a visible carousel shell.');
    assert.equal(await section(page).locator('img, canvas, [data-drift-item]').count(), 0, 'The empty archive cannot invent photographs or placeholder cards.');
    assert.equal(await section(page).locator('.archive-empty').textContent(), 'archive in progress.');
    assert.equal(await section(page).locator('[data-drift-count]').textContent(), '0 / 0');
    assert.equal(await section(page).locator('[data-drift-previous]').isDisabled(), true);
    assert.equal(await section(page).locator('[data-drift-next]').isDisabled(), true);

    await page.evaluate(async () => {
      const { renderHorizontalDrift } = await import('/src/horizontal-drift-content.js');
      const { initHorizontalDrift } = await import('/src/horizontal-drift.js');
      const { initGallery } = await import('/src/gallery.js');
      const old = document.querySelector('[data-horizontal-drift="tattoos"]');
      const host = document.createElement('div');
      // Six copies of a supplied image are a browser fixture only. Production
      // keeps its honest empty tattoo archive and publishes no invented work.
      host.innerHTML = renderHorizontalDrift(Array.from({ length: 6 }, (_, index) => ({
        id: `carousel-fixture-${index}`, category: 'tattoos', title: `fixture ${index + 1}`,
        images: [
          { src: '/assets/tattoo-texture.webp', alt: 'supplied artwork test fixture', width: 1024, height: 1448 },
          { src: '/assets/tattoo-texture.webp?detail=1', alt: 'supplied detail test fixture', width: 1024, height: 1448 },
        ],
      })), { category: 'tattoos', label: 'tattoos' });
      old.replaceWith(host);
      const stopCarousel = initHorizontalDrift(host), stopGallery = initGallery(host);
      window.__stopCarouselFixture = () => { stopGallery(); stopCarousel(); };
      window.__carouselNode = host.querySelector('[data-horizontal-drift]');
      await Promise.all([...host.querySelectorAll('img')].map(image => { image.loading = 'eager'; return image.decode(); }));
    });
    await showSection(page);
    await atIndex(page, 0);
    const initial = await state(page);
    assert.ok(await viewport(page).evaluate(element => element.scrollHeight <= element.clientHeight + 1),
      'The screen-reader announcement must not create an invisible vertical scroll range.');
    assert.ok(initial.travel > width);
    assert.equal(initial.inlineHeight, '', 'A carousel must not reserve a tall vertical scroll timeline.');
    assert.notEqual(initial.sticky, 'sticky');
    assert.ok(initial.height < 844, 'The image gallery remains one ordinary page section.');

    await section(page).locator('[data-drift-next]').click();
    const next = await atIndex(page, 1);
    assert.ok(next.left > 80);
    assert.ok(Math.abs(next.scrollY - initial.scrollY) < 1, 'Horizontal controls must not move the document vertically.');
    assert.equal(next.count, '2 / 6');
    await section(page).locator('[data-drift-previous]').click();
    await atIndex(page, 0);
    await section(page).focus();
    await page.keyboard.press('End');
    const end = await atIndex(page, 5);
    assert.ok(Math.abs(end.left - end.travel) < 2);
    assert.equal(await section(page).locator('[data-drift-next]').isDisabled(), true);
    await home(page);
    await page.keyboard.press('ArrowRight');
    await atIndex(page, 1);
    await page.keyboard.press('ArrowLeft');
    await atIndex(page, 0);

    let box = await viewport(page).boundingBox();
    await page.mouse.move(box.x + box.width * .5, box.y + Math.min(180, box.height * .4));
    await page.mouse.wheel(500, 0);
    await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"] .drift-viewport').scrollLeft > 100);
    const trackpad = await state(page);
    await page.keyboard.down('Shift');
    await page.mouse.wheel(0, 600);
    await page.keyboard.up('Shift');
    await page.waitForFunction(before => document.querySelector('[data-horizontal-drift="tattoos"] .drift-viewport').scrollLeft > before + 80, trackpad.left);
    const shiftedWheel = await state(page);

    // Ordinary wheel input always belongs to the vertical page, even over a
    // carousel that still has horizontal material to browse.
    const verticalBefore = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 170);
    await page.waitForFunction(before => scrollY > before + 30, verticalBefore);
    const vertical = await state(page);

    let drag;
    await showSection(page);
    await home(page);
    if (width >= 600) {
      const partial = await section(page).evaluate(element => {
        const port = element.querySelector('.drift-viewport').getBoundingClientRect();
        for (const item of [...element.querySelectorAll('[data-drift-item]')].slice(1)) {
          const image = item.querySelector('[data-artwork-open]').getBoundingClientRect();
          const left = Math.max(port.left, image.left), right = Math.min(port.right, image.right);
          if (right - left > 18 && image.right > port.right + 5) return {
            x: left + Math.min(25, (right - left) / 2), y: image.top + Math.min(100, image.height / 2),
          };
        }
        return null;
      });
      assert.ok(partial, 'The fixture exposes a real partially visible adjacent work.');
      const partialStart = (await state(page)).left;
      await page.mouse.move(partial.x, partial.y);
      await page.mouse.down();
      assert.ok(Math.abs((await state(page)).left - partialStart) < 1,
        'Pointer focus on a partially visible work must not recenter the carousel before its drag.');
      await page.mouse.move(partial.x - 60, partial.y, { steps: 4 });
      await page.waitForFunction(start => document.querySelector('[data-horizontal-drift="tattoos"] .drift-viewport').scrollLeft > start + 20, partialStart);
      assert.ok((await state(page)).left < partialStart + 85, 'Dragging an adjacent work continues from the actual image position.');
      await page.mouse.up();
      assert.equal(await page.locator('.artwork-dialog[open]').count(), 0);
      await home(page);
      const button = section(page).locator('[data-drift-item]').first().locator('[data-artwork-open]').first();
      box = await button.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + Math.min(140, box.height / 2));
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - Math.min(360, width * .4), box.y + Math.min(140, box.height / 2), { steps: 9 });
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"] .drift-viewport').scrollLeft > 100);
      drag = await state(page);
    } else {
      const cdp = await context.newCDPSession(page);
      box = await viewport(page).boundingBox();
      const start = { x: box.x + box.width * .82, y: box.y + Math.min(180, box.height * .45) };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      for (let index = 1; index <= 8; index++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - index * 26, y: start.y }] });
        await page.waitForTimeout(24);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"] .drift-viewport').scrollLeft > 80);
      drag = await state(page);
      await home(page); await showSection(page);
      box = await viewport(page).boundingBox();
      const before = await page.evaluate(() => scrollY);
      const point = { x: box.x + box.width / 2, y: box.y + Math.min(290, box.height * .65) };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      for (let index = 1; index <= 8; index++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - index * 20 }] });
        await page.waitForTimeout(24);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(before => scrollY > before + 30, before);
      await cdp.detach();
    }
    assert.equal(await page.locator('.artwork-dialog[open]').count(), 0, 'A drag or native vertical swipe must not click an artwork.');

    // Select a middle work, not merely the first image, to prove exact native
    // horizontal position survives both a detail image and close animation.
    await showSection(page); await home(page);
    await page.keyboard.press('ArrowRight'); await atIndex(page, 1);
    await page.keyboard.press('ArrowRight'); await atIndex(page, 2);
    const opener = section(page).locator('[data-drift-item]').nth(2).locator('[data-artwork-open]').first();
    await opener.evaluate(element => element.focus({ preventScroll: true }));
    const beforeViewer = await state(page);
    await page.keyboard.press('Enter');
    const dialog = page.locator('.artwork-dialog[open]');
    await dialog.waitFor();
    await page.waitForFunction(() => document.querySelector('.artwork-dialog[open] .artwork-viewer-status')?.textContent === 'image 1 of 2');
    assert.equal(await section(page).getAttribute('data-drift-paused'), '');
    await dialog.locator('.artwork-next').click();
    await page.waitForFunction(() => document.querySelector('.artwork-dialog[open] .artwork-viewer-status')?.textContent === 'image 2 of 2');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.artwork-dialog[open]'));
    const afterViewer = await state(page);
    assert.ok(Math.abs(afterViewer.left - beforeViewer.left) < 1, 'Closing a detail must restore the same horizontal context.');
    assert.ok(Math.abs(afterViewer.scrollY - beforeViewer.scrollY) < 1, 'Closing a detail must restore the same vertical context.');
    assert.equal(await opener.evaluate(element => element === document.activeElement), true);

    await section(page).focus(); await page.keyboard.press('End'); await atIndex(page, 5);
    box = await viewport(page).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(150, box.height / 2));
    const boundaryBefore = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 170);
    await page.waitForFunction(before => scrollY > before + 30, boundaryBefore);
    const boundary = await state(page);
    assert.ok(boundary.maximum <= boundary.viewport + 1, 'The carousel must not widen the website.');
    await page.screenshot({ path: new URL(`carousel-${width}.png`, artifacts).pathname });
    await page.evaluate(() => window.__stopCarouselFixture());
    assert.equal(await section(page).evaluate(element => element.classList.contains('is-drift-enhanced')), false);
    assert.deepEqual(errors, []);
    results.push({ width, initial, next, end, trackpad, shiftedWheel, vertical, drag, beforeViewer, afterViewer, boundary, errors });
    await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: false, results }, null, 2));
    console.log(`PASS native carousel ${width}px: controls, keyboard, horizontal wheel/shift-wheel, vertical release, ${width < 600 ? 'native swipe/pan' : 'drag'}, detail return and bounds.`);
    await context.close();
  }
  await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: true, results }, null, 2));
} finally { clearTimeout(deadline); await browser.close(); }
