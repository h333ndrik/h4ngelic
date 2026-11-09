import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createPointerWindow } from '../src/mannequin-pointer-window.js';
import { mannequinPreviewConfig } from '../src/mannequin-preview-config.js';

/**
 * M4i: Messreihe fuer Fensterlaenge und Stillstands-Regel.
 *
 * Gemessen wird die echte Funktion aus src/mannequin-pointer-window.js, die der
 * Viewer benutzt — nicht ein Nachbau. Gesten: konstante Zeigergeschwindigkeit,
 * Ereignisse alle 8 ms (125 Hz), optional Stillstand bis zum Loslassen.
 *
 * Abnahmeregel (vorab festgelegt):
 * (a) schneller und langsamer Wisch loesen einen Flick aus,
 * (b) Stillstand >= 150 ms vor dem Loslassen loest keinen Flick aus,
 * (c) kein Doppel-Trigger pro Geste.
 *
 * Aufteilung seit dieser Messung: `pointerWindowMs` glaettet die Messung,
 * `pointerStopMs` entscheidet ueber Stillstand. Mit nur einem Wert haette bei
 * 10 fps (ein Ereignis pro Frame) jedes Loslassen als Stillstand gegolten.
 */
const motion = mannequinPreviewConfig.motion;
const { dragSensitivity, dragVelocityLimit, flickVelocity } = motion;
const MIN_DELTA = 1 / 2000;
const EVENT_MS = 8;
const SHOOT_MS = motion.shoot.outMs + motion.shoot.holdMs + motion.shoot.backMs;
const WINDOWS = [70, 100, 150];

function trace(speed, moveMs, holdMs) {
  const events = [];
  for (let t = 0; t <= moveMs; t += EVENT_MS) events.push({ t, x: (speed * t) / 1000 });
  return { events, releaseAt: moveMs + holdMs };
}

/** Ein einzelner Ausreisser mitten in einer ruhigen Bewegung. */
function spikeTrace(speed, moveMs, spikeAt, spikePx) {
  const events = [];
  let x = 0;
  for (let t = 0; t <= moveMs; t += EVENT_MS) {
    x += (speed * EVENT_MS) / 1000;
    if (t === spikeAt) x += spikePx;
    events.push({ t, x });
  }
  return { events, releaseAt: moveMs };
}

const GESTURES = {
  'schnell 900 px/s': trace(900, 200, 0),
  'langsam 380 px/s': trace(380, 400, 0),
  '+60 ms Stillstand': trace(900, 200, 60),
  '+100 ms Stillstand': trace(900, 200, 100),
  '+150 ms Stillstand': trace(900, 200, 150),
  '+200 ms Stillstand': trace(900, 200, 200),
  'Ausreisser +60 px': spikeTrace(400, 400, 200, 60),
};

function measure(windowMs, gesture) {
  const win = createPointerWindow({
    windowMs,
    stopMs: motion.pointerStopMs,
    sensitivity: dragSensitivity,
    limit: dragVelocityLimit,
    minDelta: MIN_DELTA,
  });
  win.reset(gesture.events[0]);
  const velocities = [];
  for (const event of gesture.events.slice(1)) {
    win.push(event);
    velocities.push(Math.abs(win.velocity(event.t)));
  }
  const release = win.velocity(gesture.releaseAt);
  const flicks = Math.abs(release) > flickVelocity;
  const sorted = [...velocities].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const peak = Math.max(...velocities);
  // Zeit bis die Auto-Rotation wieder traegt: nach einem Flick laeuft erst die
  // Shoot-Animation, dann ramp die Geschwindigkeit von 0 auf 0.18 rad/s.
  // Ohne Flick klingt die Restgeschwindigkeit ueber dieselbe Rampe ab.
  let elapsed = flicks ? SHOOT_MS : 0;
  let current = flicks ? 0 : release;
  const dt = 1 / 60;
  while (Math.abs(current - motion.autoSpeed) > 0.01 && elapsed < 20000) {
    const step = (motion.autoSpeed - current) * (1 - Math.exp(-motion.inertiaDamping * dt));
    const maxStep = motion.maxAngularAcceleration * dt;
    current += Math.min(maxStep, Math.max(-maxStep, step));
    elapsed += dt * 1000;
  }
  return {
    release: Number(release.toFixed(2)),
    peak: Number(peak.toFixed(2)),
    median: Number(median.toFixed(2)),
    flicks,
    backMs: Math.round(elapsed),
  };
}

