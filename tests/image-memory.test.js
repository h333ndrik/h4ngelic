import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageMemoryField, paintImageMemory } from '../src/image-memory.js';

// An independent nearest-neighbour Canvas2D oracle. It implements image copy
// and alpha composition, not the production field/displacement formulas.
function bitmap(width, height, color = () => [0, 0, 0, 255]) {
  const canvas = { width, height, data: Array.from({ length: width * height }, (_, index) => color(index % width, Math.floor(index / width))) };
  const context = { canvas, globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', reads: [],
    drawImage(source, ...args) {
      let sx = 0, sy = 0, sw = source.width, sh = source.height, dx = 0, dy = 0, dw = sw, dh = sh;
      if (args.length === 2) [dx, dy] = args;
      else if (args.length === 4) [dx, dy, dw, dh] = args;
      else [sx, sy, sw, sh, dx, dy, dw, dh] = args;
      assert.ok([sx, sy, sw, sh, dx, dy, dw, dh, this.globalAlpha].every(Number.isFinite));
      assert.ok(sw > 0 && sh > 0 && dw > 0 && dh > 0);
      this.reads.push({ source, sx, sy, sw, sh });
      const sourcePixels = source.data.map(pixel => [...pixel]);
      for (let y = Math.max(0, Math.ceil(dy)); y < Math.min(canvas.height, Math.ceil(dy + dh)); y++) {
        for (let x = Math.max(0, Math.ceil(dx)); x < Math.min(canvas.width, Math.ceil(dx + dw)); x++) {
          const px = Math.min(source.width - 1, Math.max(0, Math.floor(sx + (x - dx) / dw * sw)));
          const py = Math.min(source.height - 1, Math.max(0, Math.floor(sy + (y - dy) / dh * sh)));
          const incoming = sourcePixels[py * source.width + px];
          const previous = canvas.data[y * canvas.width + x];
          const alpha = incoming[3] / 255 * this.globalAlpha;
          if (this.globalCompositeOperation === 'copy') canvas.data[y * canvas.width + x] = incoming.slice(0, 3).concat(alpha * 255);
          else canvas.data[y * canvas.width + x] = [0, 1, 2].map(channel => incoming[channel] * alpha + previous[channel] * (1 - alpha)).concat(255);
        }
      }
    },
  };
  return { canvas, context };
}

function bars(width = 64, height = 8) {
  return bitmap(width, height, x => x >= 8 && x < 16 ? [240, 5, 0, 255] : [5, 12, 25, 255]);
}

function cells(width, height, offsetX = 0, recovery = 0) {
  return Array.from({ length: width / 8 }, (_, index) => ({ x: index * 8, y: 0, width: 8, height,
    offsetX, offsetY: 0, energy: 1, recovery, bleed: 0, negative: 0 }));
}

function redCenter(canvas) {
  let weighted = 0, total = 0;
  for (let x = 0; x < canvas.width; x++) {
    const pixel = canvas.data[x];
    const red = Math.max(0, pixel[0] - pixel[2] - 20);
    weighted += (x + .5) * red; total += red;
  }
  assert.ok(total > 100, 'The previous red source must remain present.');
  return weighted / total;
}

test('a new source cannot erase previous-output colors, and successive movement carries the survivors again', () => {
  const history = bars();
  const output = bitmap(64, 8);
  const sourceB = bitmap(64, 8, () => [0, 0, 245, 255]);
  const paint = (offset, recovery = .015) => paintImageMemory({ context: output.context, history: history.canvas,
    historyContext: history.context, source: sourceB.canvas, width: 64, height: 8, cells: cells(64, 8, offset, recovery) });
  const original = redCenter(history.canvas);
  paint(8);
  assert.ok(Math.abs(redCenter(output.canvas) - (original + 8)) < .01,
    'The first move transports old red image information through the new blue source.');
  paint(8);
  assert.ok(Math.abs(redCenter(output.canvas) - (original + 16)) < .01,
    'The second move must use the previous rendered result, rather than the old source or clean blue image.');
  paint(-8);
  assert.ok(Math.abs(redCenter(output.canvas) - (original + 8)) < .01,
    'Reversal moves the already-displaced survivors back immediately.');
  const survivingRed = output.canvas.data[20];
  assert.ok(survivingRed[0] > 220 && survivingRed[2] > 0 && survivingRed[2] < 20,
    'Old color persists while a small amount of current source data reconstructs.');
  assert.deepEqual(history.canvas.data, output.canvas.data, 'The displayed output becomes the next complete history.');
});

