import test from 'node:test';
import assert from 'node:assert/strict';
import { bindModeTaps } from '../src/mode-taps.js';

function fixture(initialMode = 'normal') {
  let time = 0, timerId = 0, mode = initialMode, enabled = true;
  const tasks = new Map(), changes = [], progress = [], preparations = [];
  const view = Object.assign(new EventTarget(), {
    performance: { now: () => time },
    setTimeout(callback, delay) { tasks.set(++timerId, { callback, at: time + delay }); return timerId; },
    clearTimeout(id) { tasks.delete(id); },
  });
  const makeButton = () => {
    const attributes = new Map();
    const button = { disabled: false, isConnected: true, attributes,
      closest: selector => selector === '[data-mobile-mode]' ? button : null,
      getAttribute: name => attributes.get(name) ?? null };
    return button;
  };
  const button = makeButton();
  const doc = Object.assign(new EventTarget(), { defaultView: view, hidden: false });
  const dispose = bindModeTaps(doc, { getMode: () => mode, enabled: () => enabled,
    onPrepare: event => preparations.push(event.type), onComplete: next => changes.push(next),
    onProgress: (target, count, total) => progress.push({ target, count, total }) });
  const send = (type, properties = {}, dispatchTarget = doc) => {
    const event = new Event(type, { cancelable: true });
    for (const [name, value] of Object.entries({ target: button, ...properties })) Object.defineProperty(event, name, { value });
    dispatchTarget.dispatchEvent(event);
    return event;
  };
  const pointer = (type, properties = {}) => send(type, { pointerId: 7, clientX: 50, clientY: 80,
    button: 0, isPrimary: true, pointerType: 'touch', ...properties });
  function tick(delta) {
    const until = time + delta;
    for (;;) {
      const next = [...tasks.entries()].filter(([, task]) => task.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      tasks.delete(next[0]); time = next[1].at; next[1].callback();
    }
    time = until;
  }
  const click = properties => send('click', { button: 0, detail: 1, pointerType: 'touch', isPrimary: false, ...properties });
  const tap = properties => { pointer('pointerdown', properties); tick(30); pointer('pointerup', properties); click({ target: properties?.target ?? button }); };
  const accessible = properties => send('click', { detail: 0, button: 0, ...properties });
  return { doc, view, button, makeButton, send, pointer, tick, click, tap, accessible, dispose,
    changes, progress, preparations, setMode(value) { mode = value; }, setEnabled(value) { enabled = value; },
    get pending() { return tasks.size; } };
}

test('four deliberate normal taps complete once, with progressive feedback and a final transition lock', () => {
  const f = fixture();
  for (let count = 1; count <= 4; count++) {
    f.tap();
    assert.equal(f.dispose.snapshot().count, count);
    assert.equal(f.progress.at(-1).count, count);
    assert.equal(f.progress.at(-1).total, 4);
    if (count < 4) assert.deepEqual(f.changes, []);
    f.tick(80);
  }
  assert.deepEqual(f.changes, ['xray']);
  assert.deepEqual(f.preparations, ['click']);
  assert.equal(f.dispose.snapshot().locked, true);
  assert.equal(f.pending, 0);
  f.tap(); f.accessible(); f.tick(2500);
  assert.deepEqual(f.changes, ['xray'], 'Extra clicks cannot duplicate an accepted transition.');
  f.dispose();
});

test('the same binder returns from Other Side with three taps through the shared mode callback', () => {
  const f = fixture('xray');
  f.tap(); f.tick(80); f.tap();
  assert.deepEqual(f.changes, []);
  f.tick(80); f.tap();
  assert.deepEqual(f.changes, ['normal']);
  assert.equal(f.progress.at(-1).total, 3);
  f.dispose();
});

test('a compatibility detail-zero click cannot count twice, while a real native keyboard activation still works immediately', () => {
  const f = fixture();
  f.tap();
  f.accessible(); f.click();
  assert.equal(f.dispose.snapshot().count, 1);
  f.send('keydown', { key: 'Enter', repeat: false });
  f.accessible();
  f.send('keyup', { key: 'Enter' });
  assert.equal(f.dispose.snapshot().count, 2);
  f.send('keydown', { key: ' ', repeat: false }); f.send('keyup', { key: ' ' }); f.accessible();
  assert.equal(f.dispose.snapshot().count, 3);
  f.send('keydown', { key: 'Enter', repeat: false }); f.accessible();
  assert.deepEqual(f.changes, ['xray']);
  f.dispose();
});

test('assistive activations without pointer events can form a deliberate sequence', () => {
  const f = fixture();
  for (let count = 0; count < 4; count++) { f.accessible(); f.tick(100); }
  assert.deepEqual(f.changes, ['xray']);
  f.dispose();
});

test('a held Enter key cannot manufacture taps from native repeat clicks', () => {
  const f = fixture();
  f.send('keydown', { key: 'Enter', repeat: false }); f.accessible();
  for (let repeat = 0; repeat < 6; repeat++) {
    f.tick(60); f.send('keydown', { key: 'Enter', repeat: true }); f.accessible();
  }
  assert.equal(f.dispose.snapshot().count, 1);
  assert.deepEqual(f.changes, []);
  f.send('keyup', { key: 'Enter' });
  f.dispose();
});

test('the two-second sequence window is fixed to its first tap and expiration resets feedback', () => {
  const f = fixture();
  f.accessible(); f.tick(900); f.accessible(); f.tick(900); f.accessible();
  assert.equal(f.dispose.snapshot().count, 3);
  f.tick(200);
  assert.equal(f.dispose.snapshot().count, 0);
  assert.equal(f.progress.at(-1).count, 0);
  f.accessible();
  assert.equal(f.dispose.snapshot().count, 1, 'An expired fourth activation begins a new sequence.');
  assert.equal(f.preparations.length, 2);
  assert.deepEqual(f.changes, []);
  f.dispose();
});

test('swipes, long holds, cancellation, mismatched release and invalid coordinates reject even detail-zero compatibility clicks', () => {
  for (const cause of ['swipe', 'hold', 'cancel', 'release-target', 'coordinates', 'secondary']) {
    const f = fixture();
    f.tap(); f.tick(80);
    f.pointer('pointerdown');
    if (cause === 'swipe') f.pointer('pointermove', { clientX: 70 });
    if (cause === 'hold') f.tick(451);
    if (cause === 'cancel') f.pointer('pointercancel');
    if (cause === 'secondary') f.pointer('pointerdown', { pointerId: 8, isPrimary: false });
    f.pointer('pointerup', cause === 'release-target' ? { target: f.makeButton() }
      : cause === 'coordinates' ? { clientX: NaN } : {});
    f.accessible(); f.click();
    assert.equal(f.dispose.snapshot().count, 0, cause);
    assert.equal(f.pending, 0, cause);
    assert.deepEqual(f.changes, [], cause);
    f.dispose();
  }
});

test('modified and right-button clicks cannot count or leave a usable stale pointer completion', () => {
  for (const properties of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 2 }]) {
    const f = fixture();
    f.pointer('pointerdown'); f.tick(30); f.pointer('pointerup');
    f.click(properties); f.accessible();
    assert.equal(f.dispose.snapshot().count, 0);
    f.dispose();
  }
});

