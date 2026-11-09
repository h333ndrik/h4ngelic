/** Central interaction limits for the chrome wordmark. The F19 carousel has
 * its own settings and is not affected by these values.
 *
 * Two profiles coexist: a fine pointer gets the lively original physics, while
 * coarse pointers keep the B-F3 damping that stops a touch fling from throwing
 * the sculpture edge-on. The profile is chosen by capability, never by width. */
const damping = (linear, angular, draggingAngular) => Object.freeze({
  linear, angular, draggingAngular, returnAngularSpring: 30.25, returnAngular: 11,
});

export const heroPhysicsProfiles = Object.freeze({
  /** The pre-F19 values from main/src/physics.js: no rotation ceiling. */
  desktop: Object.freeze({
    returnDelaySeconds: 4,
    maximumPointerSpeed: 30,
    maximumDragVelocity: 18,
    maximumLinearVelocity: 7,
    maximumAngularVelocity: 5,
    maximumRotationAngle: Infinity,
    damping: damping(.65, .55, 1.5),
  }),
  /** B-F3: bounded so a touch fling stays readable. */
  touch: Object.freeze({
    returnDelaySeconds: 2.5,
    maximumPointerSpeed: 24,
    maximumDragVelocity: 14,
    maximumLinearVelocity: 4.2,
    maximumAngularVelocity: 2.2,
    /** Keep the sculpture away from an edge-on silhouette during a fling. */
    maximumRotationAngle: Math.PI * .22,
    damping: damping(1.15, 1.25, 3),
  }),
});

/** Capability first: a hybrid laptop with a mouse is a desktop, not a phone. */
export const heroPhysicsProfileFor = (matchMedia = globalThis.matchMedia) => (
  typeof matchMedia === 'function' && matchMedia('(any-pointer: fine)').matches ? 'desktop' : 'touch');
export const heroPhysicsSettingsFor = (matchMedia) => heroPhysicsProfiles[heroPhysicsProfileFor(matchMedia)];

/** Default export for callers and suites that only need the bounded profile. */
export const heroPhysicsSettings = heroPhysicsProfiles.touch;
