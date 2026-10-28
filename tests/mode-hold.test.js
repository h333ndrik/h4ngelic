import test from 'node:test';
import assert from 'node:assert/strict';
import { bindModeHold } from '../src/mode-hold.js';

function fixture() {
  let now = 0;
  let sequence = 0;
  let activations = 0;
  const tasks = new Map();
  const starts = [];
  const ends = [];
  const view = Object.assign(new EventTarget(), {
    performance: { now: () => now }, scrollX: 0, scrollY: 0,
    setTimeout(callback, delay) { tasks.set(++sequence, { callback, at: now + delay }); return sequence; },
    clearTimeout(handle) { tasks.delete(handle); },
  });
  const button = { isConnected: true, disabled: false, getAttribute: () => null, closest: () => button };
  const doc = Object.assign(new EventTarget(), { defaultView: view, hidden: false });
  const dispose = bindModeHold(doc, () => activations++, { onStart: (event) => starts.push(event.type), onEnd: (reason) => ends.push(reason) });
  function send(type, properties = {}, dispatchTarget = doc) {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({ target: button, ...properties })) Object.defineProperty(event, key, { value });
    dispatchTarget.dispatchEvent(event);
    return event;
  }
  const pointer = (type, properties = {}) => send(type, { pointerId: 1, clientX: 50, clientY: 80, button: 0, isPrimary: true, pointerType: 'touch', ...properties });
  function tick(time) {
    const end = now + time;
    while (true) {
      const next = [...tasks.entries()].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; tasks.delete(next[0]); next[1].callback();
    }
    now = end;
  }
  return { doc, view, button, dispose, send, pointer, tick, starts, ends, get activations() { return activations; }, get pending() { return tasks.size; } };
}

test('a touch hold requires one second and its release/click cannot toggle twice', () => {
  const f = fixture();
  f.pointer('pointerdown');
  assert.deepEqual(f.starts, ['pointerdown'], 'Audio/preloading begin in the original user gesture.');
  f.tick(999); assert.equal(f.activations, 0);
  f.tick(1); assert.equal(f.activations, 1);
  f.tick(2500); assert.equal(f.activations, 1);
  f.pointer('pointerup');
  f.send('click', { detail: 1, pointerType: 'touch' });
  f.send('click', { detail: 0 }); // Some touch browsers omit click pointer metadata.
  assert.equal(f.activations, 1);
  assert.equal(f.pending, 0);
  assert.deepEqual(f.ends, ['complete']);
  f.dispose();
});

test('short pointer taps only reveal the secret and cannot accumulate', () => {
  const f = fixture();
  for (let index = 0; index < 3; index++) {
    f.pointer('pointerdown'); f.tick(900); f.pointer('pointerup'); f.send('click', { detail: 1 });
  }
  f.tick(1000);
  assert.equal(f.activations, 0);
  assert.equal(f.pending, 0);
  f.dispose();
});

test('movement, scrolling, lost focus, hidden state, cancellation and navigation stop a pending hold', () => {
  for (const cause of ['movement', 'scroll', 'blur', 'hidden', 'pointercancel', 'navigation']) {
    const f = fixture();
    f.pointer('pointerdown'); f.tick(700);
    if (cause === 'movement') f.pointer('pointermove', { clientX: 61 });
    if (cause === 'scroll') { f.view.scrollY = 3; f.send('scroll', {}, f.view); }
    if (cause === 'blur') f.send('blur', {}, f.view);
    if (cause === 'hidden') { f.doc.hidden = true; f.send('visibilitychange'); }
    if (cause === 'pointercancel') f.pointer('pointercancel');
    if (cause === 'navigation') f.send('h4:pagechange');
    f.tick(1000);
    assert.equal(f.activations, 0, cause);
    assert.equal(f.pending, 0, cause);
    assert.deepEqual(f.ends, ['cancel'], cause);
    f.dispose();
  }
});

test('native keyboard and assistive button activation remain available without a timed gesture', () => {
  const f = fixture();
  f.send('click', { detail: 0 });
  assert.equal(f.activations, 1);
  f.pointer('pointerdown'); f.tick(20); f.pointer('pointerup');
  f.send('keydown', { key: 'Enter' });
  f.send('click', { detail: 0 });
  assert.equal(f.activations, 2, 'An explicit keyboard activation works immediately after a pointer tap.');
  assert.deepEqual(f.starts, ['click', 'pointerdown', 'click']);
  f.dispose();
});

test('disabled or removed controls and disposed listeners never activate', () => {
  const f = fixture();
  f.button.disabled = true;
  f.pointer('pointerdown'); f.tick(1200); f.send('click', { detail: 0 });
  assert.equal(f.activations, 0);
  f.button.disabled = false;
  f.pointer('pointerdown'); f.button.isConnected = false; f.tick(1200);
  assert.equal(f.activations, 0);
  f.button.isConnected = true;
  f.pointer('pointerdown'); f.dispose(); f.tick(1200);
  f.send('click', { detail: 0 });
  assert.equal(f.activations, 0);
  assert.equal(f.pending, 0);
});
