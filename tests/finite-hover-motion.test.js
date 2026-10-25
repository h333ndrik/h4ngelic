import test from 'node:test';
import assert from 'node:assert/strict';
import { transformedHoverPoints, createFiniteHoverMotion } from '../src/finite-hover-motion.js';

const identity = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
const footprint = Object.freeze({ left: 120, top: 240, width: 200, height: 40,
  originX: 0, originY: 20, scrollX: 0, scrollY: 0 });
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} vs ${expected}`);

test('hover edge samples keep stable identities and the exact untransformed footprint', () => {
  assert.deepEqual(transformedHoverPoints(footprint, identity), [
    { id: 'tl', x: 120, y: 240 }, { id: 'tr', x: 320, y: 240 },
    { id: 'br', x: 320, y: 280 }, { id: 'bl', x: 120, y: 280 },
  ]);
});

test('a left-origin 22 percent enlargement produces opposite vertical edges and real outward horizontal movement', () => {
  const before = transformedHoverPoints(footprint, identity);
  const after = transformedHoverPoints(footprint, { ...identity, a: 1.22, d: 1.22 });
  assert.deepEqual(after.map(point => point.id), before.map(point => point.id));
  close(after[0].x, before[0].x, 'The left transform origin stays fixed');
  close(after[1].x - before[1].x, 44, 'The right edge moves by its actual scale');
  close(after[0].y - before[0].y, -4.4, 'The upper edge moves upward');
  close(after[3].y - before[3].y, 4.4, 'The lower edge moves downward');
  for (let index = 0; index < before.length; index++) {
    const contractionX = before[index].x - after[index].x;
    const contractionY = before[index].y - after[index].y;
    close(contractionX, -(after[index].x - before[index].x), 'Contraction reverses the physical X vector');
    close(contractionY, -(after[index].y - before[index].y), 'Contraction reverses the physical Y vector');
  }
});

test('center-origin scaling retains both opposing sides rather than a stationary-center approximation', () => {
  const centered = { ...footprint, originX: 100 };
  const before = transformedHoverPoints(centered, identity);
  const after = transformedHoverPoints(centered, { ...identity, a: 1.25, d: 1.25 });
  close(after[0].x - before[0].x, -25, 'Left side expands left');
  close(after[1].x - before[1].x, 25, 'Right side expands right');
  close((after[0].x + after[1].x) / 2, (before[0].x + before[1].x) / 2, 'The center is unchanged despite real edge movement');
});

test('magnetic translation and actual document scrolling share the same viewport coordinates', () => {
  const result = transformedHoverPoints({ ...footprint, scrollX: 30, scrollY: 180 },
    { ...identity, a: 1.2, d: 1.2, e: 3, f: -2 });
  close(result[0].x, 93, 'Cached document X minus native scroll plus magnet');
  close(result[0].y, 54, 'Cached document Y minus native scroll plus scaled-origin and magnet');
  close(result[2].x, 333, 'The right edge includes actual magnification');
  close(result[2].y, 102, 'The lower edge includes actual magnification');
});

test('rotation uses resolved matrix coefficients instead of collapsing to bounding-box width changes', () => {
  const angle = Math.PI / 2;
  const result = transformedHoverPoints({ ...footprint, originX: 100 }, {
    a: Math.cos(angle), b: Math.sin(angle), c: -Math.sin(angle), d: Math.cos(angle), e: 0, f: 0,
  });
  close(result[0].x, 240, 'Rotated upper-left X');
  close(result[0].y, 160, 'Rotated upper-left Y');
  close(result[2].x, 200, 'Rotated lower-right X');
  close(result[2].y, 360, 'Rotated lower-right Y');
});

test('invalid cached geometry or matrix values cannot publish non-finite motion', () => {
  for (const patch of [{ left: NaN }, { top: Infinity }, { width: 0 }, { height: -1 }, { originX: NaN }]) {
    assert.deepEqual(transformedHoverPoints({ ...footprint, ...patch }, identity), []);
  }
  for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) {
    assert.deepEqual(transformedHoverPoints(footprint, { ...identity, [key]: NaN }), []);
  }
});

function fixture({ mode = 'xray', reduced = false, fine = true } = {}) {
  let time = 0, sequence = 0, layoutReads = 0, styleReads = 0;
  let transform = 'matrix(1, 0, 0, 1, 0, 0)';
  let rect = { left: 120, top: 240, width: 200, height: 40 };
  const frames = new Map(), timers = new Map(), media = new Map(), batches = [];
  const view = Object.assign(new EventTarget(), {
    scrollX: 0, scrollY: 0, innerWidth: 1200, innerHeight: 800,
    performance: { now: () => time },
    CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } },
    requestAnimationFrame(callback) { frames.set(++sequence, callback); return sequence; },
    cancelAnimationFrame(handle) { frames.delete(handle); },
    setTimeout(callback, delay) { timers.set(++sequence, { callback, at: time + delay }); return sequence; },
    clearTimeout(handle) { timers.delete(handle); },
    matchMedia(query) {
      if (!media.has(query)) media.set(query, Object.assign(new EventTarget(), {
        matches: query.includes('reduced-motion') ? reduced : query.includes('fine') || query.includes('hover') ? fine : false,
      }));
      return media.get(query);
    },
    getComputedStyle() {
      styleReads++;
      return { transform, transformOrigin: '0px 20px', opacity: '1', display: 'inline-flex', visibility: 'visible' };
    },
  });
  class Matrix {
    constructor(text) {
      const values = text === 'none' ? [1, 0, 0, 1, 0, 0] : text.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
      Object.assign(this, Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((key, index) => [key, values[index]])));
    }
  }
  view.DOMMatrix = view.DOMMatrixReadOnly = Matrix;
  const doc = Object.assign(new EventTarget(), { defaultView: view, hidden: false,
    documentElement: { dataset: { mode } }, hasFocus: () => true });
  const target = { isConnected: true, closest: () => null, contains: element => element === visual };
  const visual = { isConnected: true, ownerDocument: doc, parentElement: target, offsetWidth: 200, offsetHeight: 40,
    closest: () => null,
    getBoundingClientRect() { layoutReads++; return rect; } };
  target.getBoundingClientRect = visual.getBoundingClientRect;
  const controller = createFiniteHoverMotion({ doc, maximumHz: 12,
    publish: (samples, at) => batches.push({ samples, time: at ?? time }) });
  function step(elapsed = 16) {
    time += elapsed;
    for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.callback(); }
    const callbacks = [...frames.values()]; frames.clear();
    for (const callback of callbacks) callback(time);
  }
  const advance = duration => { for (let remaining = duration; remaining > 0;) { const delta = Math.min(16, remaining); step(delta); remaining -= delta; } };
  const send = (name, node = doc) => node.dispatchEvent(new Event(name));
  return { doc, view, target, visual, controller, batches, media, step, advance, send,
    setTransform(value) { transform = value; },
    setRect(value) { rect = value; },
    get layoutReads() { return layoutReads; }, get styleReads() { return styleReads; }, get pending() { return frames.size + timers.size; } };
}

test('a finite hover gesture samples actual transforms at bounded cadence without repeated layout reads', () => {
  const f = fixture();
  f.controller.track({ target: f.target, visual: f.visual }, 400);
  const initialReads = f.layoutReads;
  for (let index = 1; index <= 20; index++) {
    const scale = 1 + Math.min(1, index / 16) * .22;
    f.setTransform(`matrix(${scale}, 0, 0, ${scale}, 0, 0)`);
    f.step(20);
  }
  f.advance(200);
  assert.ok(f.batches.length >= 2, 'Actual expansion contributes multiple real movement samples.');
  assert.ok(f.batches.length <= 8, 'A short gesture cannot become a display-rate publishing loop.');
  assert.equal(f.layoutReads, initialReads, 'Animation sampling uses the cached footprint.');
  assert.ok(f.batches.every((batch, index) => index === 0 || batch.time - f.batches[index - 1].time >= 1000 / 12 - 1));
  assert.equal(f.pending, 0, 'The transition sampler stops after its bounded window.');
  const count = f.batches.length, reads = f.styleReads;
  f.advance(500);
  assert.equal(f.batches.length, count);
  assert.equal(f.styleReads, reads, 'Idle hover does not keep resolving styles.');
  f.controller.dispose();
});

test('a release sampled after a settled enlargement reconstructs its untransformed origin', () => {
  const f = fixture();
  f.setTransform('matrix(1.22, 0, 0, 1.22, 0, 0)');
  f.setRect({ left: 120, top: 235.6, width: 244, height: 48.8 });
  f.controller.track({ target: f.target, visual: f.visual }, 340);
  const enlarged = f.batches[0].samples[0];
  close(enlarged.points[1].x, 364, 'The initial right corner belongs to the enlarged visual');
  close(enlarged.points[0].y, 235.6, 'The initial upper corner belongs to the enlarged visual');
  for (let step = 1; step <= 4; step++) {
    const scale = 1.22 - step * .055;
    f.setTransform(`matrix(${scale}, 0, 0, ${scale}, 0, 0)`);
    f.advance(90);
  }
  const restored = f.batches.at(-1).samples[0];
  assert.deepEqual(restored.points.map(point => point.id), enlarged.points.map(point => point.id));
  close(restored.points[1].x, 320, 'The right edge contracts to its original position');
  close(restored.points[0].y, 240, 'The upper edge contracts downward');
  assert.equal(f.layoutReads, 1, 'The entire release uses one cached origin measurement');
  f.advance(200);
  assert.equal(f.pending, 0);
  f.controller.dispose();
});

test('a second magnet update extends finite observation without measuring layout again', () => {
  const f = fixture();
  f.controller.track({ target: f.target, visual: f.visual }, 260);
  f.advance(200);
  const reads = f.layoutReads;
  f.setTransform('matrix(1.2, 0, 0, 1.2, -3, 2)');
  f.controller.track({ target: f.target, visual: f.visual }, 340);
  f.advance(500);
  assert.equal(f.layoutReads, reads);
  const final = f.batches.at(-1).samples[0];
  close(final.points[0].x, 117, 'The signed magnetic translation remains present');
  close(final.points[0].y, 238, 'The vertical magnet and scale origin remain present');
  assert.equal(f.pending, 0);
  f.controller.dispose();
});

test('hover vectors inherit the cached rotation of a kinetic wrapper', () => {
  const base = { ...footprint, parentA: 0, parentB: 1, parentC: -1, parentD: 0 };
  const before = transformedHoverPoints(base, identity);
  const after = transformedHoverPoints(base, { ...identity, a: 1.2, d: 1.2 });
  close(after[1].x - before[1].x, 4, 'Top edge movement is rotated into horizontal motion');
  close(after[1].y - before[1].y, 40, 'Right edge expansion follows the ancestor rotation');
});

test('Normal, reduced-motion and coarse-pointer states allocate no hover sampling work', () => {
  for (const profile of [{ mode: 'normal' }, { reduced: true }, { fine: false }]) {
    const f = fixture(profile);
    f.controller.track({ target: f.target, visual: f.visual }, 400);
    f.advance(500);
    assert.equal(f.batches.length, 0);
    assert.equal(f.layoutReads, 0);
    assert.equal(f.pending, 0);
    f.controller.dispose();
  }
});

test('hidden, navigation, reset and disposal cannot leave a hover sampler running', () => {
  for (const stop of [
    f => { f.doc.hidden = true; f.send('visibilitychange'); },
    f => f.send('h4:navigationstart'),
    f => f.controller.reset(),
    f => f.controller.dispose(),
  ]) {
    const f = fixture();
    f.controller.track({ target: f.target, visual: f.visual }, 400);
    f.step(100);
    stop(f);
    const count = f.batches.length;
    f.setTransform('matrix(1.22, 0, 0, 1.22, 0, 0)');
    f.advance(500);
    assert.equal(f.batches.length, count);
    assert.equal(f.pending, 0);
    f.controller.dispose();
  }
});

test('navigation and blur stay suspended until their matching resume events', () => {
  for (const [stop, resume, target] of [
    ['h4:navigationstart', 'h4:pagechange', 'doc'], ['blur', 'focus', 'view'],
  ]) {
    const f = fixture();
    f.send(stop, f[target]);
    assert.equal(f.controller.track({ target: f.target, visual: f.visual }, 400), false);
    f.advance(200);
    assert.equal(f.pending, 0);
    assert.equal(f.layoutReads, 0);
    f.send(resume, f[target]);
    assert.equal(f.controller.track({ target: f.target, visual: f.visual }, 400), true);
    f.advance(600);
    assert.ok(f.batches.length > 0);
    assert.equal(f.pending, 0);
    f.controller.dispose();
  }
});
