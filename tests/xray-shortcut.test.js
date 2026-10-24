import test from 'node:test';
import assert from 'node:assert/strict';
import { bindXRayShortcut } from '../src/xray-shortcut.js';
import { xraySettings } from '../src/data/xraySettings.js';

function fixture() {
  let now = 0;
  let id = 0;
  let unlocks = 0;
  const tasks = new Map();
  const view = Object.assign(new EventTarget(), {
    performance: { now: () => now },
    setTimeout(callback, delay) { tasks.set(++id, { callback, at: now + delay }); return id; },
    clearTimeout(handle) { tasks.delete(handle); },
  });
  const doc = Object.assign(new EventTarget(), { defaultView: view, hidden: false, activeElement: null });
  const dispose = bindXRayShortcut(doc, () => unlocks++);
  const send = (type, properties = {}, target = doc) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, properties);
    target.dispatchEvent(event);
    return event;
  };
  const key = (type, properties = {}) => send(type, { key: '4', code: 'Digit4', ...properties });
  const tick = (time) => {
    const end = now + time;
    while (true) {
      const next = [...tasks.entries()].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      tasks.delete(next[0]);
      next[1].callback();
    }
    now = end;
  };
  return { doc, view, key, send, tick, dispose, get unlocks() { return unlocks; }, get pending() { return tasks.size; } };
}

test('the shortcut requires a full continuous second and fires only once per press', () => {
  assert.equal(xraySettings.shortcutHoldMs, 1000);
  const f = fixture();
  assert.equal(f.key('keydown').defaultPrevented, true);
  f.tick(999);
  assert.equal(f.unlocks, 0);
  f.key('keydown', { repeat: true });
  f.tick(1);
  assert.equal(f.unlocks, 1);
  for (let index = 0; index < 12; index++) f.key('keydown', { repeat: true });
  f.tick(5000);
  assert.equal(f.unlocks, 1);
  assert.equal(f.pending, 0, 'No recurring timer runs while the key remains held.');
  f.key('keyup');
  f.key('keydown');
  f.tick(1000);
  assert.equal(f.unlocks, 2, 'A new full hold can toggle back.');
  f.dispose();
});

test('short taps cannot accumulate into an unlock', () => {
  const f = fixture();
  for (let index = 0; index < 4; index++) {
    f.key('keydown');
    f.tick(999);
    f.key('keyup');
  }
  f.tick(2000);
  assert.equal(f.unlocks, 0);
  assert.equal(f.pending, 0);
  f.dispose();
});

test('numpad 4 is supported and releasing another key does not interrupt a hold', () => {
  const f = fixture();
  f.key('keydown', { key: 'ArrowLeft', code: 'Numpad4' });
  f.tick(600);
  f.key('keyup', { key: 'a', code: 'KeyA' });
  f.tick(400);
  assert.equal(f.unlocks, 1);
  f.key('keyup', { key: 'ArrowLeft', code: 'Numpad4' });
  f.dispose();
});

test('lost focus, hidden documents, composition and navigation cancel an incomplete hold', () => {
  for (const interruption of ['blur', 'visibilitychange', 'compositionstart', 'h4:pagechange']) {
    const f = fixture();
    f.key('keydown');
    f.tick(800);
    if (interruption === 'visibilitychange') f.doc.hidden = true;
    f.send(interruption, {}, interruption === 'blur' ? f.view : f.doc);
    f.tick(2000);
    assert.equal(f.unlocks, 0, interruption);
    assert.equal(f.pending, 0, interruption);
    f.dispose();
  }
});

test('typing and modifiers preserve their normal behavior and cancel pending unlocks', () => {
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'isComposing']) {
    const f = fixture();
    assert.equal(f.key('keydown', { [modifier]: true }).defaultPrevented, false);
    f.tick(1000);
    f.key('keydown');
    f.tick(500);
    f.key('keydown', { key: 'Shift', code: 'ShiftLeft', [modifier]: true });
    f.tick(1000);
    assert.equal(f.unlocks, 0, modifier);
    f.dispose();
  }
  const f = fixture();
  f.doc.activeElement = { isContentEditable: true };
  assert.equal(f.key('keydown').defaultPrevented, false);
  f.tick(1000);
  assert.equal(f.unlocks, 0);
  f.doc.activeElement = null;
  f.key('keydown');
  f.tick(500);
  f.doc.activeElement = { closest: () => ({}) };
  f.send('focusin');
  f.tick(1000);
  assert.equal(f.unlocks, 0);
  f.dispose();
});

test('disposal removes a pending timer and all shortcut listeners', () => {
  const f = fixture();
  f.key('keydown');
  f.tick(500);
  f.dispose();
  f.tick(2000);
  assert.equal(f.pending, 0);
  assert.equal(f.key('keydown').defaultPrevented, false);
  f.tick(2000);
  assert.equal(f.unlocks, 0);
});
