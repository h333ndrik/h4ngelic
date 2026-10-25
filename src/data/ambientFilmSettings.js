/** Other Side's sampled-film backplane. It never filters or rasterizes UI. */
export const ambientFilmSettings = Object.freeze({
  enabled: true,
  chemicalIntensity: 1.25,
  movementSpeed: 1,
  patchOpacity: .68,
  minimumEvolutionSeconds: 19,
  maximumEvolutionSeconds: 37,
  minimumPatchRadius: .17,
  maximumPatchRadius: .38,
  bandIntervalSeconds: 5.7,
  bandDurationSeconds: 1.5,
  bandOpacity: .64,
  exposureIntensity: .18,
  palette: Object.freeze(['#7800ff', '#b7ff0e', '#ec20db']),
  desktop: Object.freeze({ maximumWidth: 1120, maximumHeight: 800, sourceDimension: 1024, framesPerSecond: 6, activeFramesPerSecond: 24, maximumCells: 1400, regions: 26, codecFragments: 156, patches: 4, bands: 3 }),
  mobile: Object.freeze({ maximumWidth: 512, maximumHeight: 768, sourceDimension: 768, framesPerSecond: 3, activeFramesPerSecond: 18, maximumCells: 600, regions: 11, codecFragments: 64, patches: 3, bands: 2 }),
});
