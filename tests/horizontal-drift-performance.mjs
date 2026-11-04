import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const output = new URL(process.env.H4_DRIFT_PERF_OUTPUT || '../docs/validation/v3.1.2/V9/performance.json', import.meta.url);
const profiles = [1440, 390, 320];
await mkdir(new URL('.', output), { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const reports = [];
try {
  for (const width of profiles) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'no-preference',
      hasTouch: width < 600, isMobile: width < 600 });
    await context.addInitScript(() => localStorage.setItem('h4ngelic.audio.v1', JSON.stringify({ muted: true, volume: .25 })));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL('/creative/onskin?performance=1', base).href, { waitUntil: 'networkidle' });
      const section = page.locator('[data-horizontal-drift="tattoos"]');
      await section.evaluate(element => {
        const port = element.querySelector('.drift-viewport').getBoundingClientRect();
        scrollTo({ top: port.top + scrollY - Math.max(100, (innerHeight - port.height) / 2), behavior: 'instant' });
      });
      await page.waitForFunction(() => document.querySelector('[data-horizontal-drift="tattoos"]')?.dataset.carouselPhase === 'drift');
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.querySelectorAll('[data-horizontal-drift="tattoos"] img')]
          .map(image => image.decode().catch(() => undefined)));
      });
      await page.waitForTimeout(500);
      const measured = await page.evaluate(() => new Promise(resolve => {
        const tasks = [], gaps = [];
        let observer;
        try {
          observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => entry.duration)));
          observer.observe({ type: 'longtask', buffered: false });
        } catch {}
        const start = performance.now();
        let previous = start;
        function frame(now) {
          gaps.push(now - previous); previous = now;
          if (now - start < 2000) requestAnimationFrame(frame);
          else {
            observer?.disconnect();
            const sorted = [...gaps].sort((a, b) => a - b);
            const percentile = fraction => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] || 0;
            const element = document.querySelector('[data-horizontal-drift="tattoos"]');
            resolve({ elapsedMs: now - start, frames: gaps.length, frameGapP50Ms: percentile(.5),
              frameGapP95Ms: percentile(.95), frameGapMaxMs: Math.max(0, ...gaps),
              longTasks: tasks.length, maximumLongTaskMs: Math.max(0, ...tasks),
              phase: element.dataset.carouselPhase, position: Number(element.dataset.driftPosition) });
          }
        }
        requestAnimationFrame(frame);
      }));
      assert.equal(measured.phase, 'drift');
      assert.ok(measured.frames >= 10, `Drift produced too few observed frames at ${width}px.`);
      assert.deepEqual(errors, []);
      reports.push({ width, ...measured, errors });
      console.log(`PASS drift performance ${width}px: ${measured.frames} frames, p50=${measured.frameGapP50Ms.toFixed(2)}ms, p95=${measured.frameGapP95Ms.toFixed(2)}ms, max=${measured.frameGapMaxMs.toFixed(2)}ms, longTasks=${measured.longTasks}.`);
    } finally { await context.close(); }
  }
  await writeFile(output, JSON.stringify({
    base, generatedAt: new Date().toISOString(),
    method: 'After network idle, font readiness, all carousel image decodes and a 500ms warm-up, observe RAF intervals for two seconds while the carousel stays in drift.',
    caveat: 'Headless Chromium with SwiftShader. RAF observation adds a bounded callback; this is not physical-device FPS, GPU compositor timing or an INP measurement.',
    reports,
  }, null, 2));
} finally { await browser.close(); }
