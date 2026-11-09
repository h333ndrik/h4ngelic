import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_ENTRANCE_ARTIFACTS || 'artifacts/v312/F29-c'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const heroModule = /\/src\/main\.js(?:\?|$)|\/assets\/main-[^/]+\.js(?:\?|$)/;
const capture = page => page.evaluate(() => {
  const stage = document.querySelector('#stage'), canvas = document.querySelector('#logo-canvas');
  const poster = document.querySelector('[data-hero-poster]');
  const style = getComputedStyle(canvas), posterStyle = getComputedStyle(poster);
  const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
  return { entering: stage.classList.contains('is-entering'), opacity: Number(style.opacity), transform: style.transform,
    translateY: matrix.m42, height: canvas.getBoundingClientRect().height,
    filter: style.filter, transitionProperty: style.transitionProperty, transitionDuration: style.transitionDuration,
    posterOpacity: Number(posterStyle.opacity), posterTransitionProperty: posterStyle.transitionProperty,
    posterTransitionDuration: posterStyle.transitionDuration,
    at: performance.now(), stage: stage.className };
});
const results = {};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 844 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.__r3Entrance = null;
    window.__r3Shifts = [];
    window.__r4Timeline = [];
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__r3Shifts.push(entry.value); })
      .observe({ type: 'layout-shift', buffered: true });
    document.addEventListener('h4:heroready', () => {
      const started = performance.now();
      window.__r3Entrance = { at: started };
      const sample = () => {
        const canvas = document.querySelector('#logo-canvas');
        const style = getComputedStyle(canvas), matrix = new DOMMatrixReadOnly(style.transform);
        const at = performance.now() - started;
        window.__r4Timeline.push({ at, opacity: Number(style.opacity), transform: style.transform,
          scale: matrix.m11, translateY: matrix.m42 });
        if (at < 1250) setTimeout(sample, 25);
      };
      sample();
    });
  });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  await page.goto(new URL('/?test=1', base).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__r3Entrance), null, { timeout: 60000 });
  const start = await capture(page);
  await page.waitForTimeout(250);
  const mid = await capture(page);
  await page.screenshot({ path: new URL('entrance-mid-1440.png', output).pathname });
  await page.waitForFunction(() => !document.querySelector('#stage').classList.contains('is-entering'));
  await page.waitForFunction(() => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#logo-canvas')).transform);
    return Math.abs(matrix.m11 - 1) < .001 && Math.abs(matrix.m22 - 1) < .001
      && Math.abs(matrix.m41) < .001 && Math.abs(matrix.m42) < .001;
  });
  const end = await capture(page);
  await page.waitForTimeout(150);
  const timeline = await page.evaluate(() => window.__r4Timeline);
  const shifts = await page.evaluate(() => window.__r3Shifts.reduce((sum, value) => sum + value, 0));
  const build = await page.evaluate(() => document.documentElement.dataset.build || '');
  await page.screenshot({ path: new URL('entrance-end-1440.png', output).pathname });
  assert.equal(start.entering, true);
  assert.equal(start.opacity, 1, 'The logo arrives at constant opacity.');
  assert.ok(start.translateY < -start.height * .5, `The logo starts above the hero: ${JSON.stringify(start)}`);
  assert.equal(start.transitionProperty, 'transform');
  assert.equal(start.transitionDuration, '1.1s');
  assert.equal(start.filter, 'none', 'The entrance never adds a blur filter.');
  assert.equal(start.posterTransitionProperty, 'opacity');
  assert.equal(start.posterTransitionDuration, '0.9s');
  const transformDuration = Number(start.transitionDuration.replace('s', '')) * 1000;
  assert.ok(Math.abs(transformDuration - 1100) <= 110, `Transform duration stays within 10% of 1100ms: ${transformDuration}`);
  assert.equal(mid.opacity, 1, 'Opacity is constant throughout the entrance.');
  assert.ok(mid.translateY > start.translateY && mid.translateY < 0, `Mid-entrance is visibly between endpoints: ${JSON.stringify({ start: start.translateY, mid: mid.translateY })}`);
  const transformDone = timeline.find(sample => Math.abs(sample.scale - 1) < 1e-4
    && Math.abs(sample.translateY) < 1e-3)?.at;
  assert.ok(Number.isFinite(transformDone));
  const fullyOpaque = timeline.find(sample => sample.opacity >= .99)?.at;
  assert.ok(Number.isFinite(fullyOpaque) && fullyOpaque < 80, 'The canvas is opaque from its first entrance frame.');
  assert.equal(end.entering, false);
  assert.equal(end.opacity, 1);
  const endMatrix = end.transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number) || [];
  assert.equal(endMatrix.length, 6, `The entrance ends with a readable matrix: ${end.transform}`);
  assert.ok(Math.abs(endMatrix[0] - 1) < 1e-6 && Math.abs(endMatrix[1]) < 1e-6 && Math.abs(endMatrix[2]) < 1e-6
    && Math.abs(endMatrix[3] - 1) < 1e-6 && Math.abs(endMatrix[4]) < 1e-6 && Math.abs(endMatrix[5]) < 1e-6,
  `The entrance reaches identity within compositor float tolerance: ${end.transform}`);
  assert.equal(end.posterOpacity, 0);
  const elapsed = end.at - start.at;
  assert.ok(transformDone >= 990 && transformDone <= 1210, `The sampled transform completes in 1100ms ±10%: ${transformDone.toFixed(1)}ms`);
  assert.ok(shifts < .01, `Entrance is layout-shift-free: ${shifts}`);
  results.build = build;
  results.normal = { start, mid, end, elapsed, shifts, transformDone, timeline };
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
  console.log(`PASS entrance: opacity ${start.opacity} constant; Y ${start.translateY.toFixed(0)} -> ${mid.translateY.toFixed(0)} -> ${end.translateY.toFixed(0)}; transform ${transformDuration}ms/${elapsed.toFixed(0)}ms; breathing ${results.breathing.minOpacity.toFixed(3)}–${results.breathing.maxOpacity.toFixed(3)}; CLS ${shifts}.`);
} catch (error) {
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, results, error: error.stack }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
