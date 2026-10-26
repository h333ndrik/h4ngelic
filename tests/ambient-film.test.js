import test from 'node:test';
import assert from 'node:assert/strict';
import { ambientFilmSize, chemicalPatch, chemicalColorTables, createAmbientFilm } from '../src/ambient-film.js';
import { ambientFilmSettings } from '../src/data/ambientFilmSettings.js';
import { configureLivingDecay, getLivingDecaySettings } from '../src/data/livingDecaySettings.js';

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

test('a live composition keeps its seed and elapsed field until a fresh activation', () => {
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 737 });
  film.setActive(true);
  env.advance(400);
  const beforeNavigation = film.snapshot();
  env.doc.dispatchEvent(new Event('h4:pagechange'));
  film.setActive(true);
  assert.equal(film.snapshot().seed, 737);
  assert.equal(film.snapshot().elapsed, beforeNavigation.elapsed);
  assert.equal(film.snapshot().regenerations, 0);
  env.advance(400);
  assert.ok(film.snapshot().elapsed > beforeNavigation.elapsed);
  film.setActive(false);
  film.setActive(true);
  assert.notEqual(film.snapshot().seed, 737);
  assert.equal(film.snapshot().elapsed, 0);
  assert.equal(film.snapshot().regenerations, 1);
  film.regenerate(737);
  assert.equal(film.snapshot().seed, 737);
  assert.deepEqual(film.snapshot().composition, beforeNavigation.composition);
  film.dispose();
});

test('live controls and bounded scroll motion preserve the current composition', () => {
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 101 });
  film.setActive(true);
  env.advance(400);
  const previous = film.snapshot();
  const effective = film.configure({ idleIntensity: .31, cursorRadius: 1000, blockSize: 36 });
  assert.equal(effective.cursorRadius, 45);
  assert.equal(film.readSettings(), effective);
  assert.equal(film.snapshot().seed, previous.seed);
  assert.equal(film.snapshot().elapsed, previous.elapsed);
  film.setMotion({ x: NaN, y: 3, strength: 1 });
  assert.deepEqual(film.snapshot().motion, { x: 0, y: 0, strength: 0 });
  film.setMotion({ x: 999, y: -999, strength: 999, time: env.view.performance.now() });
  env.advance(400);
  const moving = film.snapshot().motion;
  assert.ok(moving.strength > 0 && moving.strength <= 2);
  assert.ok(Math.abs(moving.x) <= 8 && Math.abs(moving.y) <= 8);
  assert.equal(film.snapshot().seed, previous.seed);
  env.doc.hidden = true;
  env.doc.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual(film.snapshot().motion, { x: 0, y: 0, strength: 0 });
  film.configure({ idleIntensity: .45, cursorRadius: 35, blockSize: 28 });
  film.dispose();
});

test('manual seeds including zero are honored before activation and auto remains fresh', () => {
  const original = getLivingDecaySettings();
  for (const seed of [0, 321]) {
    configureLivingDecay({ seed });
    const env = environment();
    const film = createAmbientFilm(env);
    assert.equal(film.snapshot().seed, seed);
    film.setActive(true);
    assert.equal(film.snapshot().seed, seed);
    film.setActive(false);
    film.setActive(true);
    assert.equal(film.snapshot().seed, seed, 'A manual debug seed remains reproducible across activations.');
    film.configure({ seed: null });
    assert.equal(film.snapshot().seed, seed, 'Selecting auto does not regenerate a seed of zero.');
    film.setActive(false);
    film.setActive(true);
    const automatic = film.snapshot().seed;
    assert.notEqual(automatic, seed);
    assert.equal(film.readSettings().seed, null, 'A runtime seed never changes the auto policy.');
    film.regenerate();
    assert.notEqual(film.snapshot().seed, automatic);
    film.dispose();
  }
  configureLivingDecay(original);
});

test('calibration input cannot bypass the ambient cadence or reset material time', () => {
  const original = getLivingDecaySettings();
  configureLivingDecay({ seed: null });
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 917 });
  film.setActive(true);
  const before = film.snapshot();
  for (const patch of [{ cursorRadius: 25 }, { cursorMosh: .4 }, { hoverMosh: 0 }, { typographyMosh: .3 }, { clickMosh: .8 }]) {
    film.configure(patch);
    env.advance(10);
  }
  assert.equal(film.snapshot().frames, before.frames, 'Five input updates in 50ms cannot paint five ambient frames.');
  assert.equal(film.snapshot().elapsed, before.elapsed);
  assert.equal(env.queued, 1);
  film.configure({ voidCoverage: .65 });
  assert.equal(film.snapshot().frames, before.frames, 'Material changes wait for the existing scheduled paint.');
  env.advance(150);
  assert.equal(film.snapshot().frames, before.frames + 1);
  assert.ok(film.snapshot().elapsed > before.elapsed);
  film.dispose();
  configureLivingDecay(original);
});

