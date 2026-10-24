import test from 'node:test';
import assert from 'node:assert/strict';
import { ambientFilmSize, chemicalPatch, chemicalColorTables, createAmbientFilm } from '../src/ambient-film.js';
import { ambientFilmSettings } from '../src/data/ambientFilmSettings.js';

test('ambient backing store respects profile caps independently of display size', () => {
  for (const profile of ['desktop', 'mobile']) {
    const quality = ambientFilmSettings[profile];
    for (const [width, height] of [[3840, 2160], [320, 844], [1440, 1000], [0, NaN]]) {
      const size = ambientFilmSize(width, height, quality);
      assert.ok(size.width >= 1 && size.width <= quality.maximumWidth);
      assert.ok(size.height >= 1 && size.height <= quality.maximumHeight);
      if (width > 0 && height > 0) assert.ok(Math.abs(size.width / size.height - width / height) < .02);
    }
  }
});

test('chemical generations are stable and fade out rather than jump at their ends', () => {
  const start = chemicalPatch(100, 1, 2, 0);
  const middle = chemicalPatch(100, 1, 2, .5);
  const end = chemicalPatch(100, 1, 2, 1);
  assert.equal(start.opacity, 0);
  assert.equal(end.opacity, 0);
  assert.ok(middle.opacity > .4 && middle.opacity <= 1);
  assert.deepEqual(middle, chemicalPatch(100, 1, 2, .5));
  assert.notDeepEqual(middle, chemicalPatch(101, 1, 2, .5));
  assert.ok(middle.radius > 0 && middle.radius < .6);
  const before = chemicalPatch(100, 1, 2, .4999);
  assert.ok(Math.abs(before.x - middle.x) < .001);
  assert.ok(Math.abs(before.radius - middle.radius) < .001);
});

test('chemical material preserves burned white and chromatic midtone identity', () => {
  for (const color of ambientFilmSettings.palette) {
    const tables = chemicalColorTables(color);
    assert.ok(tables.every(table => table[255] === 255 && table[0] < 10));
  }
  const violet = chemicalColorTables('#7800ff').map(table => table[128]);
  const green = chemicalColorTables('#b7ff0e').map(table => table[128]);
  assert.ok(violet[2] > violet[0] && violet[0] > violet[1]);
  assert.ok(green[1] > green[0] && green[0] > green[2]);
});

function environment() {
  let clock = 1000;
  let sequence = 0;
  let draws = 0;
  const timers = new Map();
  const frames = new Map();
  const reduced = new EventTarget();
  reduced.matches = false;
  const context = { drawImage() { draws++; } };
  for (const method of ['fillRect', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'closePath', 'ellipse', 'save', 'restore', 'translate', 'rotate', 'clip']) context[method] = () => {};
  const canvases = [];
  const doc = new EventTarget();
  doc.hidden = false;
  doc.createElement = () => {
    const canvas = { style: {}, dataset: {}, width: 300, height: 150, removed: false,
      setAttribute() {}, getContext: () => context, remove() { this.removed = true; } };
    canvases.push(canvas);
    return canvas;
  };
  const view = {
    innerWidth: 1440, innerHeight: 1000,
    performance: { now: () => clock }, matchMedia: () => reduced,
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, due: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const image = { naturalWidth: 896, naturalHeight: 1344 };
  const container = { prepend() {} };
  const advance = (milliseconds = 400) => {
    clock += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.due <= clock) { timers.delete(id); timer.callback(); }
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(clock); }
  };
  return { image, container, view, doc, reduced, advance, canvases, get draws() { return draws; }, get queued() { return timers.size + frames.size; } };
}

test('ambient scheduler runs only in active visible motion and releases all resources', () => {
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 123 });
  assert.equal(film.snapshot().frames, 0);
  assert.equal(env.queued, 0);
  assert.equal(film.source, env.image);
  film.setActive(true);
  assert.equal(film.snapshot().frames, 1);
  assert.equal(film.source, film.canvas);
  assert.equal(film.sourceIsViewport, true);
  assert.ok(env.queued > 0);
  env.advance();
  assert.equal(film.snapshot().frames, 2);
  const elapsed = film.snapshot().elapsed;
  const draws = env.draws;
  env.doc.hidden = true;
  env.doc.dispatchEvent(new Event('visibilitychange'));
  env.advance(10000);
  assert.equal(env.queued, 0);
  assert.equal(env.draws, draws);
  assert.equal(film.source, env.image);
  env.doc.hidden = false;
  env.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(film.snapshot().elapsed, elapsed, 'A hidden interval must not advance material time.');
  env.reduced.matches = true;
  env.reduced.dispatchEvent(new Event('change'));
  const reducedFrames = film.snapshot().frames;
  env.advance();
  assert.equal(film.snapshot().frames, reducedFrames);
  assert.equal(env.queued, 0);
  assert.equal(film.canvas.hidden, true);
  env.reduced.matches = false;
  env.reduced.dispatchEvent(new Event('change'));
  assert.ok(env.queued > 0);
  film.setActive(false);
  const normalFrames = film.snapshot().frames;
  env.advance();
  assert.equal(film.snapshot().frames, normalFrames);
  assert.equal(env.queued, 0);
  film.dispose();
  assert.equal(film.canvas.removed, true);
  assert.ok(env.canvases.every(canvas => canvas.width === 1 && canvas.height === 1));
  film.setActive(true);
  env.doc.dispatchEvent(new Event('visibilitychange'));
  env.advance();
  assert.equal(env.queued, 0);
  assert.equal(film.snapshot().active, false);
});
