import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const destination = new URL('../artifacts/persistent-memory/', import.meta.url);
const widths = (process.env.H4_PERSISTENT_WIDTHS || '1000,390,320').split(',').map(Number);
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
const state = page => page.evaluate(() => window.__H4_CORRUPTION__?.snapshot());
const deadline = setTimeout(() => void browser.close(), 180000);
async function settleMode(page, mode) {
  await page.waitForFunction(expected => document.documentElement.dataset.mode === expected
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot'), mode, { timeout: 18000 });
}
async function enter(page) {
  await page.keyboard.down('4');
  try { await settleMode(page, 'xray'); } finally { await page.keyboard.up('4'); }
  await page.waitForFunction(() => window.__H4_CORRUPTION__?.snapshot().ambient.frames > 1);
}
async function pixelDelta(page, save = false) {
  return page.locator('[data-corruption-ambient]').evaluate((canvas, capture) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const previous = window.__persistentPixels;
    let changed = 0, absolute = 0;
    if (previous?.length === data.length) for (let index = 0; index < data.length; index += 4) {
      const delta = Math.abs(data[index] - previous[index]) + Math.abs(data[index + 1] - previous[index + 1]) + Math.abs(data[index + 2] - previous[index + 2]);
      changed += delta > 8 ? 1 : 0; absolute += delta;
    }
    if (capture) window.__persistentPixels = data;
    return { changed, pixels: data.length / 4, meanChannelDelta: absolute / (data.length / 4 * 3) };
  }, save);
}

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 760 },
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await page.addInitScript(() => {
      window.__persistentProbe = { webgl: 0 };
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        const result = getContext.call(this, type, ...args);
        if (result && /webgl/i.test(type)) window.__persistentProbe.webgl++;
        return result;
      };
    });
    try {
      await page.goto(`${base}/work/tattoos?test=1`, { waitUntil: 'networkidle' });
      await enter(page);
      const initial = await state(page);
      assert.equal(initial.ambient.memory.persistent, true);
      assert.ok(initial.ambient.memory.scarredCells > initial.ambient.memory.cells * .5,
        'The entry rupture writes real retained sampling damage across the world.');
      await page.mouse.move(width * .3, 190);
      for (let step = 0; step < 6; step++) {
        await page.mouse.move(width * .3 + step * 8, 190 + step * 3);
        await page.waitForTimeout(40);
      }
      await page.waitForTimeout(1200);
      const afterInput = await state(page);
      await pixelDelta(page, true);
      const idleStarted = Date.now();
      await page.waitForTimeout(15000);
      const idleMs = Date.now() - idleStarted;
      const idle = await state(page);
      const pixels = await pixelDelta(page);
      assert.equal(idle.ambient.seed, initial.ambient.seed);
      assert.equal(idle.ambient.memory.scarredCells, afterInput.ambient.memory.scarredCells);
      assert.equal(idle.ambient.memory.maximumScar, afterInput.ambient.memory.maximumScar);
      assert.deepEqual(idle.ambient.settings, initial.ambient.settings,
        'Persistence must not alter any existing palette, brightness, bleach or color controls.');
      assert.ok(idle.ambient.advectedBlocks > afterInput.ambient.advectedBlocks);
      assert.ok(pixels.changed > 10, 'Real idle history pixels continue evolving, without additional pointer input.');
      await page.screenshot({ path: new URL(`idle-${width}.png`, destination).pathname });
      await page.locator('[data-global-index] > summary').click();
      await page.locator('[data-index-page="about"]').click();
      await page.waitForFunction(() => document.documentElement.dataset.page === 'about'
        && !document.documentElement.hasAttribute('data-mode-snapshot'));
      const navigated = await state(page);
      assert.equal(navigated.ambient.seed, initial.ambient.seed);
      assert.equal(navigated.ambient.regenerations, initial.ambient.regenerations);
      assert.ok(navigated.ambient.memory.scarredCells > 0);
      await page.setViewportSize({ width: width + 6, height: width < 600 ? 844 : 760 });
      await page.waitForTimeout(200);
      const resized = await state(page);
      assert.equal(resized.ambient.seed, initial.ambient.seed);
      assert.equal(resized.ambient.regenerations, initial.ambient.regenerations);
      assert.ok(resized.ambient.memory.scarredCells > 0);
      for (let index = 0; index < 3; index++) await page.keyboard.press('3');
      await settleMode(page, 'normal');
      const normal = await state(page);
      await page.waitForTimeout(450);
      assert.equal((await state(page)).ambient.frames, normal.ambient.frames);
      assert.equal(normal.ambient.queued, false);
      await enter(page);
      const reentered = await state(page);
      assert.notEqual(reentered.ambient.seed, initial.ambient.seed);
      assert.equal(await page.evaluate(() => window.__persistentProbe.webgl), 0);
      assert.ok(!requests.some(path => /\/src\/main\.js|\/three(?:\/|\.)|wordmark\.typeface/.test(path)));
      assert.deepEqual(errors, []);
      reports.push({ width, passed: true, idleMs,
        seed: initial.ambient.seed, newSeed: reentered.ambient.seed,
        initial: initial.ambient.memory, afterInput: afterInput.ambient.memory,
        idle: idle.ambient.memory, pixels, navigated: navigated.ambient.memory,
        resized: resized.ambient.memory, errors, webgl: 0 });
    } finally { await context.close(); }
  }
} finally {
  clearTimeout(deadline);
  await browser.close();
  await writeFile(new URL('results.json', destination), JSON.stringify({ checkedAt: new Date().toISOString(), passed: reports.length === widths.length,
    note: 'Actual trusted mode/navigation/pointer input and 15s real idle on Chromium/SwiftShader; scar diagnostics are numeric sampling addresses, and pixel deltas are read from the displayed Canvas2D.', reports }, null, 2));
}
console.log(JSON.stringify({ passed: true, reports }, null, 2));
