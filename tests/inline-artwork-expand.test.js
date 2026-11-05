import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Exercise the production geometry in Node. Only the browser-owned CSS import
// is removed; the implementation is neither copied nor re-created by the test.
const source = (await readFile(new URL('../src/inline-artwork-expand.js', import.meta.url), 'utf8'))
  .replace(/^import ['"]\.\/inline-artwork-expand\.css['"];?\s*/m, '');
const { fitInlineArtwork } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .000001, `${actual} matches ${expected}`);
const bounds = { left: 12, top: 76, right: 1428, bottom: 768 };

function contained(pose, boundary) {
  assert.ok(pose.left >= boundary.left && pose.left + pose.width <= boundary.right + .000001);
  assert.ok(pose.top >= boundary.top && pose.top + pose.height <= boundary.bottom + .000001);
}

test('shared inline geometry enlarges a centered portrait without translating its center', () => {
  const preview = { left: 620, top: 282, width: 200, height: 280 };
  const pose = fitInlineArtwork({ preview, frame: { width: 400, height: 560 }, bounds });
  close(pose.scale, 2); close(pose.width, 400); close(pose.height, 560);
  close(pose.x, 0); close(pose.y, 0); contained(pose, bounds);
});

test('a partially visible portrait translates into a 320px viewport and retains its real ratio', () => {
  const narrow = { left: 12, top: 76, right: 308, bottom: 768 };
  const preview = { left: 220, top: 300, width: 160, height: 224 };
  const pose = fitInlineArtwork({ preview, frame: { width: 500, height: 700 }, bounds: narrow });
  close(pose.width, 296); close(pose.scale, 296 / 160);
  close(pose.width / pose.height, preview.width / preview.height);
  assert.ok(pose.x < 0, 'The photograph moves within the reserved row instead of scrolling or widening the website.');
  contained(pose, narrow);
});

test('landscape expansion respects the reserved frame as well as viewport limits', () => {
  const preview = { left: 300, top: 210, width: 300, height: 150 };
  const pose = fitInlineArtwork({ preview, frame: { width: 600, height: 240 }, bounds });
  close(pose.scale, 1.6); close(pose.width, 480); close(pose.height, 240);
  close(pose.width / pose.height, 2); contained(pose, bounds);
});

test('an image near a viewport edge fits below header clearance and above the bottom inset', () => {
  const preview = { left: 100, top: 78, width: 150, height: 210 };
  const pose = fitInlineArtwork({ preview, frame: { width: 500, height: 700 }, bounds });
  close(pose.top, bounds.top);
  assert.ok(pose.scale > 1.2); contained(pose, bounds);
});

test('insufficient visible space never shrinks artwork or invents a fullscreen overlay', () => {
  const preview = { left: 100, top: 76, width: 200, height: 280 };
  assert.equal(fitInlineArtwork({ preview, frame: { width: 600, height: 800 },
    bounds: { ...bounds, bottom: 100 } }), null);
  assert.equal(fitInlineArtwork({ preview, frame: { width: 200, height: 280 }, bounds }), null);
});

test('zero, nonfinite and reversed geometry is rejected instead of emitting invalid transforms', () => {
  const valid = { preview: { left: 100, top: 100, width: 200, height: 280 }, frame: { width: 600, height: 800 }, bounds };
  assert.equal(fitInlineArtwork({ ...valid, preview: { ...valid.preview, width: 0 } }), null);
  assert.equal(fitInlineArtwork({ ...valid, preview: { ...valid.preview, height: NaN } }), null);
  assert.equal(fitInlineArtwork({ ...valid, frame: { width: Infinity, height: 800 } }), null);
  assert.equal(fitInlineArtwork({ ...valid, bounds: { ...bounds, right: -1 } }), null);
});
