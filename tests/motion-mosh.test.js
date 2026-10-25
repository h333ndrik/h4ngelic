import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisualMotionPublisher, initMotionMosh } from '../src/motion-mosh.js';
import { livingDecayDefaults } from '../src/data/livingDecaySettings.js';

function fixture(mode = 'xray', patch = {}) {
  let time = 0;
  let focused = true;
  let nextFrame = 0;
  let settings = { ...livingDecayDefaults, ...patch };
  const frames = new Map();
  const media = new Map();
  const impulses = [];
  const scrollMotion = [];
  const impulseTimes = [];
  const html = { dataset: { mode } };
  const view = Object.assign(new EventTarget(), {
    innerWidth: 1200, innerHeight: 800, scrollX: 0, scrollY: 0,
    performance: { now: () => time },
    CustomEvent: class extends Event {
      constructor(type, options) { super(type); this.detail = options?.detail; }
    },
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    matchMedia(query) {
      if (!media.has(query)) media.set(query, Object.assign(new EventTarget(), { matches: false }));
      return media.get(query);
    },
  });
  const doc = Object.assign(new EventTarget(), {
    defaultView: view, hidden: false, documentElement: html, hasFocus: () => focused,
  });
  doc.addEventListener('h4:moshimpulse', event => { impulses.push(event.detail); impulseTimes.push(time); });
  doc.addEventListener('h4:scrollmotion', event => scrollMotion.push(event.detail));
  const controller = initMotionMosh({ doc, readSettings: () => settings });
  const send = (type, detail, target = doc) => target.dispatchEvent(new view.CustomEvent(type, { detail }));
  const target = () => ({
    isConnected: true,
    closest: () => null,
    getBoundingClientRect() { assert.fail('Motion sampling must use the supplied geometry.'); },
  });
  const sample = (element, values = {}) => ({
    kind: 'typography', target: element, x: 300, y: 250,
    width: 180, height: 48, opacity: 1, ...values,
  });
  const visual = (...samples) => send('h4:visualmotion', { time, samples });
  function step(elapsed = 16) {
    time += elapsed;
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(time);
  }
  function advance(elapsed) {
    const until = time + elapsed;
    while (time < until) step(Math.min(16, until - time));
  }
  function drain(maximumMs = 3500) {
    const until = time + maximumMs;
    while (frames.size && time < until) step();
    assert.equal(frames.size, 0, 'The event-scheduled motion loop must finish after recovery.');
  }
  function scrollTo(y, x = 0) { view.scrollY = y; view.scrollX = x; send('scroll', undefined, view); }
  function modeChange(value) { html.dataset.mode = value; send('h4:modechange'); }
  function reducedChange(value) {
    const reduced = [...media].find(([query]) => query.includes('reduced'))?.[1];
    assert.ok(reduced, 'The controller checks the reduced-motion preference.');
    reduced.matches = value;
    send('change', undefined, reduced);
  }
  return { doc, view, html, controller, impulses, impulseTimes, scrollMotion, target, sample, visual,
    send, step, advance, drain, scrollTo, modeChange, reducedChange,
    tick: elapsed => { time += elapsed; }, now: () => time, pending: () => frames.size,
    configure: patch => { settings = { ...settings, ...patch }; },
    blur() { focused = false; send('blur', undefined, view); },
    focus() { focused = true; send('focus', undefined, view); },
  };
}

test('Normal mode performs no motion rendering or layout reads; activation begins from a fresh baseline', () => {
  const f = fixture('normal');
  const element = f.target();
  f.visual(f.sample(element));
  f.tick(100);
  f.visual(f.sample(element, { x: 650 }));
  f.scrollTo(160);
  f.advance(250);
  assert.equal(f.impulses.length, 0);
  assert.equal(f.scrollMotion.length, 0);
  assert.equal(f.pending(), 0);
  f.modeChange('xray');
  f.visual(f.sample(element, { x: 650 }));
  f.advance(100);
  assert.equal(f.impulses.length, 0, 'Activating the effect must not interpolate from Normal-mode samples.');
  f.visual(f.sample(element, { x: 600 }));
  f.advance(100);
  assert.ok(f.impulses.length > 0);
  assert.ok(f.impulses.every(impulse => impulse.dx < 0));
  f.controller.dispose();
});

