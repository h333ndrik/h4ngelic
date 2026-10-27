import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Real mesh input and raster evidence. Read-only projected anchors identify a
// small screenshot region; coloured rendered pixels, not those coordinates,
// establish that pigment is visible there as the actual sculpture moves.
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const destination = new URL('../artifacts/hero-ink/', import.meta.url);
const profiles = (process.env.H4_INK_PROFILES || 'desktop,390,320,record').split(',');
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const deadline = setTimeout(() => void browser.close(), 240000);
const reports = [];
const state = page => page.evaluate(() => window.__H4_TEST__?.snapshot());
const ink = async page => (await state(page)).heroInk;
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));

async function paused(page, value) {
  const control = page.locator('#pause-control');
  if ((await control.getAttribute('aria-pressed')) !== String(value)) {
    // Real keyboard activation avoids spending an ink lifetime waiting for the
    // button's hover animation to settle before every diagnostic pose.
    await control.focus();
    await page.keyboard.press('Enter');
  }
  await page.waitForFunction(value => document.getElementById('pause-control').getAttribute('aria-pressed') === String(value), value);
}

async function ready(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.goto(new URL('/?test=1', base).href, { waitUntil: 'networkidle' });
  await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__H4_TEST__?.snapshot().frameCount > 2
    && Boolean(window.__H4_TEST__.snapshot().heroInk));
  return { page, errors };
}

