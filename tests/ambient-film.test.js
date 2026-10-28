import test from 'node:test';
import assert from 'node:assert/strict';
import { ambientFilmSize, chemicalPatch, chemicalColorTables, createAmbientFilm, coverMemoryRect } from '../src/ambient-film.js';
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
  const sources = [];
  const context = { drawImage(source) { draws++; sources.push(source); } };
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
  return { image, container, view, doc, reduced, advance, canvases, sources, get draws() { return draws; }, get queued() { return timers.size + frames.size; } };
}

test('ambient scheduler runs only in active visible motion and releases all resources', () => {
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 123 });
  assert.equal(film.snapshot().frames, 0);
  assert.equal(env.queued, 0);
  assert.equal(film.source, env.image);
  film.setActive(true);
  assert.equal(film.snapshot().frames, 7, 'One fresh seed plus six transition feedback passes are prepared before display.');
  assert.equal(film.source, film.canvas);
  assert.equal(film.sourceIsViewport, true);
  assert.ok(env.queued > 0);
  env.advance();
  assert.equal(film.snapshot().frames, 8);
  const elapsed = film.snapshot().elapsed;
  const draws = env.draws;
  env.doc.hidden = true;
  env.doc.dispatchEvent(new Event('visibilitychange'));
  env.advance(10000);
  assert.equal(env.queued, 0);
  assert.equal(env.draws, draws);
  assert.equal(film.source, film.canvas, 'Hidden-tab pause must not substitute the original image.');
  env.doc.hidden = false;
  env.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(film.snapshot().elapsed, elapsed, 'A hidden interval must not advance material time.');
  env.reduced.matches = true;
  env.reduced.dispatchEvent(new Event('change'));
  const reducedFrames = film.snapshot().frames;
  env.advance();
  assert.equal(film.snapshot().frames, reducedFrames);
  assert.equal(env.queued, 0);
  assert.equal(film.canvas.hidden, false, 'Reduced motion retains the static damaged frame.');
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
  env.advance(100);
  assert.ok(film.snapshot().elapsed > before.elapsed);
  film.dispose();
  configureLivingDecay(original);
});

test('real scroll deltas accumulate into bounded history input without moving a clean source', () => {
  const original = getLivingDecaySettings();
  configureLivingDecay({ idleIntensity: 0, parallaxStrength: .4 });
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 152 });
  film.setActive(true);
  film.setMotion({ x: 0, y: -1, strength: 1, deltaY: 100, deltaMs: 100, time: env.view.performance.now() });
  assert.equal(film.snapshot().parallax.y, 100);
  assert.equal(film.snapshot().pending.scroll, true);
  assert.equal(film.snapshot().parallax.historyOnly, true);
  assert.equal(film.snapshot().parallax.offsetY, 0, 'No clean source rectangle travels beneath feedback.');
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
  assert.ok(longScroll.parallax.y > env.view.innerHeight, 'Actual scroll travel stays diagnostic; image memory is retained.');
  assert.equal(longScroll.pending.scroll, true, 'Twenty updates coalesce into one bounded scroll input.');
  assert.equal(longScroll.parallax.offsetY, 0);
  film.setMotion({ x: 0, y: 1, strength: 1, deltaY: -100, time: env.view.performance.now() });
  assert.ok(film.snapshot().parallax.y < longScroll.parallax.y, 'Reversing supplies the opposite physical delta.');
  assert.equal(film.snapshot().recoverySource, 'history');
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
  const beforeConsume = film.snapshot();
  env.advance(100);
  const initial = film.snapshot();
  assert.ok(initial.consumedInputs > beforeConsume.consumedInputs, 'Queued rupture is consumed only by a scheduled paint.');
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