const table = Object.fromEntries(WINDOWS.map((windowMs) => [
  windowMs,
  Object.fromEntries(Object.entries(GESTURES).map(([name, gesture]) => [name, measure(windowMs, gesture)])),
]));

test('every candidate window keeps the flick rules', () => {
  for (const windowMs of WINDOWS) {
    const rows = table[windowMs];
    assert.equal(rows['schnell 900 px/s'].flicks, true, `Schneller Wisch flickt bei ${windowMs} ms.`);
    assert.equal(rows['langsam 380 px/s'].flicks, true, `Langsamer Wisch flickt bei ${windowMs} ms.`);
    assert.equal(rows['+150 ms Stillstand'].flicks, false, `150 ms Stillstand flickt bei ${windowMs} ms nicht.`);
    assert.equal(rows['+200 ms Stillstand'].flicks, false);
    assert.equal(rows['+150 ms Stillstand'].release, 0, 'Nach dem Stillstand ist die Geschwindigkeit 0.');
  }
});

test('the shipped window is 100 ms with a 150 ms stop rule', () => {
  assert.equal(motion.pointerWindowMs, 100, 'Gewaehltes Fenster: 100 ms (siehe REPORT.md §M4i).');
  assert.equal(motion.pointerStopMs, 150, 'Stillstand ab 150 ms bricht den Flick ab.');
  const rows = table[motion.pointerWindowMs];
  assert.equal(rows['schnell 900 px/s'].release, 6.75);
  assert.equal(rows['langsam 380 px/s'].release, 2.85);
  // Kurze Loslass-Verzoegerung aendert die gemessene Geschwindigkeit nicht.
  assert.equal(rows['+60 ms Stillstand'].flicks, true);
  assert.equal(rows['+100 ms Stillstand'].flicks, true);
  assert.ok(rows['+60 ms Stillstand'].release > flickVelocity);
});

test('the window length only changes the smoothing, not the speed', () => {
  const spike = WINDOWS.map((windowMs) => table[windowMs]['Ausreisser +60 px']);
  assert.ok(spike[0].peak >= spike[1].peak && spike[1].peak >= spike[2].peak,
    `Ein Ausreisser wird mit laengerem Fenster kleiner (${spike.map((row) => row.peak).join(' / ')}).`);
  assert.equal(spike[2].release, spike[0].release, 'Die Grundgeschwindigkeit bleibt gleich.');
  for (const windowMs of WINDOWS) {
    assert.equal(table[windowMs]['schnell 900 px/s'].release, 6.75, 'Konstante Geschwindigkeit wird exakt gemessen.');
  }
});

test('velocity is a pure function of the samples (no double increment)', () => {
  const win = createPointerWindow({
    windowMs: 100, stopMs: motion.pointerStopMs,
    sensitivity: dragSensitivity, limit: dragVelocityLimit, minDelta: MIN_DELTA,
  });
  const gesture = GESTURES['schnell 900 px/s'];
  win.reset(gesture.events[0]);
  for (const event of gesture.events.slice(1)) win.push(event);
  const first = win.velocity(gesture.releaseAt);
  const second = win.velocity(gesture.releaseAt);
  assert.equal(first, second, 'Wiederholtes Abfragen aendert die Geschwindigkeit nicht.');
  assert.ok(win.size <= Math.ceil(motion.pointerWindowMs / EVENT_MS) + 2, `Der Puffer bleibt begrenzt (${win.size}).`);
});

// Evidence is written once and then left alone: the measurement itself is the
// proof, the timestamp is not. Rewriting it on every `npm test` dirtied the
// working tree and turned committed evidence into accidental noise.
const evidence = new URL('../docs/validation/MANNEQUIN-C/', import.meta.url);
await mkdir(evidence, { recursive: true });
const evidenceFile = new URL('m4i-pointer-window.json', evidence);
const payload = {
  eventIntervalMs: EVENT_MS,
  flickVelocity,
  chosen: { pointerWindowMs: motion.pointerWindowMs, pointerStopMs: motion.pointerStopMs },
  rule: ['schneller und langsamer Wisch flick', 'Stillstand >= 150 ms flick nicht', 'kein Doppel-Trigger'],
  table,
};
const existing = await readFile(evidenceFile, 'utf8').then(text => JSON.parse(text), () => null);
const unchanged = existing && JSON.stringify({ ...existing, measuredAt: undefined }) === JSON.stringify({ ...payload, measuredAt: undefined });
if (!unchanged) {
  await writeFile(evidenceFile, `${JSON.stringify({ measuredAt: new Date().toISOString(), ...payload }, null, 2)}\n`);
}