test('zero-motion identity with reconstruction disabled preserves every prior output byte', () => {
  const history = bars();
  const expected = history.canvas.data.map(pixel => [...pixel]);
  const output = bitmap(64, 8);
  const sourceB = bitmap(64, 8, () => [0, 245, 20, 255]);
  const result = paintImageMemory({ context: output.context, history: history.canvas, historyContext: history.context,
    source: sourceB.canvas, width: 64, height: 8, cells: cells(64, 8) });
  assert.deepEqual(output.canvas.data, expected);
  assert.deepEqual(history.canvas.data, expected);
  assert.deepEqual(result, { advected: 0, recovered: 0 });
});

test('selective reconstruction admits the new source without wholesale repainting untouched cells', () => {
  const history = bars();
  const output = bitmap(64, 8);
  const sourceB = bitmap(64, 8, () => [0, 200, 245, 255]);
  const regions = cells(64, 8);
  regions[1].recovery = .2;
  paintImageMemory({ context: output.context, history: history.canvas, historyContext: history.context,
    source: sourceB.canvas, width: 64, height: 8, cells: regions });
  assert.deepEqual(output.canvas.data[0], [5, 12, 25, 255], 'An untouched cell keeps its old image exactly.');
  assert.deepEqual(output.canvas.data[10], [192, 44, 49, 255], 'Only the selected old red region reconstructs from the new source.');
});

test('actual signed input vectors survive immediate horizontal and vertical reversal', () => {
  const field = createImageMemoryField({ width: 120, height: 80, cellSize: 12, seed: 812 });
  const inject = (dx, dy, time) => field.impulse({ kind: 'cursor', x: 60, y: 40, dx, dy, deltaMs: 60,
    radius: 100, strength: 3, time });
  inject(30, 18, 0);
  const forward = field.step({ time: 0, deltaMs: 40, colorBleeding: 0, negativeExposure: 0 });
  assert.ok(forward.some(cell => cell.offsetX > 0 && cell.offsetY > 0));
  inject(-30, -18, 50);
  const reverse = field.step({ time: 50, deltaMs: 40, colorBleeding: 0, negativeExposure: 0 });
  assert.ok(reverse.some(cell => cell.offsetX < 0 && cell.offsetY < 0));
  assert.equal(field.snapshot().byKind.cursor, 2);
  assert.equal(field.snapshot().accepted, 2);
});

test('stable cells retain heterogeneous recovery without inventing motion while the pointer rests', () => {
  const field = createImageMemoryField({ width: 200, height: 100, cellSize: 12, seed: 1958 });
  field.impulse({ kind: 'hover-motion', x: 100, y: 50, dx: 0, dy: 0, deltaMs: 50, strength: 1, radius: 200, time: 0 });
  const first = field.step({ time: 20, deltaMs: 40 });
  const second = field.step({ time: 10000, deltaMs: 40 });
  assert.ok(first.every(cell => cell.offsetX === 0 && cell.offsetY === 0));
  assert.ok(second.every(cell => cell.offsetX === 0 && cell.offsetY === 0));
  assert.deepEqual(first.map(cell => [cell.x, cell.y, cell.width, cell.height]), second.map(cell => [cell.x, cell.y, cell.width, cell.height]),
    'Stable macroblock addresses do not rehash across time.');
  assert.ok(new Set(second.map(cell => cell.recovery.toFixed(8))).size > 20,
    'Recovery is spatially varied instead of a single global fade.');
  assert.ok(second.every(cell => cell.recovery > 0 && cell.recovery < .3));
});

test('bounded cells and sample time prevent oversized buffers and explosive stale-frame displacement', () => {
  const field = createImageMemoryField({ width: 1120, height: 800, cellSize: 6, maxCells: 600, seed: 7 });
  assert.ok(field.snapshot().cells <= 600);
  field.impulse({ kind: 'logo', x: 560, y: 400, dx: 1e6, dy: -1e6, deltaMs: .001, strength: 100, radius: 1e6, time: 0 });
  const frame = field.step({ time: 1e6, deltaMs: 1e6, displacement: 100 });
  assert.ok(frame.every(cell => [cell.x, cell.y, cell.width, cell.height, cell.offsetX, cell.offsetY, cell.recovery].every(Number.isFinite)));
  assert.ok(frame.every(cell => Math.abs(cell.offsetX) <= 64 && Math.abs(cell.offsetY) <= 64));
  field.clear();
  const stopped = field.step({ time: 1e6 + 40, deltaMs: 40 });
  assert.ok(stopped.every(cell => cell.offsetX === 0 && cell.offsetY === 0));
  assert.equal(field.snapshot().energy, 0);
});
