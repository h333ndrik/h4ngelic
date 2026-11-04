/** Central interaction limits for the chrome wordmark. The F19 carousel has
 * its own settings and is not affected by these values. */
export const heroPhysicsSettings = Object.freeze({
  returnDelaySeconds: 2.5,
  maximumPointerSpeed: 24,
  maximumDragVelocity: 14,
  maximumLinearVelocity: 4.2,
  maximumAngularVelocity: 2.2,
  /** Keep the sculpture away from an edge-on silhouette during a fling. */
  maximumRotationAngle: Math.PI * .22,
  damping: Object.freeze({
    linear: 1.15,
    angular: 1.25,
    draggingAngular: 3,
    returnAngularSpring: 30.25,
    returnAngular: 11,
  }),
});
