import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createPreviewServer } from '../scripts/serve-preview.mjs';
import { mannequinPreviewConfig } from '../src/mannequin-preview-config.js';

/**
 * M4g: Pollrate-Unabhaengigkeit der Ziehgeschwindigkeit.
 *
 * Dieselbe physische Geste (400 px/s, 300 ms) wird mit Ereignisintervallen von
 * 1 / 4,17 / 8 / 16 ms zugestellt — das entspricht 1000/240/125/62,5 Hz
 * Pointer-Polling. Der Flick-Peak muss in allen Faellen gleich sein.
 *
 * Die Uhr wird ohne Pumpe installiert: die Testgeste schiebt die Zeit in
 * Ereignisschritten weiter und laesst nur an Framegrenzen einen rAF-Durchlauf
 * zu. So sind sowohl die Ereignis- als auch die Frame-Zeit exakt bekannt.
 *
 * Zusaetzlich (M4i): Stillstands-Gesten (60/150 ms) und der Koaleszenz-Zweig
 * mit 0, 1 und 3 Zwischenpositionen. Der Koaleszenz-Zweig ist durch einen Mock
 * abgedeckt, kein Integrationsnachweis — siehe REPORT.md §M4i.
 */
const motion = mannequinPreviewConfig.motion;
const { flickVelocity, dragSensitivity } = motion;
// Vor M4g existiert kein Zeitfenster; dann bleibt der Wert nur Dokumentation.
const pointerWindowMs = motion.pointerWindowMs ?? 70;
const EVENT_INTERVALS = [1, 4.17, 8, 16];
const FRAME_MS = 1000 / 120;
const SPEED = 400; // px/s
// Stillstands-Gesten mit einem klar schnellen Wisch (9,00 rad/s vor dem Kappen).
const FAST_SPEED = 900;
const DURATION = 300; // ms
const evidence = new URL('../docs/validation/MANNEQUIN-C/', import.meta.url);
await mkdir(evidence, { recursive: true });

const server = await createPreviewServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

// Uhr ohne Pumpe: nur die Queue, geflusht wird ausschliesslich im Test.
await page.addInitScript(() => {
  const clock = { t: 1000, id: 1, queue: new Map() };
  window.__clock = clock;
  performance.now = () => clock.t;
  window.requestAnimationFrame = (callback) => {
    const id = clock.id;
    clock.id += 1;
    clock.queue.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => { clock.queue.delete(id); };
});

await page.goto(`${base}/work/tattoos`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const element = document.querySelector('#model-3d');
  scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + scrollY - 120), behavior: 'instant' });
});
await page.waitForFunction(
  () => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'ready',
  null, { timeout: 60000, polling: 100 });

const coalescedSupport = await page.evaluate(() => ({
  prototype: typeof PointerEvent.prototype.getCoalescedEvents,
  instance: typeof new PointerEvent('pointermove').getCoalescedEvents,
}));

await page.evaluate(({ frameMs }) => {
  const clock = window.__clock;
  const viewer = () => document.querySelector('[data-mannequin-preview]');
  const element = viewer();
  element.setPointerCapture = () => {};
  element.releasePointerCapture = () => {};
  const flushFrame = () => {
    const due = [...clock.queue.values()];
    clock.queue.clear();
    for (const callback of due) callback(clock.t);
  };
  const pointer = (type, x, y) => new PointerEvent(type, {
    bubbles: true, pointerId: 21, isPrimary: true, pointerType: 'mouse',
    button: 0, buttons: 1, clientX: x, clientY: y,
  });
  window.__rig = {
    reset() {
      const host = viewer();
      host.focus();
      host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      clock.t += frameMs;
      flushFrame();
    },
    /** Geste mit fester Zeigergeschwindigkeit und festem Ereignisintervall. */
    gesture({ intervalMs, speed, durationMs, holdMs = 0, coalesce = null }) {
      const host = viewer();
      const box = host.getBoundingClientRect();
      let x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      host.dispatchEvent(pointer('pointerdown', x, y));
      let accumulated = 0;
      let sinceFrame = 0;
      for (let elapsed = 0; elapsed + intervalMs <= durationMs; elapsed += intervalMs) {
        const step = intervalMs;
        clock.t += step;
        const previousX = x;
        x += (speed * step) / 1000;
        const event = pointer('pointermove', x, y);
        if (coalesce !== null) {
          // Nachgebildete API: 0 Zwischenpositionen, 1 oder n.
          const base = event.timeStamp;
          const samples = [];
          for (let index = 1; index <= coalesce; index += 1) {
            samples.push({
              clientX: previousX + ((x - previousX) * index) / coalesce,
              timeStamp: base - step + (step * index) / coalesce,
            });
          }
          event.getCoalescedEvents = () => samples;
        }
        host.dispatchEvent(event);
        sinceFrame += step;
        accumulated += step;
        if (sinceFrame >= frameMs - 1e-9) {
          sinceFrame -= frameMs;
          flushFrame();
        }
      }
      // Stillstand vor dem Loslassen: Zeit laeuft in 1-ms-Schritten weiter, es
      // kommen keine Ereignisse mehr. (Grobe Schritte wuerden die Schwelle um
      // mehrere Millisekunden verschieben.)
      for (let held = 0; held < holdMs; held += 1) {
        clock.t += 1;
        sinceFrame += 1;
        if (sinceFrame >= frameMs - 1e-9) {
          sinceFrame -= frameMs;
          flushFrame();
        }
      }
      flushFrame();
      const result = {
        peak: Number(host.dataset.mannequinPeak || 0),
        velocity: Number(host.dataset.mannequinVelocity || 0),
        angle: Number(host.dataset.mannequinAngle || 0),
        samples: Number(host.dataset.mannequinPointerSamples || 0),
        coalesced: Number(host.dataset.mannequinCoalescedSamples || 0),
        flicks: Number(host.dataset.mannequinFlicks || 0),
        duration: accumulated,
      };
      host.dispatchEvent(pointer('pointerup', x, y));
      result.flicksAfterUp = Number(host.dataset.mannequinFlicks || 0);
      return result;
    },
  };
}, { frameMs: FRAME_MS });

