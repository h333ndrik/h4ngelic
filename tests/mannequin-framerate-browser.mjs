import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createPreviewServer } from '../scripts/serve-preview.mjs';
import { mannequinPreviewConfig } from '../src/mannequin-preview-config.js';

/**
 * Framerate-Audit (M4f): dieselbe Bewegung bei 30/60/144 Hz.
 *
 * Pro Framerate eine eigene Seite, in der `requestAnimationFrame` und
 * `performance.now` von Anfang an mit einem festen virtuellen Takt laufen
 * (1000/rate ms pro Frame). So ist die Integrationsschrittweite exakt bekannt,
 * unabhaengig von der realen Bilddauer des Software-Renderers. Zeiger-Ereignisse
 * werden am Anfang eines Frames ausgeloest; damit hat jeder Lauf dieselbe
 * Phasenlage und die Messung ist wiederholbar.
 */
const { motion } = mannequinPreviewConfig;
const RATES = [30, 60, 144];
const HOVER_SECONDS = 1.4;
const IDLE_SECONDS = 2.2;
// Die Auto-Rotation startet nach idleDelay (2 s) und laeuft exponentiell an;
// 2 s Messfenster danach reichen bis auf 0,2 % an 0,18 rad/s.
const AUTO_SECONDS = 2;
const DRAG_SECONDS = 0.25;
const DRAG_SPEED = 400; // px/s Zeigerbewegung
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

/** Virtueller Takt: rAF und performance.now laufen synchron. */
function installClock(rate) {
  const clock = { rate, t: 1000, id: 1, queue: new Map() };
  window.__clock = clock;
  performance.now = () => clock.t;
  window.requestAnimationFrame = (callback) => {
    const id = clock.id;
    clock.id += 1;
    clock.queue.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => { clock.queue.delete(id); };
  const flush = () => {
    const due = [...clock.queue.values()];
    clock.queue.clear();
    clock.t += 1000 / clock.rate;
    for (const callback of due) callback(clock.t);
    setTimeout(flush, 0);
  };
  setTimeout(flush, 0);
}

/** Lineare Interpolation eines Messwerts zum exakten virtuellen Zeitpunkt. */
function valueAt(frames, key, t) {
  if (t <= frames[0].t) return frames[0][key];
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (t <= current.t) {
      const span = current.t - previous.t || 1;
      return previous[key] + ((current[key] - previous[key]) * (t - previous.t)) / span;
    }
  }
  return frames[frames.length - 1][key];
}

/** Zeitpunkt, an dem die Winkelgeschwindigkeit das Toleranzband erreicht. */
function timeToTarget(frames, target, toleranceFraction = 0.05) {
  const tolerance = Math.abs(target) * toleranceFraction;
  const error = (frame) => Math.abs(frame.velocity - target);
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (error(previous) <= tolerance) return previous.t;
    if (error(current) > tolerance) continue;
    const span = error(previous) - error(current);
    const share = span > 0 ? (error(previous) - tolerance) / span : 1;
    return previous.t + (current.t - previous.t) * Math.min(1, Math.max(0, share));
  }
  return Number.NaN;
}

/** Mittlere Winkelgeschwindigkeit ueber das letzte Zeitfenster. */
function windowSpeed(frames, windowMs = 300) {
  const end = frames[frames.length - 1];
  const startT = end.t - windowMs;
  const angleStart = valueAt(frames, 'angle', startT);
  return (end.angle - angleStart) / ((end.t - startT) / 1000);
}

const relate = (values) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return (Math.max(...values) - Math.min(...values)) / Math.abs(mean);
};

