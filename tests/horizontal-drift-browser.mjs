import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = new URL('../artifacts/v31/native-carousel/', import.meta.url);
const originals = JSON.parse(await readFile(new URL('../docs/assets/tattoo-originals-v31.json', import.meta.url), 'utf8')).images;
const imageManifest = JSON.parse(await readFile(new URL('../src/data/imageManifest.json', import.meta.url), 'utf8'));
const profiles = [{ width: 1440, reduced: false }, { width: 390, reduced: false }, { width: 320, reduced: false }, { width: 320, reduced: true }]
  .filter(profile => !process.env.H4_DRIFT_WIDTHS || process.env.H4_DRIFT_WIDTHS.split(',').map(Number).includes(profile.width))
  .filter(profile => !process.env.H4_DRIFT_REDUCED || profile.reduced === (process.env.H4_DRIFT_REDUCED === 'true'));
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
let activeProfile = null;
const deadline = setTimeout(() => void browser.close(), 360000);
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
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function mode(page, expected) {
  await page.evaluate(() => document.activeElement?.blur());
  if (expected === 'xray') {
    await page.keyboard.down('4'); await page.waitForTimeout(1100); await page.keyboard.up('4');
  } else await page.keyboard.type('333', { delay: 65 });
  await page.waitForFunction(expected => document.documentElement.dataset.mode === expected, expected, { timeout: 60000 });
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot')
    && !document.documentElement.hasAttribute('data-xray-transition') && !document.documentElement.hasAttribute('data-memory-mosh-preparing'));
  await frames(page);
}
async function genuinePhotographs(page, context, profile, world) {
  assert.equal(await section(page).count(), 1, 'The genuine On Skin photographs use the existing native carousel.');
  assert.equal(await section(page).getAttribute('data-carousel-total'), '8');
  assert.equal(await section(page).locator('[data-drift-item]').count(), 8);
  assert.equal(await section(page).locator('img').count(), 8);
  assert.equal(await section(page).locator('.archive-empty').count(), 0, 'Real uploads replace the former empty archive.');
  const metadata = await section(page).locator('img').evaluateAll(images => images.map(image => ({
    original: image.dataset.fullSrc, width: image.width, height: image.height,
    intrinsicWidth: Number(image.getAttribute('width')), intrinsicHeight: Number(image.getAttribute('height')),
    alt: image.alt, loading: image.loading, radius: getComputedStyle(image).borderRadius,
    fit: getComputedStyle(image).objectFit,
  })));
  assert.deepEqual(metadata.map(image => image.original), originals.map(image => imageManifest[image.url].variants.at(-1).src),
    'ZIP order is preserved through the existing optimized viewer derivatives; committed originals remain unchanged.');
  for (let index = 0; index < metadata.length; index++) {
    const image = metadata[index], original = originals[index];
    assert.equal(image.intrinsicWidth, original.width); assert.equal(image.intrinsicHeight, original.height);
    assert.equal(image.loading, 'lazy'); assert.equal(image.radius, '0px'); assert.equal(image.fit, 'contain');
    assert.ok(image.alt.length > 20);
  }
  await showSection(page); await home(page);
  assert.equal(await section(page).locator('[data-drift-count]').textContent(), '1 / 8');
  assert.equal(await section(page).locator('[data-drift-previous]').isDisabled(), true);
  await section(page).locator('[data-drift-next]').click();
  const next = await atIndex(page, 1);
  assert.equal(next.count, '2 / 8');
  await section(page).locator('[data-drift-previous]').click(); await atIndex(page, 0);
  await section(page).focus(); await page.keyboard.press('End');
  const end = await atIndex(page, 7);
  assert.ok(Math.abs(end.left - end.travel) < 2); assert.equal(end.count, '8 / 8');
  assert.equal(await section(page).locator('[data-drift-next]').isDisabled(), true);
  await home(page); await page.keyboard.press('ArrowRight'); await atIndex(page, 1);
  await page.keyboard.press('ArrowRight'); await atIndex(page, 2);
  const opener = section(page).locator('[data-drift-item]').nth(2).locator('[data-artwork-open]').first();
  const image = opener.locator('img');
  await image.evaluate(element => element.decode());
  await page.mouse.move(1, 1); await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  const before = await state(page), boxBefore = await image.boundingBox();
  const slots = await section(page).locator('[data-drift-item]').evaluateAll(items => items.map(item => [item.offsetLeft, item.offsetWidth, item.offsetHeight]));
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  await opener.evaluate(element => element.focus({ preventScroll: true })); await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const selected = document.querySelector('[data-horizontal-drift="tattoos"] .drift-artwork.is-drift-expanded');
    return selected && Math.abs(new DOMMatrixReadOnly(getComputedStyle(selected).transform).m11 - 1.1) < .001;
  });
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  const enlarged = await state(page), boxEnlarged = await image.boundingBox();
  assert.ok(Math.abs(boxEnlarged.width / boxBefore.width - 1.1) < .006, 'The real photo grows once by 10%, without compounded hover scaling.');
  assert.ok(Math.abs(boxEnlarged.height / boxBefore.height - 1.1) < .006);
  assert.ok(Math.abs(boxEnlarged.x + boxEnlarged.width / 2 - boxBefore.x - boxBefore.width / 2) < 1);
  assert.ok(Math.abs(boxEnlarged.y + boxEnlarged.height / 2 - boxBefore.y - boxBefore.height / 2) < 1);
  assert.ok(Math.abs(enlarged.left - before.left) < 1 && Math.abs(enlarged.scrollY - before.scrollY) < 1,
    'Enlargement preserves horizontal and vertical context instead of zooming the website.');
  assert.deepEqual(await section(page).locator('[data-drift-item]').evaluateAll(items => items.map(item => [item.offsetLeft, item.offsetWidth, item.offsetHeight])), slots);
  assert.equal(await page.locator('dialog[open]').count(), 0); assert.equal(await opener.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => document.body.style.overflow), bodyOverflow);
  await page.keyboard.press('Escape'); assert.equal(await opener.getAttribute('aria-pressed'), 'false');
  await home(page); await showSection(page);
  const port = await viewport(page).boundingBox(), gestureBefore = await state(page);
  if (profile.width >= 600) {
    await page.mouse.move(port.x + port.width * .6, port.y + Math.min(150, port.height * .4));
    await page.mouse.down(); await page.mouse.move(port.x + port.width * .6 - 200, port.y + Math.min(150, port.height * .4), { steps: 8 }); await page.mouse.up();
  } else {
    const cdp = await context.newCDPSession(page);
    const point = { x: port.x + port.width * .82, y: port.y + Math.min(150, port.height * .4) };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    for (let index = 1; index <= 8; index++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - index * 24, y: point.y }] });
      await page.waitForTimeout(24);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  }
  await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"] .drift-viewport').scrollLeft > 80);
  const gestureAfter = await state(page);
  assert.equal(await section(page).locator('.drift-artwork.is-drift-expanded').count(), 0, 'Native gesture never opens or enlarges real work.');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.ok(Math.abs(gestureAfter.scrollY - gestureBefore.scrollY) < 2, 'A horizontal gesture retains page position.');
  assert.ok(gestureAfter.maximum <= gestureAfter.viewport + 1);
  await page.screenshot({ path: new URL(`originals-${profile.width}-${profile.reduced}-${world}.png`, artifacts).pathname });
  return { world, metadata, next, end, before, enlarged, actualImageScale: boxEnlarged.width / boxBefore.width, gestureBefore, gestureAfter };
}
try {
  for (const profile of profiles) {
    activeProfile = profile;
    const { width, reduced } = profile;
    console.log(`START V3.1 native carousel ${width}px reduced=${reduced}`);
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference',
      hasTouch: width < 600, isMobile: width < 600 });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => requests.push(request.url()));
    await page.goto(new URL('/work/tattoos?test=1', base).href, { waitUntil: 'networkidle' });
    assert.ok(!requests.some(url => /\/src\/main\.js|wordmark\.typeface|tattoo-texture|LiberationSans-Bold/.test(url)), 'A cold Work route never downloads the Three.js hero assets.');
    assert.ok(!requests.some(url => /\.mp3(?:$|[?#])/.test(url)), 'Browsing real photographs defers SMASH loading.');
    const flashes = page.locator('[data-horizontal-drift="flashes"]');
    assert.equal(await flashes.locator('img, canvas, [data-drift-item]').count(), 0, 'Unprovided Flash artwork remains genuinely empty.');
    assert.equal(await flashes.locator('.archive-empty').textContent(), 'archive in progress.');
    assert.equal(await flashes.locator('[data-drift-count]').textContent(), '0 / 0');
    assert.equal(await flashes.locator('[data-drift-previous]').isDisabled(), true);
    assert.equal(await flashes.locator('[data-drift-next]').isDisabled(), true);
    const genuine = [await genuinePhotographs(page, context, profile, 'normal')];
    await mode(page, 'xray'); genuine.push(await genuinePhotographs(page, context, profile, 'xray'));
    await mode(page, 'normal');
    console.log(`PASS eight genuine photographs ${width}px reduced=${reduced}: ZIP order/ratio/lazy/radius, controls, keyboard, in-place zoom, ${width < 600 ? 'native swipe' : 'drag'}, both333/4.`);

    await page.evaluate(async () => {
      const { renderHorizontalDrift } = await import('/src/horizontal-drift-content.js');
      const { initHorizontalDrift } = await import('/src/horizontal-drift.js');
      const { initGallery } = await import('/src/gallery.js');
      const old = document.querySelector('[data-horizontal-drift="tattoos"]');
      const host = document.createElement('div');
      // Six copies plus hidden detail images are a browser-only stress fixture.
      // Genuine photographs were checked above; this retains multi-image teardown/input coverage.
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
      // At some viewport/photo ratios the first neighbour fits completely and
      // the next is entirely outside. Choose a genuine native intermediate
      // scroll position so this stress case actually starts on a clipped work.
      await viewport(page).evaluate(scroller => {
        const port = scroller.getBoundingClientRect();
        for (const item of [...scroller.querySelectorAll('[data-drift-item]')].slice(1)) {
          const image = item.querySelector('[data-artwork-open]').getBoundingClientRect();
          if (image.right <= port.right + 5) continue;
          if (image.left >= port.right - 18) scroller.scrollTo({
            left: scroller.scrollLeft + image.left - port.right + 60, behavior: 'instant',
          });
          break;
        }
      });
      await frames(page);
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
      // Finish complete native gestures. Mixed CDP touch/mouse tests can
      // retain a prior axis latch for one gesture, including on the unchanged
      // baseline. A bounded second real swipe checks that scrolling is free;
      // production still uses no manual vertical-scroll forwarding.
      for (let attempt = 0; attempt < 2; attempt++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        for (let index = 1; index <= 8; index++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - index * 20 }] });
          await page.waitForTimeout(24);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(350);
        if (await page.evaluate(before => scrollY > before + 30, before)) break;
      }
      await page.waitForFunction(before => scrollY > before + 30, before);
      await cdp.detach();
    }
    assert.equal(await page.locator('.artwork-dialog[open]').count(), 0, 'A drag or native vertical swipe must not click an artwork.');

    assert.equal(await section(page).locator('.drift-artwork.is-drift-expanded').count(), 0,
      'A horizontal drag or vertical swipe must not enlarge an artwork.');

    // A middle image grows around its own centre, retaining every layout slot,
    // scroll offset and neighbour. No modal or document scroll lock is involved.
    await showSection(page); await home(page);
    await page.keyboard.press('ArrowRight'); await atIndex(page, 1);
    await page.keyboard.press('ArrowRight'); await atIndex(page, 2);
    const opener = section(page).locator('[data-drift-item]').nth(2).locator('[data-artwork-open]').first();
    await opener.evaluate(element => element.focus({ preventScroll: true }));
    const beforeViewer = await state(page);
    const checkContext = async () => {
      const current = await state(page);
      assert.ok(Math.abs(current.left - beforeViewer.left) < 1 && Math.abs(current.scrollY - beforeViewer.scrollY) < 1,
        `Each inline activation must preserve native scroll context: ${JSON.stringify({ beforeViewer, current })}`);
    };
    const originalBox = await opener.boundingBox();
    const originalSlots = await section(page).locator('[data-drift-item]').evaluateAll(elements => elements.map(element =>
      [element.offsetLeft, element.offsetWidth, element.offsetHeight]));
    const originalOverflow = await page.evaluate(() => document.body.style.overflow);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const selected = document.querySelector('[data-horizontal-drift="tattoos"] .drift-artwork.is-drift-expanded');
      return selected && Math.abs(new DOMMatrixReadOnly(getComputedStyle(selected).transform).m11 - 1.1) < .001;
    });
    const enlargedBox = await opener.boundingBox();
    await checkContext();
    assert.equal(await opener.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.artwork-dialog[open]').count(), 0, 'Carousel enlargement must never open a modal.');
    assert.equal(await section(page).getAttribute('data-drift-paused'), null);
    assert.equal(await page.evaluate(() => document.body.style.overflow), originalOverflow);
    assert.ok(Math.abs(enlargedBox.width / originalBox.width - 1.1) < .005);
    assert.ok(Math.abs(enlargedBox.height / originalBox.height - 1.1) < .005);
    assert.ok(Math.abs(enlargedBox.x + enlargedBox.width / 2 - originalBox.x - originalBox.width / 2) < 1,
      'The photograph must retain its carousel position rather than move to the screen centre.');
    assert.ok(Math.abs(enlargedBox.y + enlargedBox.height / 2 - originalBox.y - originalBox.height / 2) < 1);
    assert.deepEqual(await section(page).locator('[data-drift-item]').evaluateAll(elements => elements.map(element =>
      [element.offsetLeft, element.offsetWidth, element.offsetHeight])), originalSlots, 'Enlargement must not reflow or reorder images.');
    const neighbours = await section(page).locator('[data-drift-item]').evaluateAll(elements => elements.slice(1, 4).map(element => {
      const box = element.querySelector('[data-artwork-open]').getBoundingClientRect();
      return { left: box.left, right: box.right };
    }));
    assert.ok(neighbours[0].right < neighbours[1].left && neighbours[1].right < neighbours[2].left,
      'The enlarged photograph must not overlap its neighbours.');
    const activateVisiblePhoto = async () => {
      const box = await opener.boundingBox();
      assert.ok(box.x + box.width / 2 > 0 && box.x + box.width / 2 < width
        && box.y + box.height / 2 > 0 && box.y + box.height / 2 < 844,
      'Pointer activation starts on the visible photograph without automation scrolling.');
      if (width < 600) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    await activateVisiblePhoto();
    await page.waitForFunction(() => !document.querySelector('[data-horizontal-drift="tattoos"] .drift-artwork.is-drift-expanded'));
    assert.equal(await opener.getAttribute('aria-pressed'), 'false', 'A second activation restores the photograph.');
    await checkContext();
    await activateVisiblePhoto();
    await checkContext();
    // Click a visible page margin. Locator.click on the toolbar can itself
    // scroll that offscreen target (and the focused archive) into view.
    await page.mouse.click(width - 3, 400);
    await checkContext();
    assert.equal(await opener.getAttribute('aria-pressed'), 'false', 'Clicking outside restores the photograph.');
    await opener.evaluate(element => element.focus({ preventScroll: true })); await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    assert.equal(await opener.getAttribute('aria-pressed'), 'false', 'Escape restores the photograph.');
    const afterViewer = await state(page);
    assert.ok(Math.abs(afterViewer.left - beforeViewer.left) < 1, `In-place interaction must preserve horizontal context: ${JSON.stringify({ beforeViewer, afterViewer })}`);
    assert.ok(Math.abs(afterViewer.scrollY - beforeViewer.scrollY) < 1, 'In-place interaction must preserve vertical context.');
    assert.equal(await opener.evaluate(element => element === document.activeElement), true);

    await section(page).focus(); await page.keyboard.press('End'); await atIndex(page, 5);
    box = await viewport(page).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(150, box.height / 2));
    const boundaryBefore = await page.evaluate(() => scrollY);
    // Two separate genuine wheel gestures bound the check, rather than
    // compensating for Chromium's synthetic axis latch in product code.
    const wheelDeltas = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.mouse.wheel(0, 170);
      await page.waitForTimeout(350);
      wheelDeltas.push(await page.evaluate(before => scrollY - before, boundaryBefore));
      if (wheelDeltas.at(-1) > 30) break;
    }
    await page.waitForFunction(before => scrollY > before + 30, boundaryBefore);
    const boundary = await state(page);
    assert.ok(boundary.maximum <= boundary.viewport + 1, 'The carousel must not widen the website.');
    await page.screenshot({ path: new URL(`carousel-${width}-${reduced}.png`, artifacts).pathname });
    await page.evaluate(() => window.__stopCarouselFixture());
    assert.equal(await section(page).evaluate(element => element.classList.contains('is-drift-enhanced')), false);
    assert.deepEqual(errors, []);
    results.push({ width, reduced, genuine, initial, next, end, trackpad, shiftedWheel, vertical, drag, beforeViewer, afterViewer, boundary, wheelDeltas, errors });
    await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: false, results }, null, 2));
    console.log(`PASS native carousel stress fixture ${width}px reduced=${reduced}: controls, keyboard, horizontal wheel/shift-wheel, vertical release, ${width < 600 ? 'native swipe/pan' : 'drag'}, in-place enlargement/restore and bounds.`);
    await context.close();
  }
  await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: true, results }, null, 2));
} catch (error) {
  await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: false, failedProfile: activeProfile, failure: error.stack || String(error), results }, null, 2));
  throw error;
} finally { clearTimeout(deadline); await browser.close(); }
