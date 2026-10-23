import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRenderQuality, AdaptiveResolution } from '../src/render-quality.js';

test('quality caps mobile/high-DPI rendering and degrades for actual resource hints', () => {
  const desktop = chooseRenderQuality({ pixelRatio: 3, memory: 8, cores: 8 });
  const mobile = chooseRenderQuality({ pixelRatio: 3, coarsePointer: true, memory: 8, cores: 8 });
  const weak = chooseRenderQuality({ pixelRatio: 3, memory: 2, cores: 4 });
  assert.equal(desktop.pixelRatio, 2);
  assert.equal(mobile.pixelRatio, 1.5);
  assert.equal(mobile.environmentSize, 128);
  assert.equal(weak.pixelRatio, 1);
  assert.equal(weak.antialias, false);
  assert.ok(weak.curveSegments < desktop.curveSegments);
  assert.equal(chooseRenderQuality({ saveData: true }).name, 'constrained');
});

test('adaptive resolution waits for sustained slow frames and never upscales', () => {
  const adaptive = new AdaptiveResolution(1.5);
  for (let i = 0; i < 89; i++) assert.equal(adaptive.sample(.05, 6000 + i * 50), null);
  assert.equal(adaptive.sample(.05, 10500), 1.25);
  for (let i = 0; i < 90; i++) adaptive.sample(1 / 60, 16000 + i * 17);
  assert.equal(adaptive.pixelRatio, 1.25);
  adaptive.reset();
  for (let i = 0; i < 90; i++) adaptive.sample(.05, 22000 + i * 50);
  assert.equal(adaptive.pixelRatio, 1);
});
