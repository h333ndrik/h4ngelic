import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mannequinPreviewConfig } from '../src/mannequin-preview-config.js';

/**
 * Quelltext-Waechter fuer Framerate- (M4f) und Pointer-Audit (M4g). Die
 * Messreihen laufen in tests/mannequin-framerate-browser.mjs und
 * tests/mannequin-pointer-rate-browser.mjs; hier stehen nur die Konstanten und
 * die Integrationsform, damit ein Rueckfall (fester Faktor pro Frame oder pro
 * Pointer-Ereignis) sofort auffaellt.
 */
const motion = mannequinPreviewConfig.motion;
const source = await readFile(new URL('../src/mannequin-preview.js', import.meta.url), 'utf8');

test('motion uses per-second constants with a documented reference framerate', () => {
  assert.equal(motion.referenceFrameRate, 60);
  assert.equal(motion.autoSpeed, 0.18);
  assert.equal(motion.hoverSpeed, 0.55);
  assert.equal(motion.maxAngularAcceleration, 1.1);
  assert.equal(motion.inertiaDamping, 3.2);
  // Die Ziehgeschwindigkeit laeuft seit M4g ueber ein Zeitfenster von
  // 60-80 ms (rund vier Frames bei 60 Hz) statt ueber ein Ereignis.
  assert.ok(motion.pointerWindowMs >= 60 && motion.pointerWindowMs <= 80);
  assert.equal('dragVelocityFloor' in motion, false, 'Kein ereignisbasierter Boden mehr in der Config.');
  // 3.7125 /s entspricht bei 60 Hz exakt dem alten Faktor 0.94 pro Frame.
  assert.ok(Math.abs(motion.peakDecayPerSecond + Math.log(0.94) * 60) < 1e-3);
});

test('the render loop integrates with delta time instead of per-frame factors', () => {
  assert.match(source, /const MAX_FRAME_DELTA = 1 \/ 30;/, 'Der Frame-Delta ist benannt und begrenzt.');
  assert.match(source, /const delta = Math\.min\(Math\.max\(rawDelta, 0\), MAX_FRAME_DELTA\);/, 'Der Delta kommt aus dem rAF-Zeitstempel.');
  assert.match(source, /1 - Math\.exp\(-motion\.inertiaDamping \* delta\)/, 'Daempfung ist exponentiell pro Sekunde.');
  assert.match(source, /motion\.maxAngularAcceleration \* delta/, 'Die Beschleunigung skaliert mit der Framedauer.');
  assert.match(source, /view\.angle \+= \(previousVelocity \+ view\.velocity\) \* 0\.5 \* delta;/,
    'Der Winkel wird mit der Trapezregel integriert.');
  assert.match(source, /view\.peakVelocity \*= Math\.exp\(-motion\.peakDecayPerSecond \* delta\)/,
    'Der Flick-Peak zerfaellt pro Frame-Zeit, nicht pro Pointer-Ereignis.');
  assert.match(source, /function windowVelocity\(now\)/, 'Die Ziehgeschwindigkeit kommt aus dem Zeitfenster.');
  assert.match(source, /const MIN_POINTER_DELTA = 1 \/ 2000;/, 'Der Divisionsschutz ist benannt und klein genug.');
});

test('no fixed per-frame factors remain in the motion path', () => {
  assert.doesNotMatch(source, /\* 0\.94/, 'Kein 0.94 pro Ereignis mehr.');
  assert.doesNotMatch(source, /Math\.max\(0\.016/, 'Kein 16-ms-Boden mehr in der Ziehgeschwindigkeit.');
  assert.doesNotMatch(source, /Math\.max\(delta, 1 \/ 240\)/, 'Keine feste Delta-Untergrenze mehr.');
  assert.doesNotMatch(source, /\* 0\.05,/, 'Kein 50-ms-Clamp mehr (jetzt MAX_FRAME_DELTA).');
});

test('the pointer path is rate independent and bounds are cached', () => {
  assert.match(source, /typeof event\.getCoalescedEvents === 'function'/,
    'getCoalescedEvents wird per Feature-Detection benutzt, nicht angenommen.');
  assert.match(source, /pointerSamples\.push\(point\)/, 'Ereignispositionen landen im Ringpuffer.');
  assert.match(source, /Math\.max\(span, MIN_POINTER_DELTA\)/,
    'MIN_POINTER_DELTA dient nur als Divisionsschutz (keine Glaettung).');
  assert.doesNotMatch(source, /Math\.max\(motion\.dragVelocityFloor/, 'Kein ereignisbasierter Geschwindigkeitsboden mehr.');
  // applyShoot darf die Bounds nicht mehr aus dem Szenengraph bauen.
  const shoot = source.slice(source.indexOf('function applyShoot'), source.indexOf('function tick'));
  assert.doesNotMatch(shoot, /setFromObject/, 'applyShoot traversiert die Geometrie nicht mehr.');
  assert.match(shoot, /shootBounds\.copy\(modelBounds\)\.applyMatrix4\(pivot\.matrixWorld\)/,
    'applyShoot transformiert die gecachte Box.');
});
