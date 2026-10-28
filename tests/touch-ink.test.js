import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchInkSampler } from '../src/touch-ink.js';
import { easterSettings } from '../src/data/easterSettings.js';

const point = patch => ({ id: 7, x: 120, y: 400, scrollX: 0, scrollY: 30, time: 0, ...patch });

test('a sparse mobile trace starts after real travel, not a stationary hold or tap', () => {
  const sampler = createTouchInkSampler();
  assert.equal(sampler.begin(point()), true);
  assert.equal(sampler.sample(point({ time: 2000 })), null);
  assert.equal(sampler.sample(point({ x: 130, time: 2100 })), null);
  const result = sampler.sample(point({ x: 140, time: 2120 }));
  assert.deepEqual(result, { id: 7, clientX: 140, clientY: 400, scrollX: 0, scrollY: 30, x: 140, y: 430, time: 2120 });
});

test('native panning still stamps when client and scroll travel cancel in document space', () => {
  const sampler = createTouchInkSampler();
  sampler.begin(point());
  const result = sampler.sample(point({ y: 360, scrollY: 70, time: 40 }));
  assert.equal(result.y, 430, 'Actual finger document position, not a fabricated trail offset.');
  assert.equal(result.clientY, 360);
  assert.equal(sampler.snapshot().accepted, 1);
});

test('stationary live fingers may stamp as actual page content scrolls beneath them', () => {
  const sampler = createTouchInkSampler();
  sampler.begin(point());
  const result = sampler.sample(point({ scrollY: 70, time: 40 }));
  assert.equal(result.clientY, 400);
  assert.equal(result.y, 470);
  sampler.end(7);
  assert.equal(sampler.sample(point({ scrollY: 120, time: 300 })), null, 'Post-lift inertia cannot emit ink.');
});

test('fast input is bounded by both emission interval and travel, without timers', () => {
  const sampler = createTouchInkSampler();
  sampler.begin(point());
  let count = 0;
  let last;
  for (let time = 1; time <= 1000; time++) {
    const result = sampler.sample(point({ x: 120 + time, time }));
    if (result) { count++; last = result; }
  }
  assert.equal(count, 6);
  assert.equal(sampler.sample(point({ x: last.clientX, time: 3000 })), null, 'Time alone never refreshes a mark.');
});

test('foreign fingers, invalid coordinates and stale timestamps cannot corrupt a trace', () => {
  const sampler = createTouchInkSampler();
  sampler.begin(point({ time: 100 }));
  assert.equal(sampler.sample(point({ id: 8, x: 200, time: 150 })), null);
  assert.equal(sampler.sample(point({ x: Infinity, time: 150 })), null);
  assert.equal(sampler.sample(point({ x: 200, time: 99 })), null);
  assert.equal(sampler.sample(point({ x: 200, time: 160 })).x, 200);
  sampler.end(8);
  assert.equal(sampler.snapshot().active, true);
  sampler.end();
  assert.equal(sampler.snapshot().active, false);
});

test('a new finger starts an independent path with no bridge from its predecessor', () => {
  const sampler = createTouchInkSampler();
  sampler.begin(point());
  sampler.sample(point({ x: 200, time: 40 }));
  sampler.begin(point({ id: 8, x: 20, y: 50, time: 500 }));
  assert.equal(sampler.sample(point({ id: 8, x: 20, y: 50, time: 600 })), null);
  assert.equal(sampler.sample(point({ id: 8, x: 40, y: 50, time: 610 })).x, 40);
});

test('touch lifetime and palette are independent of the preserved desktop ink settings', () => {
  assert.equal(easterSettings.ink.touch.minimumLifetimeMs, 6000);
  assert.equal(easterSettings.ink.touch.maximumLifetimeMs, 10000);
  assert.equal(easterSettings.ink.touch.palette.length, 4);
  assert.equal(new Set(easterSettings.ink.touch.palette).size, 4);
  assert.equal(easterSettings.ink.maximumLifetimeMs, 12000);
  assert.equal(easterSettings.ink.maximumMarks, 12);
});