test('the exact damaged transition buffers are claimed and released without another paint', () => {
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 744 });
  const token = film.prepareTransition({ variant: 12345 });
  assert.equal(token.seed, 744);
  assert.equal(film.prepareTransition({ variant: 12345 }), token);
  assert.equal(film.snapshot().transition.passes, 6);
  assert.equal(film.snapshot().transition.frozen, true);
  assert.equal(film.snapshot().sourceInitializations, 1);
  assert.equal(film.snapshot().buffers, 2);
  assert.equal(env.canvases.length, 2, 'Preparation reuses the two buffers, including temporary source readback.');
  const draws = env.draws, frames = film.snapshot().frames;
  env.advance(500);
  assert.equal(env.draws, draws);
  film.setActive(true);
  assert.equal(film.canvas.hidden, false);
  assert.equal(film.snapshot().transition.claimedFrame, token.frame);
  assert.equal(film.snapshot().frames, frames);
  assert.equal(env.draws, draws);
  assert.equal(env.queued, 0);
  assert.equal(film.finishTransition(token), true);
  assert.equal(film.snapshot().transition.frozen, false);
  assert.equal(env.draws, draws, 'The handoff itself must not replace the captured final bitmap.');
  assert.equal(env.queued, 1);
  env.advance(100);
  assert.ok(env.draws > draws);
  assert.equal(film.snapshot().sourceInitializations, 1);
  film.setActive(false);
  const next = film.prepareTransition({ variant: 23456 });
  assert.notEqual(next.seed, token.seed);
  assert.notEqual(next.id, token.id);
  film.setActive(true);
  assert.equal(film.finishTransition(token), false, 'An obsolete capture callback cannot release a new frozen world.');
  assert.equal(film.snapshot().transition.frozen, true);
  assert.equal(film.finishTransition(next), true);
  film.dispose();
});

test('idle, input, tuning, navigation and resize never draw the clean sentinel source again', () => {
  const original = getLivingDecaySettings();
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 818 });
  const token = film.prepareTransition({ variant: 50 });
  film.setActive(true); film.finishTransition(token);
  env.sources.length = 0;
  for (let index = 0; index < 40; index++) {
    film.impulse({ kind: 'click', x: 400, y: 300, strength: 1 });
    film.setMotion({ x: 0, y: -1, strength: 1, deltaY: 20, time: env.view.performance.now() });
    env.advance(100);
  }
  film.configure({ voidCoverage: .5, organicDecay: .9 });
  env.doc.dispatchEvent(new Event('h4:pagechange'));
  film.resize({ width: 390, height: 844 });
  for (let index = 0; index < 180; index++) env.advance(400);
  assert.equal(env.sources.includes(env.image), false, 'Even recovery may only sample the previous damaged output.');
  assert.equal(film.snapshot().sourceInitializations, 1);
  assert.equal(film.snapshot().recoverySource, 'history');
  assert.equal(film.snapshot().cleanSourceRetained, false);
  assert.equal(film.snapshot().material.width, 0);
  assert.equal(film.snapshot().resizeCopies, 1);
  assert.equal(env.canvases.length, 2);
  film.dispose(); configureLivingDecay(original);
});

test('input bursts coalesce without a field walk or render on the event path', () => {
  const env = environment();
  const film = createAmbientFilm({ ...env, seed: 900 });
  film.setActive(true);
  const before = film.snapshot();
  for (let index = 0; index < 1000; index++) {
    film.impulse({ kind: 'click', x: 200 + index % 300, y: 300, strength: 1 });
    film.stroke({ x: 200 + index % 500, y: 200, time: 1000 + index * .01 });
    film.setMotion({ x: 0, y: -1, strength: 1, deltaY: 2, time: 1000 });
  }
  const queued = film.snapshot();
  assert.equal(queued.frames, before.frames);
  assert.equal(queued.memory.accepted, before.memory.accepted);
  assert.equal(queued.pending.impulses, 8);
  assert.equal(queued.pending.pointer, true);
  assert.equal(queued.pending.scroll, true);
  assert.ok(queued.droppedInputs > 0);
  assert.equal(env.queued, 1);
  env.advance(100);
  const consumed = film.snapshot();
  assert.ok(consumed.memory.accepted > before.memory.accepted);
  assert.equal(consumed.pending.impulses, 0);
  assert.equal(consumed.pending.pointer, false);
  assert.equal(consumed.pending.scroll, false);
  assert.equal(env.canvases.length, 2);
  film.dispose();
});

test('resize sampling center-covers previous memory rather than stretching its aspect', () => {
  assert.deepEqual(coverMemoryRect(400, 200, 200, 400), { x: 150, y: 0, width: 100, height: 200 });
  assert.deepEqual(coverMemoryRect(200, 400, 400, 200), { x: 0, y: 150, width: 200, height: 100 });
  assert.deepEqual(coverMemoryRect(400, 200, 800, 400), { x: 0, y: 0, width: 400, height: 200 });
});
