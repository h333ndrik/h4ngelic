import { Quaternion, Vector3 } from 'three';

const IDENTITY = new Quaternion();
const ZERO = new Vector3();
const RETURN_DELAY = 4;

/**
 * A world-space interaction layer, independent of the logo's animated transform.
 * Compose it as position = basePosition + offset and
 * quaternion = orientation * baseQuaternion.
 * All points, velocities and hit lever arms are in world coordinates.
 */
export class LogoPhysics {
  constructor({ random = Math.random } = {}) {
    this.offset = new Vector3();
    this.orientation = new Quaternion();
    this.velocity = new Vector3();
    this.angularVelocity = new Vector3();
    this.dragging = false;
    this.lastInteraction = -Infinity;
    this.random = random;
    this._dragPoint = new Vector3();
    this._previousDragPoint = new Vector3();
    this._grabLever = new Vector3();
    this._dragVelocity = new Vector3();
    this._lastDragSample = -Infinity;
    this._target = new Vector3();
    this._impulse = new Vector3();
    this._torque = new Vector3();
    this._axis = new Vector3();
    this._delta = new Quaternion();
  }

  /** Cursor velocity in world units/second; impact is relative to logo center. */
  hit(pointerVelocity, impactPoint, now) {
    if (this.dragging || !Number.isFinite(now)) return;
    const speed = Math.min(pointerVelocity.length(), 30);
    if (speed < 0.008) return;
    this._impulse.copy(pointerVelocity).clampLength(0, 30)
      .multiplyScalar(0.11 + Math.min(Math.sqrt(speed) * 0.035, 0.18));
    this._impulse.clampLength(0, 4);
    this.velocity.add(this._impulse).clampLength(0, 7);

    // The lever arm determines the spin: opposite edges turn opposite ways.
    // A slight virtual depth gives even a frontal hit a natural X/Y rotation.
    this._axis.copy(impactPoint);
    this._axis.z += 0.3;
    this._torque.crossVectors(this._axis, this._impulse).multiplyScalar(0.65);
    const variation = Math.min(speed * 0.006, 0.07);
    this._torque.x += (this.random() - 0.5) * variation;
    this._torque.y += (this.random() - 0.5) * variation;
    this._torque.z += (this.random() - 0.5) * variation;
    this.angularVelocity.add(this._torque).clampLength(0, 5);
    this.lastInteraction = now;
  }

  /** Keep the grabbed point under the pointer rather than snapping the center. */
  beginDrag(worldPoint, basePosition, now) {
    this.dragging = true;
    this.lastInteraction = now;
    this._dragPoint.copy(worldPoint);
    this._previousDragPoint.copy(worldPoint);
    this._grabLever.copy(worldPoint).sub(basePosition).sub(this.offset);
    this._dragVelocity.set(0, 0, 0);
    this._lastDragSample = now;
    this.velocity.multiplyScalar(0.3);
  }

  dragTo(worldPoint, basePosition, dt, now) {
    if (!this.dragging || !Number.isFinite(dt) || dt <= 0) return;
    const safeDt = Math.max(1e-5, dt);
    this._impulse.copy(worldPoint).sub(this._dragPoint);
    this._dragVelocity.lerp(this._target.copy(this._impulse)
      .divideScalar(safeDt).clampLength(0, 18), 1 - Math.exp(-36 * safeDt));
    this._torque.crossVectors(this._grabLever, this._impulse).multiplyScalar(0.8);
    // Turning also works when the logo is grabbed near its center.
    this._torque.x -= this._impulse.y * 0.12;
    this._torque.y += this._impulse.x * 0.12;
    this.angularVelocity.add(this._torque).clampLength(0, 4);
    this._dragPoint.copy(worldPoint);
    this._lastDragSample = now;
    this.lastInteraction = now;
  }

  endDrag(now) {
    if (!this.dragging) return;
    this.dragging = false;
    this.lastInteraction = now;
    // A release after holding still must not revive the previous pointer speed.
    const idleTime = Math.max(0, now - this._lastDragSample);
    this._dragVelocity.multiplyScalar(Math.exp(-14 * idleTime));
    this.velocity.lerp(this._dragVelocity, 0.35).clampLength(0, 7);
  }

