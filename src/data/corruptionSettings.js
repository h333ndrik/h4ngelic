import { ambientFilmSettings } from './ambientFilmSettings.js';

/** Reference-based pixel/film controls. Existing hero material strengths stay
 * unchanged; stronger damage is scoped to the film, image ROIs and snapshots.
 */
export const corruptionSettings = Object.freeze({
  assets: Object.freeze({ desktop: '/assets/corrupted-film.webp', mobile: '/assets/corrupted-film-mobile.webp' }),
  distressIntensity: 1,
  filmBurnIntensity: 1,
  grainIntensity: .7,
  colorCorruption: 1,
  pixelCorruption: 1.35,
  glowStrength: 1,
  smearingIntensity: 1.35,
  // Higher recoverySpeed restores the original pixels sooner.
  recoverySpeed: 1,
  recoveryMs: 2350,
  ambient: ambientFilmSettings,
  transition: Object.freeze({ minimumDurationMs: 1400, maximumDurationMs: 1400, framesPerSecond: 20,
    displacementPx: 180, smearPx: 220, channelOffsetPx: 9, colorStrength: .86, columns: 18, rows: 12 }),
  rendering: Object.freeze({ maximumSourceStretch: 190, maximumHistoryStretch: 250,
    sourceSmearRatio: .55, historySmearRatio: .72, historyOpacity: .74, stripeOpacity: .66, stripeEvery: 3 }),
  field: Object.freeze({
    maximumImpulses: 36,
    maximumVelocity: 4, // CSS pixels per millisecond, independent of frame rate.
    velocityResetMs: 180,
    coalesceDistance: 20,
    coalesceWindowMs: 40,
    minimumRadius: 32,
    maximumRadius: 200,
    minimumBlockSize: 12,
    maximumBlockSize: 40,
    maximumDisplacement: 150,
    maximumSmear: 330,
    channelOffsetPx: 9,
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

/** Shared by asset loading and ambient/ROI rendering, including weak desktops. */
export function chooseCorruptionProfile({ coarsePointer = false, memory, cores, saveData = false } = {}) {
  return coarsePointer || saveData || memory > 0 && memory <= 4 || cores > 0 && cores <= 4 ? 'mobile' : 'desktop';
}