test('real scroll deltas move the source, inertia cannot fabricate travel, and navigation keeps image memory', () => {
  const original = getLivingDecaySettings();
  configureLivingDecay({ idleIntensity: 0, parallaxStrength: .4 });
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 152 });
  film.setActive(true);
  film.setMotion({ x: 0, y: -1, strength: 1, deltaY: 100, deltaMs: 100, time: env.view.performance.now() });
  assert.equal(film.snapshot().parallax.y, 40, 'Native scroll displacement has the configured .4 starting gain.');
  assert.ok(film.snapshot().parallax.offsetY > 35 && film.snapshot().parallax.offsetY < 40);
  const beforeTail = film.snapshot();
  film.setMotion({ x: 0, y: -.5, strength: .5, deltaY: 0, deltaMs: 80, time: env.view.performance.now() });
  assert.deepEqual(film.snapshot().parallax, beforeTail.parallax, 'An inertia velocity does not move the real source.');
  env.advance(80);
  const beforeNavigation = film.snapshot();
  env.doc.dispatchEvent(new Event('h4:pagechange'));
  film.setActive(true);
  assert.equal(film.snapshot().memory.accepted, beforeNavigation.memory.accepted);
  assert.equal(film.snapshot().memory.energy, beforeNavigation.memory.energy);
  assert.equal(film.snapshot().seed, 152);
  for (let index = 0; index < 20; index++) film.setMotion({ x: 0, y: -2, strength: 1, deltaY: 500, time: env.view.performance.now() });
  const longScroll = film.snapshot();
  assert.ok(longScroll.parallax.y > env.view.innerHeight, 'Raw source travel keeps accumulating without resetting history.');
  assert.ok(longScroll.parallax.offsetY < env.view.innerHeight * .205, 'The continuous source remains inside finite overscan.');
  film.setMotion({ x: 0, y: 1, strength: 1, deltaY: -100, time: env.view.performance.now() });
  assert.ok(film.snapshot().parallax.offsetY < longScroll.parallax.offsetY, 'Reverse scrolling moves back through the same source field.');
  film.dispose(); configureLivingDecay(original);
});

test('continuous pointer input cannot postpone the one adaptive paint timer forever', () => {
  const original = getLivingDecaySettings();
  configureLivingDecay({ idleIntensity: 0 });
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 288 });
  film.setActive(true);
  const before = film.snapshot().frames;
  for (let index = 0; index < 60; index++) {
    film.stroke({ x: 200 + index * 2, y: 200, time: env.view.performance.now() });
    env.advance(8);
    assert.ok(env.queued <= 1, 'There is one shared ambient timer/RAF, even under event bursts.');
  }
  assert.ok(film.snapshot().frames > before + 5, '60 rapid pointer events must not starve the render scheduler.');
  assert.ok(film.snapshot().memory.byKind.cursor > 0);
  assert.ok(film.snapshot().advectedBlocks > 0);
  film.dispose(); configureLivingDecay(original);
});

test('an explicit new-gesture pointer reset cannot bridge old history after quick navigation', () => {
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 431 });
  film.setActive(true);
  film.stroke({ x: 100, y: 100, time: env.view.performance.now() });
  env.advance(40);
  film.stroke({ x: 150, y: 100, time: env.view.performance.now() });
  const accepted = film.snapshot().memory.accepted;
  env.advance(40);
  film.stroke({ x: 700, y: 700, time: env.view.performance.now(), priorInput: null });
  assert.equal(film.snapshot().memory.accepted, accepted, 'Resetting a gesture preserves history without inventing a bridge to the old pointer.');
  env.advance(40);
  film.stroke({ x: 730, y: 700, time: env.view.performance.now() });
  assert.ok(film.snapshot().memory.accepted > accepted, 'The next actual local movement still contributes.');
  film.dispose();
});

test('global material keeps scars and its existing palette through idle, navigation and viewport resizing', () => {
  const original = getLivingDecaySettings();
  configureLivingDecay({ idleIntensity: .45 });
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 482 });
  film.setActive(true);
  film.impulse({ kind: 'mode', x: 720, y: 500, strength: 1, direction: 'entering', time: env.view.performance.now() });
  const initial = film.snapshot();
  assert.equal(initial.memory.persistent, true);
  assert.ok(initial.memory.scarredCells > initial.memory.cells * .7);
  for (let frame = 0; frame < 180; frame++) env.advance(400);
  const idle = film.snapshot();
  assert.equal(idle.memory.scarredCells, initial.memory.scarredCells);
  assert.equal(idle.memory.maximumScar, initial.memory.maximumScar);
  assert.ok(idle.advectedBlocks > initial.advectedBlocks, 'The retained history still moves at the existing slow idle cadence.');
  assert.ok(idle.memory.byKind.idle > 0);
  env.doc.dispatchEvent(new Event('h4:pagechange'));
  film.setActive(true);
  assert.equal(film.snapshot().seed, initial.seed);
  assert.equal(film.snapshot().memory.scarredCells, initial.memory.scarredCells);
  const frames = film.snapshot().frames;
  film.resize({ width: 1440, height: 1000 });
  assert.equal(film.snapshot().frames, frames, 'A redundant size notification cannot repaint or clear the feedback.');
  film.resize({ width: 390, height: 844 });
  const resized = film.snapshot();
  assert.equal(resized.seed, initial.seed);
  assert.ok(resized.memory.scarredCells > 0);
  assert.deepEqual(resized.settings, initial.settings, 'No brightness, color, white balance or palette control changed.');
  assert.equal(resized.regenerations, 0);
  assert.ok(env.queued <= 1);
  film.setActive(false);
  assert.equal(env.queued, 0, 'Normal Side owns no active feedback work.');
  film.dispose(); configureLivingDecay(original);
});