  /**
   * bounds is the allowable center position after subtracting the mesh's margin.
   * Substeps keep spring and collision behavior stable at different frame rates.
   * A suspended browser tab advances at most 250 ms to avoid a violent catch-up.
   */
  update(dt, now, bounds = { x: Infinity, y: Infinity }, basePosition = ZERO) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const elapsed = Math.min(dt, 0.25);
    const steps = Math.max(1, Math.ceil(elapsed * 120));
    const step = elapsed / steps;
    for (let i = 0; i < steps; i += 1) {
      const time = now - elapsed + (i + 1) * step;
      const returning = !this.dragging && time - this.lastInteraction >= RETURN_DELAY;

      if (this.dragging) {
        // Integrate the pointer's path over the frame instead of treating its
        // newest sample as though it had been there for the entire frame.
        this._target.copy(this._previousDragPoint)
          .lerp(this._dragPoint, (i + 0.5) / steps)
          .sub(this._grabLever).sub(basePosition);
        this._springPosition(this._target, 28, step);
      } else if (returning) {
        this._springPosition(ZERO, 5.5, step);
      } else {
        const damping = Math.exp(-0.65 * step);
        // Exact integral of exponential velocity decay.
        this.offset.addScaledVector(this.velocity, (1 - damping) / 0.65);
        this.velocity.multiplyScalar(damping);
      }

      if (returning) {
        // Quaternion logarithm gives the shortest world-axis route to identity.
        const sign = this.orientation.w < 0 ? -1 : 1;
        this._axis.set(this.orientation.x, this.orientation.y, this.orientation.z)
          .multiplyScalar(sign);
        const sine = this._axis.length();
        const angle = 2 * Math.atan2(sine, this.orientation.w * sign);
        if (sine > 1e-8) this._axis.multiplyScalar(angle / sine);
        this.angularVelocity.addScaledVector(this._axis, -30.25 * step);
        this.angularVelocity.multiplyScalar(Math.exp(-11 * step));
      } else {
        this.angularVelocity.multiplyScalar(Math.exp(-(this.dragging ? 1.5 : 0.55) * step));
      }

      const angleStep = this.angularVelocity.length() * step;
      if (angleStep > 1e-10) {
        this._axis.copy(this.angularVelocity).normalize();
        this._delta.setFromAxisAngle(this._axis, angleStep);
        this.orientation.premultiply(this._delta).normalize();
      }

      this._constrain('x', bounds.x, basePosition.x, step);
      this._constrain('y', bounds.y, basePosition.y, step);
    }
    if (this.dragging) this._previousDragPoint.copy(this._dragPoint);
  }

  _springPosition(target, frequency, dt) {
    // Analytic critically damped spring: no frame-dependent lerp factors.
    const decay = Math.exp(-frequency * dt);
    for (const axis of ['x', 'y', 'z']) {
      const error = this.offset[axis] - target[axis];
      const transient = this.velocity[axis] + frequency * error;
      this.offset[axis] = target[axis] + (error + transient * dt) * decay;
      this.velocity[axis] = (this.velocity[axis] - frequency * transient * dt) * decay;
    }
  }

  _constrain(axis, limit, base, dt) {
    if (!Number.isFinite(limit)) return;
    const safeLimit = Math.max(0.01, limit);
    const position = base + this.offset[axis];
    const direction = Math.sign(position);
    const penetration = Math.abs(position) - safeLimit * 0.87;
    if (penetration > 0) {
      const outwardVelocity = Math.max(0, this.velocity[axis] * direction);
      this.velocity[axis] -= direction * (penetration * 55 + outwardVelocity * 10) * dt;
    }
    if (Math.abs(position) > safeLimit) {
      this.offset[axis] = direction * safeLimit - base;
      if (this.velocity[axis] * direction > 0) this.velocity[axis] *= -0.35;
    }
  }

  reset() {
    this.offset.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.orientation.copy(IDENTITY);
    this.dragging = false;
    this.lastInteraction = -Infinity;
    this._dragVelocity.set(0, 0, 0);
    this._lastDragSample = -Infinity;
  }
}
