import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configureLivingDecay, getLivingDecaySettings } from '../src/data/livingDecaySettings.js';

// The browser-only CSS import has no bearing on native transition ownership or
// update promises. Keep these lifecycle checks independent of a browser/GPU.
const source = (await readFile(new URL('../src/mode-snapshot.js', import.meta.url), 'utf8'))
  .replace(/^import ['"]\.\/mode-snapshot\.css['"];?\s*/m, '');
const snapshotModuleURL = `data:text/javascript;base64,${Buffer.from(`${source}\n//# sourceURL=mode-snapshot-lifecycle-fixture.js`).toString('base64')}`;
const { createModeSnapshotTransition } = await import(snapshotModuleURL);
const serviceSource = (await readFile(new URL('../src/mosh-transitions.js', import.meta.url), 'utf8'))
  .replace("'./mode-snapshot.js'", JSON.stringify(snapshotModuleURL))
  .replace("'./data/interactionMoshSettings.js'", JSON.stringify(new URL('../src/data/interactionMoshSettings.js', import.meta.url).href))
  .replace("'./data/livingDecaySettings.js'", JSON.stringify(new URL('../src/data/livingDecaySettings.js', import.meta.url).href));
const { initMoshTransitions } = await import(`data:text/javascript;base64,${Buffer.from(`${serviceSource}\n//# sourceURL=mosh-transitions-lifecycle-fixture.js`).toString('base64')}`);

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const dataName = key => `data-${String(key).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;

class Node {
  constructor(tag = 'svg', attributes = '') {
    this.tagName = tag;
    this.nodeType = 1;
    this.isConnected = true;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.classList = { add: (...classes) => this.setAttribute('class', [...new Set(`${this.getAttribute('class') || ''} ${classes.join(' ')}`.trim().split(/\s+/))].join(' ')) };
    this.style = {
      values: new Map(),
      getPropertyValue(name) { return this.values.get(name)?.value || ''; },
      getPropertyPriority(name) { return this.values.get(name)?.priority || ''; },
      setProperty(name, value, priority = '') { this.values.set(name, { value, priority }); },
      removeProperty(name) { this.values.delete(name); },
    };
    this.dataset = new Proxy({}, {
      get: (_, key) => this.getAttribute(dataName(key)) ?? undefined,
      set: (_, key, value) => { this.setAttribute(dataName(key), value); return true; },
      deleteProperty: (_, key) => { this.removeAttribute(dataName(key)); return true; },
    });
    Object.defineProperty(this.style, 'viewTransitionName', {
      get() { return this.getPropertyValue('view-transition-name'); },
      set(value) { this.setProperty('view-transition-name', value); },
    });
    for (const match of attributes.matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)) this.setAttribute(match[1], match[2] ?? '');
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  get parentElement() { return this.parentNode; }
  contains(other) { return this === other || this.children.some(node => node.contains(other)); }
  matches(selector) {
    return selector.split(',').some(part => {
      const candidate = part.trim();
      if (candidate.startsWith('.')) return (this.getAttribute('class') || '').split(/\s+/).includes(candidate.slice(1));
      const attribute = /^(\w+)?\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/.exec(candidate);
      if (attribute) return (!attribute[1] || this.tagName.toLowerCase() === attribute[1].toLowerCase())
        && this.hasAttribute(attribute[2]) && (attribute[3] === undefined || this.getAttribute(attribute[2]) === attribute[3]);
      return this.tagName.toLowerCase() === candidate.toLowerCase();
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  getBoundingClientRect() {
    const rect = this.rect || { left: 100, top: 160, width: 280, height: 180 };
    return { ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height };
  }
  append(...nodes) { for (const node of nodes) { this.children.push(node); node.parentNode = this; node.isConnected = this.isConnected; } }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; this.isConnected = false; }
  set innerHTML(markup) {
    this.markup = markup;
    this.children = [];
    for (const filter of markup.matchAll(/<filter\b([^>]*)>([\s\S]*?)<\/filter>/g)) {
      const node = new Node('filter', filter[1]);
      node.markup = filter[2];
      for (const primitive of filter[2].matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) node.append(new Node(primitive[1], primitive[2]));
      this.append(node);
    }
  }
  get innerHTML() { return this.markup || ''; }
  querySelectorAll(selector) {
    return this.children.flatMap(node => [
      ...node.matches(selector) ? [node] : [],
      ...node.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function fixture({ supported = true, reduced = false, hidden = false } = {}) {
  let sequence = 0;
  let now = 0;
  const tasks = new Map();
  const frames = new Map();
  const media = new Map();
  const view = Object.assign(new EventTarget(), {
    innerWidth: 1000, innerHeight: 760,
    navigator: { hardwareConcurrency: 8, deviceMemory: 8 },
    performance: { now: () => now },
    crypto: { getRandomValues(array) { array[0] = 1947; return array; } },
    Image: class { decode() { return Promise.resolve(); } },
    CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } },
    matchMedia(query) {
      if (!media.has(query)) media.set(query, Object.assign(new EventTarget(), { matches: query.includes('reduced-motion') && reduced }));
      return media.get(query);
    },
    requestAnimationFrame(callback) { tasks.set(++sequence, callback); frames.set(sequence, callback); return sequence; },
    cancelAnimationFrame(handle) { tasks.delete(handle); frames.delete(handle); },
    setTimeout(callback) { tasks.set(++sequence, callback); return sequence; },
    clearTimeout(handle) { tasks.delete(handle); },
  });
  const doc = Object.assign(new EventTarget(), {
    defaultView: view, hidden, documentElement: new Node('html'), body: new Node('body'),
    createElementNS: (_, tag) => new Node(tag),
    getAnimations: () => [],
  });
  doc.contains = element => element?.ownerDocument === doc && element.isConnected;
  view.getComputedStyle = element => ({
    viewTransitionName: element.style.getPropertyValue('view-transition-name') || (element === doc.documentElement ? 'root' : 'none'),
    filter: element.style.getPropertyValue('filter') || element.stylesheetFilter || 'none',
    visibility: 'visible', display: 'block',
  });
  function makeTarget(visualClass = 'interaction-visual') {
    const target = new Node('button');
    const visual = new Node(visualClass === 'img' ? 'img' : 'span');
    if (visualClass !== 'img') visual.classList.add(visualClass);
    target.ownerDocument = doc;
    visual.ownerDocument = doc;
    target.append(visual);
    return target;
  }
  const target = makeTarget();
  const transitions = [];
  if (supported) doc.startViewTransition = update => {
    const ready = deferred();
    const done = deferred();
    const finished = deferred();
    let updatePromise;
    const native = {
      ready: ready.promise, updateCallbackDone: done.promise, finished: finished.promise,
      skips: 0,
      invokeUpdate() {
        if (!updatePromise) updatePromise = Promise.resolve().then(update).then(value => {
          done.resolve(value); ready.resolve(); return value;
        }, error => { done.reject(error); ready.reject(error); throw error; });
        return updatePromise;
      },
      skipTransition() { this.skips++; },
      async complete() { await this.invokeUpdate(); finished.resolve(); },
      fail(error) { done.reject(error); ready.reject(error); finished.reject(error); },
    };
    transitions.push(native);
    return native;
  };
  const create = () => createModeSnapshotTransition({ doc });
  return { doc, view, create, transitions, media, tasks, target, visual: target.children[0], makeTarget, setNow(value) { now = value; }, advance(value) { now = value; for (const [id, callback] of [...frames]) { frames.delete(id); tasks.delete(id); callback(now); } } };
}

const local = { kind: 'hover', rect: { x: 100, y: 160, width: 280, height: 180 }, duration: 300, variant: 13 };

test('unsupported, hidden and reduced-motion fallbacks commit synchronously without bitmap resources', () => {
  for (const options of [{ supported: false }, { hidden: true }, { reduced: true }]) {
    const f = fixture(options);
    const controller = f.create();
    const calls = [];
    assert.equal(controller.prepare(), null);
    assert.equal(controller.run(detail => calls.push(detail), { mode: 'xray' }), null);
    assert.deepEqual(calls, [{ captured: false }]);
    assert.equal(f.doc.body.children.length, 0);
    assert.equal(f.doc.documentElement.hasAttribute('data-mode-snapshot'), false);
    controller.dispose();
  }
});

test('a skipped native update retains and awaits its once-only asynchronous commit', async () => {
  const f = fixture();
  const controller = f.create();
  const gate = deferred();
  const calls = [];
  const handle = controller.run(async detail => { calls.push(detail); await gate.promise; return 'committed'; }, { mode: 'xray', variant: 7 });
  assert.equal(handle.native, true);
  assert.equal(typeof handle.updateCallbackDone?.then, 'function');
  handle.skip();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].captured, false);
  let done = false;
  handle.updateCallbackDone.then(() => { done = true; });
  const nativeUpdate = f.transitions[0].invokeUpdate();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(done, false, 'The native callback must await the same commit already started by skip.');
  gate.resolve();
  await nativeUpdate;
  await handle.updateCallbackDone;
  assert.equal(calls.length, 1);
  await f.transitions[0].complete(); await handle.finished;
  assert.equal(controller.snapshot().active, false);
  assert.equal(f.doc.documentElement.hasAttribute('data-mode-snapshot'), false);
  controller.dispose();
});

test('hover never interrupts a mode or navigation owned by another controller', async () => {
  for (const kind of ['mode', 'navigation']) {
    const f = fixture();
    const owner = f.create();
    const hover = f.create();
    const handle = owner.run(() => {}, { kind, mode: 'xray', variant: 2 });
    const before = f.doc.documentElement.getAttribute('data-mode-snapshot-variant');
    const ignored = hover.run(() => {}, { ...local, target: f.target });
    assert.equal(ignored, null);
    assert.equal(f.transitions.length, 1);
    assert.equal(f.transitions[0].skips, 0);
    assert.equal(f.doc.documentElement.getAttribute('data-mode-snapshot-variant'), before);
    await f.transitions[0].complete(); await handle.finished;
    owner.dispose(); hover.dispose();
  }
});

test('hover does not create bitmap resources while another native transition is painting', () => {
  const f = fixture();
  f.doc.getAnimations = () => [{ effect: { pseudoElement: '::view-transition-new(root)' } }];
  const controller = f.create();
  assert.equal(controller.run(() => {}, { ...local, target: f.target }), null);
  assert.equal(f.transitions.length, 0);
  assert.equal(f.doc.body.children.length, 0);
  controller.dispose();
});


test('a mode supersedes a live local filter without stale cleanup changing its native ownership', async () => {
  const f = fixture();
  const hover = f.create(), mode = f.create();
  f.doc.documentElement.dataset.modeSnapshotVariant = 'original';
  const first = hover.run(() => {}, { ...local, target: f.target });
  await first.ready;
  assert.match(f.visual.style.getPropertyValue('filter'), /h4-mode-snapshot/);
  const second = mode.run(() => {}, { mode: 'xray', variant: 333 });
  await first.finished;
  assert.equal(f.visual.style.getPropertyValue('filter'), '');
  assert.equal(f.transitions.length, 1);
  assert.equal(f.doc.documentElement.dataset.modeSnapshotVariant, '333');
  assert.equal(mode.snapshot().active, true);
  await f.transitions[0].complete(); await second.finished;
  assert.equal(f.doc.documentElement.dataset.modeSnapshotVariant, 'original');
  hover.dispose(); mode.dispose();
});

test('local SourceGraphic filters alter only a safe inner visual and restore its exact inline filter', async () => {
  const f = fixture({ supported: false });
  const controller = f.create();
  f.visual.style.setProperty('filter', 'contrast(1.2)', 'important');
  const calls = [];
  const handle = controller.run(detail => calls.push(detail), { ...local, target: f.target, duration: 9999, strength: 2 });
  assert.equal(handle.native, false);
  assert.equal(handle.duration, 480);
  await handle.ready;
  assert.match(f.visual.style.getPropertyValue('filter'), /h4-mode-snapshot/);
  assert.match(f.visual.style.getPropertyValue('filter'), /contrast\(1\.2\)/, 'The existing visual treatment survives the live pixel graph.');
  assert.equal(f.visual.style.getPropertyPriority('filter'), 'important');
  assert.equal(f.target.style.getPropertyValue('filter'), '');
  assert.equal(f.doc.documentElement.style.getPropertyValue('filter'), '');
  assert.equal(f.doc.documentElement.style.getPropertyValue('view-transition-name'), '');
  assert.equal(f.transitions.length, 0);
  assert.equal(controller.snapshot().nativeCount, 0);
  assert.deepEqual(calls, [{ captured: false, duration: 480, variant: 13, kind: 'hover', strength: 1 }]);
  const markup = f.doc.body.children.map(node => node.innerHTML).join('');
  assert.match(markup, /<feDisplacementMap\b[^>]*\bin="SourceGraphic"/);
  assert.match(markup, /<feComposite\b[^>]*\bin="SourceGraphic"[^>]*\boperator="out"/);
  assert.match(markup, /<feComposite\b[^>]*\boperator="in"/);
  for (const node of f.doc.body.querySelectorAll('[data-snapshot-map]')) {
    assert.match(decodeURIComponent(node.getAttribute('href')), /width="280" height="180" viewBox="0 0 280 180"/);
  }
  f.advance(240);
  assert.ok(controller.snapshot().current.frames > 1);
  f.advance(480); await handle.finished;
  assert.equal(f.visual.style.getPropertyValue('filter'), 'contrast(1.2)');
  assert.equal(f.visual.style.getPropertyPriority('filter'), 'important');
  assert.equal(controller.snapshot().active, false);
  assert.equal(controller.snapshot().last.native, false);
  assert.equal(f.tasks.size, 0);
  for (const node of f.doc.body.querySelectorAll('[data-snapshot-map], [data-snapshot-mask]')) assert.equal(node.getAttribute('href'), null);
  controller.dispose();
});

test('local filters clean up on navigation, mode, visibility, blur, resize, scroll and reduced motion', async () => {
  for (const cause of ['navigation', 'mode', 'hidden', 'blur', 'resize', 'scroll', 'reduced']) {
    const f = fixture();
    const controller = f.create();
    const handle = controller.run(() => {}, { ...local, target: f.target });
    await handle.ready;
    if (cause === 'navigation') f.doc.dispatchEvent(new Event('h4:navigationstart'));
    if (cause === 'mode') f.doc.dispatchEvent(new Event('h4:modechange'));
    if (cause === 'hidden') { f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange')); }
    if (['blur', 'resize', 'scroll'].includes(cause)) f.view.dispatchEvent(new Event(cause));
    if (cause === 'reduced') { const media = f.media.get('(prefers-reduced-motion: reduce)'); media.matches = true; media.dispatchEvent(new Event('change')); }
    await handle.finished;
    assert.equal(controller.snapshot().active, false, cause);
    assert.equal(f.visual.style.getPropertyValue('filter'), '', cause);
    assert.equal(f.doc.documentElement.hasAttribute('data-mode-snapshot'), false, cause);
    assert.equal(f.tasks.size, 0, cause);
    assert.equal(f.transitions.length, 0, cause);
    controller.dispose();
  }
});

test('live local corruption preserves stylesheet glow then restores stylesheet ownership', async () => {
  const f = fixture({ supported: false }), controller = f.create();
  f.visual.stylesheetFilter = 'brightness(1.1) drop-shadow(0px 0px 7px rgb(255, 255, 255))';
  const handle = controller.run(() => {}, { ...local, target: f.target });
  await handle.ready;
  const filter = f.visual.style.getPropertyValue('filter');
  assert.ok(filter.includes(f.visual.stylesheetFilter), 'White hover glow must remain visible under the local pixel graph.');
  assert.match(filter, /url\("#h4-mode-snapshot-\d+-old"\)/);
  assert.equal(f.visual.style.getPropertyPriority('filter'), 'important');
  handle.skip(); await handle.finished;
  assert.equal(f.visual.style.getPropertyValue('filter'), '', 'Cleanup must not pin a computed stylesheet value inline.');
  assert.equal(f.visual.style.getPropertyPriority('filter'), '');
  assert.equal(f.view.getComputedStyle(f.visual).filter, f.visual.stylesheetFilter);
  controller.dispose();
});

test('major and ordinary navigation captures have distinct bounded durations', async () => {
  for (const [kind, requested, expected] of [
    ['mode', undefined, 1400], ['mode', 100, 750], ['mode', 9999, 1600],
    ['navigation', undefined, 340], ['navigation', 100, 250], ['navigation', 9999, 450],
  ]) {
    const f = fixture(), controller = f.create();
    const handle = controller.run(() => {}, { kind, mode: 'xray', duration: requested, variant: 4 });
    assert.equal(handle.duration, expected, `${kind}: ${requested}`);
    assert.equal(f.doc.documentElement.style.getPropertyValue('--mode-snapshot-duration'), `${expected}ms`);
    await f.transitions[0].complete(); await handle.finished;
    controller.dispose();
  }
});

test('major UV fields flow continuously across a seeded phase boundary in both directions', async () => {
  for (const mode of ['xray', 'normal']) {
    const f = fixture(), controller = f.create();
    const handle = controller.run(() => {}, { mode, variant: 271 });
    assert.equal(handle.duration, 1400);
    await f.transitions[0].invokeUpdate(); await handle.ready;
    const filters = f.doc.body.querySelectorAll('filter');
    f.advance(252); // 18%: approaching the first 20% map boundary.
    const before = filters.map(filter => ({
      next: filter.querySelector('[data-snapshot-next-map]').getAttribute('href'),
      mix: Number(filter.querySelector('[data-snapshot-map-blend]').getAttribute('k3')),
    }));
    f.advance(308); // 22%: the former destination is now the current map.
    for (let index = 0; index < filters.length; index++) {
      const filter = filters[index];
      const blend = filter.querySelector('[data-snapshot-map-blend]');
      assert.equal(filter.querySelector('[data-snapshot-map]').getAttribute('href'), before[index].next);
      assert.ok(before[index].mix > .97, 'The previous UV field has almost reached its destination.');
      assert.ok(Number(blend.getAttribute('k3')) < .03, 'The next field starts near the same destination.');
      assert.ok(Math.abs(Number(blend.getAttribute('k2')) + Number(blend.getAttribute('k3')) - 1) < 1e-9);
    }
    await f.transitions[0].complete(); await handle.finished;
    assert.ok(filters.every(filter => filter.querySelector('[data-snapshot-next-map]').getAttribute('href') === null));
    controller.dispose();
  }
});

test('navigation reads its centralized duration for each accepted route', async () => {
  const original = getLivingDecaySettings();
  const f = fixture(); f.doc.documentElement.dataset.mode = 'xray';
  const service = initMoshTransitions({ doc: f.doc });
  try {
    for (const value of [250, 340, 450]) {
      configureLivingDecay({ navigationTransitionMs: value });
      const handle = service.navigation(() => {});
      assert.equal(handle.duration, value);
      await f.transitions.at(-1).complete(); await handle.finished;
    }
  } finally { service.dispose(); configureLivingDecay(original); }
});

test('accepted native captures coordinate one numeric transition intent without duplicating callbacks', async () => {
  const f = fixture(), controller = f.create(), intents = [], commits = [];
  f.doc.addEventListener('h4:transitionintent', event => intents.push(event.detail));
  for (const [kind, mode, direction, variant] of [
    ['mode', 'xray', 'entering', 4], ['mode', 'normal', 'leaving', 333],
    ['navigation', undefined, 'forward', 27],
  ]) {
    const handle = controller.run(detail => commits.push(detail), { kind, mode, variant });
    const event = intents.at(-1);
    assert.equal(intents.length, commits.length + 1, 'The numeric intent is available before the asynchronous DOM update.');
    assert.equal(event.kind, kind);
    assert.equal(event.mode, mode);
    assert.equal(event.direction, direction);
    assert.equal(event.variant, variant);
    assert.equal(event.duration, handle.duration);
    assert.equal(event.strength, 1);
    assert.equal(event.x, f.view.innerWidth / 2);
    assert.equal(event.y, f.view.innerHeight / 2);
    await f.transitions.at(-1).complete(); await handle.finished;
  }
  assert.equal(intents.length, 3);
  assert.equal(commits.length, 3);
  controller.dispose();
});

test('local and unavailable captures do not announce a native transition intent', async () => {
  for (const options of [{ supported: false }, { reduced: true }, { hidden: true }, { throws: true }, { local: true }]) {
    const f = fixture(options), controller = f.create(), intents = [];
    f.doc.addEventListener('h4:transitionintent', event => intents.push(event.detail));
    if (options.throws) f.doc.startViewTransition = () => { throw new Error('Native unavailable'); };
    let committed = 0;
    const handle = controller.run(() => committed++, options.local ? { ...local, target: f.target } : { mode: 'xray' });
    if (handle) { await handle.ready; handle.skip(); await handle.finished; }
    assert.equal(intents.length, 0, JSON.stringify(options));
    assert.equal(committed, 1, JSON.stringify(options));
    controller.dispose();
  }
});

test('scroll leaves a real native mode capture running', async () => {
  const f = fixture(), controller = f.create();
  const handle = controller.run(() => {}, { mode: 'xray' });
  f.view.dispatchEvent(new Event('scroll'));
  assert.equal(controller.snapshot().active, true);
  assert.equal(f.transitions[0].skips, 0);
  await f.transitions[0].complete(); await handle.finished; controller.dispose();
});

test('click supersedes a preparing hover and delayed readiness cannot revive its old visual filter', async () => {
  const f = fixture(), hover = f.create(), click = f.create();
  const first = hover.run(() => {}, { ...local, target: f.target });
  const second = click.run(() => {}, { ...local, target: f.target, kind: 'click', variant: 44 });
  await Promise.all([first.ready, first.finished, second.ready]);
  assert.equal(second.native, false);
  assert.equal(f.transitions.length, 0);
  assert.equal(f.doc.documentElement.dataset.moshKind, 'click');
  assert.equal(f.doc.documentElement.dataset.modeSnapshotVariant, '44');
  assert.match(f.visual.style.getPropertyValue('filter'), /h4-mode-snapshot/);
  second.skip(); await second.finished;
  assert.equal(f.visual.style.getPropertyValue('filter'), '');
  hover.dispose(); click.dispose();
});

test('safe local visuals never require the native API and detached or missing descendants never allocate a graph', async () => {
  for (const cause of ['missing target', 'missing visual', 'detached target', 'target is visual']) {
    const f = fixture(), controller = f.create(), calls = [];
    const options = { ...local };
    if (cause !== 'missing target') options.target = cause === 'target is visual' ? f.visual : f.target;
    if (cause === 'missing visual') f.target.children = [];
    if (cause === 'detached target') f.target.isConnected = false;
    assert.equal(controller.run(detail => calls.push(detail), options), null, cause);
    assert.deepEqual(calls, [{ captured: false }], cause);
    assert.equal(f.doc.body.children.length, 0, cause); controller.dispose();
  }
  for (const kind of ['interaction-visual', 'category-magnet', 'img', 'explicit element']) {
    const f = fixture({ supported: false }), controller = f.create(), target = f.makeTarget(kind), visual = target.children[0];
    const handle = controller.run(() => {}, { ...local, ...kind === 'explicit element' ? { element: visual } : { target } });
    assert.equal(handle.native, false, kind); await handle.ready;
    assert.match(visual.style.getPropertyValue('filter'), /h4-mode-snapshot/, kind);
    assert.equal(target.style.getPropertyValue('filter'), '', kind);
    handle.skip(); await handle.finished; controller.dispose();
  }
});

test('replacing the visual or disposing during an asynchronous update releases all live effects', async () => {
  for (const cause of ['detached visual', 'dispose pending']) {
    const f = fixture(), controller = f.create(), gate = deferred();
    const handle = controller.run(() => cause === 'dispose pending' ? gate.promise : undefined, { ...local, target: f.target });
    if (cause === 'dispose pending') { controller.dispose(); gate.resolve(); }
    else { await handle.ready; f.visual.remove(); f.advance(80); }
    await handle.ready; await handle.finished;
    assert.equal(f.visual.style.getPropertyValue('filter'), '', cause);
    assert.equal(controller.snapshot().active, false, cause);
    assert.equal(f.tasks.size, 0, cause); controller.dispose();
  }
});

test('service navigation leaves unavailable updates with its caller and native captures await real render', async () => {
  for (const options of [{ mode: 'normal' }, { mode: 'xray', reduced: true }, { mode: 'xray', supported: false }, { mode: 'xray', hidden: true }]) {
    const f = fixture(options); f.doc.documentElement.dataset.mode = options.mode;
    const service = initMoshTransitions({ doc: f.doc }); let updates = 0;
    assert.equal(service.navigation(() => updates++), null); assert.equal(updates, 0); service.dispose();
  }
  const f = fixture(); f.doc.documentElement.dataset.mode = 'xray';
  const service = initMoshTransitions({ doc: f.doc }), gate = deferred(), calls = [];
  assert.equal(initMoshTransitions({ doc: f.doc }), service);
  const handle = service.navigation(async detail => { calls.push(detail); await gate.promise; }, { variant: 2026 });
  assert.equal(handle.native, true); assert.equal(handle.duration, 340);
  const update = f.transitions[0].invokeUpdate();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(calls.length, 1); assert.equal(calls[0].captured, true);
  assert.equal(calls[0].kind, 'navigation');
  assert.equal(calls[0].strength, Math.min(1, .8 * getLivingDecaySettings().navigationMosh));
  gate.resolve(); await update; await handle.updateCallbackDone;
  await f.transitions[0].complete(); await handle.finished;
  assert.equal(service.snapshot().nativeCount, 1); assert.equal(service.snapshot().navigations, 1); service.dispose();
});

test('a thrown native navigation API commits its asynchronous fallback exactly once', async () => {
  const f = fixture(); f.doc.documentElement.dataset.mode = 'xray';
  f.doc.startViewTransition = () => { throw new Error('Native unavailable'); };
  const service = initMoshTransitions({ doc: f.doc }), gate = deferred(), calls = [];
  const handle = service.navigation(async detail => { calls.push(detail); await gate.promise; });
  assert.equal(handle.native, false); handle.skip(); handle.skipTransition();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(calls.length, 1); assert.equal(calls[0].captured, false);
  gate.resolve(); await handle.updateCallbackDone; await handle.finished;
  assert.equal(calls.length, 1); assert.equal(service.snapshot().nativeCount, 0); service.dispose();
});

test('disposing an active service releases its graphs and permits a fresh document singleton', async () => {
  const f = fixture(); f.doc.documentElement.dataset.mode = 'xray';
  f.doc.documentElement.dataset.modeSnapshotVariant = 'prior';
  const service = initMoshTransitions({ doc: f.doc });
  const handle = service.navigation(() => {});
  service.dispose(); service.dispose();
  assert.equal(service.snapshot().disposed, true);
  assert.equal(service.snapshot().active, false);
  assert.equal(f.doc.body.children.length, 0);
  assert.equal(f.doc.documentElement.hasAttribute('data-mode-snapshot'), false);
  assert.equal(f.doc.documentElement.dataset.modeSnapshotVariant, 'prior');
  assert.equal(service.navigation(() => assert.fail('Disposed updates remain with the caller.')), null);
  const replacement = initMoshTransitions({ doc: f.doc });
  assert.notEqual(replacement, service);
  await f.transitions[0].complete(); await handle.finished; replacement.dispose();
});

test('preparing a rapid reverse preserves its active native graph and rebinds the cached mask when accepted', async () => {
  const f = fixture(), controller = f.create();
  const first = controller.run(() => {}, { mode: 'xray', variant: 4 });
  const maps = f.doc.body.querySelectorAll('[data-snapshot-map]'), original = maps.map(node => node.getAttribute('href'));
  const plan = controller.prepare({ variant: 333 });
  assert.ok(maps.every((node, index) => node.getAttribute('href') === original[index]));
  const second = controller.run(() => {}, { mode: 'normal', variant: 333 });
  const masks = f.doc.body.querySelectorAll('[data-snapshot-mask]');
  assert.ok(masks.every(node => node.getAttribute('href') === plan.mask));
  assert.equal(f.transitions[0].skips, 1);
  await f.transitions[0].complete(); await first.finished;
  assert.ok(masks.every(node => node.getAttribute('href') === plan.mask));
  await f.transitions[1].complete(); await second.finished; controller.dispose();
});

test('service prioritizes live clicks, bounds cooldowns, and reads shared gesture controls at each input', async () => {
  const original = getLivingDecaySettings();
  try {
    const f = fixture({ supported: false }); f.doc.documentElement.dataset.mode = 'xray';
    const service = initMoshTransitions({ doc: f.doc });
    configureLivingDecay({ hoverMosh: .5, clickMosh: .75 });
    f.setNow(100);
    const hover = service.interaction({ kind: 'hover', target: f.target, rect: local.rect });
    assert.equal(hover.native, false); assert.equal(service.snapshot().current.strength, .46 * .5);
    f.setNow(120);
    const click = service.interaction({ kind: 'click', target: f.target, rect: local.rect });
    assert.equal(click.native, false); assert.equal(service.snapshot().current.kind, 'click');
    assert.equal(service.snapshot().current.strength, .78 * .75);
    await hover.finished; await click.ready;
    f.setNow(140); assert.equal(service.interaction({ kind: 'click', target: f.target, rect: local.rect }), null);
    click.skip(); await click.finished;
    f.setNow(250); assert.equal(service.interaction({ kind: 'click', target: f.target, rect: local.rect }), null);
    f.setNow(441); configureLivingDecay({ clickMosh: 2 });
    const next = service.interaction({ kind: 'click', target: f.target, rect: local.rect });
    assert.equal(next.native, false); assert.equal(service.snapshot().current.strength, 1);
    next.skip(); await next.finished;
    configureLivingDecay({ hoverMosh: 0 }); f.setNow(900);
    assert.equal(service.interaction({ kind: 'hover', target: f.target, rect: local.rect }), null);
    assert.equal(service.snapshot().nativeCount, 0); assert.equal(f.transitions.length, 0); service.dispose();
  } finally { configureLivingDecay(original); }
});

test('zero navigation corruption leaves the render and standard transition with the navigation caller', () => {
  const original = getLivingDecaySettings();
  const f = fixture(); f.doc.documentElement.dataset.mode = 'xray';
  const service = initMoshTransitions({ doc: f.doc });
  try {
    configureLivingDecay({ navigationMosh: 0 });
    let updates = 0;
    assert.equal(service.navigation(() => updates++), null);
    assert.equal(updates, 0);
    assert.equal(f.transitions.length, 0);
    assert.equal(f.doc.body.children.length, 0);
    assert.equal(service.snapshot().navigations, 0);
  } finally { service.dispose(); configureLivingDecay(original); }
});

test('major transitions echo actual captured pixels with normalized brightness and release both directions', async () => {
  const directions = [];
  for (const mode of ['xray', 'normal']) {
    const f = fixture(), controller = f.create();
    const handle = controller.run(() => {}, { mode, variant: 271, duration: 950 });
    await f.transitions[0].invokeUpdate(); await handle.ready;
    f.advance(475);
    const filters = f.doc.body.querySelectorAll('filter');
    assert.equal(filters.length, 2);
    for (const filter of filters) {
      const echo = filter.querySelector('[data-snapshot-echo]');
      const feedback = filter.querySelector('[data-snapshot-feedback]');
      assert.equal(echo.getAttribute('in'), 'history', 'Only displaced real page pixels supply the echo.');
      assert.ok(Math.abs(Number(echo.getAttribute('dx'))) > 1);
      const primary = Number(feedback.getAttribute('k2')), held = Number(feedback.getAttribute('k3'));
      assert.ok(held > .1 && held <= .34);
      assert.ok(Math.abs(primary + held - 1) < 1e-9, 'Frame overlap cannot add white or increase exposure.');
    }
    directions.push(Number(filters[0].querySelector('[data-snapshot-echo]').getAttribute('dx')));
    await f.transitions[0].complete(); await handle.finished;
    assert.ok(filters.every(filter => filter.querySelector('[data-snapshot-echo]').getAttribute('dx') === '0'));
    assert.ok(filters.every(filter => filter.querySelector('[data-snapshot-feedback]').getAttribute('k3') === '0'));
    assert.equal(f.tasks.size, 0);
    assert.equal(handle.duration, 950);
    controller.dispose();
  }
  assert.ok(directions[0] > 0 && directions[1] < 0, 'Return reconstructs in a distinct signed direction.');
});
