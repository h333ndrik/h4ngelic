import test from 'node:test';
import assert from 'node:assert/strict';
import { initInquiryEntrance } from '../src/inquiry-entrance.js';

function fixture({ reduce = false, focused = false, observer = true } = {}) {
  const listeners = new Map(), mediaListeners = new Map();
  const media = { matches: reduce, addEventListener: (name, callback) => mediaListeners.set(name, callback), removeEventListener: name => mediaListeners.delete(name) };
  let callback, disconnected = 0, observed = null;
  const view = { matchMedia: () => media };
  if (observer) view.IntersectionObserver = class {
    constructor(handler, options) { callback = handler; assert.equal(options.rootMargin, '0px 0px -8% 0px'); }
    observe(element) { observed = element; }
    disconnect() { disconnected++; }
  };
  const element = { dataset: {}, ownerDocument: { defaultView: view, activeElement: {} }, contains: () => focused,
    addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name),
    removeAttribute(name) { delete this.dataset[name === 'data-inquiry-reveal' ? 'inquiryReveal' : 'inquiryRevealImmediate']; } };
  return { element, media, listeners, mediaListeners, get observed() { return observed; }, get disconnected() { return disconnected; }, intersect: isIntersecting => callback?.([{ isIntersecting }]) };
}

test('inquiry enters once when approaching and does not disappear on reverse scroll', () => {
  const state = fixture();
  const stop = initInquiryEntrance(state.element);
  assert.equal(state.observed, state.element);
  assert.equal(state.element.dataset.inquiryReveal, 'pending');
  state.intersect(false);
  assert.equal(state.element.dataset.inquiryReveal, 'pending');
  state.intersect(true);
  assert.equal(state.element.dataset.inquiryReveal, 'visible');
  const count = state.disconnected;
  state.intersect(false); state.intersect(true);
  assert.equal(state.element.dataset.inquiryReveal, 'visible');
  assert.equal(state.disconnected, count);
  stop();
  assert.deepEqual(state.element.dataset, {});
  assert.equal(state.listeners.size, 0);
  assert.equal(state.mediaListeners.size, 0);
});

test('focus immediately exposes the form without waiting for an entrance', () => {
  const state = fixture();
  const stop = initInquiryEntrance(state.element);
  state.listeners.get('focusin')();
  assert.equal(state.element.dataset.inquiryReveal, 'visible');
  assert.equal(state.element.dataset.inquiryRevealImmediate, '');
  stop();
});

test('reduced motion, unavailable observers and existing focus keep the form static and visible', () => {
  for (const options of [{ reduce: true }, { observer: false }, { focused: true }]) {
    const state = fixture(options);
    const stop = initInquiryEntrance(state.element);
    assert.equal(state.element.dataset.inquiryReveal, 'visible');
    assert.equal(state.element.dataset.inquiryRevealImmediate, '');
    assert.equal(state.observed, null);
    stop();
  }
});

test('changing to reduced motion settles a pending entrance immediately', () => {
  const state = fixture();
  const stop = initInquiryEntrance(state.element);
  state.media.matches = true;
  state.mediaListeners.get('change')();
  assert.equal(state.element.dataset.inquiryReveal, 'visible');
  assert.equal(state.element.dataset.inquiryRevealImmediate, '');
  stop();
});
