import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const artifacts = new URL(`../${process.env.H4_DRIFT_ARTIFACTS || 'artifacts/v311/F9/carousel'}/`, import.meta.url);
const originals = JSON.parse(await readFile(new URL('../docs/assets/tattoo-originals-v31.json', import.meta.url), 'utf8')).images;
const imageManifest = JSON.parse(await readFile(new URL('../src/data/imageManifest.json', import.meta.url), 'utf8'));
const profiles = [1440, 390, 320].flatMap(width => [false, true].map(reduced => ({ width, reduced })))
  .filter(profile => !process.env.H4_DRIFT_WIDTHS || process.env.H4_DRIFT_WIDTHS.split(',').map(Number).includes(profile.width))
  .filter(profile => !process.env.H4_DRIFT_REDUCED || profile.reduced === (process.env.H4_DRIFT_REDUCED === 'true'));
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const results = [];
let activeProfile = null, activePage = null, activeErrors = [];
const deadline = setTimeout(() => void browser.close(), 600000);
const section = page => page.locator('[data-horizontal-drift="tattoos"]');
const viewport = page => section(page).locator('.drift-viewport');
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const close = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
async function state(page) {
  return section(page).evaluate(element => {
    const port = element.querySelector('.drift-viewport');
    return { position: Number(element.dataset.driftPosition), velocity: Number(element.dataset.carouselVelocity),
      phase: element.dataset.carouselPhase, wrapCount: Number(element.dataset.carouselWrapCount),
      index: Number(element.dataset.carouselIndex), scrollY, height: element.offsetHeight, hidden: document.hidden,
      documentHeight: document.documentElement.scrollHeight, nativeLeft: port.scrollLeft,
      inlineHeight: element.style.height, sticky: getComputedStyle(port).position,
      count: element.querySelector('[data-drift-count]').textContent,
      maximum: document.documentElement.scrollWidth, viewport: innerWidth,
      slots: [...element.querySelectorAll('[data-drift-item]')].map(item => [item.offsetLeft, item.offsetWidth, item.offsetHeight]),
    };
  });
}
async function pauseDrift(page) {
  await section(page).focus({ preventScroll: true }); await page.keyboard.press('Shift');
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-horizontal-drift="tattoos"]');
    return (element?.dataset.carouselPhase === 'idle' || element?.dataset.carouselPhase === 'expanded')
      && Number(element?.dataset.carouselVelocity) === 0;
  }, null, { timeout: 12000 });
  await frames(page);
  return state(page);
}
async function atIndex(page, index) {
  await page.waitForFunction(index => Number(document.querySelector('[data-horizontal-drift="tattoos"]').dataset.carouselIndex) === index, index);
  return pauseDrift(page);
}
async function showSection(page) {
  await section(page).evaluate(element => {
    const port = element.querySelector('.drift-viewport').getBoundingClientRect();
    scrollTo({ top: port.top + scrollY - Math.max(100, (innerHeight - port.height) / 2), behavior: 'instant' });
  });
  await frames(page);
}
async function home(page) {
  await section(page).focus(); await page.keyboard.press('Home'); await atIndex(page, 0);
  await showSection(page); await pauseDrift(page);
}
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
async function metadata(page) {
  const siteFilter = await page.evaluate(() => {
    const figure = document.createElement('figure'); figure.className = 'project-image';
    const image = document.createElement('img'); figure.append(image); document.body.append(figure);
    const filter = getComputedStyle(image).filter; figure.remove(); return filter;
  });
  const photos = section(page).locator('[data-drift-item]');
  assert.equal(await section(page).getAttribute('data-carousel-total'), '8');
  assert.equal(await photos.count(), 8, 'Eight original photographs remain semantic slides without cloned copies.');
  assert.equal(await section(page).locator('img').count(), 8);
  const entries = await photos.locator('img').evaluateAll(images => images.map(image => ({
    original: image.dataset.fullSrc, width: Number(image.getAttribute('width')), height: Number(image.getAttribute('height')),
    alt: image.alt, loading: image.loading, srcset: image.srcset, sizes: image.sizes,
    radius: getComputedStyle(image).borderRadius, filter: getComputedStyle(image).filter,
    fit: getComputedStyle(image).objectFit, transform: getComputedStyle(image).transform,
    frameWidth: image.closest('.inline-artwork-frame').getBoundingClientRect().width,
    frameHeight: image.closest('.inline-artwork-frame').getBoundingClientRect().height,
    imageWidth: image.getBoundingClientRect().width, imageHeight: image.getBoundingClientRect().height,
  })));
  assert.deepEqual(entries.map(image => image.original), originals.map(image => imageManifest[image.url].variants.at(-1).src));
  for (let i = 0; i < entries.length; i++) {
    const image = entries[i];
    assert.equal(image.width, originals[i].width); assert.equal(image.height, originals[i].height);
    assert.equal(image.loading, 'lazy'); assert.equal(image.radius, '4px'); assert.equal(image.fit, 'cover');
    assert.ok(close(image.frameWidth, 300, .5) && close(image.frameHeight, 420, .5), `Every resting card is exactly 300x420: ${JSON.stringify(image)}`);
    assert.equal(image.filter, siteFilter,
      'Photos retain the existing site-wide reality treatment without a carousel-specific recolor.');
    assert.ok(image.alt.length > 20 && image.srcset.includes('w') && image.sizes.length > 0);
  }
  return entries;
}
async function expansion(page, profile, world) {
  await home(page); await page.keyboard.press('ArrowRight'); await atIndex(page, 1);
  const opener = section(page).locator('[data-drift-item]').nth(1).locator('[data-artwork-open]').first();
  const image = opener.locator('img'); await image.evaluate(element => element.decode());
  await page.evaluate(() => document.activeElement?.blur()); await pauseDrift(page);
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  await opener.evaluate(element => element.focus({ preventScroll: true }));
  await frames(page);
  const before = await state(page), boxBefore = await image.boundingBox();
  const fitBefore = await image.evaluate(element => getComputedStyle(element).objectFit);
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"] [data-inline-expanded]'));
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  const enlarged = await state(page), boxEnlarged = await image.boundingBox();
  const ratio = boxEnlarged.width / boxBefore.width;
  const restingGrowth = boxEnlarged.width / Math.min(boxBefore.width, 300);
  const fitAfter = await image.evaluate(element => getComputedStyle(element).objectFit);
  assert.equal(fitBefore, 'cover'); assert.equal(fitAfter, 'contain', 'Only the expanded view uses contain.');
  assert.ok(restingGrowth >= (profile.width < 600 ? 1.04 : 1.2), `Within-page expansion exceeds the exact resting card where viewport room permits: ${JSON.stringify({ ratio, restingGrowth, boxBefore, boxEnlarged })}`);
  assert.ok(close(boxEnlarged.height / boxBefore.height, ratio, .01), 'Expansion preserves genuine photo proportions.');
  assert.ok(boxEnlarged.x >= -1 && boxEnlarged.x + boxEnlarged.width <= profile.width + 1
    && boxEnlarged.y >= -1 && boxEnlarged.y + boxEnlarged.height <= 845, `Expanded photograph fits the viewport: ${JSON.stringify(boxEnlarged)}`);
  assert.equal(await opener.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('dialog[open]').count(), 0); assert.equal(await page.evaluate(() => document.body.style.overflow), bodyOverflow);
  assert.ok(close(enlarged.position, before.position) && close(enlarged.scrollY, before.scrollY), 'Only the photograph transforms; both scroll positions remain.');
  assert.equal(enlarged.documentHeight, before.documentHeight); assert.deepEqual(enlarged.slots, before.slots);
  await page.screenshot({ path: new URL(`expanded-${profile.width}-${profile.reduced}-${world}.png`, artifacts).pathname });
  await page.keyboard.press('Escape'); assert.equal(await opener.getAttribute('aria-pressed'), 'false');
  assert.equal(await opener.evaluate(element => element === document.activeElement), true, 'Escape retains keyboard focus.');
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  const pointerActivate = async () => {
    await pauseDrift(page);
    const box = await opener.boundingBox();
    if (profile.width < 600) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  await pointerActivate(); assert.equal(await opener.getAttribute('aria-pressed'), 'true');
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  await pointerActivate(); assert.equal(await opener.getAttribute('aria-pressed'), 'false', 'Second click/tap restores.');
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  await pauseDrift(page);
  await opener.evaluate(element => element.focus({ preventScroll: true }));
  await page.keyboard.press('Enter');
  assert.equal(await opener.getAttribute('aria-pressed'), 'true');
  await page.mouse.click(profile.width - 2, 90);
  assert.equal(await opener.getAttribute('aria-pressed'), 'false', 'Outside click restores.');
  // Compare the same resting state: Escape deliberately retains keyboard
  // focus, whose shared hover treatment is independent of inline expansion.
  // Freeze the approved ambient drift before measuring the restored frame.
  await page.evaluate(() => document.activeElement?.blur());
  await pauseDrift(page);
  await page.waitForFunction(element => {
    const transform = getComputedStyle(element.querySelector('.interaction-visual')).transform;
    const outer = getComputedStyle(element).transform;
    return Math.abs(new DOMMatrixReadOnly(transform === 'none' ? undefined : transform).m11 - 1) < .001
      && Math.abs(new DOMMatrixReadOnly(outer === 'none' ? undefined : outer).m11 - 1) < .001;
  }, await opener.elementHandle(), { timeout: 3000 });
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  const restored = await state(page), boxRestored = await image.boundingBox();
  assert.ok(close(boxRestored.width, boxBefore.width, 8) && close(boxRestored.height, boxBefore.height, 8), JSON.stringify({ world, computed: await opener.evaluate(e => ({ hover:e.matches(':hover'), focus:e.matches(':focus-visible'), active:document.activeElement.tagName, matrix:getComputedStyle(e.querySelector('.interaction-visual')).transform, scale:getComputedStyle(e.querySelector('.interaction-visual')).getPropertyValue('--ui-active-scale') })), boxBefore, boxEnlarged, boxRestored, style: await opener.getAttribute('style'), wrapper: await opener.locator('.interaction-visual').getAttribute('style') }));
  assert.equal(await image.evaluate(element => getComputedStyle(element).objectFit), 'cover', 'Closing restores the covered resting view.');
  assert.ok(close(restored.position, before.position, 12) && close(restored.scrollY, before.scrollY), JSON.stringify({ before, restored, world, phase: restored.phase }));
  assert.deepEqual(restored.slots, before.slots); assert.equal(restored.documentHeight, before.documentHeight);
  return { before, enlarged, restored, boxBefore, boxEnlarged, ratio };
}
async function controlsAndWrap(page) {
  await home(page);
  assert.equal(await section(page).locator('[data-drift-previous]').isDisabled(), false);
  assert.equal(await section(page).locator('[data-drift-next]').isDisabled(), false);
  await section(page).locator('[data-drift-next]').click(); const next = await atIndex(page, 1);
  assert.equal(next.count, '02/ 08');
  await section(page).locator('[data-drift-previous]').click(); await atIndex(page, 0);
  await section(page).focus(); await page.keyboard.press('End'); const end = await atIndex(page, 7);
  await page.keyboard.press('ArrowRight'); const wrappedForward = await atIndex(page, 0);
  const wrapDistance = (a, b) => Math.min(Math.abs(a - b), Math.abs(3200 - Math.abs(a - b)));
  assert.ok(wrapDistance(wrappedForward.position, end.position) < 800, 'Last to first wraps across the seam instead of crossing the entire archive.');
  await page.keyboard.press('ArrowLeft'); const wrappedBackward = await atIndex(page, 7);
  assert.ok(wrapDistance(wrappedBackward.position, wrappedForward.position) < 800);
  await home(page); return { next, end, wrappedForward, wrappedBackward };
}
async function gestures(page, context, profile) {
  await home(page);
  const resting = await state(page);
  await page.evaluate(() => document.activeElement?.blur());
  if (!profile.reduced) {
    await page.mouse.move(1, 90);
    await page.waitForTimeout(320);
    const drifting = await state(page);
    assert.equal(drifting.phase, 'drift', 'Ambient carousel drift runs while the strip is visible.');
    assert.ok(Math.abs(drifting.position - resting.position) > 2, 'Ambient drift changes the compositor position.');
  } else {
    await page.mouse.move(1, 90); await page.waitForTimeout(320);
    assert.ok(close((await state(page)).position, resting.position, .01), 'Reduced motion keeps a static row.');
  }
  const port = await viewport(page).boundingBox();
  const point = { x: port.x + port.width * .72, y: port.y + Math.min(port.height * .5, 240) };
  await page.mouse.move(point.x, point.y); await pauseDrift(page);
  const wheelBefore = await state(page), wheelScrollBefore = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 100);
  await page.waitForFunction(before => Math.abs(Number(document.querySelector('[data-horizontal-drift="tattoos"]').dataset.driftPosition) - before) > 1, wheelBefore.position);
  await frames(page); const wheelDuring = await state(page);
  assert.ok(Math.abs(wheelDuring.position - wheelBefore.position) > 1, 'Vertical wheel over the viewport drives the horizontal physics.');
  assert.ok(close(wheelDuring.scrollY, wheelScrollBefore, 1), 'The captured wheel must not scroll the page.');
  assert.ok(['momentum', 'idle'].includes(wheelDuring.phase));
  await pauseDrift(page);
  const horizontalBefore = (await state(page)).position;
  await page.mouse.wheel(100, 0);
  await page.waitForFunction(before => Math.abs(Number(document.querySelector('[data-horizontal-drift="tattoos"]').dataset.driftPosition) - before) > 1, horizontalBefore);
  await frames(page);
  const wheelAfter = await state(page);
  assert.ok(Math.abs(wheelAfter.position - horizontalBefore) > 1, 'Native horizontal wheel delta uses the same horizontal physics.');
  assert.ok(close(wheelAfter.scrollY, wheelScrollBefore, 1), 'Horizontal wheel capture also leaves the page scroll untouched.');
  await home(page);
  let cdp;
  const dragBefore = await state(page);
  if (profile.width < 600) {
    cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - i * 19, y: point.y }] });
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x - 160, point.y, { steps: 8 }); await page.mouse.up();
  }
  await frames(page); const dragRelease = await state(page);
  assert.ok(Math.abs(dragRelease.position - dragBefore.position) > 140, `Real drag/swipe moves the horizontal archive: ${JSON.stringify({profile, point, dragBefore, dragRelease, world: await page.locator('html').getAttribute('data-mode')})}`);
  if (profile.reduced) { assert.equal(dragRelease.phase, 'idle'); assert.equal(dragRelease.velocity, 0); }
  else { await page.waitForTimeout(120); await frames(page); const running = await state(page); assert.ok(Math.abs(running.position - dragRelease.position) > .5, `Drag/swipe releases into finite momentum: ${JSON.stringify({ dragRelease, running })}`); }
  const dragAfter = await pauseDrift(page);
  assert.ok(close(dragAfter.scrollY, dragBefore.scrollY, 2), 'Horizontal gestures preserve page scroll.');
  assert.equal(await section(page).locator('[data-inline-expanded]').count(), 0, 'Drag/swipe never clicks open a photograph.');
  const stopped = await state(page);
  assert.ok(stopped.velocity === 0, 'Input momentum stops completely at rest.');
  let resumed = null;
  if (!profile.reduced) {
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(1, 1); await page.waitForTimeout(320); resumed = await state(page);
    assert.equal(resumed.phase, 'drift', JSON.stringify({ resumed, paused: await section(page).getAttribute('data-carousel-hover-paused'), pointerInside: await section(page).getAttribute('data-carousel-pointer-inside'), keyboardPaused: await section(page).getAttribute('data-carousel-keyboard-paused'), active: await page.evaluate(() => document.activeElement?.className) })); assert.ok(Math.abs(resumed.position - stopped.position) > 1, 'Auto-drift resumes after manual drag.');
  }
  await page.mouse.move(profile.width - 2, 400);
  const outsideBefore = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 170);
  await page.waitForFunction(before => scrollY > before + 25, outsideBefore);
  const outsideAfter = await page.evaluate(() => scrollY);
  let verticalTouch;
  if (cdp) {
    await home(page);
    const touchPort = await viewport(page).boundingBox();
    const start = { x: touchPort.x + touchPort.width / 2, y: touchPort.y + Math.min(300, touchPort.height * .65) };
    const yBefore = await page.evaluate(() => scrollY);
    for (let attempt = 0; attempt < 2; attempt++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - i * 18 }] });
        await page.waitForTimeout(24);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
      if (await page.evaluate(before => scrollY > before + 25, yBefore)) break;
    }
    await page.waitForFunction(before => scrollY > before + 25, yBefore);
    verticalTouch = { before: yBefore, after: await page.evaluate(() => scrollY) };
    await cdp.detach();
  }
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  return { resting, wheelBefore, wheelDuring, wheelAfter, dragBefore, dragRelease, dragAfter, stopped, resumed, outsideBefore, outsideAfter, verticalTouch };
}
async function hover(page, profile) {
  await home(page);
  const opener = section(page).locator('[data-drift-item]').first().locator('[data-artwork-open]');
  const slotsBefore = (await state(page)).slots;
  if (!profile.reduced) {
    await page.mouse.move(1, 90); await page.waitForTimeout(220);
  }
  const neighborBefore = await section(page).locator('[data-drift-item]').nth(1).locator('.drift-images').evaluate(element => ({ transform: getComputedStyle(element).transform, top: element.getBoundingClientRect().top, left: element.getBoundingClientRect().left }));
  if (profile.width >= 600) await opener.hover(); else await opener.focus();
  const pausedAt = Number(await section(page).getAttribute('data-drift-position'));
  await page.waitForTimeout(profile.reduced ? 0 : 360);
  if (!profile.reduced && profile.width >= 600) assert.ok(Math.abs(Number(await section(page).getAttribute('data-drift-position')) - pausedAt) < 1, 'Hover pauses ambient drift.');
  const value = await opener.evaluate(element => {
    const visual = element.querySelector('.interaction-visual'), style = getComputedStyle(visual);
    const m = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    return { scale: Math.hypot(m.m11, m.m12), filter: style.filter, duration: style.transitionDuration,
      preferred: Number(getComputedStyle(element).getPropertyValue('--ui-target-scale')),
      parentTransform: getComputedStyle(element.closest('[data-drift-item]')).transform };
  });
  assert.ok(value.scale >= .999 && value.scale <= 1.026);
  if (!profile.reduced && profile.width >= 600) { assert.notEqual(value.filter, 'none'); assert.ok(value.scale > 1); }
  else assert.ok(close(value.scale, 1, .001));
  const neighborAfter = await section(page).locator('[data-drift-item]').nth(1).locator('.drift-images').evaluate(element => ({ transform: getComputedStyle(element).transform, top: element.getBoundingClientRect().top, left: element.getBoundingClientRect().left }));
  if (!profile.reduced && profile.width >= 600) assert.notEqual(neighborAfter.transform, neighborBefore.transform, 'Configured neighbour displacement changes a compositor transform.');
  assert.deepEqual((await state(page)).slots, slotsBefore, 'Hover and neighbour displacement never reflow carousel slots.');
  await page.mouse.move(1, 90); await page.evaluate(() => document.activeElement?.blur());
  return { ...value, neighborBefore, neighborAfter };
}
try {
  for (const profile of profiles) {
    activeProfile = profile;
    console.log(`START V3.1.1 F9 carousel ${profile.width}px reduced=${profile.reduced}`);
    const context = await browser.newContext({ viewport: { width: profile.width, height: 844 },
      reducedMotion: profile.reduced ? 'reduce' : 'no-preference', hasTouch: profile.width < 600, isMobile: profile.width < 600 });
    await context.addInitScript(() => {
      localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .25 }));
      window.__carouselLayoutShifts = [];
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__carouselLayoutShifts.push(entry.value); })
        .observe({ type: 'layout-shift', buffered: true });
    });
    const page = activePage = await context.newPage();
    await page.bringToFront();
    const errors = activeErrors = [], requests = [];
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => requests.push(request.url()));
    try {
      await page.goto(new URL('/creative/tattoos?test=1', base).href, { waitUntil: 'networkidle' });
      assert.ok(!requests.some(url => /\/src\/main\.js|(?:\/|_)three(?:[._/]|$)|wordmark\.typeface|tattoo-texture|LiberationSans-Bold/i.test(url)), 'Cold Works downloads no Three.js or hero assets.');
      assert.ok(!requests.some(url => /\.mp3(?:$|[?#])/.test(url)), 'Photograph browsing never fetches SMASH.');
      const config = await page.evaluate(async () => (await import('/src/carouselSettings.js')).carouselSettings);
      assert.equal(config.cardWidth, 300); assert.equal(config.cardHeight, 420); assert.equal(config.spacing, 100);
      assert.equal(config.inertia, .05); assert.equal(config.wheelSensitivity, 8); assert.equal(config.wrap, true);
      assert.equal(config.autoDrift, true); assert.equal(config.autoScroll, .3); assert.equal(config.hoverPause, true);
      assert.equal(config.scrollCapture, 'area'); assert.equal(config.perspectiveZoom, 45); assert.equal(config.cameraDistance, 900);
      assert.equal(config.depthScale, false); assert.equal(config.edgeRotation, 0); assert.equal(config.edgeScaleFloor, 1); assert.equal(config.pointerLabel, false);
      assert.equal(config.expandWithinLayout, true);
      const depth = await section(page).evaluate(element => {
        const port = element.querySelector('.drift-viewport');
        return { perspective: getComputedStyle(port).perspective,
          items: [...element.querySelectorAll('[data-drift-item]')].map(item => {
            const matrix = new DOMMatrixReadOnly(getComputedStyle(item).transform === 'none' ? undefined : getComputedStyle(item).transform);
            return { scale: Math.hypot(matrix.m11, matrix.m12), rotation: Math.atan2(matrix.m12, matrix.m11), is3d: !matrix.is2D };
          }) };
      });
      assert.equal(depth.perspective, 'none');
      assert.ok(depth.items.every(item => close(item.scale, 1, .0001) && close(item.rotation, 0, .0001)), `Every card remains flat without depth scale or rotation: ${JSON.stringify(depth.items)}`);
      // B-013/B-014 (4ada015): flashes and jewellery ship editorial
      // placeholders, not artwork. The strip is therefore a real carousel with
      // eight marked placeholder cards — still without a single image or canvas.
      const flashes = page.locator('[data-horizontal-drift="flashes"]');
      assert.equal(await flashes.locator('img,canvas').count(), 0);
      assert.equal(await flashes.locator('[data-drift-item]').count(), 8);
      assert.equal(await flashes.locator('[data-drift-item][data-placeholder="true"]').count(), 8);
      assert.equal(await flashes.locator('[data-placeholder-expand]').count(), 8);
      assert.equal(await flashes.locator('[data-placeholder-expand][aria-pressed="false"]').count(), 8);
      assert.equal(await flashes.locator('.archive-empty').count(), 0);
      assert.equal(await flashes.locator('[data-drift-count]').textContent(), '01/ 08');
      assert.equal(await flashes.locator('[data-drift-previous]').isDisabled(), false);
      assert.equal(await flashes.locator('[data-drift-next]').isDisabled(), false);
      await page.evaluate(() => { window.__carouselLayoutShifts.length = 0; });
      const worlds = [];
      for (const world of ['normal', 'xray']) {
        if (world === 'xray') await mode(page, world);
        const images = await metadata(page), controls = await controlsAndWrap(page);
        const hoverState = await hover(page, profile), viewing = await expansion(page, profile, world);
        const input = await gestures(page, context, profile);
        await home(page);
        const final = await state(page);
        assert.equal(final.nativeLeft, 0, 'Enhanced motion uses transforms rather than a native scroll timeline.');
        assert.equal(final.inlineHeight, ''); assert.notEqual(final.sticky, 'sticky');
        assert.ok(final.maximum <= final.viewport + 1);
        await page.screenshot({ path: new URL(`carousel-${profile.width}-${profile.reduced}-${world}.png`, artifacts).pathname });
        worlds.push({ world, images, controls, hover: hoverState, viewing, input, final });
      }
      await mode(page, 'normal');
      // Exercise teardown with multi-image fixture without fabricated production content.
      const fixture = await page.evaluate(async () => {
        const { renderHorizontalDrift } = await import('/src/horizontal-drift-content.js');
        const { initHorizontalDrift } = await import('/src/horizontal-drift.js');
        const { initGallery } = await import('/src/gallery.js');
        const host = document.createElement('div');
        host.innerHTML = renderHorizontalDrift([{ id: 'test-only-multiimage', category: 'tattoos', title: 'test fixture', images: [
          { src: '/images/tattoos/tattoo-01.jpg', alt: 'genuine supplied photograph, browser-only fixture', width: 1170, height: 1674 },
          { src: '/images/tattoos/tattoo-02.jpg', alt: 'genuine supplied detail, browser-only fixture', width: 1170, height: 1470 },
        ] }], { category: 'tattoos', label: 'test only' });
        document.querySelector('main').append(host);
        const stopCarousel = initHorizontalDrift(host), stopGallery = initGallery(host);
        const element = host.querySelector('[data-horizontal-drift]');
        const enhanced = element.classList.contains('is-drift-enhanced');
        const visible = [...element.querySelectorAll('[data-artwork-open]')].filter(node => !node.closest('[hidden]')).length;
        const hidden = element.querySelectorAll('[hidden]').length;
        stopGallery(); stopCarousel();
        const disposed = !element.classList.contains('is-drift-enhanced');
        host.remove(); return { enhanced, disposed, visible, hidden };
      });
      assert.equal(fixture.enhanced, true); assert.equal(fixture.disposed, true); assert.equal(fixture.visible, 1); assert.ok(fixture.hidden > 0);
      assert.deepEqual(errors, []);
      const layoutShifts = await page.evaluate(() => window.__carouselLayoutShifts);
      const cumulativeLayoutShift = layoutShifts.reduce((total, value) => total + value, 0);
      assert.ok(cumulativeLayoutShift <= .001, `Carousel interactions and lazy images cause no meaningful layout shift (${cumulativeLayoutShift}).`);
      results.push({ ...profile, config, worlds, fixture, layoutShifts, cumulativeLayoutShift, errors });
      await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: false, results }, null, 2));
      console.log(`PASS F9/F19 ${profile.width}px reduced=${profile.reduced}: eight 300x420 covered cards, flat row, viewport wheel physics, touch escape, wrapping controls, unified hover, actual inline fit and no Three.js.`);
    } finally { await context.close(); activePage = null; }
  }
  await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: true, results }, null, 2));
} catch (error) {
  if (activePage) await activePage.screenshot({ path: new URL(`failure-${activeProfile.width}-${activeProfile.reduced}.png`, artifacts).pathname }).catch(() => {});
  await writeFile(new URL('results.json', artifacts), JSON.stringify({ passed: false, failedProfile: activeProfile, errors: activeErrors, failure: error.stack || String(error), results }, null, 2));
  throw error;
} finally { clearTimeout(deadline); await browser.close(); }
