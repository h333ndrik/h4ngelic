import test from 'node:test';
import assert from 'node:assert/strict';
import { initInteractionMosh } from '../src/interaction-mosh.js';
import { interactionMoshSettings as settings } from '../src/data/interactionMoshSettings.js';

class Element {
  constructor(tag = 'button', attributes = {}, parent = null) {
    this.tagName = tag.toLowerCase();
    this.attributes = { ...attributes };
    this.parentElement = parent;
    this.children = [];
    parent?.children.push(this);
    this.nodeType = 1;
    this.isConnected = true;
    this.disabled = false;
    this.isContentEditable = false;
    this.reads = 0;
    this.box = { left: 40, top: 100, width: 200, height: 40 };
  }
  matches(selector) {
    return selector.split(',').some(value => {
      const rule = value.trim();
      if (rule.includes(' ')) {
        const parts = rule.split(' ');
        const last = parts.pop();
        return this.matches(last) && Boolean(this.parentElement?.closest(parts.join(' ')));
      }
      if (rule === ':disabled') return this.disabled;
      if (rule === '[contenteditable]:not([contenteditable="false"])') {
        return this.attributes.contenteditable !== undefined && this.attributes.contenteditable !== 'false';
      }
      if (rule.startsWith('.')) return (this.attributes.class || '').split(' ').includes(rule.slice(1));
      if (rule.startsWith('#')) return this.attributes.id === rule.slice(1);
      const attribute = rule.match(/^([a-z-]*)\[([a-z-]+)(?:="([^"]*)")?\]$/);
      if (attribute) return (!attribute[1] || this.tagName === attribute[1])
        && (attribute[3] === undefined ? this.attributes[attribute[2]] !== undefined : this.attributes[attribute[2]] === attribute[3]);
      return this.tagName === rule;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { this.reads++; return this.box; }
}

function fixture(mode = 'xray') {
  let time = 0;
  const media = new Map();
  const observers = [];
  const impulses = [];
  const captures = [];
  const html = new Element('html');
  html.dataset = { mode };
  const view = Object.assign(new EventTarget(), {
    performance: { now: () => time }, innerWidth: 1200,
    CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } },
    matchMedia(query) {
      if (!media.has(query)) media.set(query, Object.assign(new EventTarget(), { matches: !query.includes('reduced') }));
      return media.get(query);
    },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; observers.push(this); }
      observe(target) { this.targets.push(target); }
      disconnect() { this.disconnected = true; }
      fire(target, isIntersecting = true) { this.callback([{ target, isIntersecting, boundingClientRect: target.box }]); }
    },
  });
  const doc = Object.assign(new EventTarget(), { defaultView: view, hidden: false, documentElement: html,
    querySelectorAll: selector => html.querySelectorAll(selector), hasFocus: () => true });
  const section = new Element('section', { class: 'content-section' }, html);
  const heading = new Element('h2', { class: 'kinetic-heading' }, section);
  doc.addEventListener('h4:moshimpulse', event => impulses.push(event.detail));
  const controller = initInteractionMosh({ doc, onSnapshot: detail => captures.push(detail) });
  const element = (tag = 'button', attributes = {}, parent = html) => new Element(tag, attributes, parent);
  function send(type, target, properties = {}, dispatchTarget = doc) {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries({ target, ...properties })) Object.defineProperty(event, key, { value });
    dispatchTarget.dispatchEvent(event);
    return event;
  }
  const hover = (target, properties = {}) => send('pointerover', target,
    { pointerType: 'mouse', isPrimary: true, detail: 0, clientX: 80, clientY: 110, relatedTarget: null, ...properties });
  const click = (target, properties = {}) => send('click', target,
    { button: 0, isPrimary: true, detail: 1, clientX: 80, clientY: 110, ...properties });
  const modeChange = value => { html.dataset.mode = value; send('h4:modechange'); };
  function mediaChange(part, matches) {
    const query = [...media.keys()].find(value => value.includes(part));
    media.get(query).matches = matches;
    send('change', null, {}, media.get(query));
  }
  return { doc, view, html, section, heading, observers, impulses, captures, controller, element,
    send, hover, click, modeChange, mediaChange, tick: elapsed => { time += elapsed; } };
}

