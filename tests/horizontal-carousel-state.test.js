import test from 'node:test';
import assert from 'node:assert/strict';
import { carouselPositions, carouselIndex, shiftedWheelDelta } from '../src/horizontal-carousel-state.js';

test('real image centers produce bounded native offsets and expose first and last work', () => {
  const targets = carouselPositions([{ left: 250, width: 300 }, { left: 600, width: 300 }, { left: 950, width: 300 }], 800, 700);
  assert.deepEqual(targets, [0, 350, 700]);
  assert.equal(carouselIndex(0, targets), 0);
  assert.equal(carouselIndex(310, targets), 1);
  assert.equal(carouselIndex(700, targets), 2);
  assert.deepEqual(carouselPositions([{ left: 20, width: 140 }, { left: 210, width: 500 }], 300, 420), [0, 310]);
  assert.equal(carouselIndex(0, []), -1);
});

test('ordinary vertical wheel and native horizontal trackpad movement are not cancelled', () => {
  assert.equal(shiftedWheelDelta({ deltaY: 180 }, 200, 600, 390), 0);
  assert.equal(shiftedWheelDelta({ deltaX: 180, deltaY: 0 }, 200, 600, 390), 0);
  assert.equal(shiftedWheelDelta({ deltaY: 180, shiftKey: true, ctrlKey: true }, 200, 600, 390), 0);
});

test('explicit Shift+wheel honors browser delta units and releases at both boundaries', () => {
  assert.equal(shiftedWheelDelta({ deltaY: 100, shiftKey: true }, 200, 600, 390), 100);
  assert.equal(shiftedWheelDelta({ deltaY: -2, deltaMode: 1, shiftKey: true }, 200, 600, 390), -32);
  assert.equal(shiftedWheelDelta({ deltaY: 1, deltaMode: 2, shiftKey: true }, 200, 600, 390), 390);
  assert.equal(shiftedWheelDelta({ deltaY: -100, shiftKey: true }, 0, 600, 390), 0);
  assert.equal(shiftedWheelDelta({ deltaY: 100, shiftKey: true }, 600, 600, 390), 0);
  assert.equal(shiftedWheelDelta({ deltaY: 100, shiftKey: true }, 0, 0, 390), 0);
});
