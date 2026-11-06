import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { worldSoundSettings } from '../src/audio/worldSoundSettings.js';

const LOOP_333 = worldSoundSettings.paths.loops['333'][0];

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/audio-performance/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'],
});
const reports = [], failures = [];

async function instrument(context) {
  await context.addInitScript(() => {
    window.__H4_AUDIO_PERF__ = [];
    window.__audioPerf = { contexts: 0, fetches: [], decodes: [], starts: [], rafAudio: 0, reads: 0, longTasks: [], layoutShifts: [], resumeAt: [], pointerAt: 0, pointerDoneAt: 0, analyser: null, heap: [] };
    const nativeRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      if (String(callback).includes('tickActivity')) window.__audioPerf.rafAudio++;
      return nativeRaf(callback);
    };
    document.addEventListener('pointerdown', () => { window.__audioPerf.pointerAt = performance.now(); }, { capture: true, passive: true });
    window.addEventListener('pointerdown', () => { window.__audioPerf.pointerDoneAt = performance.now(); }, { passive: true });
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__audioPerf.longTasks.push({ start: entry.startTime, duration: entry.duration });
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* optional */ }
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__audioPerf.layoutShifts.push(entry.value);
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* optional */ }
    const Native = window.AudioContext || window.webkitAudioContext;
    if (!Native) return;
    window.AudioContext = class extends Native {
      constructor(options) {
        super(options);
        window.__audioPerf.contexts++;
        window.__audioPerf.context = this;
        const resume = this.resume.bind(this);
        this.resume = () => { window.__audioPerf.resumeAt.push(performance.now()); return resume(); };
      }
      createAnalyser() {
        const node = super.createAnalyser();
        const read = node.getByteFrequencyData.bind(node);
        node.getByteFrequencyData = array => { window.__audioPerf.reads++; return read(array); };
        window.__audioPerf.analyser = node;
        return node;
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (when = 0, offset = 0, ...rest) => {
          window.__audioPerf.starts.push({ loop: source.loop, duration: source.buffer?.duration || 0, at: performance.now() });
          return start(when, offset, ...rest);
        };
        return source;
      }
      decodeAudioData(...args) {
        window.__audioPerf.decodes.push(performance.now());
        return super.decodeAudioData(...args);
      }
    };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (url, ...args) => {
      const value = String(url?.url || url);
      if (/\/assets\/audio\//.test(value)) window.__audioPerf.fetches.push(value);
      return nativeFetch(url, ...args);
    };
  });
}

const perf = page => page.evaluate(() => {
  const { analyser, context: audioContext, ...rest } = window.__audioPerf;
  return {
    ...rest,
    analyserFftSize: analyser?.fftSize || 0,
    perf: window.__H4_AUDIO_PERF__.map(entry => ({ ...entry })),
    snapshot: window.__H4_AUDIO__.snapshot(),
    heapNow: performance.memory?.usedJSHeapSize ?? null,
  };
});
const activeLoop = page => page.waitForFunction(() => window.__H4_AUDIO__?.snapshot().world?.loops['333'].active, null, { timeout: 30000 });

async function openContext({ width = 1440, reduced = false, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: mobile, hasTouch: mobile });
  await instrument(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(new URL('/?test=1', base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__H4_AUDIO__));
  await page.waitForTimeout(300);
  return { context, page, errors };
}
async function clickWordmark(page) {
  const box = await page.locator('#stage').boundingBox();
  const at = await page.evaluate(() => performance.now());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return at;
}

