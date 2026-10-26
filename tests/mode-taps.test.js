import test from 'node:test';
import assert from 'node:assert/strict';
import { bindModeTaps } from '../src/mode-taps.js';

function fixture(initialMode = 'normal') {
  let time = 0, timerId = 0, mode = initialMode, enabled = true;
  const tasks = new Map(), changes = [], progress = [], preparations = [];
  const view = Object.assign(new EventTarget(), {
    performance: { now: () => time, timeOrigin: 1700000000000 },
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
    for (const [name, value] of Object.entries({ target: button, timeStamp: time, ...properties })) Object.defineProperty(event, name, { value });
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
    get now() { return time; },
    get pending() { return tasks.size; } };
}

function recordedTap(f, physicalClick, delivered, { epoch = false, pointerId = 7 } = {}) {
  f.tick(delivered - f.now);
  const stamp = value => epoch ? f.view.performance.timeOrigin + value : value;
  f.pointer('pointerdown', { timeStamp: stamp(physicalClick - 30), pointerId });
  f.pointer('pointerup', { timeStamp: stamp(physicalClick), pointerId });
  f.click({ timeStamp: stamp(physicalClick) });
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

test('queued physical taps within two seconds still complete after handler delivery and UI expiry', () => {
  for (const epoch of [false, true]) {
    for (const initialMode of ['normal', 'xray']) {
      const f = fixture(initialMode);
      const physical = initialMode === 'xray' ? [100, 900, 2091] : [100, 500, 1100, 2091];
      const delivered = initialMode === 'xray' ? [100, 1500, 2700] : [100, 700, 1700, 3200];
      for (let index = 0; index < physical.length - 1; index++) recordedTap(f, physical[index], delivered[index], { epoch });
      f.tick(2100 - f.now);
      assert.equal(f.dispose.snapshot().count, 0, 'Visible progress clears at the original physical deadline.');
      assert.equal(f.dispose.snapshot().retained, true, 'At most one bounded partial record remains for queued input.');
      const last = physical.length - 1;
      recordedTap(f, physical[last], delivered[last], { epoch });
      assert.deepEqual(f.changes, [initialMode === 'xray' ? 'normal' : 'xray']);
      assert.equal(f.preparations.length, 1, 'A queued completion resumes the original prepared gesture.');
      assert.equal(f.dispose.snapshot().retained, false);
      assert.equal(f.pending, 0);
      f.dispose();
    }
  }
});

test('delivery grace never extends the physical two-second window or replays older accepted input', () => {
  for (const lastPhysical of [2100, 2101, 2700, 850]) {
    const f = fixture('xray');
    recordedTap(f, 100, 100);
    recordedTap(f, 900, 1500);
    f.tick(2200 - f.now);
    recordedTap(f, lastPhysical, 2800);
    assert.deepEqual(f.changes, [], `Physical ${lastPhysical}ms cannot finish the original window.`);
    assert.equal(f.dispose.snapshot().count, 1, 'An out-of-window input only begins a new sequence.');
    assert.equal(f.preparations.length, 2);
    f.dispose();
  }
});

test('physical hold duration stays capped at 450ms even when handlers are dispatched together or far apart', () => {
  for (const duration of [449, 450, 451, 1500]) {
    const f = fixture();
    f.tick(2000);
    f.pointer('pointerdown', { timeStamp: 100 });
    f.pointer('pointerup', { timeStamp: 100 + duration });
    f.click({ timeStamp: 100 + duration });
    assert.equal(f.dispose.snapshot().count, duration <= 450 ? 1 : 0);
    f.dispose();
  }
  const f = fixture();
  f.tick(100); f.pointer('pointerdown', { timeStamp: 100 });
  f.tick(1900); f.pointer('pointerup', { timeStamp: 130 }); f.click({ timeStamp: 130 });
  assert.equal(f.dispose.snapshot().count, 1, 'A 30ms physical tap does not become a 1900ms hold because of delivery delay.');
  f.dispose();
});

test('UI expiry between pointerup and its queued compatibility click preserves the completed physical gesture', () => {
  const f = fixture('xray');
  recordedTap(f, 100, 100);
  recordedTap(f, 900, 1500);
  f.tick(2060 - f.now); f.pointer('pointerdown', { timeStamp: 2060 });
  f.tick(30); f.pointer('pointerup', { timeStamp: 2090 });
  f.tick(110);
  assert.equal(f.dispose.snapshot().count, 0);
  assert.equal(f.dispose.snapshot().retained, true);
  f.click({ timeStamp: 2090 });
  assert.deepEqual(f.changes, ['normal']);
  f.dispose();
});

test('native keyboard and assistive clicks also use their physical timestamps after delayed dispatch', () => {
  const f = fixture('xray');
  f.tick(100); f.accessible({ timeStamp: 100 });
  f.tick(1400); f.accessible({ timeStamp: 900 });
  f.tick(1200); f.accessible({ timeStamp: 2091 });
  assert.deepEqual(f.changes, ['normal']);
  assert.equal(f.preparations.length, 1);
  f.dispose();
});

test('hard cancellations discard retained history and reject physically older queued taps', () => {
  for (const cause of ['h4:navigationstart', 'h4:pagechange', 'h4:modechange', 'blur', 'hidden', 'scroll', 'explicit']) {
    const f = fixture('xray');
    recordedTap(f, 100, 100);
    recordedTap(f, 900, 1500);
    f.tick(2200 - f.now);
    assert.equal(f.dispose.snapshot().retained, true);
    if (cause === 'hidden') { f.doc.hidden = true; f.send('visibilitychange'); f.doc.hidden = false; }
    else if (cause === 'explicit') f.dispose.cancel();
    else f.send(cause, {}, ['blur', 'scroll'].includes(cause) ? f.view : f.doc);
    assert.equal(f.dispose.snapshot().retained, false, cause);
    recordedTap(f, 1991, 2600);
    assert.equal(f.dispose.snapshot().count, 0, cause);
    assert.deepEqual(f.changes, [], cause);
    recordedTap(f, 2700, 2700);
    assert.equal(f.dispose.snapshot().count, 1, 'A genuinely new gesture is still usable.');
    f.dispose();
  }
});

test('retained partial state expires after the bounded delivery grace and invalid or stale gestures cannot complete', () => {
  const f = fixture('xray');
  recordedTap(f, 100, 100); recordedTap(f, 900, 1500);
  f.tick(2100 - f.now);
  assert.equal(f.dispose.snapshot().retained, true);
  f.tick(5000);
  assert.equal(f.dispose.snapshot().retained, false);
  assert.equal(f.pending, 0);
  recordedTap(f, 2091, 7200);
  assert.deepEqual(f.changes, []);
  assert.equal(f.dispose.snapshot().count, 0, 'Input delayed beyond five seconds is not silently treated as fresh.');
  f.tick(100);
  f.pointer('pointerdown', { timeStamp: 7250 });
  f.pointer('pointerup', { timeStamp: 7100 });
  f.click({ timeStamp: 7100 });
  assert.equal(f.dispose.snapshot().count, 0, 'A physical release cannot precede its press.');
  f.dispose();
});
