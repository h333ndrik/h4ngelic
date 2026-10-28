import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaygroundField } from '../src/dev/playground-field.js';
import { playgroundSettings } from '../src/data/playgroundSettings.js';
import { getLivingDecaySettings } from '../src/data/livingDecaySettings.js';

test('experimental feedback samples its previous output, including reconstruction, rather than a pristine source', () => {
  const history = { width: 64, height: 32 };
  const output = { width: 64, height: 32 };
  const reads = [];
  const context = { canvas: output, drawImage(source) { reads.push(source); } };
  const historyContext = { drawImage(source) { assert.equal(source, output); } };
  const field = createPlaygroundField({ width: 64, height: 32 });
  field.impulse({ kind: 'click', x: 32, y: 16, dx: 40, dy: 12, strength: 2, radius: 200, time: 0 });
  const first = field.paint({ context, history, historyContext, time: 0 });
  assert.ok(first.advected > 0);
  assert.ok(first.recovered > 0);
  assert.ok(reads.length > 4);
  assert.ok(reads.every(source => source === history), 'Every reconstruction and displaced read uses the last damaged frame.');
  const before = field.snapshot().memory;
  for (let frame = 1; frame <= 480; frame++) field.paint({ context, history, historyContext, time: frame * 125 });
  const after = field.snapshot().memory;
  assert.equal(after.scarredCells, before.scarredCells, 'Idle evolution cannot create new pointer scars.');
  assert.equal(after.cells, before.cells);
  assert.ok(reads.every(source => source === history), 'A full minute cannot introduce a pristine source read.');
  field.dispose();
});

test('experimental resources are bounded after prolonged repeated input and do not modify global settings', () => {
  const settings = getLivingDecaySettings();
  const field = createPlaygroundField({ width: 999999, height: 999999, seed: 42 });
  let maximumCells = 0;
  for (let index = 0; index < 10000; index++) {
    field.impulse({ kind: index % 2 ? 'click' : 'navigation', x: index % 480, y: index % 300,
      dx: 100000, dy: -100000, strength: 100, radius: 100000, time: index * 125 });
    if (index % 10 === 0) {
      const cells = field.step(index * 125);
      maximumCells = Math.max(maximumCells, cells.length);
      assert.ok(cells.every(cell => Math.abs(cell.offsetX) <= 64 && Math.abs(cell.offsetY) <= 64));
    }
  }
  const state = field.snapshot();
  assert.equal(state.width, playgroundSettings.width);
  assert.equal(state.height, playgroundSettings.height);
  assert.equal(state.historyBuffers, 2);
  assert.ok(maximumCells <= playgroundSettings.maximumCells);
  assert.ok(state.memory.cells <= playgroundSettings.maximumCells);
  assert.equal(getLivingDecaySettings(), settings, 'No public setting or palette object was replaced.');
  field.dispose();
});

test('seed and recorded inputs reproduce exact macroblock output, including ongoing idle evolution', () => {
  const left = createPlaygroundField({ seed: 812 });
  const right = createPlaygroundField({ seed: 812 });
  const other = createPlaygroundField({ seed: 813 });
  let movedWhileIdle = false;
  for (let frame = 0; frame < 80; frame++) {
    const inputs = { x: 100 + frame, y: 125, time: frame * 125 };
    if (frame < 6) { left.pointer(inputs); right.pointer(inputs); other.pointer(inputs); }
    const a = left.step(inputs.time), b = right.step(inputs.time), c = other.step(inputs.time);
    assert.deepEqual(a, b);
    if (frame > 50 && a.some(cell => cell.offsetY !== 0)) movedWhileIdle = true;
    if (frame === 70) assert.notDeepEqual(a, c);
  }
  assert.equal(movedWhileIdle, true, 'Slow regional flow continues after a pointer has stopped.');
  left.dispose(); right.dispose(); other.dispose();
});

test('invalid inputs are ignored, suspension drops the stale pointer and disposal cannot schedule or mutate', () => {
  const field = createPlaygroundField();
  assert.equal(field.pointer({ x: 10, y: 10, time: 0 }), false);
  assert.equal(field.pointer({ x: 20, y: 10, time: 20 }), true);
  field.suspend();
  assert.equal(field.pointer({ x: 100, y: 100, time: 200 }), false, 'Resume cannot fling from a stale point.');
  assert.equal(field.impulse({ x: 0, y: 0, dx: NaN, dy: 1 }), false);
  const accepted = field.snapshot().memory.accepted;
  field.dispose();
  assert.equal(field.impulse({ x: 10, y: 10, dx: 10, dy: 2, time: 220 }), false);
  assert.deepEqual(field.step(300), []);
  assert.equal(field.snapshot().memory.accepted, accepted);
  assert.equal(field.snapshot().disposed, true);
});
