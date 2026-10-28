import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { featureFlags } from '../src/data/featureFlags.js';

if (!featureFlags.otherSideEnabled) throw new Error('The Other Side is disabled. Use npm run measure:performance for Normal Mode loading.');

// Runtime observations are deliberately separate from Lighthouse loading runs.
// Neither browser RAF callback cadence nor SwiftShader represents real-phone FPS.
const baseURL = process.env.H4_BASE_URL || 'http://127.0.0.1:4173';
const label = process.env.H4_RUNTIME_LABEL || 'ref09';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('H4_RUNTIME_LABEL must contain only letters, digits or hyphens.');
const observationMs = 3000;
const chromeFlags = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: chromeFlags });
const results = [];

/** Optional hooks exist only on development pages with ?test=1. Built pages
 * retain DOM counters; missing instrumentation is reported as null.
 */
async function effectSnapshot(page) {
  return page.evaluate(() => {
    const effect = window.__H4_CORRUPTION__?.snapshot?.();
    const ambient = effect?.ambient;
    const transition = effect?.transition;
    const finite = value => Number.isFinite(value) ? value : null;
    const boolean = value => typeof value === 'boolean' ? value : null;
    const ambientCanvas = document.querySelector('[data-corruption-ambient]');
    const transitionCanvas = document.querySelector('[data-corruption-transition]');
    const counter = (node, name) => node && node.dataset[name] !== undefined ? finite(Number(node.dataset[name])) : null;
    return {
      mode: document.documentElement.dataset.mode,
      devHookAvailable: Boolean(effect),
      roiRegions: document.querySelectorAll('[data-corruption-region]').length,
      roiQueued: document.documentElement.hasAttribute('data-corruption-running'),
      roiFrames: finite(effect?.frames),
      ambientFrames: finite(ambient?.frames) ?? finite(effect?.ambientFrames) ?? counter(ambientCanvas, 'ambientFrame'),
      ambientQueued: boolean(ambient?.queued) ?? boolean(effect?.ambientQueued),
      transitionFrames: finite(transition?.frames) ?? finite(effect?.transitionFrames) ?? counter(transitionCanvas, 'transitionFrame'),
      transitionQueued: boolean(transition?.queued) ?? boolean(transition?.active) ?? boolean(effect?.transitionQueued),
      materialUniformAmount: finite(window.__H4_TEST__?.snapshot?.().xrayAmount),
    };
  });
}

async function changeMode(page, target) {
  if (await page.locator('html').getAttribute('data-mode') === target) return {
    method: 'initial-normal-state', inputToModeChangeMs: 0, controllerTransitionMs: 0,
    declaredTransitionMs: null, settledFromModeChangeMs: 0, variant: null,
  };
  const index = await page.evaluate(() => window.__h4RuntimeProbe.transitions.length);
  const method = target === 'xray' ? 'trusted-keyboard-continuous-4-hold' : 'trusted-keyboard-three-released-3-presses';
  if (target === 'xray') {
    await page.keyboard.down('4');
    try {
      // Keep the physical key held until the authoritative mode actually changes.
      await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray', null, { timeout: 15000 });
    } finally { await page.keyboard.up('4'); }
  } else {
    // keyboard.press issues a distinct down/up pair; native repeat never counts.
    for (let press = 0; press < 3; press++) await page.keyboard.press('3');
  }
  await page.waitForFunction(({ target, index }) => {
    const root = document.documentElement;
    const record = window.__h4RuntimeProbe.transitions[index];
    if (root.dataset.mode !== target || root.hasAttribute('data-xray-transition') || !record?.controllerSettledAt) return false;
    const hero = window.__H4_TEST__?.snapshot?.();
    if (hero && Math.abs(hero.xrayAmount - (target === 'xray' ? 1 : 0)) > .001) return false;
    const effect = window.__H4_CORRUPTION__?.snapshot?.();
    const burst = effect?.transition;
    return !(burst?.queued || burst?.active || effect?.transitionQueued);
  }, { target, index }, { timeout: 15000 });
  const transition = await page.evaluate(index => {
    const record = window.__h4RuntimeProbe.transitions[index];
    return {
      inputToModeChangeMs: Number.isFinite(record.inputStartedAt) ? record.changedAt - record.inputStartedAt : null,
      controllerTransitionMs: record.controllerSettledAt - record.changedAt,
      declaredTransitionMs: record.declaredDuration,
      settledFromModeChangeMs: performance.now() - record.changedAt,
      variant: record.variant,
    };
  }, index);
  assert.ok(Number.isFinite(transition.inputToModeChangeMs) && transition.inputToModeChangeMs >= (target === 'xray' ? 999 : 0), 'The measured mode must follow the real shortcut, not a synthetic immediate state change.');
  return { method, ...transition };
}

