import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_ENTRANCE_ARTIFACTS || 'artifacts/v312/r3-entrance'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const heroModule = /\/src\/main\.js(?:\?|$)|\/assets\/main-[^/]+\.js(?:\?|$)/;
const capture = page => page.evaluate(() => {
  const stage = document.querySelector('#stage'), canvas = document.querySelector('#logo-canvas');
  const style = getComputedStyle(canvas);
  return { entering: stage.classList.contains('is-entering'), opacity: Number(style.opacity), transform: style.transform,
    animation: style.animationName, duration: style.animationDuration, stage: stage.className };
});
const results = {};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 844 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.__r3Entrance = null;
    window.__r3Shifts = [];
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__r3Shifts.push(entry.value); })
      .observe({ type: 'layout-shift', buffered: true });
    document.addEventListener('h4:heroready', () => { window.__r3Entrance = { at: performance.now() }; });
  });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  await page.goto(new URL('/?test=1', base).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__r3Entrance), null, { timeout: 60000 });
  const start = await capture(page);
  await page.waitForTimeout(250);
  const mid = await capture(page);
  await page.screenshot({ path: new URL('entrance-mid-1440.png', output).pathname });
  await page.waitForFunction(() => !document.querySelector('#stage').classList.contains('is-entering'));
  const end = await capture(page);
  const shifts = await page.evaluate(() => window.__r3Shifts.reduce((sum, value) => sum + value, 0));
  await page.screenshot({ path: new URL('entrance-end-1440.png', output).pathname });
  assert.equal(start.entering, true);
  assert.equal(start.animation, 'hero-wordmark-arrive');
  assert.equal(start.duration, '0.7s');
  assert.ok(mid.opacity > 0 && mid.opacity < 1, `Mid-entrance opacity is visibly between endpoints: ${mid.opacity}`);
  assert.notEqual(mid.transform, 'matrix(1, 0, 0, 1, 0, 0)');
  assert.equal(end.entering, false);
  assert.equal(end.opacity, 1);
  assert.equal(end.transform, 'matrix(1, 0, 0, 1, 0, 0)');
  assert.ok(shifts < .01, `Entrance is layout-shift-free: ${shifts}`);
  results.normal = { start, mid, end, shifts };
  await context.close();

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const reduced = await reducedContext.newPage(); reduced.setDefaultTimeout(60000);
  await reduced.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await reduced.locator('#stage.is-poster-static').waitFor();
  results.reduced = await reduced.evaluate(() => ({ poster: Number(getComputedStyle(document.querySelector('[data-hero-poster]')).opacity),
    animation: getComputedStyle(document.querySelector('[data-hero-poster]')).animationName,
    canvas: getComputedStyle(document.querySelector('#logo-canvas')).display,
    entering: document.querySelector('#stage').classList.contains('is-entering') }));
  assert.equal(results.reduced.poster, 1);
  assert.equal(results.reduced.animation, 'none');
  assert.equal(results.reduced.canvas, 'none');
  assert.equal(results.reduced.entering, false);
  await reduced.screenshot({ path: new URL('reduced-390.png', output).pathname });
  await reducedContext.close();

  const failedContext = await browser.newContext({ viewport: { width: 1440, height: 844 }, deviceScaleFactor: 1 });
  const failed = await failedContext.newPage(); failed.setDefaultTimeout(30000);
  await failed.route(heroModule, route => route.abort('failed'));
  await failed.goto(new URL('/', base).href, { waitUntil: 'domcontentloaded' });
  await failed.locator('#stage.is-boot-failed').waitFor();
  await failed.waitForTimeout(750);
  results.failed = await failed.evaluate(() => ({ poster: Number(getComputedStyle(document.querySelector('[data-hero-poster]')).opacity),
    entering: document.querySelector('#stage').classList.contains('is-entering'),
    canvas: getComputedStyle(document.querySelector('#logo-canvas')).display }));
  assert.equal(results.failed.poster, 1);
  assert.equal(results.failed.entering, false);
  assert.equal(results.failed.canvas, 'none');
  await failed.screenshot({ path: new URL('failed-skip-1440.png', output).pathname });
  await failedContext.close();

  const breathingContext = await browser.newContext({ viewport: { width: 1440, height: 844 }, deviceScaleFactor: 1 });
  const breathing = await breathingContext.newPage(); breathing.setDefaultTimeout(60000);
  let heldRoute;
  await breathing.route(heroModule, route => { heldRoute = route; });
  await breathing.goto(new URL('/', base).href, { waitUntil: 'domcontentloaded' });
  await breathing.waitForFunction(() => getComputedStyle(document.querySelector('[data-hero-poster]')).animationName === 'hero-poster-breathe');
  const samples = await breathing.evaluate(async () => {
    const values = [];
    for (let index = 0; index < 60; index++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const style = getComputedStyle(document.querySelector('[data-hero-poster]'));
      const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
      values.push({ opacity: Number(style.opacity), scale: Math.hypot(matrix.m11, matrix.m12) });
    }
    return values;
  });
  const opacities = samples.map(sample => sample.opacity), scales = samples.map(sample => sample.scale);
  results.breathing = { minOpacity: Math.min(...opacities), maxOpacity: Math.max(...opacities),
    minScale: Math.min(...scales), maxScale: Math.max(...scales), samples };
  assert.ok(results.breathing.minOpacity <= .6 && results.breathing.maxOpacity >= .98,
    `Breathing is visibly wide: ${results.breathing.minOpacity} -> ${results.breathing.maxOpacity}`);
  assert.ok(results.breathing.minScale <= .99 && results.breathing.maxScale >= 1.01,
    `Breathing scale spans at least ±1%: ${results.breathing.minScale} -> ${results.breathing.maxScale}`);
  assert.ok(heldRoute, 'The breathing fixture held the real hero module.');
  await heldRoute.abort('failed');
  await breathingContext.close();
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, results, passed: true }, null, 2) + '\n');
  console.log(`PASS entrance: ${start.opacity} -> ${mid.opacity.toFixed(3)} -> ${end.opacity}; breathing ${results.breathing.minOpacity.toFixed(3)}–${results.breathing.maxOpacity.toFixed(3)}; CLS ${shifts}.`);
} catch (error) {
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, results, error: error.stack }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
