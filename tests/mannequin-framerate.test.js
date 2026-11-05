import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mannequinPreviewConfig } from '../src/mannequin-preview-config.js';

/**
 * Quelltext-Waechter fuer den Framerate-Audit (M4f). Die Messreihe selbst
 * laeuft in tests/mannequin-framerate-browser.mjs; hier stehen nur die
 * Konstanten und die Integrationsform, damit ein Rueckfall (fester Faktor pro
 * Frame) sofort auffaellt.
 */
const motion = mannequinPreviewConfig.motion;
const source = await readFile(new URL('../src/mannequin-preview.js', import.meta.url), 'utf8');

test('motion uses per-second constants with a documented reference framerate', () => {
  assert.equal(motion.referenceFrameRate, 60);
  assert.equal(motion.autoSpeed, 0.18);
  assert.equal(motion.hoverSpeed, 0.55);
  assert.equal(motion.maxAngularAcceleration, 1.1);
  assert.equal(motion.inertiaDamping, 3.2);
  assert.equal(motion.dragVelocityFloor, 1 / 240);
  // 3.7136 /s entspricht bei 60 Hz exakt dem alten Faktor 0.94 pro Ereignis.
  assert.ok(Math.abs(motion.peakDecayPerSecond + Math.log(0.94) * 60) < 1e-3);
});

test('the render loop integrates with delta time instead of per-frame factors', () => {
  assert.match(source, /const MAX_FRAME_DELTA = 1 \/ 30;/, 'Der Frame-Delta ist benannt und begrenzt.');
  assert.match(source, /const delta = Math\.min\(Math\.max\(rawDelta, 0\), MAX_FRAME_DELTA\);/, 'Der Delta kommt aus dem rAF-Zeitstempel.');
  assert.match(source, /1 - Math\.exp\(-motion\.inertiaDamping \* delta\)/, 'Daempfung ist exponentiell pro Sekunde.');
  assert.match(source, /motion\.maxAngularAcceleration \* delta/, 'Die Beschleunigung skaliert mit der Framedauer.');
  assert.match(source, /view\.angle \+= \(previousVelocity \+ view\.velocity\) \* 0\.5 \* delta;/,
    'Der Winkel wird mit der Trapezregel integriert.');
  assert.match(source, /Math\.exp\(-motion\.peakDecayPerSecond \* eventDelta\)/, 'Der Flick-Peak zerfaellt pro Sekunde.');
  assert.match(source, /Math\.max\(motion\.dragVelocityFloor, \(now - view\.lastInteraction\) \/ 1000\)/,
    'Die Ziehgeschwindigkeit teilt durch das echte Ereignisintervall.');
});

test('no fixed per-frame factors remain in the motion path', () => {
  assert.doesNotMatch(source, /\* 0\.94/, 'Kein 0.94 pro Ereignis mehr.');
  assert.doesNotMatch(source, /Math\.max\(0\.016/, 'Kein 16-ms-Boden mehr in der Ziehgeschwindigkeit.');
  assert.doesNotMatch(source, /Math\.max\(delta, 1 \/ 240\)/, 'Keine feste Delta-Untergrenze mehr.');
  assert.doesNotMatch(source, /\* 0\.05,/, 'Kein 50-ms-Clamp mehr (jetzt MAX_FRAME_DELTA).');
});