test('actual screen-space velocity controls damage strength and direction', () => {
  function movement(elapsed) {
    const f = fixture();
    const element = f.target();
    f.visual(f.sample(element));
    f.tick(elapsed);
    f.visual(f.sample(element, { x: 340, y: 230 }));
    f.advance(100);
    assert.ok(f.impulses.length > 0);
    const result = f.impulses[0];
    assert.ok(result.dx > 0 && result.dy < 0, 'Damage follows the actual element motion.');
    assert.ok(result.strength > 0 && result.strength <= 1);
    assert.ok([result.x, result.y, result.rect.left, result.rect.top, result.width, result.height].every(Number.isFinite));
    f.controller.dispose();
    return result.strength;
  }
  assert.ok(movement(100) > movement(250), 'The same distance travelled faster produces stronger corruption.');
});

test('targets have independent velocity history and stationary text does not refresh recovering damage', () => {
  const f = fixture();
  const first = f.target();
  const second = f.target();
  f.visual(f.sample(first, { x: 180 }), f.sample(second, { x: 1000 }));
  f.tick(100);
  f.visual(f.sample(first, { x: 220 }), f.sample(second, { x: 1000 }));
  f.advance(100);
  assert.ok(f.impulses.length > 0);
  assert.ok(f.impulses.every(impulse => impulse.target === first), 'Distant targets must never create a shared teleport stroke.');
  const count = f.impulses.length;
  for (let index = 0; index < 5; index++) {
    f.visual(f.sample(first, { x: 220, opacity: 1 - index * .1 }), f.sample(second, { x: 1000 }));
    f.advance(100);
  }
  assert.equal(f.impulses.length, count, 'Neither static geometry nor opacity-only updates are motion.');
  f.drain();
  f.controller.dispose();
});

test('the first movement after an idle pause still leaves a section and text path', () => {
  const f = fixture();
  const heading = f.target();
  const text = f.target();
  f.visual(f.sample(heading, { kind: 'section', y: 500 }), f.sample(text, { x: 900, y: 600 }));
  f.tick(5000);
  f.visual(f.sample(heading, { kind: 'section', y: 380 }), f.sample(text, { x: 500, y: 480 }));
  f.advance(100);
  assert.ok(f.impulses.some(impulse => impulse.target === heading && impulse.kind === 'section' && impulse.dy < 0),
    'An event-scheduled sampler must not discard the first section movement after it rests.');
  assert.ok(f.impulses.some(impulse => impulse.target === text && impulse.kind === 'typography' && impulse.dx < 0),
    'A single resumed fly-in leaves damage without requiring a second scroll event.');
  f.controller.dispose();
});

test('a moving element leaving the viewport leaves a clipped exit trail', () => {
  const f = fixture();
  const element = f.target();
  f.visual(f.sample(element, { kind: 'section', y: 70 }));
  f.tick(100);
  f.visual(f.sample(element, { kind: 'section', y: -120, opacity: 0 }));
  f.advance(100);
  assert.ok(f.impulses.length > 0, 'An exit is sampled even when its final pose has disappeared.');
  assert.ok(f.impulses.some(impulse => impulse.kind === 'section' && impulse.dy < 0));
  assert.ok(f.impulses.every(impulse => impulse.x >= 0 && impulse.x <= f.view.innerWidth
    && impulse.y >= 0 && impulse.y <= f.view.innerHeight), 'The exit anchor remains in the visible material.');
  f.controller.dispose();
});

test('logo rotation can damage material while its projected center remains still', () => {
  const f = fixture();
  const logo = f.target();
  f.visual(f.sample(logo, { kind: 'logo', angularVelocity: 0 }));
  f.tick(100);
  f.visual(f.sample(logo, { kind: 'logo', angularVelocity: 2 }));
  f.advance(100);
  assert.ok(f.impulses.some(impulse => impulse.kind === 'logo' && impulse.strength > 0));
  assert.ok(f.impulses.every(impulse => [impulse.dx, impulse.dy, impulse.strength].every(Number.isFinite)));
  f.controller.dispose();
});

