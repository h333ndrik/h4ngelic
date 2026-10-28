import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55173';
const label = process.argv[2] || 'after';
assert.match(label, /^[a-z0-9-]+$/i);
const idleDuration = Number(process.env.H4_MEMORY_IDLE_MS || 15000);
assert.ok(Number.isFinite(idleDuration) && idleDuration >= 15000 && idleDuration <= 180000);
const widths = (process.env.H4_MEMORY_WIDTHS || '1000,390').split(',').map(Number);
assert.ok(widths.length && widths.every(width => [1000, 390, 320].includes(width)));
const out = new URL('../artifacts/v71/', import.meta.url); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const cases = [];
try {
 for (const width of widths) {
  console.log(`START ${label} ${width}`);
  const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1,
   isMobile: width < 600, hasTouch: width < 600 });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
   window.__p0Perf = { delays: [], tasks: [], contexts: 0 };
   const get = HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext = function(type, ...args) { if (/webgl/i.test(type)) window.__p0Perf.contexts++; return get.call(this, type, ...args); };
   for (const type of ['pointermove', 'pointerdown', 'click', 'wheel']) document.addEventListener(type, e => {
    window.__p0Perf.delays.push({ type, delay: Math.max(0, performance.now() - e.timeStamp) });
    if (window.__p0Perf.delays.length > 500) window.__p0Perf.delays.shift();
   }, { passive: true });
   try { new PerformanceObserver(list => { for (const item of list.getEntries()) window.__p0Perf.tasks.push({ at: item.startTime, duration: item.duration }); }).observe({ type: 'longtask', buffered: true }); } catch {}
  });
  const start = Date.now(); await page.goto(`${base}/work?test=1`, { waitUntil: 'networkidle' });
  const normalLoadMs = Date.now() - start;
  for (const delta of [180, 180, -180, -180]) { await page.mouse.wheel(0, delta); await page.waitForTimeout(90); }
  const entryStart = Date.now(); await page.keyboard.down('4');
  await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray' && !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'), null, { timeout: 60000 });
  await page.keyboard.up('4');
  await page.waitForFunction(() => Boolean(window.__H4_CORRUPTION__?.snapshot().ambient.frames));
  const entryMs = Date.now() - entryStart;
  const snap = () => page.evaluate(() => window.__H4_CORRUPTION__.snapshot());
  const first = await snap();
  const phaseStart = Date.now();
  for (let i=0;i<16;i++) await page.mouse.move(12 + i % 4 * width / 5, 250 + i % 3 * 65, { steps: 2 });
  for (let i=0;i<10;i++) { await page.mouse.click(12, 240 + i % 4 * 85); await page.waitForTimeout(55); }
  for (const delta of [140, 160, -170, -130, 150, -150]) { await page.mouse.wheel(0, delta); await page.waitForTimeout(80); }
  const interactionsMs = Date.now() - phaseStart;
  const interacting = await snap();
  const idleStart = Date.now(); const sessionSamples = [];
  for (let elapsed = 0; elapsed < idleDuration; elapsed += 15000) {
   await page.waitForTimeout(Math.min(15000, idleDuration - elapsed));
   sessionSamples.push(await page.evaluate(() => ({ at: performance.now(),
    heapBytes: performance.memory?.usedJSHeapSize ?? null,
    ambient: window.__H4_CORRUPTION__.snapshot().ambient,
    canvases: document.querySelectorAll('[data-corruption-ambient]').length,
    regions: document.querySelectorAll('.corruption-region').length })));
  }
  const idle = await snap(); const idleMs = Date.now() - idleStart;
  const perf = await page.evaluate(() => ({ ...window.__p0Perf,
   heapBytes: performance.memory?.usedJSHeapSize ?? null,
   canvases: document.querySelectorAll('canvas').length,
   inkMarks: document.querySelectorAll('[data-ink-mark]').length,
   source: document.querySelector('.corruption-background')?.style.backgroundImage }));
  const percentile = (items, p) => { const a=items.slice().sort((a,b)=>a-b); return a[Math.min(a.length-1, Math.floor(a.length*p))] ?? 0; };
  cases.push({ width, normalLoadMs, entryMs, interactionsMs, idleMs, first, interacting, idle, sessionSamples, perf,
   summary: { paintP50Ms: percentile(idle.ambient.drawMs,.5), paintP95Ms: percentile(idle.ambient.drawMs,.95), inputDelayP95Ms: percentile(perf.delays.map(x=>x.delay),.95), longTasks: perf.tasks.length, maximumLongTaskMs: Math.max(0,...perf.tasks.map(x=>x.duration)), idleFrames: idle.ambient.frames-interacting.ambient.frames }, errors });
  assert.deepEqual(errors, []); assert.equal(perf.contexts, 0);
  if (label.includes('extended')) {
   assert.ok(sessionSamples.every(sample => sample.canvases === 1 && sample.regions === 0
    && sample.ambient.buffers === 2 && sample.ambient.sourceInitializations === 1
    && sample.ambient.seed === first.ambient.seed && sample.ambient.pending.impulses <= 8
    && sample.ambient.drawMs.length <= 180));
   await page.screenshot({ path: new URL(`${label}-${width}.png`, out).pathname, timeout: 60000 });
  }
  console.log(`DONE ${label} ${width}: ${JSON.stringify(cases.at(-1).summary)}`);
  await context.close();
 }
 await writeFile(new URL(`${label}-measurements.json`, out), JSON.stringify({ measuredAt: new Date().toISOString(), conditions: 'Headless Chromium, ANGLE SwiftShader, DPR1, same driver inputs; integration/lab measurements, not physical-device FPS or field INP.', browser: browser.version(), label, cases }, null, 2));
} finally { await browser.close(); }