test('navigation, focus loss, hiding, scrolling and mode changes cancel incomplete sequences', () => {
  for (const cause of ['h4:navigationstart', 'h4:pagechange', 'h4:modechange', 'blur', 'hidden', 'scroll']) {
    const f = fixture();
    f.tap(); f.tick(50); f.pointer('pointerdown');
    if (cause === 'hidden') { f.doc.hidden = true; f.send('visibilitychange'); }
    else f.send(cause, {}, ['blur', 'scroll'].includes(cause) ? f.view : f.doc);
    f.pointer('pointerup'); f.accessible(); f.tick(2500);
    assert.equal(f.dispose.snapshot().count, 0, cause);
    assert.equal(f.pending, 0, cause);
    assert.deepEqual(f.changes, [], cause);
    f.dispose();
  }
});

test('controls keep independent tap sequences and reject disabled, removed or unavailable targets', () => {
  const f = fixture();
  f.tap(); f.tick(80);
  const other = f.makeButton(); f.tap({ target: other });
  assert.equal(f.dispose.snapshot().count, 1);
  assert.equal(f.progress.at(-1).target, other);
  for (const condition of ['disabled', 'aria', 'removed', 'unavailable']) {
    f.dispose.cancel();
    f.button.disabled = condition === 'disabled';
    f.button.isConnected = condition !== 'removed';
    if (condition === 'aria') f.button.attributes.set('aria-disabled', 'true'); else f.button.attributes.delete('aria-disabled');
    f.setEnabled(condition !== 'unavailable');
    f.tap(); f.accessible();
    assert.equal(f.dispose.snapshot().count, 0, condition);
  }
  f.dispose();
});

test('disposal clears timers, progress and event bindings without later callbacks', () => {
  const f = fixture();
  f.tap();
  f.dispose();
  const size = f.progress.length;
  f.tick(3000); f.tap(); f.accessible(); f.dispose();
  assert.equal(f.pending, 0);
  assert.equal(f.progress.length, size);
  assert.deepEqual(f.changes, []);
  assert.equal(f.dispose.snapshot().count, 0);
});
