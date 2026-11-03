import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL('../artifacts/v312/V8/', import.meta.url);
await mkdir(output, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || chromium.executablePath();
const browser = await chromium.launch({ executablePath, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

try {
  for (const width of [1440, 390, 320]) for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      window.__posterShifts = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__posterShifts.push({ value: entry.value, sources: entry.sources.map(source => ({ id: source.node?.id || '', className: typeof source.node?.className === 'string' ? source.node.className : '', tag: source.node?.tagName || '' })) });
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    const first = await page.evaluate(() => {
      const poster = document.querySelector('[data-hero-poster]'), style = getComputedStyle(poster);
      return { text: poster.textContent.trim(), background: style.backgroundImage, opacity: Number(style.opacity),
        stylesReady: document.documentElement.dataset.h4StylesReady, heroHeight: document.querySelector('.hero').getBoundingClientRect().height,
        viewportHeight: innerHeight };
    });
    assert.equal(first.text, '', 'Poster contains no plain-text wordmark fallback.');
    if (reduced) assert.match(first.background, /wordmark-fallback\.svg/, 'Reduced motion retains the text poster.');
    else assert.equal(first.background, 'none', 'Normal boot shows no 2D wordmark.');
    assert.equal(first.stylesReady, 'true');
    assert.ok(Math.abs(first.heroHeight - first.viewportHeight) < 1.5, 'Critical hero layout reserves the viewport before main CSS.');
    if (reduced) {
      await page.waitForTimeout(250);
      const staticState = await page.evaluate(() => ({
        poster: Number(getComputedStyle(document.querySelector('[data-hero-poster]')).opacity),
        stage: document.querySelector('#stage').className,
        canvas: getComputedStyle(document.querySelector('#logo-canvas')).display,
      }));
      assert.equal(staticState.poster, 1, 'Reduced motion retains the poster.');
      assert.match(staticState.stage, /is-poster-static/);
      assert.equal(staticState.canvas, 'none');
      assert.ok(!requests.some(url => /\/src\/main\.js|\/main-|wordmark\.typeface/.test(url)), 'Reduced motion must not load the WebGL scene.');
    } else {
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-hero-poster]')).opacity) < .05);
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#logo-canvas')).opacity) === 1);
      const ready = await page.evaluate(() => ({
        poster: Number(getComputedStyle(document.querySelector('[data-hero-poster]')).opacity),
        canvas: Number(getComputedStyle(document.querySelector('#logo-canvas')).opacity),
        cls: window.__posterShifts.reduce((sum, entry) => sum + entry.value, 0), shifts: window.__posterShifts,
      }));
      assert.equal(ready.canvas, 1, 'Rendered canvas stays fully opaque through the entrance.');
      assert.ok(ready.poster < .05, 'Poster recedes after the first real frame.');
      assert.ok(ready.cls < .01, `Poster/layout handoff must not shift layout (CLS ${ready.cls}, ${JSON.stringify(ready.shifts)}).`);
    }
    await page.screenshot({ path: new URL(`home-${width}-${reduced ? 'reduced' : 'motion'}.png`, output).pathname });
    assert.deepEqual(errors, []);
    reports.push({ width, reduced, first, requests: requests.filter(url => /main|wordmark|fallback|three/.test(url)) });
    console.log(`PASS hero poster ${width}px reduced=${reduced}`);
    await context.close();
  }
} catch (error) {
  failures.push(error.stack || error.message);
  throw error;
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), reports, failures }, null, 2));
  await browser.close();
}
