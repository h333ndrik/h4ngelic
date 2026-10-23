import test from 'node:test';
import assert from 'node:assert/strict';
import { xraySettings, chooseXRayQuality, isXRayShortcut, solarizedChannels } from '../src/data/xraySettings.js';

test('solarization has exact identity endpoints and non-monotonic false-color curves', () => {
  const neutral = solarizedChannels(0);
  const altered = solarizedChannels(1);
  for (const channel of ['red', 'green', 'blue']) {
    assert.deepEqual(neutral[channel], xraySettings.channels[channel].map((_, index, samples) => index / (samples.length - 1)));
    assert.deepEqual(altered[channel], xraySettings.channels[channel]);
    assert.ok(altered[channel].some((value, index) => index > 0 && value < altered[channel][index - 1]), 'A solarized curve must contain tonal reversals.');
    assert.ok(altered[channel].every((value) => value >= 0 && value <= 1));
  }
  assert.notDeepEqual(altered.red, altered.green, 'False color must not collapse into a monochrome negative.');
});

test('solarization interpolation reverses without accumulating image changes', () => {
  for (const amount of [0, .25, .5, .75, 1, .75, .5, .25, 0]) {
    const first = solarizedChannels(amount);
    const second = solarizedChannels(amount);
    assert.deepEqual(first, second);
  }
  assert.deepEqual(solarizedChannels(-5), solarizedChannels(0));
  assert.deepEqual(solarizedChannels(4), solarizedChannels(1));
  assert.deepEqual(solarizedChannels(Number.NaN), solarizedChannels(0));
});

test('keyboard shortcut supports both 4 keys while preserving typing, repeats and composition', () => {
  const event = { key: '4', code: 'Digit4' };
  assert.equal(isXRayShortcut(event), true);
  assert.equal(isXRayShortcut({ ...event, code: 'Numpad4' }), true);
  assert.equal(isXRayShortcut({ code: 'Numpad4' }), true);
  assert.equal(isXRayShortcut({ key: 'ArrowLeft', code: 'Numpad4' }), true, 'Numpad4 remains the explicit shortcut with Num Lock off.');
  assert.equal(isXRayShortcut({ key: 'ArrowLeft', code: 'ArrowLeft' }), false, 'An ordinary arrow key remains unchanged.');
  for (const flag of ['repeat', 'isComposing', 'defaultPrevented', 'ctrlKey', 'altKey', 'metaKey', 'shiftKey']) assert.equal(isXRayShortcut({ ...event, [flag]: true }), false, flag);
  const input = { closest: () => ({}) };
  assert.equal(isXRayShortcut({ ...event, target: input }), false);
  assert.equal(isXRayShortcut(event, input), false);
  assert.equal(isXRayShortcut({ ...event, composedPath: () => [{}, { isContentEditable: true }] }), false, 'A shadow-DOM editor must retain its typing keys.');
});

test('X-Ray quality fallback follows device and connection hints', () => {
  assert.equal(chooseXRayQuality({}), 'full');
  assert.equal(chooseXRayQuality({ coarsePointer: true, memory: 8, cores: 8 }), 'lite');
  assert.equal(chooseXRayQuality({ memory: 4, cores: 12 }), 'lite');
  assert.equal(chooseXRayQuality({ memory: 8, cores: 4 }), 'lite');
  assert.equal(chooseXRayQuality({ saveData: true }), 'lite');
  assert.equal(chooseXRayQuality({ memory: 0, cores: 0 }), 'full', 'Unavailable hints do not fabricate a constrained device.');
});
