import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Native bitmap fidelity is checked against real portfolio typography with the
// color treatment disabled. A shifted white glyph outside its old mask proves
// source-pixel displacement; colored rectangles or a whole-page tint cannot
// satisfy both the grayscale and spatial assertions.
const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const destination = new URL('../artifacts/mode-snapshot/', import.meta.url);
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];

try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/work', baseURL).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { createModeSnapshotTransition } = await import('/src/mode-snapshot.js');
    window.__snapshotProbe = {
      create: createModeSnapshotTransition,
      callbacks: [],
      controller: createModeSnapshotTransition({ settings: { colorStrength: 0, channelOffsetPx: 0, displacementPx: 180 } }),
    };
    window.__snapshotProbe.controller.prepare({ variant: 1947 });
  });
  const clip = { x: 0, y: 120, width: 760, height: 270 };
  const original = await page.screenshot({ clip, path: new URL('original-typography.png', destination).pathname });
  await page.evaluate(() => {
    const probe = window.__snapshotProbe;
    probe.handle = probe.controller.run(detail => probe.callbacks.push(detail), { mode: 'xray', duration: 1000, variant: 1947 });
  });
  await page.waitForFunction(() => Number(document.documentElement.dataset.modeSnapshotFrame) >= 3, null, { timeout: 5000 });
  // Software-GPU screenshot readback can outlast the entire one-second effect.
  // Freeze the native animation clock for this structural pixel proof only;
  // the separate unpaused run below verifies real-time completion and cleanup.
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) if (animation.effect?.pseudoElement?.startsWith('::view-transition-')) {
      animation.pause(); animation.currentTime = 400;
    }
  });
  await page.waitForTimeout(90);
  const metadata = await page.evaluate(() => ({
    callbacks: window.__snapshotProbe.callbacks,
    filter: getComputedStyle(document.documentElement, '::view-transition-old(root)').filter,
    source: document.querySelector('.mode-snapshot-definitions feDisplacementMap')?.getAttribute('in'),
    controller: window.__snapshotProbe.controller.snapshot(),
  }));
  // Read active metadata before potentially slow GPU/PNG readback. The real
  // bounded-lifetime guard can clean up while that readback finishes; the
  // following bitmap displacement assertions still require captured pixels.
  const shifted = await page.screenshot({ clip, path: new URL('displaced-actual-typography.png', destination).pathname });
  await page.evaluate(async () => { window.__snapshotProbe.controller.skip(); await window.__snapshotProbe.handle.finished; });
  const [beforePixels, afterPixels] = await Promise.all([original, shifted].map(image => sharp(image).removeAlpha().raw().toBuffer()));
  let brightBefore = 0, brightAfter = 0, movedOutsideMask = 0, unexpectedColors = 0;
  for (let offset = 0; offset < beforePixels.length; offset += 3) {
    const before = beforePixels[offset] > 120 && beforePixels[offset + 1] > 120;
    const after = afterPixels[offset] > 120 && afterPixels[offset + 1] > 120;
    if (before) brightBefore++;
    if (after) brightAfter++;
    if (after && !before) movedOutsideMask++;
    if (Math.abs(afterPixels[offset] - afterPixels[offset + 1]) > 12 || Math.abs(afterPixels[offset + 1] - afterPixels[offset + 2]) > 12) unexpectedColors++;
  }
  assert.ok(brightBefore > 1000 && brightAfter > 1000, 'The captured source must preserve actual readable glyph information.');
  assert.ok(movedOutsideMask > 600, `Real bright glyph pixels must move outside their old mask; observed ${movedOutsideMask}.`);
  assert.ok(unexpectedColors < 500, 'With color treatment disabled, displacement must sample grayscale website pixels, not the colored UV map.');
  assert.match(metadata.filter, /h4-mode-snapshot/);
  assert.equal(metadata.source, 'SourceGraphic');
  assert.deepEqual(metadata.callbacks.map(detail => detail.captured), [true]);
  assert.equal(await page.locator('html').getAttribute('data-mode-snapshot'), null);
  const restored = await page.screenshot({ clip, path: new URL('restored-typography.png', destination).pathname });
  const restoredPixels = await sharp(restored).removeAlpha().raw().toBuffer();
  assert.deepEqual(restoredPixels, beforePixels, 'The native snapshot effect must not permanently alter live DOM pixels.');

  const realtime = await page.evaluate(async () => {
    const probe = window.__snapshotProbe;
    const calls = [];
    const started = performance.now();
    const handle = probe.controller.run(detail => calls.push(detail), { mode: 'normal', duration: 720, variant: 2231 });
    await handle.finished;
    return { elapsedMs: Math.round(performance.now() - started), calls, flag: document.documentElement.hasAttribute('data-mode-snapshot'), snapshot: probe.controller.snapshot() };
  });
  assert.deepEqual(realtime.calls.map(detail => detail.captured), [true]);
  assert.ok(realtime.elapsedMs >= 650 && realtime.elapsedMs < 3000, `The unpaused native transition must finish within its bounded lifecycle; observed ${realtime.elapsedMs}ms.`);
  assert.equal(realtime.flag, false);
  assert.equal(realtime.snapshot.active, false);

  const fallback = await page.evaluate(async () => {
    const probe = window.__snapshotProbe;
    probe.controller.dispose();
    const native = document.startViewTransition;
    document.startViewTransition = undefined;
    const calls = [];
    const controller = probe.create();
    const handle = controller.run(detail => calls.push(detail), { mode: 'normal' });
    const result = { calls, handle, active: controller.snapshot().active, flag: document.documentElement.hasAttribute('data-mode-snapshot') };
    controller.dispose(); document.startViewTransition = native;
    return result;
  });
  assert.deepEqual(fallback.calls, [{ captured: false }]);
  assert.equal(fallback.handle, null);
  assert.equal(fallback.active, false);
  assert.equal(fallback.flag, false);

  const interruption = await page.evaluate(async () => {
    const probe = window.__snapshotProbe;
    const controller = probe.create({ settings: { displacementPx: 0, columns: 0, rows: 0, framesPerSecond: 0 } });
    const calls = [];
    const handle = controller.run(detail => calls.push(detail), { mode: 'xray', duration: 800, variant: 13 });
    document.dispatchEvent(new CustomEvent('h4:navigationstart'));
    await handle.finished;
    const invalid = [...document.querySelectorAll('.mode-snapshot-definitions [scale],.mode-snapshot-definitions [href]')]
      .some(node => /NaN|Infinity/.test(`${node.getAttribute('scale')} ${node.getAttribute('href')}`));
    const result = { calls, invalid, flag: document.documentElement.hasAttribute('data-mode-snapshot'), snapshot: controller.snapshot() };
    controller.dispose(); return result;
  });
  assert.equal(interruption.calls.length, 1, 'Skipping before native update must still commit exactly once.');
  assert.equal(interruption.invalid, false, 'A zero-strength preset must not create invalid displacement values.');
  assert.equal(interruption.flag, false);
  assert.equal(interruption.snapshot.active, false);
  assert.deepEqual(errors, []);
  reports.push({ profile: 'native-desktop', brightBefore, brightAfter, movedOutsideMask, unexpectedColors, metadata, realtime, fallback, interruption });
  await context.close();

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(new URL('/work', baseURL).href, { waitUntil: 'networkidle' });
  const reduced = await reducedPage.evaluate(async () => {
    const { createModeSnapshotTransition } = await import('/src/mode-snapshot.js');
    const controller = createModeSnapshotTransition();
    const calls = [];
    const prepared = controller.prepare();
    const handle = controller.run(detail => calls.push(detail), { mode: 'xray' });
    const result = { calls, prepared, handle, nodes: document.querySelectorAll('.mode-snapshot-definitions').length };
    controller.dispose(); return result;
  });
  assert.deepEqual(reduced, { calls: [{ captured: false }], prepared: null, handle: null, nodes: 0 });
  reports.push({ profile: 'reduced-motion', ...reduced });
  await reducedContext.close();
  await writeFile(new URL('results.json', destination), JSON.stringify({ measuredAt: new Date().toISOString(), reports }, null, 2));
  console.log('PASS native snapshot: actual glyph-pixel displacement, preserved source colors, exact restoration, once-only callbacks, interrupted/zero-strength/reduced/unsupported cleanup.',
    { brightBefore, brightAfter, movedOutsideMask, unexpectedColors });
} finally { await browser.close(); }
