import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorruptionField, sampleCorruptionBlock } from '../src/corruption-field.js';
import { corruptionSettings } from '../src/data/corruptionSettings.js';

function movingField(elapsed, options = {}) {
  const field = createCorruptionField(options);
  field.stroke({ x: 0, y: 0, time: 0 });
  field.stroke({ x: 100, y: 0, time: elapsed });
  return { field, sample: field.sample(elapsed).at(-1) };
}

test('faster movement creates stronger, wider and longer-lived image displacement', () => {
  const slow = movingField(100).sample;
  const fast = movingField(10).sample;
  assert.ok(fast.energy > slow.energy);
  assert.ok(fast.radiusX > slow.radiusX);
  assert.ok(Math.abs(fast.displacementX) > Math.abs(slow.displacementX));
  assert.ok(fast.smearLength > slow.smearLength);
  assert.ok(fast.expiresAt - fast.updatedAt > slow.expiresAt - slow.updatedAt);
  assert.ok(fast.blockSize > slow.blockSize);
});

test('extreme or zero-time pointer jumps have bounded finite velocity', () => {
  const field = createCorruptionField();
  field.stroke({ x: 0, y: 0, time: 0 });
  field.stroke({ x: 100_000, y: -100_000, time: 0 });
  const samples = field.sample(0);
  assert.ok(samples.every((sample) => Object.values(sample).every(Number.isFinite)));
  const latest = samples.at(-1);
  assert.ok(Math.hypot(latest.velocityX, latest.velocityY) <= corruptionSettings.field.maximumVelocity + 1e-12);
  assert.ok(latest.speed <= 1 + 1e-12);
});

test('damage stays anchored where created instead of following later cursor positions', () => {
  const field = createCorruptionField();
  field.stroke({ x: 30, y: 40, time: 0 });
  field.stroke({ x: 150, y: 70, time: 20 });
  field.stroke({ x: 300, y: 110, time: 40 });
  const early = field.sample(40);
  const later = field.sample(400);
  assert.deepEqual(later.map(({ x, y }) => [x, y]), [[30, 40], [150, 70], [300, 110]]);
  assert.ok(later.every((sample, index) => sample.energy < early[index].energy));
});

test('nearby high-frequency input coalesces without moving the original anchor', () => {
  const field = createCorruptionField();
  const id = field.stroke({ x: 50, y: 60, time: 0 });
  for (let index = 1; index <= 20; index++) {
    assert.equal(field.stroke({ x: 50 + index % 8, y: 60 - index % 6, time: index * 5 }), id);
  }
  assert.equal(field.size, 1);
  const [sample] = field.sample(100);
  assert.equal(sample.x, 50);
  assert.equal(sample.y, 60);
  assert.equal(sample.createdAt, 0);
  assert.equal(sample.updatedAt, 100);
});

test('sustained input respects the configured live impulse cap', () => {
  const field = createCorruptionField({ settings: { field: { maximumImpulses: 8 } } });
  for (let index = 0; index < 100; index++) field.stroke({ x: index * 50, y: 0, time: index });
  assert.equal(field.size, 8);
  const samples = field.sample(100);
  assert.equal(samples.length, 8);
  assert.deepEqual(samples.map(({ x }) => x), Array.from({ length: 8 }, (_, index) => (92 + index) * 50));
});

test('recovery decays monotonically and completely removes expired state', () => {
  const { field, sample } = movingField(20);
  const remaining = sample.expiresAt - sample.updatedAt;
  let previous = Infinity;
  for (let index = 0; index < 10; index++) {
    const current = field.sample(sample.updatedAt + remaining * index / 10).find(({ id }) => id === sample.id);
    assert.ok(current.energy <= previous);
    previous = current.energy;
  }
  assert.deepEqual(field.sample(sample.expiresAt), []);
  assert.equal(field.size, 0);
  assert.deepEqual(field.sample(0), [], 'Older frames cannot resurrect expired damage.');
});

test('a faster recovery setting shortens the finite recovery interval', () => {
  const standard = movingField(20).sample;
  const quick = movingField(20, { settings: { recoverySpeed: 2 } }).sample;
  assert.ok(quick.expiresAt - quick.updatedAt < standard.expiresAt - standard.updatedAt);
  const field = createCorruptionField({ settings: { pixelCorruption: 0 } });
  assert.equal(field.stroke({ x: 10, y: 10, time: 0 }), null);
  assert.equal(field.size, 0);
});

test('block sampling is reproducible and varies by cell and seed', () => {
  const first = movingField(20, { seed: 7 }).sample;
  const again = movingField(20, { seed: 7 }).sample;
  const different = movingField(20, { seed: 8 }).sample;
  const blocks = Array.from({ length: 8 }, (_, index) => sampleCorruptionBlock(first, index, 1));
  assert.deepEqual(blocks, Array.from({ length: 8 }, (_, index) => sampleCorruptionBlock(again, index, 1)));
  assert.notDeepEqual(blocks, Array.from({ length: 8 }, (_, index) => sampleCorruptionBlock(different, index, 1)));
  assert.equal(new Set(blocks.map((block) => JSON.stringify(block))).size, blocks.length);
  assert.ok(blocks.every((block) => Object.values(block).every(Number.isFinite) && block.opacity >= 0 && block.opacity <= 1));
});

test('invalid input and stale event timestamps do not poison live field state', () => {
  const field = createCorruptionField();
  field.stroke({ x: 10, y: 20, time: 100 });
  for (const input of [null, {}, { x: NaN, y: 0, time: 1 }, { x: 0, y: Infinity, time: 1 },
    { x: 0, y: 0, time: -1 }, { x: 0, y: 0, time: 99 }, { x: 1e99, y: 0, time: 200 }]) {
    assert.equal(field.stroke(input), null);
  }
  assert.deepEqual(field.sample(NaN), []);
  const snapshot = field.sample(100);
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].x, 10);
  snapshot[0].x = 99;
  assert.equal(field.sample(100)[0].x, 10, 'Renderer mutations cannot alter internal anchors.');
  assert.deepEqual(sampleCorruptionBlock(null, 0, 0), { offsetX: 0, offsetY: 0, smearLength: 0, channelShift: 0, opacity: 0 });
});

test('pointer reset preserves trails but prevents a new entry inheriting a teleport velocity', () => {
  const { field } = movingField(20);
  const count = field.size;
  field.resetPointer();
  field.stroke({ x: 900, y: 900, time: 25 });
  assert.equal(field.size, count + 1);
  assert.equal(field.sample(25).at(-1).speed, 0);
  field.clear();
  assert.equal(field.size, 0);
  assert.deepEqual(field.sample(1000), []);
});