test('Normal mode is inert; delegated Xray hover measures once and keeps target bounds', () => {
  const f = fixture('normal');
  const link = f.element('a', { class: 'category-link', href: '/work' });
  const child = f.element('span', {}, link);
  f.hover(child);
  assert.equal(link.reads, 0);
  assert.equal(f.observers.length, 0);
  assert.equal(f.impulses.length, 0);
  f.modeChange('xray');
  f.hover(child);
  assert.deepEqual(Object.keys(f.impulses[0]), ['kind', 'target', 'x', 'y', 'width', 'height', 'rect', 'dx', 'dy', 'strength', 'sequence']);
  assert.equal(f.impulses[0].target, link);
  assert.equal(f.impulses[0].kind, 'hover');
  assert.equal(f.impulses[0].strength, settings.hover.strength);
  assert.deepEqual([f.impulses[0].x, f.impulses[0].y, f.impulses[0].width, f.impulses[0].height], [80, 110, 200, 40]);
  assert.deepEqual(f.impulses[0].rect, link.box, 'Snapshot bounds reuse the same geometry read.');
  assert.equal(f.captures.length, 1, 'Hover may snapshot an internal link before navigation.');
  f.hover(child, { relatedTarget: link });
  f.hover(child);
  assert.equal(link.reads, 1, 'Child boundary crossings and cooldowns do not read layout.');
  f.send('pointerout', child, { pointerType: 'mouse', clientX: 1, clientY: 1 });
  f.tick(settings.hover.cooldownMs);
  f.hover(child);
  assert.equal(link.reads, 2);
  f.controller.dispose();
});

test('native snapshot hit-testing cannot retrigger a stationary physical hover after cooldown', () => {
  const f = fixture();
  const target = f.element('a', { href: '/about', class: 'text-link' });
  const overlay = f.element('div');
  f.hover(target);
  for (let index = 0; index < 4; index++) {
    f.send('pointerout', target, { pointerType: 'mouse', clientX: 80, clientY: 110, relatedTarget: overlay });
    f.tick(settings.hover.cooldownMs + 1);
    f.hover(target, { relatedTarget: overlay });
  }
  assert.equal(f.impulses.length, 1);
  assert.equal(f.captures.length, 1);
  assert.equal(target.reads, 1, 'Synthetic boundary events reuse the physical-entry latch.');
  assert.equal(f.controller.snapshot().hoverLatched, true);
  f.controller.dispose();
});

test('a real outside departure releases the hover latch and permits return to the same coordinates', () => {
  const f = fixture();
  const target = f.element('a', { href: '/about', class: 'text-link' });
  f.hover(target);
  f.send('pointerout', target, { pointerType: 'mouse', clientX: 1, clientY: 1, relatedTarget: f.html });
  assert.equal(f.controller.snapshot().hoverLatched, false);
  f.tick(settings.hover.cooldownMs);
  f.hover(target);
  assert.equal(f.impulses.length, 2);
  assert.equal(f.captures.length, 2);
  assert.equal(target.reads, 2);
  assert.deepEqual(f.impulses.map(detail => [detail.x, detail.y]), [[80, 110], [80, 110]]);
  f.controller.dispose();
});

test('right and bottom boundary departures release the hover latch', () => {
  for (const point of [{ clientX: 240, clientY: 110 }, { clientX: 80, clientY: 140 }]) {
    const f = fixture();
    const target = f.element();
    f.hover(target);
    f.send('pointerout', target, { pointerType: 'mouse', ...point });
    assert.equal(f.controller.snapshot().hoverLatched, false);
    f.tick(settings.hover.cooldownMs);
    f.hover(target);
    assert.equal(f.captures.length, 2);
    assert.equal(target.reads, 2);
    f.controller.dispose();
  }
});

test('hover only accepts a primary mouse with a fine hover-capable pointer', () => {
  const f = fixture();
  const target = f.element();
  for (const pointerType of ['touch', 'pen', undefined]) f.hover(target, { pointerType });
  f.hover(target, { isPrimary: false });
  f.mediaChange('hover:', false);
  f.hover(target);
  f.send('pointermove', target, { pointerType: 'mouse', clientX: 500, clientY: 250 });
  assert.equal(target.reads, 0);
  assert.equal(f.impulses.length, 0);
  f.controller.dispose();
});

test('focus gives a gentle Canvas impulse with no page snapshot', () => {
  const f = fixture();
  const target = f.element('a', { href: '/about', class: 'text-link' });
  const event = f.send('focusin', target);
  assert.equal(event.defaultPrevented, false);
  assert.equal(f.impulses[0].kind, 'focus');
  assert.equal(f.impulses[0].strength, settings.focus.strength);
  assert.deepEqual([f.impulses[0].x, f.impulses[0].y], [140, 120]);
  assert.equal(f.captures.length, 0);
  f.controller.dispose();
});

