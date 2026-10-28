import { Euler, Quaternion, Vector3 } from 'three';

export const CYCLE_SECONDS = 15;
const rotation = new Euler(0, 0, 0, 'YXZ');

// The periodic base never depends on a pointer, physics state or inactivity timer.
export function sampleBase(time, motionScale = 1, position = new Vector3(), quaternion = new Quaternion()) {
  const phase = time / CYCLE_SECONDS * Math.PI * 2;
  position.set(Math.sin(phase) * 1.05 * motionScale, Math.sin(phase * 2) * .32 * motionScale, 0);
  rotation.set(phase * 2 * motionScale, phase * motionScale, Math.sin(phase * 2) * .025 * motionScale);
  quaternion.setFromEuler(rotation);
  return { position, quaternion };
}
