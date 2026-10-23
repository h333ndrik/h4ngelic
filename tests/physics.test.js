import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { LogoPhysics } from '../src/physics.js';

const makePhysics = () => new LogoPhysics({ random: () => 0.5 });
const unbounded = { x: Infinity, y: Infinity };

function advance(physics, start, duration, hz = 60, bounds = unbounded, base = new Vector3()) {
  const count = Math.round(duration * hz);
  for (let i = 0; i < count; i += 1) physics.update(1 / hz, start + (i + 1) / hz, bounds, base);
}

test('impact direction, speed, and lever arm determine displacement and spin', () => {
  const left = makePhysics();
  const right = makePhysics();
  const slow = makePhysics();
  left.hit(new Vector3(0, 8, 0), new Vector3(-2, 0, 0), 0);
  right.hit(new Vector3(0, 8, 0), new Vector3(2, 0, 0), 0);
  slow.hit(new Vector3(0, 1, 0), new Vector3(2, 0, 0), 0);
  assert.ok(left.velocity.y > 0);
  assert.ok(right.angularVelocity.z > 0);
  assert.ok(left.angularVelocity.z < 0);
  assert.ok(right.velocity.length() > slow.velocity.length());
  assert.ok(right.angularVelocity.x !== 0, 'frontal hit also turns the X axis');
  const previous = right.velocity.y;
  right.hit(new Vector3(0, 8, 0), new Vector3(2, 0, 0), 0.1);
  assert.ok(right.velocity.y > previous, 'repeated hits accumulate momentum');
});

test('drag preserves the grab offset and releases with linear and angular momentum', () => {
  const physics = makePhysics();
  const base = new Vector3(1, 0, 0);
  physics.beginDrag(new Vector3(2, 0, 0), base, 0);
  advance(physics, 0, 0.1, 60, unbounded, base);
  assert.ok(physics.offset.length() < 1e-8, 'pointer down does not teleport the center');
  for (let i = 0; i < 30; i += 1) {
    const time = 0.1 + (i + 1) / 60;
    physics.dragTo(new Vector3(2 + (i + 1) / 30, (i + 1) / 30, 0), base, 1 / 60, time);
    physics.update(1 / 60, time, unbounded, base);
  }
  physics.endDrag(0.6);
  assert.ok(physics.offset.x > 0.8);
  assert.ok(physics.velocity.x > 0.5);
  assert.ok(physics.angularVelocity.length() > 0.05);
  const before = physics.offset.clone();
  advance(physics, 0.6, 0.1, 60, unbounded, base);
  assert.ok(physics.offset.x > before.x, 'release carries movement forward');
});

test('return starts after inactivity and smoothly settles both independent transforms', () => {
  const physics = makePhysics();
  physics.hit(new Vector3(4, 2, 0), new Vector3(1, 1, 0), 0);
  advance(physics, 0, 3.9);
  const beforeReturn = physics.offset.length();
  assert.ok(beforeReturn > 0.5, 'the logo still drifts before the return timer');
  advance(physics, 3.9, 2.1);
  assert.ok(physics.offset.length() < beforeReturn * 0.005);
  assert.ok(physics.orientation.angleTo(new Quaternion()) < 0.02);
  assert.ok(physics.velocity.length() < 0.02);
});

test('a new hit interrupts return immediately and restarts inactivity timing', () => {
  const physics = makePhysics();
  physics.hit(new Vector3(4, 0, 0), new Vector3(1, 0, 0), 0);
  advance(physics, 0, 4.5);
  physics.hit(new Vector3(-8, 0, 0), new Vector3(1, 0, 0), 4.5);
  const velocity = physics.velocity.x;
  physics.update(1 / 60, 4.5 + 1 / 60);
  assert.ok(velocity < 0);
  assert.ok(Math.abs(physics.velocity.x - velocity) < 0.05, 'no return spring fights the new hit');
  assert.equal(physics.lastInteraction, 4.5);
});

test('substepped motion is stable at 30, 60, and 120 Hz', () => {
  const results = [30, 60, 120].map((hz) => {
    const physics = makePhysics();
    physics.hit(new Vector3(6, 2, 0), new Vector3(1, 1, 0), 0);
    advance(physics, 0, 5.5, hz);
    return physics;
  });
  for (const result of results.slice(1)) {
    assert.ok(result.offset.distanceTo(results[0].offset) < 0.003);
    assert.ok(result.orientation.angleTo(results[0].orientation) < 0.003);
  }
});

test('viewport constraints keep the displayed center inside its limits', () => {
  const physics = makePhysics();
  const base = new Vector3(0.5, -0.3, 0);
  physics.hit(new Vector3(30, -30, 0), new Vector3(1, 1, 0), 0);
  for (let i = 0; i < 240; i += 1) {
    physics.update(1 / 60, (i + 1) / 60, { x: 1.5, y: 0.8 }, base);
    assert.ok(Math.abs(base.x + physics.offset.x) <= 1.5 + 1e-10);
    assert.ok(Math.abs(base.y + physics.offset.y) <= 0.8 + 1e-10);
  }
});

test('reset clears interaction state without modifying external base transforms', () => {
  const physics = makePhysics();
  physics.hit(new Vector3(4, 2, 0), new Vector3(1, 1, 0), 0);
  advance(physics, 0, 0.2);
  physics.reset();
  assert.equal(physics.offset.length(), 0);
  assert.equal(physics.velocity.length(), 0);
  assert.equal(physics.angularVelocity.length(), 0);
  assert.equal(physics.orientation.angleTo(new Quaternion()), 0);
  assert.equal(physics.dragging, false);
});

test('releasing after a stationary hold does not revive stale drag momentum', () => {
  const physics = makePhysics();
  const base = new Vector3();
  physics.beginDrag(new Vector3(1, 0, 0), base, 0);
  physics.dragTo(new Vector3(2, 0, 0), base, 0.1, 0.1);
  advance(physics, 0.1, 1);
  physics.endDrag(1.1);
  assert.ok(physics.velocity.length() < 0.001);
});

test('drag release velocity is consistent across pointer sampling rates', () => {
  const results = [30, 60, 120].map((hz) => {
    const physics = makePhysics();
    const base = new Vector3();
    physics.beginDrag(new Vector3(1, 0, 0), base, 0);
    for (let i = 0; i < hz; i += 1) {
      const time = (i + 1) / hz;
      // Vary the speed to exercise the time-based low-pass filter.
      physics.dragTo(new Vector3(1 + time * time, time * time * 0.3, 0), base, 1 / hz, time);
      physics.update(1 / hz, time);
    }
    physics.endDrag(1);
    return physics;
  });
  for (const result of results.slice(1)) {
    assert.ok(result.velocity.distanceTo(results[0].velocity) < 0.06);
    assert.ok(result.angularVelocity.distanceTo(results[0].angularVelocity) < 0.02);
  }
});
