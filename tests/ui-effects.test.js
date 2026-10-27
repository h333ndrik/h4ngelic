import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedHoverScale, fitHoverFrame } from '../src/data/uiEffectSettings.js';

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

test('long off-centre hover labels retain every edge during their entire magnetic range', () => {
  for (const viewport of [320, 390, 1440, 1614]) {
    for (const origin of [0, .5, 1]) {
      for (const [left, width] of [[22, viewport - 44], [viewport - 112, 90], [35, 80]]) {
        const fit = fitHoverFrame({ left, width, boundsRight: viewport, preferred: 1.22, origin, translation: 3 });
        const anchor = left + width * origin;
        for (const movement of [fit.minimumTranslation, fit.maximumTranslation]) {
          const first = anchor - width * origin * fit.scale + movement;
          const last = first + width * fit.scale;
          assert.ok(first >= -.01 && last <= viewport + .01,
            `Both edges must stay in ${viewport}px, origin ${origin}, geometry ${left}/${width}.`);
        }
        assert.ok(fit.scale >= 1 && fit.scale <= 1.22);
        assert.ok(fit.minimumTranslation >= -3 && fit.maximumTranslation <= 3);
      }
    }
  }
});

test('a clipped scrollport bounds hover independently of a larger browser window', () => {
  const fit = fitHoverFrame({ left: 230, width: 100, boundsLeft: 200, boundsRight: 340, preferred: 1.22, translation: 3 });
  assert.ok(fit.scale < 1.22 && fit.scale >= 1);
  assert.ok(230 + 100 * fit.scale + fit.maximumTranslation <= 340);
  assert.equal(fitHoverFrame({ left: 35, width: 80, boundsRight: 1440, preferred: 1.22 }).scale, 1.22,
    'Short labels with room keep the full visible magnification.');
});

test('partly offscreen and unmeasurable visuals are never enlarged or displaced further', () => {
  for (const geometry of [{ left: -8, width: 90, boundsRight: 320 }, { left: 290, width: 90, boundsRight: 320 },
    { left: 0, width: 0, boundsRight: 320 }, { left: 20, width: 80, boundsRight: NaN }]) {
    assert.deepEqual(fitHoverFrame(geometry), { scale: 1, minimumTranslation: 0, maximumTranslation: 0 });
  }
});
