/**
 * Other Side effect controls. Values are provisional until all supplied visual
 * references have been inspected. These numbers do not define a new palette.
 * Intensity controls use 0 = none, 1 = intended strength, up to 2 = exaggerated.
 */
export const corruptionSettings = Object.freeze({
  assets: Object.freeze({ desktop: '/assets/corrupted-film.webp', mobile: '/assets/corrupted-film-mobile.webp' }),
  distressIntensity: 1,
  filmBurnIntensity: 1,
  grainIntensity: .7,
  colorCorruption: 1,
  pixelCorruption: 1,
  glowStrength: 1,
  smearingIntensity: 1,
  // Higher recoverySpeed restores the original pixels sooner.
  recoverySpeed: 1,
  recoveryMs: 1600,
  field: Object.freeze({
    maximumImpulses: 36,
    maximumVelocity: 4, // CSS pixels per millisecond, independent of frame rate.
    velocityResetMs: 180,
    coalesceDistance: 20,
    coalesceWindowMs: 40,
    minimumRadius: 24,
    maximumRadius: 120,
    minimumBlockSize: 12,
    maximumBlockSize: 40,
    maximumDisplacement: 84,
    maximumSmear: 164,
    instabilityIntervalMs: 80,
    maximumCoordinate: 10_000_000,
  }),
  quality: Object.freeze({
    maximumRegions: 2, // One active ROI and one anchored, recovering ROI.
    desktop: Object.freeze({ width: 620, height: 420, pixelRatio: 1, framesPerSecond: 30, maximumBlocks: 160, minimumBlocks: 40, maximumPhotoDimension: 1024 }),
    mobile: Object.freeze({ width: 360, height: 300, pixelRatio: 1, framesPerSecond: 30, maximumBlocks: 72, minimumBlocks: 40, maximumPhotoDimension: 640 }),
    reducedMotion: Object.freeze({ interactiveCorruption: false }),
  }),
});
