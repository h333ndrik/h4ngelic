import test from 'node:test';
import assert from 'node:assert/strict';
import { bindReverseShortcut, bindXRayShortcut } from '../src/xray-shortcut.js';

function fixture() {
  let now = 0, serial = 0, reversals = 0, primes = 0;
  let other = true;
  const timers = new Map();
  const view = Object.assign(new EventTarget(), {
    performance: { now: () => now },
    setTimeout(callback, delay) { timers.set(++serial, { callback, at: now + delay }); return serial; },
    clearTimeout(id) { timers.delete(id); },
  });
  const doc = Object.assign(new EventTarget(), { defaultView: view, hidden: false, activeElement: null });
  const stop = bindReverseShortcut(doc, () => { reversals++; other = false; }, { isEnabled: () => other, onStart: () => primes++ });
  const event = (type, values = {}, target = doc) => {
    const e = new Event(type, { cancelable: true }); Object.assign(e, values); target.dispatchEvent(e); return e;
  };
  const key = (type, values = {}) => event(type, { key: '3', code: 'Digit3', ...values });
  const press = (values = {}) => { key('keydown', values); key('keyup', values); };
  const tick = amount => {
    const end = now + amount;
    while (true) {
      const task = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!task) break;
      now = task[1].at; timers.delete(task[0]); task[1].callback();
    }
    now = end;
  };
  return { doc, view, event, key, press, tick, stop, setOther(value) { other = value; },
    get reversals() { return reversals; }, get primes() { return primes; }, get pending() { return timers.size; } };
}

test('three distinct released presses reverse once inside a fixed two-second window', () => {
  const f = fixture();
  f.press(); f.tick(999); f.press(); f.tick(1000);
  assert.equal(f.reversals, 0);
  f.press(); assert.equal(f.reversals, 1); assert.equal(f.pending, 0);
  for (let i = 0; i < 6; i++) f.press();
  assert.equal(f.reversals, 1, 'Normal Mode cannot execute a reverse sequence.');
  f.stop();
});

test('repeat, duplicate keydown and overlapping main/numpad keys never fabricate presses', () => {
  const f = fixture();
  f.key('keydown');
  for (let i = 0; i < 10; i++) f.key('keydown', { repeat: true });
  f.key('keydown'); f.key('keydown', { code: 'Numpad3', key: 'PageDown' });
  assert.equal(f.primes, 1);
  f.key('keyup');
  f.press({ code: 'Numpad3', key: 'PageDown' });
  assert.equal(f.reversals, 0);
  f.press(); assert.equal(f.reversals, 1);
  f.stop();
});

test('a timed-out sequence cannot combine with later presses', () => {
  const f = fixture();
  f.press(); f.tick(1500); f.press(); f.tick(500);
  assert.equal(f.pending, 0);
  f.press(); f.press(); assert.equal(f.reversals, 0);
  f.press(); assert.equal(f.reversals, 1);
  f.stop();
});

test('focus, navigation, mode changes, composition and hidden pages cancel incomplete sequences', () => {
  for (const type of ['blur', 'h4:navigationstart', 'h4:pagechange', 'h4:modechange', 'compositionstart', 'visibilitychange']) {
    const f = fixture(); f.press(); f.press();
    if (type === 'visibilitychange') f.doc.hidden = true;
    f.event(type, {}, type === 'blur' ? f.view : f.doc);
    f.doc.hidden = false;
    f.press(); assert.equal(f.reversals, 0, type);
    f.press(); f.press(); assert.equal(f.reversals, 1, type);
    f.stop();
  }
});

test('editable controls, modifiers and composing text retain ordinary input', () => {
  const f = fixture();
  for (const editable of [{ isContentEditable: true }, { closest: () => ({}) }]) {
    f.doc.activeElement = editable;
    for (let i = 0; i < 3; i++) assert.equal(f.key('keydown').defaultPrevented, false);
  }
  f.doc.activeElement = null;
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'isComposing']) {
    f.press(); f.press();
    assert.equal(f.key('keydown', { [modifier]: true }).defaultPrevented, false);
    f.press(); assert.equal(f.reversals, 0);
    f.event('h4:modechange');
  }
  f.stop(); assert.equal(f.pending, 0);
  f.press(); f.press(); f.press(); assert.equal(f.reversals, 0, 'Disposal removes every listener.');
});

test('the enter hold can be disabled on the Other Side without handling the key', () => {
  const f = fixture(); let enters = 0;
  const stop = bindXRayShortcut(f.doc, () => enters++, { isEnabled: () => false });
  assert.equal(f.event('keydown', { key: '4', code: 'Digit4' }).defaultPrevented, false);
  f.tick(4000); assert.equal(enters, 0);
  stop(); f.stop();
});
