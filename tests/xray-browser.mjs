import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const artifacts = new URL('../artifacts/xray/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function open({ lite = false, reduced = false } = {}) {
  const context = await browser.newContext({
    viewport: lite ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    isMobile: lite,
    hasTouch: lite,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  // Explicit profiles make both presentation pipelines reproducible in CI;
  // these overrides are coverage fixtures, not device-performance measurements.
  await context.addInitScript((weak) => {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => weak ? 2 : 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => weak ? 2 : 8 });
  }, lite);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('/work', baseURL).href, { waitUntil: 'networkidle' });
  await page.locator('html[data-xray-ready]').waitFor();
  await page.evaluate(async () => {
    // The real application and its real stylesheet remain in use. Only the
    // photograph is a temporary fixture, never an artwork-data entry or route.
    const fixture = document.createElement('div');
    fixture.dataset.xrayFixture = '';
    Object.assign(fixture.style, { position: 'fixed', left: '16px', top: '16px', width: '256px', zIndex: '2147483000', pointerEvents: 'none' });
    const figure = document.createElement('figure');
    figure.className = 'project-image';
    Object.assign(figure.style, { margin: '0', width: '256px' });
    const image = new Image();
    image.src = '/assets/tattoo-texture.webp';
    image.alt = 'supplied tattoo artwork used only in an automated test';
    image.width = 256;
    image.height = 362;
    Object.assign(image.style, { display: 'block', width: '256px', height: '362px', maxWidth: 'none', opacity: '1', transform: 'none', transition: 'none' });
    figure.append(image);
    fixture.append(figure);
    if (!document.querySelector('#logo-canvas')) {
      const canvas = document.createElement('canvas');
      canvas.id = 'logo-canvas';
      canvas.width = 256;
      canvas.height = 80;
      Object.assign(canvas.style, { position: 'relative', width: '256px', height: '80px', opacity: '1' });
      fixture.append(canvas);
    }
    document.body.append(fixture);
    await image.decode();
  });
  return { context, page, errors, media: page.locator('[data-xray-fixture] img') };
}

async function settled(page, mode) {
  await page.waitForFunction((expected) => document.documentElement.dataset.mode === expected && !document.documentElement.hasAttribute('data-xray-transition'), mode);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function pixelDifference(before, after) {
  const [original, changed] = await Promise.all([before, after].map((bytes) => sharp(bytes).ensureAlpha().raw().toBuffer()));
  assert.equal(original.length, changed.length, 'The treatment must preserve image dimensions.');
  let pixelsChanged = 0;
  let totalDelta = 0;
  for (let index = 0; index < original.length; index += 4) {
    const delta = Math.abs(original[index] - changed[index]) + Math.abs(original[index + 1] - changed[index + 1]) + Math.abs(original[index + 2] - changed[index + 2]);
    if (delta > 18) pixelsChanged++;
    totalDelta += delta;
  }
  return { pixelsChanged, pixels: original.length / 4, fraction: pixelsChanged / (original.length / 4), meanChannelDelta: totalDelta / (original.length / 4 * 3) };
}

try {
  const full = await open();
  const before = await full.media.screenshot();
  assert.equal(await full.page.locator('html').getAttribute('data-xray-quality'), 'full');
  await full.page.keyboard.press('4');
  await settled(full.page, 'xray');
  assert.match(await full.media.evaluate((element) => getComputedStyle(element).filter), /h4-xray-treatment/);
  const transformed = await full.media.screenshot();
  const fullPixels = await pixelDifference(before, transformed);
  assert.ok(fullPixels.fraction > .15 && fullPixels.meanChannelDelta > 8, `The actual photograph must transform, not just its CSS property: ${JSON.stringify(fullPixels)}`);
  await writeFile(new URL('normal.png', artifacts), before);
  await writeFile(new URL('other-side.png', artifacts), transformed);
  await full.page.keyboard.press('Numpad4');
  await settled(full.page, 'normal');
  assert.equal(await full.media.evaluate((element) => getComputedStyle(element).filter), 'none');
  assert.equal((await pixelDifference(before, await full.media.screenshot())).pixelsChanged, 0, 'Returning to Normal must restore the original photograph exactly.');

  await full.page.evaluate(() => {
    // Synchronous toggles intentionally interrupt the bounded transition.
    for (let index = 0; index < 10; index++) document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', code: 'Digit4', bubbles: true }));
  });
  await settled(full.page, 'normal');
  assert.equal(await full.page.locator('[data-xray-filters]').count(), 1);
  assert.equal(await full.page.locator('[data-xray-filters] filter').count(), 2);
  assert.equal(await full.page.locator('.xray-distress').count(), 1);
  assert.equal((await pixelDifference(before, await full.media.screenshot())).pixelsChanged, 0, 'Interrupted toggles must not accumulate residual filters.');
  assert.deepEqual(full.errors, []);
  await full.context.close();
  console.log('PASS X-Ray full pipeline: real rendered pixel changes, exact normal restoration, numpad and interrupted-toggle reuse.', fullPixels);

  const lite = await open({ lite: true });
  const liteBefore = await lite.media.screenshot();
  assert.equal(await lite.page.locator('html').getAttribute('data-xray-quality'), 'lite');
  await lite.page.locator('[data-xray-toggle]').tap();
  await settled(lite.page, 'xray');
  assert.match(await lite.media.evaluate((element) => getComputedStyle(element).filter), /h4-xray-lite/);
  assert.doesNotMatch(await lite.page.locator('#logo-canvas').evaluate((element) => getComputedStyle(element).filter), /url\(/, 'An animated weak-device hero must use the cheaper CSS treatment.');
  const litePixels = await pixelDifference(liteBefore, await lite.media.screenshot());
  assert.ok(litePixels.fraction > .15 && litePixels.meanChannelDelta > 8, 'The lite pipeline must still transform the actual photograph.');
  await lite.page.locator('[data-xray-toggle]').tap();
  await settled(lite.page, 'normal');
  assert.equal((await pixelDifference(liteBefore, await lite.media.screenshot())).pixelsChanged, 0);
  assert.deepEqual(lite.errors, []);
  await lite.context.close();
  console.log('PASS X-Ray touch/lite pipeline: actual photograph treatment, cheap hero filter and exact restoration.', litePixels);

  const reduced = await open({ reduced: true });
  const reducedBefore = await reduced.media.screenshot();
  await reduced.page.keyboard.press('4');
  assert.equal(await reduced.page.locator('html').getAttribute('data-mode'), 'xray');
  assert.equal(await reduced.page.locator('html').getAttribute('data-xray-transition'), null, 'Reduced motion must not schedule the distortion transition.');
  assert.ok((await pixelDifference(reducedBefore, await reduced.media.screenshot())).fraction > .15);
  await reduced.page.keyboard.press('4');
  assert.equal(await reduced.media.evaluate((element) => getComputedStyle(element).filter), 'none');
  assert.equal((await pixelDifference(reducedBefore, await reduced.media.screenshot())).pixelsChanged, 0);
  assert.deepEqual(reduced.errors, []);
  await reduced.context.close();
  console.log('PASS X-Ray reduced motion: immediate treatment and clean restoration.');
} finally {
  await browser.close();
}
