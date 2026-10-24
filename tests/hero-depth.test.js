import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { createHeroDepth } from '../src/hero-depth.js';
import { sampleHeroDepth } from '../src/data/heroDepthSettings.js';

test('camera depth is bounded, scroll-deterministic and has exact reduced-motion/base endpoints', () => {
  assert.deepEqual(sampleHeroDepth(-1), { amount: 0, distance: 1, x: 0, y: 0, fieldOfView: 0 });
  assert.deepEqual(sampleHeroDepth(.7, true), sampleHeroDepth(0));
  const middle = sampleHeroDepth(.5);
  assert.ok(middle.distance > 1 && middle.distance < 1.08);
  assert.ok(middle.fieldOfView > 0 && middle.fieldOfView < 1);
  assert.deepEqual(sampleHeroDepth(.5), middle);
  assert.equal(sampleHeroDepth(20).distance, 1.08);
});

test('camera composition restores after reversal and resize without controlling sculpture transforms', () => {
  const camera = new PerspectiveCamera(35, 1.44, .1, 150);
  const worldSize = {};
  const depth = createHeroDepth(camera, { worldSize });
  depth.resize({ distance: 30, top: 0, height: 1000, scrollPosition: 0, reduced: false });
  const original = depth.snapshot();
  depth.update(600, false);
  const middle = depth.snapshot();
  assert.ok(middle.position[2] > original.position[2]);
  assert.ok(middle.position[0] > 0 && middle.position[0] < 1);
  assert.ok(worldSize.x > worldSize.y);
  depth.update(300, false);
  depth.update(600, false);
  assert.deepEqual(depth.snapshot(), middle);
  depth.update(0, false);
  assert.deepEqual(depth.snapshot(), original);
  depth.resize({ distance: 42, top: 0, height: 844, scrollPosition: 500, reduced: false });
  depth.update(0, false);
  assert.deepEqual(depth.snapshot(), { amount: 0, position: [0, 0, 42], fov: 35 });
  depth.update(700, true);
  assert.deepEqual(depth.snapshot(), { amount: 0, position: [0, 0, 42], fov: 35 });
});
