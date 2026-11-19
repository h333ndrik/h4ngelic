import test from 'node:test';
import assert from 'node:assert/strict';
import { initHeroStatus } from '../src/hero-status.js';

// The `?status` panel exists because iOS has no console without a Mac. It must
// stay invisible on every normal visit: no element, no timer, no listeners.

function fake({ search = '', stageClass = 'stage is-ready', posterOpacity = '0' } = {}) {
  const made = [];
  const element = (tag) => {
    const node = { tagName: tag, style: {}, children: [], attributes: {}, textContent: '',
      setAttribute(name, value) { this.attributes[name] = value; },
      append(child) { this.children.push(child); },
      remove() { this.removed = true; } };
    made.push(node);
    return node;
  };
  const body = { tagName: 'body', children: [], append(child) { this.children.push(child); } };
  const stage = { className: stageClass };
  const poster = { node: true };
  const canvas = { width: 1170, height: 2532 };
  const styles = new Map([[poster, { display: 'block', opacity: posterOpacity, animationName: 'none' }],
    [canvas, { display: 'block', opacity: '1', transform: 'none' }]]);
  const timers = [];
  const doc = {
    documentElement: { dataset: { build: 'test-sha', heroLoading: 'false' } },
    body,
    createElement: element,
    getElementById: id => (id === 'stage' ? stage : null),
    querySelector: selector => (selector === '[data-hero-poster]' ? poster : null),
  };
  const view = {
    location: { search },
    devicePixelRatio: 3,
    innerWidth: 390,
    innerHeight: 844,
    getComputedStyle: el => styles.get(el),
    matchMedia: () => ({ matches: false }),
    setInterval: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearInterval: () => {},
  };
  return { doc: { ...doc, getElementById: id => (id === 'stage' ? stage : id === 'logo-canvas' ? canvas : null) }, view, body, made, timers };
}

test('without ?status nothing is inserted and no timer runs', () => {
  const { doc, view, made, timers } = fake({ search: '?foo=1' });
  const dispose = initHeroStatus(doc, view);
  assert.equal(made.length, 0, 'no element is created');
  assert.equal(timers.length, 0, 'no interval is started');
  dispose();
});

test('with ?status the panel reports the hero state and cleans up', () => {
  const { doc, view, made, timers } = fake({ search: '?status=1' });
  const dispose = initHeroStatus(doc, view);
  const panel = made.find(node => node.attributes['data-hero-status'] !== undefined);
  assert.ok(panel, 'a panel element exists');
  assert.equal(panel.attributes['data-no-mosh'], '', 'the panel is excluded from mosh effects');
  assert.match(panel.textContent, /build test-sha/);
  assert.match(panel.textContent, /stage stage is-ready/);
  assert.match(panel.textContent, /dpr 3 · 390×844/);
  assert.equal(timers.length, 1, 'the panel refreshes on a timer');
  dispose();
  assert.equal(panel.removed, true, 'dispose removes the panel');
});
