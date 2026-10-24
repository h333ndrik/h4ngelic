import { sampleHeroDepth } from './data/heroDepthSettings.js';

/** Camera-only composition driven by the hero's existing render loop.
 * Layout is measured by resize(), never by scrolling or pointer movement.
 * Does not read/write the wordmark, base motion, quaternions or physics state.
 */
export function createHeroDepth(camera, { fieldOfView = 35, worldSize }) {
  let geometry = null;
  let previousProgress = null;
  let previousReduced = null;
  let amount = 0;

  function update(scrollPosition, reduced) {
    if (!geometry) return;
    const progress = (scrollPosition - geometry.top) / geometry.height;
    if (progress === previousProgress && reduced === previousReduced) return;
    previousProgress = progress;
    previousReduced = reduced;
    const sample = sampleHeroDepth(progress, reduced);
    amount = sample.amount;
    camera.fov = fieldOfView + sample.fieldOfView;
    camera.position.set(geometry.distance * sample.x, geometry.distance * sample.y, geometry.distance * sample.distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    worldSize.y = 2 * Math.tan(camera.fov * Math.PI / 360) * camera.position.z;
    worldSize.x = worldSize.y * camera.aspect;
  }

  return {
    resize({ distance, top, height, scrollPosition, reduced }) {
      geometry = { distance, top, height: Math.max(1, height) };
      previousProgress = null;
      update(scrollPosition, reduced);
    },
    update,
    snapshot: () => ({ amount, position: camera.position.toArray(), fov: camera.fov }),
  };
}
