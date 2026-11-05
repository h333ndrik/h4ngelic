import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const label = process.env.H4_MEASURE_LABEL || 'after';
const runs = Number(process.env.H4_MEASURE_RUNS || 3);
const widths = (process.env.H4_MEASURE_WIDTHS || '1440,390,320').split(',').map(Number);
const output = new URL(`../${process.env.H4_MEASURE_OUTPUT || 'artifacts/v312/V17/measure'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
const results = [];
for (const width of widths) {
  const samples = [];
  for (let run = 0; run < runs; run++) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__measure = { fcp: 0, lcp: 0, longTasks: [], heroReady: 0 };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint') window.__measure.fcp = entry.startTime;
      }).observe({ type: 'paint', buffered: true });
      new PerformanceObserver(list => {
        const entries = list.getEntries(); if (entries.length) window.__measure.lcp = entries.at(-1).startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => window.__measure.longTasks.push(...list.getEntries().map(entry => entry.duration)))
        .observe({ type: 'longtask', buffered: true });
    });
    const started = Date.now();
    await page.goto(new URL('/?test', base).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#stage.is-ready, #stage.is-poster-static'), null, { timeout: 60000 });
    const heroReady = await page.evaluate(() => performance.now());
    await page.waitForFunction(() => document.documentElement.dataset.h4EasterEggsReady === 'true', null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    const measure = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return { ...window.__measure, domContentLoaded: nav?.domContentLoadedEventEnd || 0, load: nav?.loadEventEnd || 0,
        heap: performance.memory?.usedJSHeapSize || 0 };
    });
    samples.push({ ...measure, heroReady, wall: Date.now() - started });
    await context.close();
  }
  results.push({ width, samples, summary: {
    fcp: median(samples.map(sample => sample.fcp)), lcp: median(samples.map(sample => sample.lcp)),
    domContentLoaded: median(samples.map(sample => sample.domContentLoaded)), load: median(samples.map(sample => sample.load)),
    heroReady: median(samples.map(sample => sample.heroReady)), wall: median(samples.map(sample => sample.wall)),
    longTaskCount: median(samples.map(sample => sample.longTasks.length)),
    longTaskTotal: median(samples.map(sample => sample.longTasks.reduce((sum, value) => sum + value, 0))),
    longTaskMaximum: median(samples.map(sample => Math.max(0, ...sample.longTasks))),
  }});
  console.log(`${label} ${width}px: FCP ${results.at(-1).summary.fcp.toFixed(1)}ms, LCP ${results.at(-1).summary.lcp.toFixed(1)}ms, hero ${results.at(-1).summary.heroReady.toFixed(1)}ms, long tasks ${results.at(-1).summary.longTaskCount} / ${results.at(-1).summary.longTaskTotal.toFixed(1)}ms`);
}
await writeFile(new URL(`${label}.json`, output), JSON.stringify({ checkedAt: new Date().toISOString(), base, runs, widths, results }, null, 2));
await browser.close();
