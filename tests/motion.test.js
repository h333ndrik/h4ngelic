import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { CYCLE_SECONDS, sampleBase } from '../src/motion.js';
import { revealWeight } from '../src/reveal.js';

test('base motion makes a seamless 15-second cycle in position and orientation', () => {
  assert.equal(CYCLE_SECONDS, 15);
  for (const time of [0, 0.5, 2.3, 7.5, 14.99]) {
    const first = sampleBase(time);
    const next = sampleBase(time + CYCLE_SECONDS);
    assert.ok(first.position.distanceTo(next.position) < 1e-10);
    assert.ok(first.quaternion.angleTo(next.quaternion) < 1e-7);
  }
  const before = sampleBase(CYCLE_SECONDS - 0.001);
  const after = sampleBase(CYCLE_SECONDS + 0.001);
  assert.ok(before.position.distanceTo(after.position) < 0.003);
  assert.ok(before.quaternion.angleTo(after.quaternion) < 0.003);
});

test('the horizontal figure eight crosses its center twice and reaches both sides', () => {
  const origin = sampleBase(0).position;
  const halfway = sampleBase(CYCLE_SECONDS / 2).position;
  const right = sampleBase(CYCLE_SECONDS / 4).position;
  const left = sampleBase(CYCLE_SECONDS * 3 / 4).position;
  assert.ok(origin.length() < 1e-10);
  assert.ok(halfway.length() < 1e-10);
  assert.ok(right.x > 0.9 && Math.abs(right.y) < 1e-10);
  assert.ok(left.x < -0.9 && Math.abs(left.y) < 1e-10);
  assert.ok(sampleBase(CYCLE_SECONDS / 8).position.y > 0);
  assert.ok(sampleBase(CYCLE_SECONDS * 3 / 8).position.y < 0);
});

test('the base reuses supplied transforms and zero motion scale gives a static pose', () => {
  const position = new Vector3(8, 9, 10);
  const quaternion = new Quaternion(0.2, 0.1, 0.4, 0.8).normalize();
  const pose = sampleBase(3.2, 0, position, quaternion);
  assert.equal(pose.position, position);
  assert.equal(pose.quaternion, quaternion);
  assert.equal(position.length(), 0);
  assert.equal(quaternion.angleTo(new Quaternion()), 0);
});

test('tattoo reveal peaks at its configurable angle and fades smoothly around it', () => {
  const yaw = (degrees) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), degrees * Math.PI / 180);
  assert.ok(revealWeight(yaw(150)) > 0.999999);
  assert.ok(Math.abs(revealWeight(yaw(135)) - 0.5) < 1e-10);
  assert.ok(Math.abs(revealWeight(yaw(165)) - 0.5) < 1e-10);
  assert.ok(revealWeight(yaw(119)) < 1e-10);
  assert.ok(revealWeight(yaw(181)) < 1e-10);
  assert.ok(revealWeight(yaw(75), 75) > 0.999999);
  assert.ok(revealWeight(yaw(-179), 179) > 0.98, 'fade wraps across the angular seam');
});

test('reveal reads the composed displayed orientation, including physical rotation', () => {
  const axis = new Vector3(0, 1, 0);
  const base = new Quaternion().setFromAxisAngle(axis, 110 * Math.PI / 180);
  const interaction = new Quaternion().setFromAxisAngle(axis, 40 * Math.PI / 180);
  assert.equal(revealWeight(base), 0);
  const displayed = interaction.clone().multiply(base);
  assert.ok(revealWeight(displayed) > 0.999999);
  const equivalent = new Quaternion(-displayed.x, -displayed.y, -displayed.z, -displayed.w);
  assert.ok(Math.abs(revealWeight(displayed) - revealWeight(equivalent)) < 1e-10);
});

test('the unassisted base cycle actually reaches the tattoo reveal orientation', () => {
  let peak = 0;
  let visibleSamples = 0;
  // Simultaneous X/Y rotations can otherwise hide an unreachable yaw target.
  // Sample a complete cycle at 120 Hz using the actual displayed normal.
  for (let frame = 0; frame < CYCLE_SECONDS * 120; frame += 1) {
    const weight = revealWeight(sampleBase(frame / 120).quaternion);
    peak = Math.max(peak, weight);
    if (weight > 0.5) visibleSamples += 1;
  }
  assert.ok(peak > 0.95, `base motion must reveal the artwork; observed peak ${peak}`);
  assert.ok(visibleSamples > 30, 'the reveal remains visible for more than a fleeting frame');
});
