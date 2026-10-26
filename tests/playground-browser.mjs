import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const out = new URL('../artifacts/v6-playground/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], scripts = [];
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  await page.addInitScript(() => {
    window.__playgroundWebGL = 0;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (/webgl/i.test(type)) window.__playgroundWebGL++;
      return getContext.call(this, type, ...args);
    };
  });
  await page.goto(new URL('/work?playground=1', base).href, { waitUntil: 'networkidle' });
  const panel = page.locator('.other-side-playground');
  await panel.waitFor();
  await page.waitForFunction(() => Boolean(window.__H4_PLAYGROUND__));
  const snapshot = () => page.evaluate(() => window.__H4_PLAYGROUND__.snapshot());
  const before = await snapshot();
  assert.equal(before.started, false);
  assert.equal(before.sourceRequests, 0);
  assert.equal(before.queued, 0);
  await panel.locator('[data-playground-start]').click();
  await page.waitForFunction(() => window.__H4_PLAYGROUND__.snapshot().experiment?.frames > 2);
  const canvas = panel.locator('canvas');
  const box = await canvas.boundingBox();
  for (let index = 0; index < 10; index++) {
    const x = box.x + box.width * (.2 + index % 4 * .19);
    const y = box.y + box.height * (.25 + index % 3 * .2);
    await page.mouse.move(x, y, { steps: 3 });
    await page.mouse.click(x, y);
    await page.waitForTimeout(140);
  }
  await panel.locator('[data-playground-navigation]').click();
  await page.waitForTimeout(350);
  const damaged = await snapshot();
  assert.equal(damaged.experiment.memory.byKind.click, 10);
  assert.equal(damaged.experiment.memory.byKind.navigation, 1);
  assert.ok(damaged.experiment.memory.scarredCells > 0);
  const first = await canvas.evaluate(node => [...node.getContext('2d').getImageData(0, 0, node.width, node.height).data]);
  const idleStarted = Date.now();
  await page.waitForTimeout(15000);
  const idleMs = Date.now() - idleStarted;
  const idle = await snapshot();
  const later = await canvas.evaluate(node => [...node.getContext('2d').getImageData(0, 0, node.width, node.height).data]);
  let changedPixels = 0;
  for (let index = 0; index < first.length; index += 4) {
    if ([0, 1, 2].some(channel => first[index + channel] !== later[index + channel])) changedPixels++;
  }
  assert.ok(changedPixels > 100, 'The actual accumulated output continues evolving at rest.');
  assert.equal(idle.experiment.memory.scarredCells, damaged.experiment.memory.scarredCells);
  assert.equal(idle.experiment.seed, damaged.experiment.seed);
  assert.equal(idle.sourceRequests, 1);
  assert.equal(idle.canvases, 2);
  assert.ok(idle.experiment.memory.cells <= 600);
  assert.ok(idle.drawMs.length <= 40);
  assert.equal(idle.queued, 1);
  await page.screenshot({ path: new URL('accumulated-local-field.png', out).pathname });
  await panel.locator('[data-playground-pause]').click();
  const pausedFrames = (await snapshot()).experiment.frames;
  await page.waitForTimeout(500);
  assert.equal((await snapshot()).experiment.frames, pausedFrames);
  assert.equal((await snapshot()).queued, 0);
  await panel.locator('[data-playground-pause]').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await snapshot();
  await page.waitForTimeout(500);
  assert.equal((await snapshot()).experiment.frames, reduced.experiment.frames);
  assert.equal((await snapshot()).queued, 0);
  assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal');
  assert.equal(await page.evaluate(() => window.__playgroundWebGL), 0);
  assert.ok(!scripts.some(url => /three|\/main\.js|GLTFLoader/.test(url)), 'The isolated 2D experiment must not download the hero or optional 3D viewer.');
  await panel.locator('[data-playground-close]').click();
  assert.equal(await panel.count(), 0);
  const closed = await snapshot();
  assert.equal(closed.started, false);
  assert.equal(closed.canvases, 0);
  assert.equal(closed.queued, 0);
  assert.deepEqual(errors, []);
  const result = { checkedAt: new Date().toISOString(), source: 'Actual DEV-only local experiment, using supplied Living Decay material and released memory kernel.',
    idleMs, changedPixels, damaged, idle, reduced, closed, webglContexts: 0, runtimeErrors: errors };
  await writeFile(new URL('results.json', out), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
