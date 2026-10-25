import test from 'node:test';
import assert from 'node:assert/strict';
import { paintTemporalPixels } from '../src/temporal-mosh.js';
import { temporalMoshSettings } from '../src/data/temporalMoshSettings.js';

// Tiny Canvas2D image-copy oracle: pixels and alpha compose independently of
// the field's displacement formulas, with no browser, DOM, timer or fillRect.
function bitmap(width, height, color = () => [0, 0, 0, 0]) {
  const canvas = { width, height, data: Array.from({ length: width * height }, (_, index) => color(index % width, Math.floor(index / width))) };
  const context = { canvas, globalAlpha: 1, globalCompositeOperation: 'source-over', reads: [],
    clearRect() { canvas.data = canvas.data.map(() => [0, 0, 0, 0]); },
    drawImage(source, ...args) {
      let sx = 0, sy = 0, sw = source.width, sh = source.height, dx, dy, dw = sw, dh = sh;
      if (args.length === 2) [dx, dy] = args;
      else if (args.length === 4) [dx, dy, dw, dh] = args;
      else [sx, sy, sw, sh, dx, dy, dw, dh] = args;
      assert.ok([sx, sy, sw, sh, dx, dy, dw, dh, this.globalAlpha].every(Number.isFinite));
      this.reads.push({ source, sx, sy, sw, sh });
      for (let y = Math.max(0, Math.ceil(dy)); y < Math.min(canvas.height, Math.ceil(dy + dh)); y++) {
        for (let x = Math.max(0, Math.ceil(dx)); x < Math.min(canvas.width, Math.ceil(dx + dw)); x++) {
          const px = Math.min(source.width - 1, Math.max(0, Math.floor(sx + (x - dx) / dw * sw)));
          const py = Math.min(source.height - 1, Math.max(0, Math.floor(sy + (y - dy) / dh * sh)));
          const incoming = source.data[py * source.width + px];
          const prior = canvas.data[y * canvas.width + x];
          const alpha = incoming[3] / 255 * this.globalAlpha;
          const finalAlpha = alpha + prior[3] / 255 * (1 - alpha);
          canvas.data[y * canvas.width + x] = [0, 1, 2].map(channel => finalAlpha
            ? (incoming[channel] * alpha + prior[channel] * prior[3] / 255 * (1 - alpha)) / finalAlpha : 0)
            .concat(finalAlpha * 255);
        }
      }
    },
  };
  return { canvas, context };
}

test('captured source A is advected through consecutive frames after live source becomes B', () => {
  const sourceA = bitmap(8, 2, x => [40 + x * 20, 0, 0, 255]).canvas;
  const sourceB = bitmap(8, 2, () => [0, 0, 255, 255]).canvas;
  const history = bitmap(8, 2);
  const output = bitmap(8, 2);
  let source = sourceA;
  history.context.drawImage(source, 0, 0);
  const blocks = Array.from({ length: 4 }, (_, index) => ({ x: index * 2, y: 0, width: 2, height: 2,
    offsetX: -2, offsetY: 0, opacity: 1, stretch: 0, progress: 0 }));
  const paint = frame => paintTemporalPixels({ context: output.context, history: history.canvas, historyContext: history.context,
    width: 8, height: 2, blocks, frame, settings: { ...temporalMoshSettings, advectionRatio: 1, feedbackOpacity: 1 },
    drawSource(context, block) {
      context.drawImage(source, block.x, block.y, block.width, block.height, block.x, block.y, block.width, block.height);
    } });
  paint(0);
  assert.equal(output.canvas.data[0][0], sourceA.data[2][0]);
  source = sourceB;
  paint(1);
  assert.equal(output.canvas.data[0][0], sourceA.data[4][0], 'Second frame carries pixels moved into prior history, rather than resampling live B.');
  paint(2);
  assert.ok(output.canvas.data[0][0] > 150, 'Old A pixels travel through multiple history updates.');
  assert.ok(output.canvas.data[0][2] < 10, 'Gradual reconstruction cannot replace the captured frame with B in one paint.');
  assert.ok(history.canvas.data.some(pixel => pixel[2] > 0), 'Current source B is gradually reconstructed into history.');
});

test('extreme image offsets stay inside the captured ROI and reconstruction stays bounded', () => {
  const history = bitmap(20, 10, () => [50, 70, 90, 255]);
  const output = bitmap(20, 10);
  let sourceCopies = 0;
  const blocks = Array.from({ length: 160 }, (_, index) => ({ x: index % 20, y: index % 10,
    width: 12, height: 12, offsetX: index % 2 ? 1e6 : -1e6, offsetY: 1e6, opacity: .7, progress: .5, stretch: 100 }));
  const result = paintTemporalPixels({ context: output.context, history: history.canvas, historyContext: history.context,
    width: 20, height: 10, blocks, drawSource() { sourceCopies++; } });
  assert.equal(result.drawn, 160);
  assert.equal(sourceCopies, 40);
  assert.equal(history.context.reads.length, 1, 'A single image-copy feeds back the displayed blocks.');
  assert.ok(output.context.reads.every(read => read.source === history.canvas && read.sx >= 0 && read.sy >= 0
    && read.sx + read.sw <= 20 && read.sy + read.sh <= 10));
});
