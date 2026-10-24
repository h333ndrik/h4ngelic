import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedHoverScale } from '../src/data/uiEffectSettings.js';

test('large hover labels use their preferred scale only when their column has room', () => {
  assert.equal(boundedHoverScale(200, 400, 1.2), 1.2);
  const bounded = boundedHoverScale(250, 275, 1.2);
  assert.ok(bounded > 1 && bounded < 1.2);
  assert.ok(250 * bounded + 5 <= 275, 'The enlarged label and margin must remain inside the original column.');
});

test('tight or unmeasurable targets never shrink their readable base label', () => {
  assert.equal(boundedHoverScale(260, 220, 1.2), 1);
  assert.equal(boundedHoverScale(0, 220, 1.2), 1);
  assert.equal(boundedHoverScale(260, 0, 1.2), 1);
});