async function stamp(page, options = {}) {
  const before = await ink(page);
  for (let attempt = 0; attempt < 4; attempt++) {
    const hit = await page.evaluate(options => window.__H4_TEST__.hitPoint(options), options);
    assert.ok(hit, `The visible mesh must offer a real raycast target for ${JSON.stringify(options)}.`);
    await page.mouse.click(hit.x, hit.y);
    try {
      await page.waitForFunction(created => window.__H4_TEST__.snapshot().heroInk.created > created,
        before.created, { timeout: 2500 });
      const result = await ink(page);
      const mark = result.marks.at(-1);
      assert.ok(mark?.vertexCount >= 3 && mark.opacity >= 0);
      assert.ok(mark.lifetimeMs >= 6000 && mark.lifetimeMs <= 12000);
      assert.ok(mark.registrationError < 1e-7, 'Decal vertices must share the parent mesh coordinate frame.');
      assert.equal(await page.locator('[data-ink-mark]').count(), 0,
        'A canvas hit must not also create a flat document ink overlay.');
      return { hit, mark, snapshot: result };
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

async function pixelsAt(page, id, label) {
  const before = (await ink(page)).marks.find(mark => mark.id === id);
  assert.ok(before, `Mark ${id} must still be alive for ${label}.`);
  const image = await page.screenshot({ path: new URL(`${label}.png`, destination).pathname });
  const after = (await ink(page)).marks.find(mark => mark.id === id);
  assert.ok(after, `Mark ${id} must survive the ${label} screenshot.`);
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const anchor = { x: (before.projected.x + after.projected.x) / 2, y: (before.projected.y + after.projected.y) / 2 };
  const radius = Math.min(65, Math.max(12, before.projected.radius * 1.6 + 5,
    Math.hypot(before.projected.x - after.projected.x, before.projected.y - after.projected.y) + 5));
  let coloredPixels = 0, sumX = 0, sumY = 0, maximumChroma = 0;
  for (let y = Math.max(0, Math.floor(anchor.y - radius)); y < Math.min(info.height, Math.ceil(anchor.y + radius)); y++) {
    for (let x = Math.max(0, Math.floor(anchor.x - radius)); x < Math.min(info.width, Math.ceil(anchor.x + radius)); x++) {
      if (Math.hypot(x - anchor.x, y - anchor.y) > radius) continue;
      const offset = (y * info.width + x) * 3;
      const values = data.subarray(offset, offset + 3);
      const maximum = Math.max(...values), minimum = Math.min(...values);
      maximumChroma = Math.max(maximumChroma, maximum - minimum);
      if (maximum - minimum > 45 && maximum > 70) { coloredPixels++; sumX += x; sumY += y; }
    }
  }
  const centroid = coloredPixels ? { x: sumX / coloredPixels, y: sumY / coloredPixels } : null;
  const result = { label, before, after, radius, coloredPixels, maximumChroma, centroid,
    centroidToAnchor: centroid ? Math.hypot(centroid.x - anchor.x, centroid.y - anchor.y) : null };
  await writeFile(new URL(`${label}.json`, destination), JSON.stringify(result, null, 2));
  return result;
}

async function mode(page, expected) {
  if (expected === 'xray') {
    await page.keyboard.down('4');
    try { await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray'); }
    finally { await page.keyboard.up('4'); }
  } else for (let index = 0; index < 3; index++) await page.keyboard.press('3');
  await page.waitForFunction(expected => document.documentElement.dataset.mode === expected
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot'), expected);
}

async function desktop() {
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce' });
  const { page, errors } = await ready(context);
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.getElementById('pause-control').getAttribute('aria-pressed') === 'true');
    await page.locator('#speed-control').focus();
    await page.keyboard.press('Enter');
    const clean = await ink(page);
    assert.equal(clean.count, 0);
    assert.ok((await state(page)).revealOpacity < .01,
      'The initial raster comparison uses clean chrome, before its supplied artwork reflection is revealed.');
    const front = await stamp(page, { minFacing: .15, minAbsNormalZ: .9999 });
    await page.waitForFunction(id => window.__H4_TEST__.snapshot().heroInk.marks.find(mark => mark.id === id)?.opacity > .4, front.mark.id);
    const first = await pixelsAt(page, front.mark.id, 'front-still');
    assert.ok(first.coloredPixels > 8, `Surface pigment must appear in actual raster pixels; observed ${first.coloredPixels}.`);
    assert.ok(first.centroidToAnchor < first.radius);

    // Returning to the normal animation media preference resumes the original
    // base clock. No test setter or fabricated mesh transform is involved.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.getElementById('pause-control').getAttribute('aria-pressed') === 'false');
    const frames = [first];
    await paused(page, true);
    for (let sample = 0; sample < 2; sample++) {
      const previous = await state(page);
      await paused(page, false);
      await page.waitForFunction(time => window.__H4_TEST__.snapshot().baseTime > time + .12, previous.baseTime);
      await paused(page, true);
      const mark = (await ink(page)).marks.find(mark => mark.id === front.mark.id);
      if (mark?.facing > 0 && mark.opacity > .2) {
        const frame = await pixelsAt(page, mark.id, `moving-surface-${frames.length}`);
        assert.ok(distance(frame.after.localPoint, front.mark.localPoint) < 1e-9,
          'The same paint anchor must remain fixed in the letter local geometry.');
        assert.ok(frame.after.registrationError < 1e-7);
        frames.push(frame);
      }
    }
    assert.ok(frames.length >= 3, 'At least three actual moving frames must show surface paint.');
    const moving = frames.filter(frame => frame.coloredPixels > 5);
    assert.ok(moving.length >= 3, 'Pigment raster pixels must remain near the surface anchor over several real animation frames.');
    const travel = Math.max(...moving.map(frame => Math.hypot(frame.after.projected.x - first.after.projected.x,
      frame.after.projected.y - first.after.projected.y)));
    assert.ok(travel > 3, 'The verified paint must actually move on screen with the rotating/translating logo.');
    const rasterTravel = Math.max(...moving.map(frame => Math.hypot(frame.centroid.x - first.centroid.x,
      frame.centroid.y - first.centroid.y)));
    assert.ok(rasterTravel > 3, 'The actual pigment-pixel centroid must move too; projected coordinates alone cannot prove adhesion.');
    // Resume the actual base motion. A front decal may correctly wrap a small
    // bevel: that sliver can remain visible after the cap rotates away. Most
    // pigment must disappear from the rendered image, rather than remain as a
    // constant screen-space sticker. The separate recording stays unpaused.
    await page.locator('#speed-control').focus();
    await page.keyboard.press('Enter');
    await paused(page, false);
    await page.waitForFunction(id => window.__H4_TEST__.snapshot().heroInk.marks.find(mark => mark.id === id)?.facing < -.18,
      front.mark.id, { timeout: 6000 });
    const hidden = await pixelsAt(page, front.mark.id, 'rotated-away');
    const maximumVisiblePigment = Math.max(...moving.map(frame => frame.coloredPixels));
    assert.ok(hidden.coloredPixels < maximumVisiblePigment * .35,
      `The turned-away cap must lose most visible pigment; wrapped bevel remnants may remain (${hidden.coloredPixels}/${maximumVisiblePigment}).`);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const angled = await stamp(page, { minFacing: .15, maxFacing: .9, maxAbsNormalZ: .9 });
    assert.ok(Math.abs(angled.mark.normal[2]) < .95, 'An angled extrusion/bevel surface must be raycast and painted.');
    const colors = [angled.mark.color];
    for (let index = 0; index < 7; index++) {
      const mark = await stamp(page);
      colors.push(mark.mark.color);
      assert.ok(mark.snapshot.count <= mark.snapshot.maxMarks && mark.snapshot.pending <= mark.snapshot.maxMarks);
    }
    assert.ok(colors.every((color, index) => index === 0 || color !== colors[index - 1]),
      'Consecutive deliberate hits should choose different dominant pigments.');
    const capped = await ink(page);
    assert.equal(capped.count, capped.maxMarks);
    assert.ok(capped.resourcesDisposed.geometries > 0 && capped.resourcesDisposed.materials > 0 && capped.resourcesDisposed.textures > 0,
      'Cap eviction must release every GPU resource belonging to its old marks.');

    const created = capped.created;
    await page.mouse.click(12, 500);
    await page.waitForTimeout(100);
    assert.equal((await ink(page)).created, created, 'Empty canvas space cannot create a floating decal.');
    const grab = await page.evaluate(() => window.__H4_TEST__.hitPoint());
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(grab.x + 95, grab.y - 32, { steps: 6 });
    await page.mouse.up();
    assert.equal((await ink(page)).created, created, 'Dragging the sculpture must not also stamp paint.');
    assert.equal((await state(page)).isDragging, false);

    // A real elapsed lifetime is checked once, with no accelerated clock.
    const lifetimeStart = await ink(page);
    await page.waitForFunction(() => window.__H4_TEST__.snapshot().heroInk.count === 0
      && window.__H4_TEST__.snapshot().heroInk.pending === 0, null, { timeout: 13000 });
    const expired = await ink(page);
    assert.ok(expired.disposed >= lifetimeStart.disposed + lifetimeStart.count);
    assert.ok(expired.resourcesDisposed.geometries >= expired.created);
    assert.ok(expired.resourcesDisposed.materials >= expired.created);
    assert.ok(expired.resourcesDisposed.textures >= expired.created);
    assert.equal(expired.gpu.geometries, clean.gpu.geometries,
      'Expired surface marks must return actual renderer geometry allocations to their initial count.');
    assert.equal(expired.gpu.textures, clean.gpu.textures,
      'Expired surface marks must return actual renderer texture allocations to their initial count.');

    await stamp(page);
    await mode(page, 'xray');
    assert.equal((await ink(page)).count, 0, 'Entering The Other Side clears Normal surface ink.');
    const otherCreated = (await ink(page)).created;
    const otherHit = await page.evaluate(() => window.__H4_TEST__.hitPoint());
    if (otherHit) await page.mouse.click(otherHit.x, otherHit.y);
    assert.equal((await ink(page)).created, otherCreated, 'The Other Side must not create extra surface paint.');
    await mode(page, 'normal');
    assert.equal((await ink(page)).count, 0);
    await stamp(page);
    await page.locator('.hero-nav a[href="/work"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.page === 'work');
    // render() commits the route attribute before awaiting its enhancements;
    // lifecycle cleanup follows h4:pagechange once that async commit finishes.
    await page.waitForFunction(() => window.__H4_TEST__.snapshot().heroInk.count === 0
      && window.__H4_TEST__.snapshot().heroInk.pending === 0);
    assert.equal((await ink(page)).count, 0, 'Leaving the homepage releases obsolete surface paint.');
    assert.deepEqual(errors, []);
    reports.push({ profile: 'desktop', front: front.mark, angled: angled.mark, frames, hidden, projectedTravel: travel,
      colors, capped, lifetimeStart, expired, final: await ink(page), errors });
    console.log('PASS 3D ink desktop: actual rotating raster pigment, local adhesion, hidden backface, angled hit, color/cap, drag/empty, elapsed disposal and mode/route cleanup.');
  } finally { await context.close(); }
}

async function mobile(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    reducedMotion: 'reduce' });
  const { page, errors } = await ready(context);
  try {
    const hit = await page.evaluate(() => window.__H4_TEST__.hitPoint());
    assert.ok(hit);
    await page.touchscreen.tap(hit.x, hit.y);
    await page.waitForFunction(() => window.__H4_TEST__.snapshot().heroInk.count > 0);
    const initial = await ink(page);
    assert.ok(initial.maxMarks <= 3 && initial.count <= initial.maxMarks);
    assert.equal(await page.locator('[data-ink-mark]').count(), 0, 'A hero tap cannot duplicate its 3D mark with flat document ink.');
    const raster = await pixelsAt(page, initial.marks.at(-1).id, `mobile-${width}`);
    assert.ok(raster.coloredPixels > 2, 'A mobile mesh tap must produce actual visible pigment.');
    const created = initial.created;
    await page.touchscreen.tap(12, 560);
    assert.equal((await ink(page)).created, created);
    const grab = await page.evaluate(() => window.__H4_TEST__.hitPoint());
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: grab.x, y: grab.y }] });
    for (let index = 1; index <= 6; index++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: grab.x, y: grab.y - index * 22 }] });
      await page.waitForTimeout(25);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => scrollY > 30);
    assert.equal((await ink(page)).created, created, 'Native vertical scrolling over the mesh must not stamp a decal.');
    assert.equal((await state(page)).isDragging, false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    reports.push({ profile: `mobile-${width}`, hit, initial, raster, final: await ink(page), errors });
    await session.detach();
    console.log(`PASS 3D ink ${width}px: actual surface tap, no duplicate/empty mark, native vertical pan and bounded resources.`);
  } finally { await context.close(); }
}