const errors = [];
const runs = [];
for (const rate of RATES) {
  const context = await browser.newContext({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${rate} Hz: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`${rate} Hz: ${message.text()}`); });
  await page.addInitScript(installClock, rate);
  await page.goto(`${base}/creative/tattoos`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const element = document.querySelector('#model-3d');
    scrollTo({ top: Math.max(0, element.getBoundingClientRect().top + scrollY - 120), behavior: 'instant' });
  });
  await page.waitForFunction(
    () => document.querySelector('[data-mannequin-preview]')?.dataset.mannequinState === 'ready',
    null, { timeout: 60000 });

  await page.evaluate(() => {
    const clock = window.__clock;
    const viewer = () => document.querySelector('[data-mannequin-preview]');
    viewer().setPointerCapture = () => {};
    viewer().releasePointerCapture = () => {};
    window.__rig = {
      /** Home-Taste: Winkel, Geschwindigkeit und Flick zurueck auf Start. */
      reset() {
        const element = viewer();
        element.focus();
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      },
      escape() {
        const element = viewer();
        element.focus();
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      },
      /**
       * Protokolliert einen Frame pro Flush; `action` (Zeiger rein/raus) laeuft
       * am Anfang des ersten Frames.
       */
      sample(seconds, action = '') {
        const element = viewer();
        const frames = [];
        let start = null;
        return new Promise((resolve) => {
          const step = () => {
            if (start === null) {
              if (action === 'enter') element.dispatchEvent(new PointerEvent('pointerenter'));
              if (action === 'leave') element.dispatchEvent(new PointerEvent('pointerleave'));
              start = clock.t;
              requestAnimationFrame(step);
              return;
            }
            frames.push({
              t: clock.t - start,
              angle: Number(element.dataset.mannequinAngle),
              velocity: Number(element.dataset.mannequinVelocity),
            });
            if (clock.t - start >= seconds * 1000) resolve(frames);
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      },
      /** Ziehen mit konstanter Zeigergeschwindigkeit, danach loslassen. */
      drag(seconds, speed) {
        const element = viewer();
        const box = element.getBoundingClientRect();
        let x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        const pointer = (type) => new PointerEvent(type, {
          bubbles: true, pointerId: 11, isPrimary: true, pointerType: 'mouse',
          button: 0, buttons: 1, clientX: x, clientY: y,
        });
        const peaks = [];
        let start = null;
        let angleStart = 0;
        return new Promise((resolve) => {
          const step = () => {
            if (start === null) {
              element.dispatchEvent(pointer('pointerdown'));
              angleStart = Number(element.dataset.mannequinAngle);
              start = clock.t;
              requestAnimationFrame(step);
              return;
            }
            x += (speed * (1000 / clock.rate)) / 1000;
            element.dispatchEvent(pointer('pointermove'));
            peaks.push(Number(element.dataset.mannequinPeak));
            if (clock.t - start >= seconds * 1000) {
              const angle = Number(element.dataset.mannequinAngle) - angleStart;
              element.dispatchEvent(pointer('pointerup'));
              resolve({ peaks, angle, flicks: Number(element.dataset.mannequinFlicks || 0) });
            } else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      },
    };
  });

  await page.evaluate(() => window.__rig.reset());
  const hover = await page.evaluate((seconds) => window.__rig.sample(seconds, 'enter'), HOVER_SECONDS);
  const flicksBefore = await page.evaluate(() => Number(document.querySelector('[data-mannequin-preview]').dataset.mannequinFlicks || 0));
  const drag = await page.evaluate(([seconds, speed]) => window.__rig.drag(seconds, speed), [DRAG_SECONDS, DRAG_SPEED]);
  await page.evaluate(() => window.__rig.escape());
  await page.evaluate((seconds) => window.__rig.sample(seconds, 'leave'), IDLE_SECONDS);
  const auto = await page.evaluate((seconds) => window.__rig.sample(seconds), AUTO_SECONDS);

  runs.push({
    rate,
    hover: {
      t95: timeToTarget(hover, motion.hoverSpeed),
      speed: windowSpeed(hover),
      angleAtOneSecond: valueAt(hover, 'angle', 1000) - hover[0].angle,
      frames: hover.length,
    },
    drag: {
      peak: Math.max(...drag.peaks),
      lastPeak: drag.peaks[drag.peaks.length - 1],
      flicks: drag.flicks - flicksBefore,
      angle: drag.angle,
    },
    auto: { speed: windowSpeed(auto), frames: auto.length },
  });
  const run = runs[runs.length - 1];
  console.log(`  ${rate} Hz  t95 ${(run.hover.t95 / 1000).toFixed(3)} s  `
    + `Hover ${run.hover.speed.toFixed(4)} rad/s  `
    + `Peak ${run.drag.lastPeak.toFixed(2)} rad/s  `
    + `Auto ${run.auto.speed.toFixed(4)} rad/s  (${run.hover.frames} Frames)`);
  await context.close();
}

const hoverSpeeds = runs.map((run) => run.hover.speed);
const hoverTimes = runs.map((run) => run.hover.t95 / 1000);
const hoverAngles = runs.map((run) => run.hover.angleAtOneSecond);
const autoSpeeds = runs.map((run) => run.auto.speed);
const peaks = runs.map((run) => run.drag.lastPeak);

assert.ok(runs.every((run) => run.drag.flicks === 1), `Every rate must fire exactly one flick per gesture (${runs.map((run) => run.drag.flicks)}).`);
assert.ok(runs.every((run) => Math.abs(run.drag.lastPeak - DRAG_SPEED * motion.dragSensitivity) < 0.05 * DRAG_SPEED * motion.dragSensitivity),
  `The drag velocity is a speed in rad/s, independent of the input rate (${peaks.join(', ')}).`);
assert.ok(relate(peaks) < 0.05, `Flick peak spread stays under 5 % (${(relate(peaks) * 100).toFixed(2)} %).`);

// Der Start der Rampe liegt eine Frame-Quantisierung nach dem Ereignis
// (33 ms bei 30 Hz, 7 ms bei 144 Hz) — das ist Aufloesung, nicht Drift.
assert.ok(relate(hoverTimes) < 0.05, `Time to hover speed differs by less than 5 % across rates (${hoverTimes.map((value) => value.toFixed(3)).join(' / ')} s).`);
assert.ok(relate(hoverSpeeds) < 0.05, `Hover speed differs by less than 5 % across rates (${hoverSpeeds.map((value) => value.toFixed(4)).join(' / ')}).`);
assert.ok(relate(hoverAngles) < 0.05, `Angle after one second differs by less than 5 % across rates (${hoverAngles.map((value) => value.toFixed(3)).join(' / ')}).`);
assert.ok(relate(autoSpeeds) < 0.05, `Auto speed differs by less than 5 % across rates (${autoSpeeds.map((value) => value.toFixed(4)).join(' / ')}).`);
assert.ok(Math.abs(autoSpeeds[0] - motion.autoSpeed) < 0.05 * motion.autoSpeed, `Auto rotation runs at ${motion.autoSpeed} rad/s (${autoSpeeds[0].toFixed(4)}).`);
assert.ok(Math.abs(hoverSpeeds[0] - motion.hoverSpeed) < 0.05 * motion.hoverSpeed, `Hover rotation reaches ${motion.hoverSpeed} rad/s (${hoverSpeeds[0].toFixed(4)}).`);
assert.deepEqual(errors, [], 'no console errors during the framerate measurements');

const spread = {
  hoverTimePercent: relate(hoverTimes) * 100,
  hoverSpeedPercent: relate(hoverSpeeds) * 100,
  hoverAnglePercent: relate(hoverAngles) * 100,
  autoSpeedPercent: relate(autoSpeeds) * 100,
  flickPeakPercent: relate(peaks) * 100,
};
await writeFile(new URL('m4f-framerate.json', evidence), `${JSON.stringify({
  measuredAt: new Date().toISOString(),
  referenceFrameRate: motion.referenceFrameRate,
  dragSpeedPxPerSecond: DRAG_SPEED,
  note: 'Pro Framerate eine eigene Seite mit festem virtuellem rAF-Takt; Ereignisse am Frameanfang.',
  motion,
  runs,
  spread,
}, null, 2)}\n`);

console.log(`PASS mannequin framerate: ${RATES.join('/')} Hz, spread < 5 % (`
  + `t95 ${spread.hoverTimePercent.toFixed(2)} %, Winkel/s ${spread.hoverAnglePercent.toFixed(2)} %, `
  + `Hover ${spread.hoverSpeedPercent.toFixed(2)} %, Auto ${spread.autoSpeedPercent.toFixed(2)} %, `
  + `Flick-Peak ${spread.flickPeakPercent.toFixed(2)} %).`);

await browser.close();
server.close();
