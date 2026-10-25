/** Bounded inter-frame pixel carry. The history is a captured image region,
 * rebuilt gradually from current source pixels and released after recovery.
 */
export const temporalMoshSettings = Object.freeze({
  maximumQueuedImpulses: 6,
  maximumPendingAgeMs: 900,
  advectionRatio: .24,
  maximumAdvectionPx: 44,
  feedbackOpacity: .9,
  reconstructionEvery: 4,
  minimumReconstruction: .012,
  maximumReconstruction: .3,
  impulses: Object.freeze({
    hover: Object.freeze({ maximumRadius: 64, recoveryRatio: .42 }),
    focus: Object.freeze({ maximumRadius: 48, recoveryRatio: .32 }),
    click: Object.freeze({ maximumRadius: 150, recoveryRatio: .75 }),
    navigation: Object.freeze({ maximumRadius: 180, recoveryRatio: .85 }),
    section: Object.freeze({ maximumRadius: 130, recoveryRatio: .62 }),
    scroll: Object.freeze({ maximumRadius: 110, recoveryRatio: .48 }),
    typography: Object.freeze({ maximumRadius: 110, recoveryRatio: .55 }),
    logo: Object.freeze({ maximumRadius: 120, recoveryRatio: .58 }),
  }),
});
