import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initCorruptionLifecycle } from '../src/corruption-lifecycle.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const emptyBinding = moduleURL(`const empty = () => {}; empty.cancel = () => {}; empty.refresh = () => {};
  export const bindXRayShortcut = () => empty;
  export const bindReverseShortcut = () => empty;
  export const bindModeHold = () => empty;
  export const initMobileMode = () => empty;`);
let source = (await readFile(new URL('../src/xray.js', import.meta.url), 'utf8')).replace(/^import ['"]\.\/xray\.css['"];?\s*/m, '');
for (const name of ['xray-shortcut.js', 'mode-hold.js', 'mobile-mode.js']) source = source.replace(`'./${name}'`, JSON.stringify(emptyBinding));
source = source.replace("'./mode-snapshot.js'", JSON.stringify(moduleURL('export const createModeSnapshotTransition = ({doc}) => doc.__snapshot;')))
  .replace("'./mode-audio.js'", JSON.stringify(moduleURL('export const createModeAudio = ({view}) => view.__audio;')));
for (const name of ['xraySettings.js', 'corruptionSettings.js', 'livingDecaySettings.js']) source = source.replace(`'./data/${name}'`, JSON.stringify(new URL(`../src/data/${name}`, import.meta.url).href));
const { initXRay } = await import(moduleURL(`${source}\n//# sourceURL=xray-memory-handoff-fixture.js`));