test('background inertia follows real scroll direction, reverses promptly, and finishes without an idle loop', () => {
  const f = fixture();
  f.tick(100);
  f.scrollTo(180);
  f.advance(110);
  assert.ok(f.scrollMotion.some(motion => motion.y < 0 && motion.strength > 0), 'Scrolling down carries background material upward.');
  const reversal = f.scrollMotion.length;
  f.scrollTo(40);
  f.advance(110);
  assert.ok(f.scrollMotion.slice(reversal).some(motion => motion.y > 0 && motion.strength > 0), 'Upward scrolling reverses the actual background pull.');
  const moving = f.scrollMotion.filter(motion => motion.strength > 0);
  assert.ok(moving.every(motion => [motion.x, motion.y, motion.strength, motion.time].every(Number.isFinite)));
  assert.ok(moving.every(motion => Math.abs(motion.x) <= 4 && Math.abs(motion.y) <= 4));
  f.drain();
  const count = f.scrollMotion.length;
  f.advance(500);
  assert.equal(f.scrollMotion.length, count, 'Recovered material does not keep emitting motion.');
  assert.equal(f.pending(), 0);
  f.controller.dispose();
});

test('motion output has a shared frame and impulse budget under dense high-frequency input', () => {
  const f = fixture();
  const elements = Array.from({ length: 8 }, () => f.target());
  f.visual(...elements.map((element, index) => f.sample(element, { x: 100 + index * 100 })));
  for (let index = 0; index < 60; index++) {
    f.tick(16);
    f.visual(...elements.map((element, item) => f.sample(element, { x: 100 + item * 100 + index * 2 })));
    f.step(0);
  }
  assert.ok(f.impulses.length > 0);
  assert.ok(f.impulses.length <= 12, 'The combined motion stream admits at most twelve impulses in one second.');
  const bursts = new Map();
  for (const time of f.impulseTimes) bursts.set(time, (bursts.get(time) || 0) + 1);
  assert.ok([...bursts.values()].every(count => count <= 2), 'A flush cannot exceed the two-region material budget.');
  const times = [...bursts.keys()];
  assert.ok(times.every((time, index) => index === 0 || time - times[index - 1] >= 1000 / 12 - 1));
  f.drain();
  f.controller.dispose();
});

test('reduced motion, hidden documents, blur, and navigation cancel pending motion and reset velocity', () => {
  const interruptions = [
    { stop: f => f.reducedChange(true), resume: f => f.reducedChange(false) },
    { stop: f => { f.doc.hidden = true; f.send('visibilitychange'); }, resume: f => { f.doc.hidden = false; f.send('visibilitychange'); } },
    { stop: f => f.blur(), resume: f => f.focus() },
    { stop: f => f.send('h4:navigationstart'), resume: f => f.send('h4:pagechange') },
    { stop: f => f.modeChange('normal'), resume: f => f.modeChange('xray') },
  ];
  for (const { stop, resume } of interruptions) {
    const f = fixture();
    const element = f.target();
    f.visual(f.sample(element));
    f.tick(100);
    f.visual(f.sample(element, { x: 340 }));
    f.scrollTo(120);
    stop(f);
    const impulseCount = f.impulses.length;
    const scrollCount = f.scrollMotion.length;
    f.visual(f.sample(element, { x: 900 }));
    f.scrollTo(900);
    f.advance(200);
    assert.equal(f.impulses.length, impulseCount);
    assert.equal(f.scrollMotion.length, scrollCount);
    assert.equal(f.pending(), 0, 'Suspension cancels the finite inertia loop immediately.');
    resume(f);
    f.visual(f.sample(element, { x: 900 }));
    f.advance(100);
    assert.equal(f.impulses.length, impulseCount, 'Resuming never uses the stale pre-suspension pose.');
    f.controller.dispose();
  }
});