test('anchor clicks preserve native behavior and leave actual page captures to navigation', () => {
  for (const attributes of [
    { href: '/work' }, { href: '/#contact' }, { href: '#/work' },
    { href: 'https://example.com', target: '_blank' }, { href: 'mailto:artist@example.com' },
    { href: '/file.pdf', download: '' }, { href: '/work', 'data-native-navigation': '' },
  ]) {
    const f = fixture();
    const target = f.element('a', attributes);
    const event = f.click(target);
    assert.equal(event.defaultPrevented, false);
    assert.equal(f.impulses.length, 1);
    assert.equal(f.captures.length, 0, attributes.href);
    f.controller.dispose();
  }
});

test('primary button activation snapshots; modified, middle and right clicks emit no effect', () => {
  for (const properties of [{}, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { button: 1 }, { button: 2 }]) {
    const f = fixture();
    const target = f.element();
    const event = f.click(target, properties);
    assert.equal(event.defaultPrevented, false);
    assert.equal(f.captures.length, Object.keys(properties).length ? 0 : 1);
    assert.equal(f.impulses.length, Object.keys(properties).length ? 0 : 1);
    assert.equal(target.reads, Object.keys(properties).length ? 0 : 1);
    f.controller.dispose();
  }
  const f = fixture();
  f.click(f.element('button', { 'data-native-navigation': '' }));
  assert.equal(f.captures.length, 0);
  f.controller.dispose();
});

test('mouse and touch compatibility clicks work when PointerEvent isPrimary is false', () => {
  for (const pointerType of ['mouse', 'touch']) {
    const f = fixture();
    const target = f.element();
    const event = f.click(target, { pointerType, isPrimary: false });
    assert.equal(event.defaultPrevented, false);
    assert.equal(f.impulses.length, 1, pointerType);
    assert.equal(f.impulses[0].kind, 'click');
    assert.equal(f.captures.length, 1, pointerType);
    assert.deepEqual([f.impulses[0].x, f.impulses[0].y], [80, 110]);
    f.controller.dispose();
  }
});

test('keyboard and assistive clicks use the target center without pointer metadata', () => {
  const f = fixture();
  const target = f.element();
  const event = f.click(target, { detail: 0, pointerType: '', isPrimary: false, clientX: 0, clientY: 0 });
  assert.equal(event.defaultPrevented, false);
  assert.equal(f.impulses.length, 1);
  assert.equal(f.captures.length, 1);
  assert.deepEqual([f.impulses[0].x, f.impulses[0].y], [140, 120]);
  f.controller.dispose();
});

test('protected controls, their children, forms and editable content do not read layout or emit', () => {
  const f = fixture();
  const protectedAttributes = [
    { class: 'secret-hotspot' }, { 'data-secret-hotspot': '' }, { 'data-mode-hold': '' },
    { 'data-mode-mute': '' }, { 'data-other-side-hint': '' }, { 'data-corruption-protected': '' },
    { 'data-no-hover': '' }, { 'data-no-mosh': '' }, { 'aria-disabled': 'true' },
    { class: 'skip-link' }, { class: 'is-unconfigured' }, { contenteditable: 'true' }, { inert: '' },
  ];
  for (const attributes of protectedAttributes) {
    const parent = f.element('div', attributes);
    const target = f.element('button', {}, parent);
    f.hover(target); f.click(target); f.send('focusin', target);
    assert.equal(target.reads, 0);
  }
  for (const tag of ['form', 'input', 'textarea', 'select', 'canvas']) {
    const parent = f.element(tag);
    const target = f.element('button', {}, parent);
    f.hover(target); f.click(target);
    assert.equal(target.reads, 0);
  }
  const disabled = f.element(); disabled.disabled = true;
  f.click(disabled);
  assert.equal(f.impulses.length, 0);
  assert.equal(f.captures.length, 0);
  f.controller.dispose();
});