try {
  const { context, page, errors } = await openContext();
  const indicator = page.locator('[data-sound-activity]');
  const mute = page.locator('[data-mode-mute]');
  assert.equal(await indicator.count(), 1);
  assert.equal(await indicator.getAttribute('aria-hidden'), 'true');
  assert.equal(await indicator.locator('i').count(), 3, 'Exactly three decorative bars.');
  const reserved = await indicator.boundingBox();
  assert.ok(reserved.width > 8 && reserved.width < 24, 'The bars reserve a small fixed width.');
  let state = await perf(page);
  assert.equal(state.contexts, 0);
  assert.deepEqual(state.fetches, []);
  assert.deepEqual(state.decodes, [], 'Zero audio bytes and zero decodes before the first gesture.');

  const heapBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  const gestureAt = await clickWordmark(page);
  await activeLoop(page);
  await page.waitForTimeout(1200);
  state = await perf(page);
  assert.equal(state.contexts, 1);
  assert.deepEqual(state.fetches, [LOOP_333], 'Only the active loop is downloaded; no idle second-loop prefetch.');
  assert.equal(state.decodes.length, 1);
  assert.equal(state.starts.filter(source => source.loop).length, 1, 'One loop start.');
  assert.equal(await indicator.getAttribute('data-active'), 'true');
  assert.equal(state.layoutShifts.reduce((sum, value) => sum + value, 0), 0, 'Reserved bars add no layout shift.');
  assert.equal(state.snapshot.analyserConnected, true);
  assert.ok(state.analyserFftSize > 0 && state.analyserFftSize <= 64, `fftSize ${state.analyserFftSize}`);
  assert.ok(state.starts[0].at - gestureAt > 0);
  assert.ok(state.resumeAt.some(at => at <= state.pointerDoneAt),
    'resume() runs inside pointerdown dispatch, before the event bubbles back to window.');

  const by = name => state.perf.filter(entry => entry.name === name);
  const unlock = by('unlock').at(-1);
  const start = by('startListening').at(-1);
  const indicatorStart = by('indicatorStart').at(-1);
  const indicatorStop = by('indicatorStop').at(-1);
  const contextCreate = by('contextCreate').at(-1);
  const guidedInit = by('guidedInit').at(-1);
  const indicatorCreate = by('indicatorCreate').at(-1);
  assert.ok(contextCreate && contextCreate.ms > 0, 'First context creation is measured separately from incremental handler cost.');
  assert.ok(unlock && start && indicatorStart && indicatorStop);
  assert.ok(unlock.at <= start.at, 'unlock precedes activation scheduling.');
  assert.ok(state.decodes[0] > start.at, 'Decode begins after the fade intent is scheduled, never synchronously in the handler.');
  for (const entry of [unlock, start, indicatorStart, indicatorStop, guidedInit, indicatorCreate]) {
    assert.ok(entry.ms < 1, `${entry.name} handler cost ${entry.ms.toFixed(3)} ms must stay below 1 ms.`);
  }
  const handlerTotal = unlock.ms + start.ms + indicatorStart.ms + indicatorStop.ms;
  assert.ok(handlerTotal < 2, `unlock + cascade + indicator ${handlerTotal.toFixed(3)} ms must stay below 2 ms.`);
  const startupTotal = guidedInit.ms + indicatorCreate.ms;
  assert.ok(startupTotal < 2, `Added startup cost ${startupTotal.toFixed(3)} ms must stay below 2 ms.`);

  // Decoded-heap budget: one loop resident after two full mode round-trips.
  const cdp = await context.newCDPSession(page);
  const heapSnapshot = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(200);
    return page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  };
  await page.waitForTimeout(600);
  const roundTripBefore = await heapSnapshot();
  for (let round = 0; round < 2; round++) {
    await page.evaluate(() => window.__H4_AUDIO__.switchMode('xray', 900));
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__H4_AUDIO__.switchMode('normal', 900));
    await page.waitForTimeout(1200);
  }
  const roundTripAfter = await heapSnapshot();
  const roundTripState = await perf(page);
  assert.equal(roundTripState.snapshot.world.currentWorld, '333');
  assert.equal(roundTripState.snapshot.world.loops['333'].bufferDuration > 89, true);
  assert.equal(roundTripState.snapshot.world.loops['4'].bufferDuration, 0, 'The outgoing loop PCM is released after the fade.');
  const heapDelta = roundTripBefore !== null && roundTripAfter !== null ? roundTripAfter - roundTripBefore : null;
  assert.ok(heapDelta !== null && heapDelta <= 2 * 1024 * 1024,
    `Two mode round-trips must add at most 2 MB of decoded heap (measured ${heapDelta}).`);

  await page.evaluate(() => { window.__audioPerf.reads = 0; });
  await page.waitForTimeout(1000);
  const reads = await page.evaluate(() => window.__audioPerf.reads);
  assert.ok(reads > 0 && reads <= 31, `Analyser reads ${reads}/s must stay at or under 30 Hz.`);

  await mute.click();
  assert.equal(await page.evaluate(() => window.__H4_AUDIO__.snapshot().analyserConnected), false,
    'The analyser disconnects in the same event tick as the mute.');
  await page.waitForFunction(() => window.__H4_AUDIO__.snapshot().muted === true);
  await page.waitForTimeout(120);
  const rafAtMute = await page.evaluate(() => window.__audioPerf.rafAudio);
  await page.waitForTimeout(350);
  const afterMute = await perf(page);
  assert.equal(afterMute.rafAudio ?? rafAtMute, rafAtMute, 'No audio rAF is scheduled while muted.');
  assert.equal(await indicator.getAttribute('data-active'), 'false');
  assert.equal(afterMute.snapshot.analyserConnected, false, 'The analyser disconnects in the same tick as the mute.');
  assert.equal((await mute.getAttribute('aria-label')), 'sound');
  assert.equal((await mute.getAttribute('aria-pressed')), 'false');
  assert.equal((await mute.textContent()).trim(), 'sound off');
  await mute.click();
  await activeLoop(page);
  assert.equal((await mute.getAttribute('aria-label')), 'sound');
  assert.equal((await mute.getAttribute('aria-pressed')), 'true');
  const rafBeforeHide = await page.evaluate(() => window.__audioPerf.rafAudio);
  await page.evaluate(() => window.__H4_AUDIO__.setPageHidden(true));
  await page.waitForTimeout(450);
  const hidden = await perf(page);
  assert.equal(hidden.rafAudio, rafBeforeHide, 'No audio rAF is scheduled while the page is hidden.');
  assert.equal(hidden.snapshot.analyserConnected, false);
  await page.evaluate(() => window.__H4_AUDIO__.setPageHidden(false));
  await page.waitForTimeout(300);

  const labels = await page.evaluate(() => document.querySelector('[data-mode-mute]').getAttribute('aria-label'));
  assert.equal(labels, 'sound');

  const beforeSwitch = await page.evaluate(() => window.__H4_AUDIO__.snapshot().world.transportStart);
  await page.evaluate(() => { window.__audioPerf.longTasks.length = 0; });
  for (let index = 0; index < 5; index++) {
    await page.evaluate(mode => window.__H4_AUDIO__.switchMode(mode, 80), index % 2 ? 'xray' : 'normal');
    await page.waitForTimeout(180);
  }
  for (let index = 0; index < 4; index++) await page.evaluate(() => window.__H4_AUDIO__.startListening({ isTrusted: true }));
  await page.waitForTimeout(200);
  state = await perf(page);
  assert.equal(state.contexts, 1, 'Five activations and five mode switches reuse exactly one AudioContext.');
  assert.equal(state.snapshot.world.transportStart, beforeSwitch, 'Activation never restarts the shared transport.');
  assert.deepEqual(errors, []);
  assert.deepEqual(state.longTasks.filter(entry => entry.duration > 50), [], 'The audio-only activation/switch window adds no long task above 50 ms.');
  const heap = state.heapNow;
  reports.push({ profile: 'desktop', reserved, reads, handlerTotal, startupTotal, contextCreateMs: contextCreate.ms,
    unlockMs: unlock.ms, startMs: start.ms, indicatorStartMs: indicatorStart.ms, heapBefore, heapNow: heap,
    heapDelta: heapBefore !== null && heap !== null ? heap - heapBefore : null,
    decodedBytes: 3969000 * 2 * 4, coldGestureToStartMs: +(state.starts[0].at - gestureAt).toFixed(1),
    roundTripBefore, roundTripAfter, roundTripHeapDelta: heapDelta,
    roundTripLoops: roundTripState.snapshot.world.loops, fetches: state.fetches, errors });
  await context.close();

  // Reduced motion: static active bars, no animation frame, no analyser reads.
  {
    const reduced = await openContext({ reduced: true });
    const bars = reduced.page.locator('[data-sound-activity]');
    const before = await bars.boundingBox();
    await clickWordmark(reduced.page);
    await activeLoop(reduced.page);
    await reduced.page.waitForTimeout(600);
    const value = await perf(reduced.page);
    assert.equal(await bars.getAttribute('data-active'), 'true');
    assert.equal(value.rafAudio, 0, 'Reduced motion schedules no audio rAF.');
    assert.equal(value.snapshot.analyserConnected, false);
    const after = await bars.boundingBox();
    assert.equal(after.x, before.x, 'Reserved bars do not shift layout.');
    assert.equal(after.width, before.width);
    reports.push({ profile: 'reduced', before, after, rafAudio: value.rafAudio });
    assert.deepEqual(reduced.errors, []);
    await reduced.context.close();
  }

  // 390 and 320: bars stay in the controls, no horizontal overflow.
  for (const width of [390, 320]) for (const reduced of [false, true]) {
    const narrow = await openContext({ width, mobile: true, reduced });
    await clickWordmark(narrow.page);
    await activeLoop(narrow.page);
    await narrow.page.waitForTimeout(400);
    const box = await narrow.page.locator('[data-sound-activity]').boundingBox();
    assert.ok(box && box.width > 8 && box.x + box.width <= width, `${width}px indicator fits.`);
    const overflow = await narrow.page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    assert.equal(overflow, 0);
    await narrow.page.evaluate(async () => {
      await window.__H4_AUDIO__.switchMode('xray', 120);
      await window.__H4_AUDIO__.switchMode('normal', 120);
    });
    assert.equal((await perf(narrow.page)).contexts, 1, 'Both modes share the one context.');
    assert.deepEqual(narrow.errors, []);
    reports.push({ profile: `${width}px-${reduced ? 'reduced' : 'full'}`, box, overflow });
    await narrow.context.close();
  }

  // In-flight decode: no source until the buffer resolves, then exactly one start.
  {
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await instrument(context2);
    await context2.route('**/assets/audio/loop-333.*.m4a', async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
    const page2 = await context2.newPage();
    await page2.goto(new URL('/?test=1', base).href, { waitUntil: 'networkidle' });
    await page2.waitForFunction(() => Boolean(window.__H4_AUDIO__));
    await clickWordmark(page2);
    await page2.waitForTimeout(150);
    assert.equal((await perf(page2)).starts.filter(source => source.loop).length, 0, 'No source starts before decode resolves.');
    await activeLoop(page2);
    await page2.waitForTimeout(300);
    const after = await perf(page2);
    assert.equal(after.starts.filter(source => source.loop).length, 1, 'Exactly one start on resolve.');
    assert.equal(after.decodes.length, 1);
    reports.push({ profile: 'inflight-decode', starts: after.starts.filter(source => source.loop).length, decodes: after.decodes.length });
    await context2.close();
  }

  // Cold and warm gesture-to-first-audible timing, measured on the same origin.
  {
    const timingContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await instrument(timingContext);
    const timingPage = await timingContext.newPage();
    const times = [];
    for (const pass of ['cold', 'warm']) {
      await timingPage.goto(new URL('/?test=1', base).href, { waitUntil: 'networkidle' });
      await timingPage.waitForFunction(() => Boolean(window.__H4_AUDIO__));
      await timingPage.waitForTimeout(250);
      const before = await timingPage.evaluate(() => performance.now());
      await clickWordmark(timingPage);
      await activeLoop(timingPage);
      const after = await perf(timingPage);
      times.push({ pass, ms: +(after.starts.find(source => source.loop).at - before).toFixed(1) });
    }
    reports.push({ profile: 'gesture-to-audible', times });
    assert.ok(times.every(item => item.ms > 0));
    await timingContext.close();
  }

  const result = { checkedAt: new Date().toISOString(), base, reports, failures };
  await writeFile(new URL('results.json', output), JSON.stringify(result, null, 2));
  console.log(`PASS audio performance: handler ${reports[0].handlerTotal.toFixed(3)} ms, startup ${reports[0].startupTotal.toFixed(3)} ms, context ${reports[0].contextCreateMs.toFixed(1)} ms, reads ${reports[0].reads}/s; reduced/narrow/in-flight scenarios pass.`);
} catch (error) {
  failures.push({ error: error.stack });
  await writeFile(new URL('results.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, reports, failures }, null, 2));
  throw error;
} finally { await browser.close(); }
