import test from 'node:test';
import assert from 'node:assert/strict';
import { livingDecayDefaults, livingDecaySchema, createLivingDecaySettings, getLivingDecaySettings,
  configureLivingDecay, subscribeLivingDecay, normalizeLivingSeed } from '../src/data/livingDecaySettings.js';
import { createLivingComposition, sampleLivingField, createLivingField, renderLivingMaterial, livingRegion, livingCodecFragment,
  livingNoise } from '../src/living-decay-material.js';

test('mode and frozen-memory handoff share the 1.4 second target without lengthening local gestures', () => {
  assert.equal(livingDecayDefaults.modeTransitionMs, 1400);
  assert.equal(createLivingDecaySettings({ modeTransitionMs: 1400 }).modeTransitionMs, 1400);
  assert.equal(createLivingDecaySettings({ modeTransitionMs: Infinity }).modeTransitionMs, 1400);
  assert.equal(createLivingDecaySettings({ modeTransitionMs: 9999 }).modeTransitionMs, 1600);
  assert.equal(livingDecayDefaults.navigationTransitionMs, 340);
});

test('living controls are bounded immutable replacements with stable frame reads', () => {
  const original = getLivingDecaySettings();
  const notices = [];
  const unsubscribe = subscribeLivingDecay((settings, detail) => notices.push({ settings, detail }));
  const next = configureLivingDecay({ cursorRadius: 800, feedbackPersistence: Infinity, idleIntensity: '0.72', unknown: 2 });
  assert.notEqual(next, original);
  assert.equal(next.cursorRadius, 45);
  assert.equal(next.idleIntensity, .72);
  assert.equal(next.feedbackPersistence, original.feedbackPersistence);
  assert.equal(next.unknown, undefined);
  assert.equal(getLivingDecaySettings(), next);
  assert.equal(configureLivingDecay({ cursorRadius: 45 }), next);
  assert.equal(notices.length, 1);
  assert.deepEqual(notices[0].detail.changed.sort(), ['cursorRadius', 'idleIntensity']);
  assert.ok(Object.isFrozen(livingDecayDefaults) && Object.isFrozen(next));
  assert.equal(livingDecayDefaults.cursorRadius, 35);
  unsubscribe();
  configureLivingDecay(original);
  assert.equal(notices.length, 1);
  assert.deepEqual(Object.keys(livingDecaySchema), Object.keys(livingDecayDefaults));
});

test('manual seeds reproduce composition and every seed controls material identity', () => {
  assert.equal(normalizeLivingSeed('12345'), 12345);
  assert.equal(normalizeLivingSeed('negative-organism'), normalizeLivingSeed('negative-organism'));
  assert.notEqual(normalizeLivingSeed('negative-organism'), normalizeLivingSeed('negative-organism-2'));
  assert.equal(normalizeLivingSeed(NaN, 21), 21);
  assert.equal(createLivingDecaySettings({ seed: null }).seed, null);
  assert.equal(createLivingDecaySettings({ seed: 0 }).seed, 0);
  const first = createLivingComposition(123);
  assert.equal(first.controls.seed, 123);
  assert.deepEqual(first, createLivingComposition(123));
  const second = createLivingComposition(124);
  for (const key of ['source', 'flow', 'tint', 'field']) assert.notDeepEqual(first[key], second[key]);
});

test('continuous material fields have substantial density variation and no cell discontinuities', () => {
  const composition = createLivingComposition(6831);
  const samples = [];
  for (let y = 0; y <= 1; y += .04) for (let x = 0; x <= 1; x += .04) samples.push(sampleLivingField(composition, x, y));
  const voids = samples.map(sample => sample.void);
  assert.ok(Math.max(...voids) - Math.min(...voids) > .5);
  assert.ok(samples.every(sample => Object.values(sample).every(Number.isFinite)));
  const before = livingNoise(36, .99999, 1.6); const after = livingNoise(36, 1.00001, 1.6);
  assert.ok(Math.abs(after - before) < .00001);
  assert.deepEqual(createLivingField(composition), createLivingField(composition));
  const neutral = sampleLivingField(composition, .4, .6, 0, createLivingDecaySettings({ voidCoverage: 0, bleachCoverage: 0 }));
  assert.equal(neutral.void, 0); assert.equal(neutral.bleach, 0);
  const moreVoid = createLivingDecaySettings({ voidCoverage: .7 });
  assert.ok(samples.every((sample, index) => {
    const x = (index % 25) * .04; const y = Math.floor(index / 25) * .04;
    return sampleLivingField(composition, x, y, 0, moreVoid).void >= sample.void - 1e-6;
  }));
});

test('source synthesis is reproducible, opaque and visibly different across seeds', () => {
  const source = new Uint8ClampedArray(32 * 24 * 4);
  for (let i = 0; i < source.length; i += 4) {
    source[i] = (i / 4 % 32) * 8; source[i + 1] = Math.floor(i / 128) * 10;
    source[i + 2] = (i / 4 % 7) * 35; source[i + 3] = 255;
  }
  const render = seed => renderLivingMaterial({ source, sourceWidth: 32, sourceHeight: 24,
    width: 64, height: 40, composition: createLivingComposition(seed) });
  const first = render(91);
  assert.deepEqual(first, render(91));
  const second = render(92);
  let changed = 0;
  for (let index = 0; index < first.length; index += 4) {
    assert.equal(first[index + 3], 255);
    if (Math.abs(first[index] - second[index]) + Math.abs(first[index + 1] - second[index + 1])
      + Math.abs(first[index + 2] - second[index + 2]) > 30) changed++;
  }
  assert.ok(changed > 64 * 40 * .6);
});

test('idle movement uses independent stable regions and honors zero intensity', () => {
  const composition = createLivingComposition(771);
  const first = livingRegion(composition, 0, 6);
  const second = livingRegion(composition, 1, 6);
  assert.deepEqual(first, livingRegion(composition, 0, 6));
  assert.notEqual(first.dx, second.dx);
  assert.notEqual(first.dy, second.dy);
  assert.notDeepEqual(first, livingRegion(composition, 0, 9));
  const stopped = livingRegion(composition, 0, 9, createLivingDecaySettings({ idleIntensity: 0 }));
  assert.equal(stopped.dx, 0); assert.equal(stopped.dy, 0); assert.equal(stopped.opacity, 0);
});

test('codec remnants vary scale and direction without changing image-space', () => {
  const composition = createLivingComposition(293);
  const fragments = Array.from({ length: 120 }, (_, index) => livingCodecFragment(composition, index));
  assert.deepEqual(fragments[0], livingCodecFragment(composition, 0));
  assert.ok(fragments.some(fragment => fragment.width > .1 && fragment.height < .015));
  assert.ok(fragments.some(fragment => fragment.width < .04 && fragment.height > .015));
  assert.ok(fragments.some(fragment => fragment.dx < 0) && fragments.some(fragment => fragment.dx > 0));
  assert.ok(fragments.every(fragment => fragment.x >= 0 && fragment.x <= 1 && fragment.opacity >= 0 && fragment.opacity <= 1));
});