const runs = [];
const play = async (config) => {
  await page.evaluate(() => window.__rig.reset());
  const before = await page.evaluate(() => Number(document.querySelector('[data-mannequin-preview]').dataset.mannequinFlicks || 0));
  const run = await page.evaluate((settings) => window.__rig.gesture(settings), config);
  return { ...run, flicks: run.flicksAfterUp - before };
};

for (const intervalMs of EVENT_INTERVALS) {
  runs.push({ intervalMs, ...(await play({ intervalMs, speed: SPEED, durationMs: DURATION })) });
}

// Stillstand vor dem Loslassen (M4i): 60 ms fliegt noch, 150 ms gilt als Halt.
const holds = [];
for (const holdMs of [60, 150]) {
  holds.push({ holdMs, ...(await play({ intervalMs: 8, speed: FAST_SPEED, durationMs: DURATION, holdMs })) });
}

// Koaleszenz-Pfad mit 0, 1 und 3 Zwischenpositionen (nachgebildete API).
const coalescedRuns = [];
for (const coalesce of [0, 1, 3]) {
  coalescedRuns.push({ coalesce, ...(await play({ intervalMs: 8, speed: SPEED, durationMs: DURATION, coalesce })) });
}
const coalesced = coalescedRuns.find((entry) => entry.coalesce === 3);

const expectedPeak = SPEED * dragSensitivity;
const peaks = runs.map((run) => run.peak);
const spread = (Math.max(...peaks) - Math.min(...peaks)) / expectedPeak;

for (const run of runs) {
  console.log(`  ${String(run.intervalMs).padStart(5)} ms  Peak ${run.peak.toFixed(3)} rad/s  `
    + `Angle ${run.angle.toFixed(3)} rad  Samples ${run.samples}  Flicks ${run.flicks}`);
}
for (const entry of holds) {
  console.log(`  ${String(entry.holdMs).padStart(5)} ms Stillstand  Peak ${entry.peak.toFixed(3)} rad/s  Flicks ${entry.flicks}`);
}
for (const entry of coalescedRuns) {
  console.log(`  coalesced(${entry.coalesce})  Peak ${entry.peak.toFixed(3)} rad/s  Samples ${entry.samples}  `
    + `Coalesced ${entry.coalesced}  Flicks ${entry.flicks}`);
}

assert.ok(runs.every((run) => Math.abs(run.peak - expectedPeak) < 0.05 * expectedPeak),
  `Every pointer rate must report ${expectedPeak.toFixed(2)} rad/s (${peaks.map((peak) => peak.toFixed(2)).join(', ')}).`);
assert.ok(spread < 0.05, `Peak spread across pointer rates stays under 5 % (${(spread * 100).toFixed(2)} %).`);
assert.ok(runs.every((run) => run.flicks === 1), `Every pointer rate must fire exactly one flick (${runs.map((run) => run.flicks)}).`);
assert.ok(runs.every((run) => run.peak > flickVelocity),
  `The flick threshold ${flickVelocity} rad/s is exceeded at every pointer rate.`);
assert.equal(holds.find((entry) => entry.holdMs === 60)?.flicks, 1,
  '60 ms Stillstand vor dem Loslassen fliegt noch (Fenster 100 ms).');
assert.equal(holds.find((entry) => entry.holdMs === 150)?.flicks, 0,
  '150 ms Stillstand vor dem Loslassen loest keinen Flick aus.');
for (const entry of coalescedRuns) {
  assert.equal(entry.flicks, 1, `Koaleszenz mit ${entry.coalesce} Zwischenpositionen flickt genau einmal.`);
  assert.ok(Math.abs(entry.peak - expectedPeak) < 0.05 * expectedPeak,
    `Koaleszenz mit ${entry.coalesce} Zwischenpositionen liefert dieselbe Geschwindigkeit (${entry.peak.toFixed(2)}).`);
}
assert.equal(coalescedRuns.find((entry) => entry.coalesce === 0)?.coalesced, 0,
  'Leere Koaleszenz-Liste faellt auf die Position des Ereignisses zurueck.');
assert.ok(coalescedRuns.find((entry) => entry.coalesce === 3).coalesced > 0,
  'Drei Zwischenpositionen landen im Zeitfenster.');
assert.deepEqual(errors, [], 'no console errors during the pointer-rate runs');

await writeFile(new URL('m4g-pointer-rate.json', evidence), `${JSON.stringify({
  measuredAt: new Date().toISOString(),
  frameMs: FRAME_MS,
  speedPxPerSecond: SPEED,
  durationMs: DURATION,
  pointerWindowMs,
  expectedPeak,
  coalescedSupport,
  runs,
  holds: holds.map((entry) => ({ holdMs: entry.holdMs, peak: entry.peak, flicks: entry.flicks })),
  coalesced: coalescedRuns.map((entry) => ({
    subSamples: entry.coalesce, peak: entry.peak, samples: entry.samples,
    coalescedSamples: entry.coalesced, flicks: entry.flicks,
  })),
  spreadPercent: spread * 100,
}, null, 2)}\n`);

console.log(`PASS pointer rate: ${EVENT_INTERVALS.join('/')} ms, Peak ${expectedPeak.toFixed(2)} rad/s, Spanne ${(spread * 100).toFixed(2)} %.`);
await context.close();
await browser.close();
server.close();
