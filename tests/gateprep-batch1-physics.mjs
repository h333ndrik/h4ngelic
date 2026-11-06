import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { Quaternion, Vector3 } from 'three';
import { LogoPhysics } from '../src/physics.js';
import { heroPhysicsSettings } from '../src/data/heroPhysicsSettings.js';

// The pre-fix constants from 831737c. Replaying the identical extreme gesture
// through them proves that the new assertions are red without the fix.
const legacySettings = {
  returnDelaySeconds: 4,
  maximumPointerSpeed: 30,
  maximumDragVelocity: 18,
  maximumLinearVelocity: 7,
  maximumAngularVelocity: 5,
  maximumRotationAngle: Infinity,
  damping: { linear: .65, angular: .55, draggingAngular: 1.5, returnAngularSpring: 30.25, returnAngular: 11 },
};

const identity = new Quaternion();
const unbounded = { x: Infinity, y: Infinity };
const output = new URL('../docs/validation/GATEPREP/BATCH-1/gallery/', import.meta.url);
await mkdir(output, { recursive: true });

function runGesture(settings) {
  const physics = new LogoPhysics({ random: () => .5, settings });
  const base = new Vector3();
  let time = 0;
  physics.beginDrag(new Vector3(-2, -1, 0), base, 0);
  for (let index = 0; index < 12; index += 1) {
    time += 1 / 120;
    physics.dragTo(new Vector3(-2 + (index + 1) * .5, -1 + (index + 1) * .15, 0), base, 1 / 120, time);
    physics.update(1 / 120, time, unbounded, base);
  }
  physics.endDrag(time);
  let maximumRotationDegrees = 0, peakAtMs = 0, maximumLinearVelocity = 0, maximumAngularVelocity = 0, settledAtMs = null;
  for (let step = 1; step <= 600; step += 1) {
    const now = time + step / 120;
    physics.update(1 / 120, now, unbounded, base);
    const degrees = physics.orientation.angleTo(identity) * 180 / Math.PI;
    if (degrees > maximumRotationDegrees) { maximumRotationDegrees = degrees; peakAtMs = step / 120 * 1000; }
    maximumLinearVelocity = Math.max(maximumLinearVelocity, physics.velocity.length());
    maximumAngularVelocity = Math.max(maximumAngularVelocity, physics.angularVelocity.length());
    if (settledAtMs === null && maximumRotationDegrees > 5 && degrees < 2) settledAtMs = step / 120 * 1000;
  }
  return { maximumRotationDegrees, peakAtMs, maximumLinearVelocity, maximumAngularVelocity, settledAtMs };
}

const before = runGesture(legacySettings);
const after = runGesture(heroPhysicsSettings);
const limitDegrees = heroPhysicsSettings.maximumRotationAngle * 180 / Math.PI;
const settleLimitMs = (heroPhysicsSettings.returnDelaySeconds + 1) * 1000;

assert.ok(before.maximumRotationDegrees > 90, `the legacy gesture must reproduce the edge-on overshoot: ${before.maximumRotationDegrees}`);
assert.ok(after.maximumRotationDegrees <= limitDegrees + 1e-6, `rotation ${after.maximumRotationDegrees} exceeded ${limitDegrees}`);
assert.ok(after.maximumLinearVelocity <= heroPhysicsSettings.maximumLinearVelocity + 1e-6);
assert.ok(after.maximumAngularVelocity <= heroPhysicsSettings.maximumAngularVelocity + 1e-6);
assert.ok(after.settledAtMs !== null && after.settledAtMs <= settleLimitMs, `the fling must settle inside the return window: ${after.settledAtMs}`);

const report = { checkedAt: new Date().toISOString(), gesture: 'extreme 12-step touch fling, 120 Hz',
  limitDegrees, returnDelaySeconds: heroPhysicsSettings.returnDelaySeconds, before, after,
  assertions: { legacyOver90Degrees: true, boundedRotation: true, boundedVelocities: true, settlesInWindow: true } };
await writeFile(new URL('fling-physics.json', output), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS fling physics: ${before.maximumRotationDegrees.toFixed(2)}° -> ${after.maximumRotationDegrees.toFixed(2)}° (limit ${limitDegrees.toFixed(1)}°), settle ${after.settledAtMs.toFixed(0)}ms.`);
