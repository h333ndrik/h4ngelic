export function chooseRenderQuality({ pixelRatio = 1, coarsePointer = false, memory, cores, saveData = false } = {}) {
  const constrained = saveData || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
  return {
    name: constrained ? 'constrained' : coarsePointer ? 'mobile' : 'desktop',
    pixelRatio: Math.max(.75, Math.min(pixelRatio, constrained ? 1 : coarsePointer ? 1.5 : 2)),
    environmentSize: constrained || coarsePointer ? 128 : 256,
    curveSegments: constrained ? 8 : 10,
    bevelSegments: constrained ? 3 : 4,
    antialias: !constrained,
  };
}

/** Sustained low frame rates reduce resolution only, never material or motion. */
export class AdaptiveResolution {
  constructor(pixelRatio) {
    this.pixelRatio = pixelRatio;
    this.samples = [];
    this.lastChange = 0;
  }

  sample(seconds, now) {
    if (seconds <= 0 || seconds > .25 || this.pixelRatio <= 1) return null;
    this.samples.push(seconds);
    if (this.samples.length < 90 || now - this.lastChange < 5000) return null;
    const average = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
    this.samples.length = 0;
    if (average < 1 / 28) return null;
    this.pixelRatio = Math.max(1, this.pixelRatio - .25);
    this.lastChange = now;
    return this.pixelRatio;
  }

  reset() { this.samples.length = 0; }
}