test('runtime motion strengths can disable text and section damage without changing choreography', () => {
  const f = fixture('xray', { sectionMosh: 0, typographyMosh: 0 });
  const text = f.target();
  const section = f.target();
  f.visual(f.sample(text), f.sample(section, { kind: 'section' }));
  f.tick(100);
  f.visual(f.sample(text, { x: 400 }), f.sample(section, { kind: 'section', y: 400 }));
  f.advance(100);
  assert.equal(f.impulses.length, 0);
  f.configure({ sectionMosh: 1, typographyMosh: 1 });
  f.visual(f.sample(text, { x: 440 }), f.sample(section, { kind: 'section', y: 440 }));
  f.advance(100);
  assert.ok(f.impulses.length > 0, 'Consumers read current calibration values on each motion update.');
  f.controller.dispose();
});

test('dispose removes motion listeners and cancels scheduled recovery', () => {
  const f = fixture();
  f.tick(100);
  f.scrollTo(200);
  assert.ok(f.pending() > 0);
  f.controller.dispose();
  assert.equal(f.pending(), 0);
  const impulses = f.impulses.length;
  const scroll = f.scrollMotion.length;
  f.tick(100);
  f.scrollTo(400);
  const element = f.target();
  f.visual(f.sample(element));
  f.tick(100);
  f.visual(f.sample(element, { x: 500 }));
  f.advance(200);
  assert.equal(f.impulses.length, impulses);
  assert.equal(f.scrollMotion.length, scroll);
  assert.equal(f.pending(), 0);
});

test('visual publishers cap sampling and retain the final coalesced exit pose without an idle loop', () => {
  const f = fixture();
  f.controller.dispose();
  const batches = [];
  f.doc.addEventListener('h4:visualmotion', event => batches.push({ ...event.detail, receivedAt: f.now() }));
  const publisher = createVisualMotionPublisher({ doc: f.doc });
  const element = f.target();
  assert.equal(publisher.ready(), true);
  assert.equal(publisher.publish([f.sample(element)]), true);
  f.step();
  assert.ok(batches.length > 0);
  for (let index = 0; index < 6; index++) {
    f.tick(4);
    publisher.publish([f.sample(element, { x: 300 + index * 30 })]);
    f.step(0);
  }
  publisher.publish([f.sample(element, { x: 600, y: -80, opacity: 0 })]);
  f.drain(500);
  assert.equal(batches.at(-1).samples[0].y, -80, 'Throttling retains the last exit sample after scrolling ends.');
  assert.equal(batches.at(-1).samples[0].opacity, 0);
  assert.ok(batches.every((batch, index) => index === 0 || batch.receivedAt - batches[index - 1].receivedAt >= 1000 / 12 - 1));
  const count = batches.length;
  f.advance(500);
  assert.equal(batches.length, count);
  assert.equal(f.pending(), 0);
  publisher.reset();
});

test('visual publisher gating rejects Normal and reduced-motion frames before allocating work', () => {
  const f = fixture('normal');
  f.controller.dispose();
  const batches = [];
  f.doc.addEventListener('h4:visualmotion', event => batches.push(event.detail));
  const publisher = createVisualMotionPublisher({ doc: f.doc });
  const element = f.target();
  assert.equal(publisher.ready(), false);
  assert.equal(publisher.publish([f.sample(element)]), false);
  assert.equal(f.pending(), 0);
  f.modeChange('xray');
  assert.equal(publisher.ready(), true);
  publisher.publish([f.sample(element)]);
  f.tick(4);
  publisher.publish([f.sample(element, { x: 350 })]);
  const before = batches.length;
  f.reducedChange(true);
  assert.equal(publisher.ready(), false);
  assert.equal(publisher.publish([f.sample(element, { x: 700 })]), false);
  f.advance(250);
  assert.equal(batches.length, before, 'A preference change cancels an already queued publication.');
  assert.equal(f.pending(), 0);
  publisher.reset();
});
