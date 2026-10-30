/** Native scroll is the single clock for all editorial entrances. */
const calm = Object.freeze({ start: .16, end: .90, distanceVw: .055, maximumDistance: 36 });
export const motionSettings = Object.freeze({
  mobileBreakpoint: 700,
  approach: .85,
  pin: Object.freeze({ work: .68, contact: .58, mobileWork: .48, mobileContact: .44 }),
  calm,
  heading: Object.freeze({ start: 0, end: .27, rise: 112 }),
  // Keep the approved About paragraph/link timing and modest relative inset.
  about: Object.freeze({ approach: .68, finish: .10, headingEnd: .28,
    copyStart: calm.start, copyEnd: calm.end, linkStart: .24, linkEnd: .98,
    copyDistanceVw: calm.distanceVw, linkDistanceVw: .045,
    maximumCopyDistance: calm.maximumDistance, maximumLinkDistance: 28 }),
  hero: Object.freeze({ start: .02, end: .90, scale: .97 }),
  heroBar: Object.freeze({ start: .02, end: .55 }),
});

export function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function progressBetween(value, start, end) {
  return end > start ? clamp01((value - start) / (end - start)) : Number(value >= end);
}

export function easeOutCubic(value) {
  return 1 - (1 - clamp01(value)) ** 3;
}

/** Rest-to-rest interpolation: no rotation, overshoot, stagger or history. */
export function smoothProgress(value) {
  const p = clamp01(value);
  return p ** 3 * (10 + p * (-15 + 6 * p));
}

/** The existing native sticky Work interval remains independent of animation. */
export function pinnedProgress(position, top, viewportHeight, pinRun, settings = motionSettings) {
  const approach = Math.max(0, viewportHeight * settings.approach);
  return (position - top + approach) / Math.max(1, approach + pinRun);
}

export function sampleCalmProgress(progress, distance = 0) {
  const amount = smoothProgress(progress);
  const boundedDistance = Math.max(0, Number.isFinite(distance) ? distance : 0);
  return { x: boundedDistance * (1 - amount), rotation: 0, opacity: amount };
}

export function sampleCalmItem(sectionProgress, viewportWidth, settings = motionSettings.calm) {
  const distance = Math.min(settings.maximumDistance,
    Math.max(0, Number(viewportWidth) || 0) * settings.distanceVw);
  return sampleCalmProgress(progressBetween(sectionProgress, settings.start, settings.end), distance);
}

/** About retains its approved copy/link offsets through the same calm sampler. */
export function sampleAboutItem(sectionProgress, role, viewportWidth, settings = motionSettings.about) {
  const link = role === 'link';
  const local = progressBetween(sectionProgress, link ? settings.linkStart : settings.copyStart,
    link ? settings.linkEnd : settings.copyEnd);
  const distance = Math.min(link ? settings.maximumLinkDistance : settings.maximumCopyDistance,
    Math.max(0, Number(viewportWidth) || 0) * (link ? settings.linkDistanceVw : settings.copyDistanceVw));
  return sampleCalmProgress(local, distance);
}

/** Every label belonging to an archive group receives this same parent pose. */
export function sampleArchiveHeading(sectionProgress, viewportWidth, settings = motionSettings.about) {
  const distance = Math.min(settings.maximumCopyDistance,
    Math.max(0, Number(viewportWidth) || 0) * settings.copyDistanceVw);
  return sampleCalmProgress(sectionProgress, distance);
}

export function sampleHeading(progress, start = motionSettings.heading.start, end = motionSettings.heading.end) {
  const local = progressBetween(progress, start, end);
  return { y: motionSettings.heading.rise * (1 - easeOutCubic(local)), opacity: progressBetween(local, 0, .8) };
}

export function sampleHero(progress, settings = motionSettings.hero) {
  const local = easeOutCubic(progressBetween(progress, settings.start, settings.end));
  return { scale: 1 + (settings.scale - 1) * local, opacity: 1 - local };
}

/** The bar is completely gone before the next section fills the viewport. */
export function sampleHeroBar(progress, { reduced = false, settings = motionSettings.heroBar } = {}) {
  const opacity = reduced ? Number(progress < settings.end)
    : 1 - smoothProgress(progressBetween(progress, settings.start, settings.end));
  return { opacity, hidden: opacity <= .001 };
}

// Compatibility exports for existing consumers. The kinetic implementation,
// stagger/overshoot configuration and decorative trails have been retired.
// Runtime choreography uses only the calm samplers above.
export function sampleFlyIn(progress, { distance = 0 } = {}) {
  return sampleCalmProgress(progress, distance);
}
export function kineticItemProgress(sectionProgress, _index, settings = motionSettings.calm) {
  return progressBetween(sectionProgress, settings.start, settings.end);
}
export function sampleKineticItem(sectionProgress, _index, viewportWidth, settings = motionSettings.calm) {
  return sampleCalmItem(sectionProgress, viewportWidth, settings);
}
export function sampleMotionTrail() { return { x: 0, opacity: 0 }; }
