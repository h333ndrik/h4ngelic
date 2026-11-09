import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(`../${process.env.H4_PERF_ARTIFACTS || 'artifacts/v312/r2-performance'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [], failures = [];
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const forbidden = /\/main-[^/]+\.js|wordmark\.typeface|tattoo-texture|\/three(?:\.module)?[^/]*\.js/;
async function directoryBytes(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    total += entry.isDirectory() ? await directoryBytes(child) : (await stat(child)).size;
  }
  return total;
}

try {
  for (const width of [1440, 390, 320]) {
    console.log(`CHECK V3.1.2-r2 performance ${width}px`);
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'no-preference' });
    await context.addInitScript(() => localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .2 })));
    try {
      for (const route of ['/creative/tattoos', '/contact']) {
        const samples = [], requests = [], errors = [];
        let page;
        for (let warmup = 0; warmup < 2; warmup++) {
          const warm = await context.newPage();
          await warm.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
          await warm.close();
        }
        for (let run = 0; run < 5; run++) {
          page = await context.newPage(); page.setDefaultTimeout(60000);
          page.on('request', request => requests.push(request.url()));
          page.on('pageerror', error => errors.push(error.message));
          page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
          await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => performance.getEntriesByType('paint').some(entry => entry.name === 'first-contentful-paint'));
          samples.push(await page.evaluate(() => performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint').startTime));
          if (run < 4) await page.close();
        }
        const result = { width, route, samples, median: median(samples),
          finalPath: new URL(page.url()).pathname, forbidden: [...new Set(requests.filter(url => forbidden.test(url)))], errors };
        assert.ok(result.median < 200, `${route} FCP median stays inside the 200ms headless guard: ${result.median}ms`);
        assert.deepEqual(result.forbidden, [], `${route} stays free of the Home hero module, font and texture.`);
        assert.deepEqual(result.errors, [], `${route} has no runtime errors.`);
        reports.push(result);
        await page.close();
      }
    } finally { await context.close(); }
  }

  const entranceContext = await browser.newContext({ viewport: { width: 1440, height: 844 }, deviceScaleFactor: 1 });
  await entranceContext.addInitScript(() => {
    window.__r3Entrance = null;
    window.__r3Shifts = [];
    window.__r3Lcp = 0;
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__r3Shifts.push(entry.value); })
      .observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__r3Lcp = Math.max(window.__r3Lcp, entry.startTime); })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    document.addEventListener('h4:heroready', () => {
      const stage = document.querySelector('#stage'), canvas = document.querySelector('#logo-canvas');
      const style = getComputedStyle(canvas);
      const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
      window.__r3Entrance = { entering: stage.classList.contains('is-entering'), transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration, opacity: Number(style.opacity), transform: style.transform,
        translateY: matrix.m42, height: canvas.getBoundingClientRect().height };
    });
  });
  const entranceWarm = await entranceContext.newPage();
  await entranceWarm.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
  await entranceWarm.close();
  const entrancePage = await entranceContext.newPage(); entrancePage.setDefaultTimeout(60000);
  await entrancePage.goto(new URL('/?test=1', base).href, { waitUntil: 'domcontentloaded' });
  await entrancePage.waitForFunction(() => Boolean(window.__r3Entrance), null, { timeout: 60000 });
  const entranceStart = await entrancePage.evaluate(() => window.__r3Entrance);
  await entrancePage.waitForFunction(() => !document.querySelector('#stage').classList.contains('is-entering'));
  await entrancePage.waitForFunction(() => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#logo-canvas')).transform);
    return Math.abs(matrix.m11 - 1) < .001 && Math.abs(matrix.m22 - 1) < .001
      && Math.abs(matrix.m41) < .001 && Math.abs(matrix.m42) < .001;
  });
  const entranceEnd = await entrancePage.evaluate(() => ({
    entering: document.querySelector('#stage').classList.contains('is-entering'),
    opacity: Number(getComputedStyle(document.querySelector('#logo-canvas')).opacity),
    transform: getComputedStyle(document.querySelector('#logo-canvas')).transform,
    posterOpacity: Number(getComputedStyle(document.querySelector('[data-hero-poster]')).opacity),
    fcp: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime || Infinity,
    lcp: window.__r3Lcp,
    cls: window.__r3Shifts.reduce((sum, value) => sum + value, 0),
    build: document.documentElement.dataset.build || '',
  }));
  assert.equal(entranceStart.entering, true);
  assert.equal(entranceStart.opacity, 1);
  assert.ok(entranceStart.translateY < -entranceStart.height * .5, `The logo starts above the hero: ${JSON.stringify(entranceStart)}`);
  assert.equal(entranceStart.transitionProperty, 'transform');
  assert.equal(entranceStart.transitionDuration, '1.1s');
  const transformMs = Number(entranceStart.transitionDuration.replace('s', '')) * 1000;
  assert.ok(Math.abs(transformMs - 1100) <= 110, `Entrance transform duration is 1100ms ±10%: ${transformMs}ms`);
  assert.equal(entranceEnd.entering, false);
  assert.equal(entranceEnd.opacity, 1);
  const endMatrix = entranceEnd.transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number) || [];
  assert.equal(endMatrix.length, 6);
  assert.ok(endMatrix.every((value, index) => Math.abs(value - [1, 0, 0, 1, 0, 0][index]) < 1e-6), `Entrance reaches identity: ${entranceEnd.transform}`);
  assert.equal(entranceEnd.posterOpacity, 0);
  assert.ok(entranceEnd.fcp <= 200, `Home FCP stays inside the 200ms guard: ${entranceEnd.fcp}ms`);
  assert.ok(entranceEnd.lcp <= 200, `Home LCP stays inside the 200ms guard: ${entranceEnd.lcp}ms`);
  assert.ok(entranceEnd.cls < .01, `The compositor-only entrance has no layout shift: ${entranceEnd.cls}`);
  assert.match(entranceEnd.build, /^[a-f0-9]{7,40}$/i);
  await entranceContext.close();

  const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const href = index.match(/<link rel="modulepreload" href="([^"]+main-[^"]+\.js)"/)?.[1];
  assert.ok(href, 'The Home document preloads a hashed main chunk.');
  const mainChunks = (await readdir(new URL('../dist/assets/', import.meta.url))).filter(name => /^main-.*\.js$/.test(name));
  assert.deepEqual(mainChunks, [href.split('/').at(-1)], 'The modulepreload points at the single emitted main chunk.');
  const manifest = JSON.parse(await readFile(new URL('../dist/route-manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.routes.length, 23, 'The build contains 23 canonical routes plus 404.');
  const distBytes = await directoryBytes(new URL('../dist/', import.meta.url));
  console.log(`PASS performance: ${reports.map(result => `${result.route}@${result.width} ${result.median.toFixed(2)}ms`).join(', ')}; preload ${href}; ${mainChunks.length} main chunk; routes ${manifest.routes.length}.`);
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, reports,
    entrance: { start: entranceStart, end: entranceEnd }, distBytes, modulepreload: href, mainChunks,
    routes: manifest.routes.length, failures }, null, 2) + '\n');
} catch (error) {
  failures.push({ error: error.stack });
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, reports, failures }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
