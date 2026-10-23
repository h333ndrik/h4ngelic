import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// A small runtime observation, separate from Lighthouse loading measurements.
// SwiftShader is not representative of a physical phone's GPU or input latency.
const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const results = [];
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      deviceScaleFactor: 1, isMobile: touch, hasTouch: touch,
    });
    try {
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        window.__h4ClearCalls = 0;
        for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
          if (!type) continue;
          const clear = type.prototype.clear;
          type.prototype.clear = function (...args) {
            if (this.canvas.id === 'logo-canvas') window.__h4ClearCalls++;
            return clear.apply(this, args);
          };
        }
      });
      const page = await context.newPage();
      await page.goto(new URL('/?test=1', baseURL).href, { waitUntil: 'networkidle' });
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
      const samples = [];
      for (const mode of ['normal', 'xray', 'normal']) {
        const transitionMs = await page.evaluate(async (target) => {
          if (document.documentElement.dataset.mode === target) return 0;
          const started = performance.now();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', code: 'Digit4', bubbles: true }));
          await new Promise((resolve) => {
            if (!document.documentElement.hasAttribute('data-xray-transition')) return resolve();
            const observer = new MutationObserver(() => {
              if (!document.documentElement.hasAttribute('data-xray-transition')) { observer.disconnect(); resolve(); }
            });
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-xray-transition'] });
          });
          return performance.now() - started;
        }, mode);
        const before = await metrics();
        const observed = await page.evaluate(() => new Promise((resolve) => {
          const started = performance.now();
          const firstClear = window.__h4ClearCalls;
          const intervals = [];
          const longTasks = [];
          let previous;
          const observer = new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)));
          observer.observe({ type: 'longtask', buffered: false });
          function sample(now) {
            if (previous !== undefined) intervals.push(now - previous);
            previous = now;
            if (now - started < 3000) return requestAnimationFrame(sample);
            observer.disconnect();
            intervals.sort((a, b) => a - b);
            resolve({
              elapsedMs: performance.now() - started,
              webglClearCalls: window.__h4ClearCalls - firstClear,
              frameIntervalMedianMs: intervals[Math.floor(intervals.length / 2)],
              frameIntervalP95Ms: intervals[Math.floor(intervals.length * .95)],
              longTaskCount: longTasks.length,
              longTaskTotalMs: longTasks.reduce((sum, duration) => sum + duration, 0),
              observedPixelRatio: document.getElementById('logo-canvas').width / document.getElementById('logo-canvas').clientWidth,
            });
          }
          requestAnimationFrame(sample);
        }));
        const after = await metrics();
        samples.push({ mode, transitionMs, ...observed,
          taskDurationMs: (after.TaskDuration - before.TaskDuration) * 1000,
          scriptDurationMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
          layoutDurationMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
        });
      }
      results.push({ profile: touch ? '390px-touch-lite' : '1440px-desktop-full',
        xrayQuality: await page.locator('html').getAttribute('data-xray-quality'), samples });
      console.log(JSON.stringify(results.at(-1)));
    } finally { await context.close(); }
  }
  const output = new URL('../artifacts/performance/xray-runtime.json', import.meta.url);
  await mkdir(new URL('.', output), { recursive: true });
  await writeFile(output, JSON.stringify({ baseURL, measuredAt: new Date().toISOString(),
    browser: browser.version(), renderer: 'SwiftShader', deviceScaleFactor: 1,
    observationMs: 3000, sequence: 'normal → xray → normal; three seconds after each settled mode',
    caveats: 'Single software-GPU observation per profile; resource hints overridden for coverage. No physical-device FPS, INP or statistical performance claim.', results }, null, 2));
} finally { await browser.close(); }