async function record() {
  const context = await browser.newContext({ viewport: { width: 800, height: 650 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce', recordVideo: { dir: destination.pathname, size: { width: 800, height: 650 } } });
  const { page, errors } = await ready(context);
  const video = page.video();
  try {
    const mark = await stamp(page, { minFacing: .35 });
    await page.waitForFunction(id => window.__H4_TEST__.snapshot().heroInk.marks.find(mark => mark.id === id)?.opacity > .5, mark.mark.id);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const samples = [];
    for (let index = 0; index < 16; index++) { await page.waitForTimeout(400); samples.push(await state(page)); }
    assert.ok(samples.some(sample => sample.heroInk.marks.length), 'The recording must contain actual live surface paint.');
    assert.deepEqual(errors, []);
    reports.push({ profile: 'recorded-real-animation', samples, errors });
  } finally {
    await context.close();
    await video.saveAs(new URL('rotating-surface-ink.webm', destination).pathname);
  }
}

try {
  if (profiles.includes('desktop')) await desktop();
  for (const width of [390, 320]) if (profiles.includes(String(width))) await mobile(width);
  if (profiles.includes('record')) await record();
  await writeFile(new URL('results.json', destination), JSON.stringify({ measuredAt: new Date().toISOString(), base,
    note: 'Headless Chromium with software WebGL. Actual geometry input/raster evidence, not physical-device FPS.', reports }, null, 2));
} finally { clearTimeout(deadline); await browser.close(); }