class Element {
  constructor() {
    this.attributes = new Map();
    this.style = {
      values: new Map(),
      getPropertyValue(name) { return this.values.get(name) || ''; },
      setProperty(name, value) { this.values.set(name, String(value)); },
      removeProperty(name) { this.values.delete(name); },
    };
    this.dataset = new Proxy({}, {
      get: (_, key) => this.getAttribute(`data-${String(key).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`) ?? undefined,
      set: (_, key, value) => { this.setAttribute(`data-${String(key).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, value); return true; },
    });
    this.classList = { add() {} };
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelectorAll() { return []; }
  append() {}
  remove() {}
}

function fixture({ reduced = false, native = true } = {}) {
  const events = [], captures = [], released = [], preparations = [], audioModes = [];
  const view = Object.assign(new EventTarget(), {
    navigator: {}, performance: { now: () => 0 }, crypto: { getRandomValues(array) { array[0] = 174033; return array; } },
    matchMedia(query) { return Object.assign(new EventTarget(), { matches: reduced && query.includes('reduce') }); },
    getComputedStyle: () => ({ getPropertyValue: () => '#242424' }),
    CustomEvent: class extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout, clearTimeout,
  });
  const status = { textContent: '' };
  const doc = Object.assign(new EventTarget(), {
    defaultView: view, nodeType: 9, hidden: false, documentElement: new Element(), body: new Element(),
    createElementNS: () => new Element(), createElement: () => new Element(),
    querySelectorAll: selector => selector === '[data-mode-status]' ? [status] : [],
    querySelector: () => null,
  });
  view.__audio = { supported: true, muted: false, prime: () => Promise.resolve(), play: mode => audioModes.push(mode), stop() {}, dispose() {} };
  let active = null;
  doc.__snapshot = {
    prepare() {},
    run(update, options) {
      if (!native) { update({ captured: false, ...options }); return null; }
      const finished = deferred();
      const record = { options, committed: false, finished,
        commit() { if (!record.committed) { record.committed = true; update({ captured: true, ...options }); } },
        end() { if (active === record) active = null; events.push('native-cleaned'); finished.resolve(); },
      };
      active = record; captures.push(record);
      return { native: true, finished: finished.promise };
    },
    skip() { if (active) { const previous = active; previous.commit(); previous.end(); } },
    dispose() { this.skip(); },
  };
  const memory = {
    prepareTransition(options) { const wait = deferred(); preparations.push({ options, ...wait }); return wait.promise; },
    finishTransition(token) { events.push('memory-released'); released.push(token); },
  };
  const dispose = initXRay({ root: doc, memory });
  return { doc, view, status, events, captures, preparations, released, audioModes, memory, dispose,
    send(type) { doc.dispatchEvent(new Event(type)); },
  };
}

test('mode entry waits for a real damaged frame before native capture and releases after native cleanup', async () => {
  const f = fixture();
  f.dispose.setMode('xray');
  assert.equal(f.doc.documentElement.dataset.mode, 'normal');
  assert.equal(f.captures.length, 0);
  assert.equal(f.doc.documentElement.hasAttribute('data-memory-mosh-preparing'), true);
  const token = { id: 1 };
  f.preparations[0].resolve(token); await flush();
  assert.equal(f.captures.length, 1);
  assert.equal(f.captures[0].options.variant, f.preparations[0].options.variant);
  assert.equal(f.doc.documentElement.dataset.mode, 'normal');
  f.captures[0].commit();
  assert.equal(f.doc.documentElement.dataset.mode, 'xray');
  assert.deepEqual(f.released, []);
  f.captures[0].end(); await flush();
  assert.deepEqual(f.events, ['native-cleaned', 'memory-released']);
  assert.deepEqual(f.released, [token]);
  assert.equal(f.doc.documentElement.hasAttribute('data-xray-transition'), false);
  f.dispose();
});

test('reversing an uncommitted entry cannot resurrect it after material loading completes', async () => {
  const f = fixture();
  f.dispose.setMode('xray');
  f.dispose.setMode('normal');
  const token = { id: 1 }; f.preparations[0].resolve(token); await flush();
  assert.equal(f.doc.documentElement.dataset.mode, 'normal');
  assert.equal(f.captures.length, 0);
  assert.deepEqual(f.audioModes, []);
  assert.deepEqual(f.released, [token]);
  f.dispose();
});

test('superseded native callbacks are invalidated before skip can commit them', async () => {
  const f = fixture();
  f.dispose.setMode('xray');
  const token = { id: 1 }; f.preparations[0].resolve(token); await flush();
  f.dispose.setMode('normal'); await flush();
  assert.equal(f.doc.documentElement.dataset.mode, 'normal');
  assert.deepEqual(f.audioModes, []);
  assert.equal(f.captures.length, 1);
  f.dispose();
});

test('hidden, navigation and disposal cancel loading without changing the current reality', async () => {
  for (const reason of ['hidden', 'navigation', 'dispose']) {
    const f = fixture(); f.dispose.setMode('xray');
    if (reason === 'hidden') { f.doc.hidden = true; f.send('visibilitychange'); }
    if (reason === 'navigation') f.send('h4:navigationstart');
    if (reason === 'dispose') f.dispose();
    const token = { id: reason }; f.preparations[0].resolve(token); await flush();
    assert.notEqual(f.doc.documentElement.dataset.mode, 'xray');
    assert.equal(f.captures.length, 0);
    assert.deepEqual(f.released, [token]);
    if (reason !== 'dispose') f.dispose();
  }
});

test('failed preparation stays normal and can be retried instead of exposing an unprepared source', async () => {
  const f = fixture();
  f.dispose.setMode('xray'); f.preparations[0].resolve(null); await flush();
  assert.equal(f.doc.documentElement.dataset.mode, 'normal');
  assert.equal(f.captures.length, 0);
  assert.match(f.status.textContent, /could not be prepared/);
  f.dispose.setMode('xray');
  assert.equal(f.preparations.length, 2);
  const token = { id: 2 }; f.preparations[1].resolve(token); await flush();
  f.captures[0].commit(); f.captures[0].end(); await flush();
  assert.equal(f.doc.documentElement.dataset.mode, 'xray');
  f.dispose();
});

test('reduced motion and unsupported capture use the same prepared frame without a native transition', async () => {
  const f = fixture({ reduced: true, native: false });
  f.dispose.setMode('xray');
  const token = { id: 1 }; f.preparations[0].resolve(token); await flush();
  assert.equal(f.doc.documentElement.dataset.mode, 'xray');
  assert.equal(f.captures.length, 0);
  assert.deepEqual(f.released, [token]);
  f.dispose();
});

test('lifecycle coalesces loading and reports actual prepared/released token ownership', async () => {
  const f = fixture(); f.dispose();
  const loading = deferred(); let loads = 0, current = null, disposed = 0;
  const phases = [];
  const controller = {
    setActive() {}, dispose() { disposed++; },
    prepareMemoryTransition(options) { return current = { id: options.variant }; },
    finishMemoryTransition(token) { if (token !== current) return false; current = null; return true; },
    snapshot: () => ({ ambient: { frozen: Boolean(current) } }),
  };
  f.doc.addEventListener('h4:memoryhandoff', event => phases.push(event.detail));
  const lifecycle = initCorruptionLifecycle(f.doc, { loadController: () => { loads++; return loading.promise; } });
  const preparing = lifecycle.prepare();
  const handoff = lifecycle.prepareTransition({ variant: 17 });
  assert.equal(loads, 1);
  loading.resolve(controller); await preparing;
  const token = await handoff;
  assert.equal(token, current);
  assert.equal(f.doc.documentElement.hasAttribute('data-memory-mosh-ready'), true);
  assert.deepEqual(phases.map(({ phase, variant, snapshot }) => [phase, variant, snapshot.frozen]), [['prepared', 17, true]]);
  assert.equal(lifecycle.finishTransition({ id: 17 }), false);
  assert.equal(phases.length, 1);
  lifecycle.finishTransition(token);
  assert.deepEqual(phases.map(({ phase, variant, snapshot }) => [phase, variant, snapshot.frozen]), [['prepared', 17, true], ['released', 17, false]]);
  lifecycle();
  assert.equal(disposed, 1);
  assert.equal(f.doc.documentElement.hasAttribute('data-memory-mosh-ready'), false);
});

test('late lifecycle controller creation is disposed and cannot publish a prepared frame', async () => {
  const f = fixture(); f.dispose();
  const loading = deferred(); let disposed = 0;
  const lifecycle = initCorruptionLifecycle(f.doc, { loadController: () => loading.promise });
  const result = lifecycle.prepareTransition({ variant: 1 }); lifecycle();
  loading.resolve({ dispose() { disposed++; } });
  assert.equal(await result, null);
  assert.equal(disposed, 1);
  assert.equal(f.doc.documentElement.hasAttribute('data-memory-mosh-ready'), false);
});