try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      deviceScaleFactor: 1, isMobile: touch, hasTouch: touch,
    });
    try {
      await context.addInitScript(() => {
        // Controlled full/lite coverage, not detected real hardware capability.
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        window.__h4ClearCalls = 0;
        window.__h4RuntimeProbe = { transitions: [], enterStartedAt: null, reverseStartedAt: null };
        document.addEventListener('keydown', event => {
          if (!event.isTrusted || event.repeat) return;
          const probe = window.__h4RuntimeProbe;
          if (event.key === '4' && document.documentElement.dataset.mode === 'normal') probe.enterStartedAt = performance.now();
          if (event.key === '3' && document.documentElement.dataset.mode === 'xray' && probe.reverseStartedAt === null) probe.reverseStartedAt = performance.now();
        }, true);
        document.addEventListener('h4:modechange', event => {
          const probe = window.__h4RuntimeProbe;
          const record = {
            mode: event.detail.mode, changedAt: performance.now(),
            inputStartedAt: event.detail.mode === 'xray' ? probe.enterStartedAt : probe.reverseStartedAt,
            declaredDuration: Number.isFinite(event.detail.duration) ? event.detail.duration : null,
            variant: event.detail.variant ?? null, controllerSettledAt: null,
          };
          probe.transitions.push(record);
          probe.reverseStartedAt = null;
          // modechange precedes setting the transition attribute. Read after its
          // turn, then observe removal instead of resolving before animation starts.
          queueMicrotask(() => {
            if (!document.documentElement.hasAttribute('data-xray-transition')) { record.controllerSettledAt = performance.now(); return; }
            const observer = new MutationObserver(() => {
              if (!document.documentElement.hasAttribute('data-xray-transition')) {
                record.controllerSettledAt = performance.now(); observer.disconnect();
              }
            });
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-xray-transition'] });
          });
        });
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
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(new URL('/?test=1', baseURL).href, { waitUntil: 'networkidle' });
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      await page.locator('html[data-xray-ready][data-mode="normal"]').waitFor();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
      const samples = [];
      for (const mode of ['normal', 'xray', 'normal']) {
        const transition = await changeMode(page, mode);
        const effectBefore = await effectSnapshot(page);
        const before = await metrics();
        const observed = await page.evaluate(observationMs => new Promise(resolve => {
          const started = performance.now();
          const firstClear = window.__h4ClearCalls;
          const intervals = [], longTasks = [];
          let previous;
          const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration)));
          observer.observe({ type: 'longtask', buffered: false });
          function sample(now) {
            if (previous !== undefined) intervals.push(now - previous);
            previous = now;
            if (now - started < observationMs) return requestAnimationFrame(sample);
            observer.disconnect(); intervals.sort((a, b) => a - b);
            resolve({ elapsedMs: performance.now() - started, webglClearCalls: window.__h4ClearCalls - firstClear,
              rafCallbackIntervalMedianMs: intervals[Math.floor(intervals.length / 2)],
              rafCallbackIntervalP95Ms: intervals[Math.floor(intervals.length * .95)],
              longTaskCount: longTasks.length, longTaskTotalMs: longTasks.reduce((sum, duration) => sum + duration, 0),
              observedPixelRatio: document.getElementById('logo-canvas').width / document.getElementById('logo-canvas').clientWidth });
          }
          requestAnimationFrame(sample);
        }), observationMs);
        const after = await metrics();
        const effectAfter = await effectSnapshot(page);
        const delta = name => effectBefore[name] !== null && effectAfter[name] !== null ? effectAfter[name] - effectBefore[name] : null;
        samples.push({ mode, transition, ...observed, effectBefore, effectAfter,
          roiFramesDelta: delta('roiFrames'), ambientFramesDelta: delta('ambientFrames'), transitionFramesDelta: delta('transitionFrames'),
          taskDurationMs: (after.TaskDuration - before.TaskDuration) * 1000,
          scriptDurationMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
          layoutDurationMs: (after.LayoutDuration - before.LayoutDuration) * 1000 });
      }
      assert.deepEqual(errors, [], 'A page or shader error invalidates this observation.');
      await cdp.detach();
      results.push({ profile: touch ? '390px-touch-lite' : '1440px-desktop-full',
        inputMethod: 'trusted keyboard on both emulated profiles; no native-touch latency measurement',
        xrayQuality: await page.locator('html').getAttribute('data-xray-quality'), samples, errors });
      console.log(JSON.stringify(results.at(-1)));
    } finally { await context.close(); }
  }
  const output = new URL(`../artifacts/performance/${label}-runtime.json`, import.meta.url);
  await mkdir(new URL('.', output), { recursive: true });
  await writeFile(output, JSON.stringify({ baseURL, measuredAt: new Date().toISOString(),
    browser: browser.version(), renderer: 'SwiftShader', chromeFlags, deviceScaleFactor: 1,
    overriddenResourceHints: { deviceMemory: 8, hardwareConcurrency: 8 }, observationMs,
    sequence: 'normal → trusted hold4 → xray → trusted released333 → normal; stationary three-second observation after each settled state',
    transitionDefinitions: {
      inputToModeChangeMs: 'First trusted shortcut keydown to authoritative modechange; includes the one-second entry hold.',
      controllerTransitionMs: 'Modechange to removal of data-xray-transition; zero/near-zero when the controller skips animation.',
      settledFromModeChangeMs: 'Modechange to observed controller completion, matching optional hero uniform and optional compositor-transition completion. Not a visual paint latency guarantee.',
      declaredTransitionMs: 'Requested duration from event detail when exposed; null means unavailable.',
    },
    caveats: 'Single software-GPU observation per profile; resource hints overridden for coverage. The measurement itself adds a bounded RAF observer. Callback intervals are not GPU/compositor FPS. No physical-device input, native-touch latency, INP or statistical performance claim. Missing DEV counters remain null; ambient scheduling is separate from recovered pointer-ROI idleness.',
    results }, null, 2) + '\n');
  console.log(`Saved ${output.pathname}`);
} finally { await browser.close(); }
