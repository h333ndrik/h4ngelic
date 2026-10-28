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
  desktop: Object.freeze({ resolutionScale: .35, maximumWidth: 720, maximumHeight: 480, sourceDimension: 1024, framesPerSecond: 12, activeFramesPerSecond: 20, maximumCells: 600, regions: 26, codecFragments: 156, patches: 4, bands: 3 }),
  mobile: Object.freeze({ resolutionScale: .4, maximumWidth: 320, maximumHeight: 480, sourceDimension: 768, framesPerSecond: 8, activeFramesPerSecond: 16, maximumCells: 300, regions: 11, codecFragments: 64, patches: 3, bands: 2 }),
});