test('all triggers share a bounded rolling budget and clicks can follow hover immediately', () => {
  const f = fixture();
  const target = f.element();
  f.hover(target);
  f.click(target);
  assert.deepEqual(f.impulses.map(detail => detail.kind), ['hover', 'click']);
  for (let index = 0; index < 12; index++) f.click(f.element());
  assert.equal(f.impulses.length, settings.rate.maximumImpulses);
  assert.equal(f.controller.snapshot().geometryReads, settings.rate.maximumImpulses);
  assert.ok(f.controller.snapshot().rejected.rate > 0);
  f.send('h4:pagechange');
  f.click(f.element());
  assert.equal(f.impulses.length, settings.rate.maximumImpulses, 'Page rebinding cannot reset the shared budget.');
  f.tick(settings.rate.windowMs);
  f.click(f.element());
  assert.equal(f.impulses.length, settings.rate.maximumImpulses + 1);
  f.controller.dispose();
});

test('section entry uses observer geometry and never starts a native snapshot', () => {
  const f = fixture();
  assert.equal(f.observers[0].targets.length, 1, 'Headings cover their section without duplicate observations.');
  const observer = f.observers[0];
  observer.fire(f.heading);
  observer.fire(f.heading);
  assert.equal(f.impulses.length, 1);
  assert.equal(f.impulses[0].kind, 'section');
  assert.equal(f.impulses[0].dy, -settings.section.dy);
  assert.equal(f.heading.reads, 0);
  assert.equal(f.captures.length, 0);
  observer.fire(f.heading, false);
  observer.fire(f.heading);
  assert.equal(f.impulses.length, 1, 'Reentry observes the section cooldown.');
  f.tick(settings.section.cooldownMs);
  observer.fire(f.heading, false);
  observer.fire(f.heading);
  assert.equal(f.impulses.length, 2);
  f.controller.dispose();
});

test('navigation rebinds current headings and old observer deliveries cannot emit', () => {
  const f = fixture();
  const old = f.observers[0];
  f.send('h4:navigationstart');
  assert.equal(old.disconnected, true);
  old.fire(f.heading);
  f.hover(f.element());
  assert.equal(f.impulses.length, 0);
  const heading = f.element('h1', { class: 'page-heading' });
  f.send('h4:pagechange');
  const current = f.observers.at(-1);
  assert.ok(current.targets.includes(heading));
  old.fire(f.heading);
  current.fire(heading);
  assert.equal(f.impulses.length, 1);
  assert.equal(f.impulses[0].target, heading);
  f.controller.dispose();
});

test('synchronous page changes invalidate the remaining entries in an observer delivery', () => {
  const f = fixture();
  const heading = f.element('h1', { class: 'page-heading' });
  const old = f.observers[0];
  f.doc.addEventListener('h4:moshimpulse', () => {
    f.tick(settings.rate.minimumGapMs);
    f.send('h4:pagechange');
  });
  old.callback([f.heading, heading].map(target => ({ target, isIntersecting: true, boundingClientRect: target.box })));
  assert.equal(f.impulses.length, 1);
  assert.equal(f.impulses[0].target, f.heading);
  f.controller.dispose();
});

test('Normal, reduced motion, hidden documents, blur and disposal clear observers synchronously', () => {
  for (const reason of ['normal', 'reduced', 'hidden', 'blur', 'dispose']) {
    const f = fixture();
    const target = f.element();
    const observer = f.observers[0];
    f.hover(target);
    assert.equal(f.controller.snapshot().hoverLatched, true, reason);
    if (reason === 'normal') f.modeChange('normal');
    if (reason === 'reduced') f.mediaChange('reduced', true);
    if (reason === 'hidden') { f.doc.hidden = true; f.send('visibilitychange'); }
    if (reason === 'blur') f.send('blur', null, {}, f.view);
    if (reason === 'dispose') f.controller.dispose();
    assert.equal(observer.disconnected, true, reason);
    assert.equal(f.controller.snapshot().active, false, reason);
    assert.equal(f.controller.snapshot().observing, false, reason);
    assert.equal(f.controller.snapshot().pending, 0, reason);
    assert.equal(f.controller.snapshot().hoverLatched, false, reason);
    observer.fire(f.heading);
    f.hover(target); f.click(target); f.send('focusin', target);
    assert.equal(f.impulses.length, 1, reason);
    assert.equal(target.reads, 1, reason);
    f.controller.dispose();
  }
});

test('a synchronous mode change from an impulse consumer cancels its snapshot request', () => {
  const f = fixture();
  f.doc.addEventListener('h4:moshimpulse', () => f.modeChange('normal'));
  f.hover(f.element());
  assert.equal(f.impulses.length, 1);
  assert.equal(f.captures.length, 0);
  f.controller.dispose();
});
