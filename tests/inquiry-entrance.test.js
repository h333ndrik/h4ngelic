import test from 'node:test';
import assert from 'node:assert/strict';
import { initInquiryEntrance } from '../src/inquiry-entrance.js';

function fixture() {
  const removed = [];
  const element = { dataset: { inquiryReveal: 'pending', inquiryRevealImmediate: '' },
    removeAttribute(name) { removed.push(name); delete this.dataset[name === 'data-inquiry-reveal' ? 'inquiryReveal' : 'inquiryRevealImmediate']; },
    addEventListener() { assert.fail('The retired one-shot reveal must not add another event clock.'); },
    ownerDocument: { get defaultView() { assert.fail('Form entrance no longer needs observers or motion listeners.'); } } };
  return { element, removed };
}

test('the form stays directly usable while its parent owns reversible scroll motion', () => {
  const { element, removed } = fixture();
  const stop = initInquiryEntrance(element);
  assert.deepEqual(element.dataset, {});
  assert.deepEqual(removed, ['data-inquiry-reveal', 'data-inquiry-reveal-immediate']);
  stop();
  assert.deepEqual(element.dataset, {});
});

test('the compatibility hook safely handles missing or detached form content', () => {
  const stop = initInquiryEntrance(null);
  assert.equal(typeof stop, 'function');
  stop();
  const element = { removeAttribute() {} };
  assert.doesNotThrow(() => initInquiryEntrance(element)());
});
