/**
 * Homepage choreography uses scroll distance, never elapsed animation time.
 * Pin distances are multiples of viewport height; travel is viewport width.
 * Keeping the settings here makes the sequence editable without touching DOM
 * listeners or the Three.js scene. See docs/MOTION.md before changing ranges.
 */
export const motionSettings = Object.freeze({
  mobileBreakpoint: 700,
  pin: Object.freeze({ work: 1.12, contact: .95, mobileWork: .68, mobileContact: .60 }),
  fly: Object.freeze({ start: .03, stagger: .16, duration: .58, distanceVw: 1.5, rotation: 6.5, overshoot: 14, overshootAt: .78 }),
  heading: Object.freeze({ start: -.72, end: -.06, rise: 112 }),
  about: Object.freeze({ approach: .78, finish: .10, headingEnd: .48, copyStart: .14, copyEnd: .88, linkStart: .32, linkEnd: 1, copyDistanceVw: .48, linkDistanceVw: .27 }),
  hero: Object.freeze({ start: .02, end: .90, scale: .88 }),
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

/** A continuous, deterministic entrance with one small controlled overshoot. */
export function sampleFlyIn(progress, { distance = 0, rotation = 0, overshoot = 0, overshootAt = .78 } = {}) {
  const p = clamp01(progress);
  // Explicit endpoints avoid floating-point remnants at rest and on reversal.
  if (p === 0) return { x: distance, rotation, opacity: 0 };
  if (p === 1) return { x: 0, rotation: 0, opacity: 1 };
  const turn = Math.max(.01, Math.min(.99, overshootAt));
  const settle = clamp01((p - turn) / (1 - turn));
  const x = p < turn
    ? distance + (-overshoot - distance) * easeOutCubic(p / turn)
    : -overshoot * (1 - settle * settle * (3 - 2 * settle));
  return { x, rotation: rotation * (1 - easeOutCubic(p)), opacity: progressBetween(p, 0, .16) };
}

export function sampleKineticItem(sectionProgress, index, viewportWidth, settings = motionSettings.fly) {
  const local = progressBetween(sectionProgress, settings.start + index * settings.stagger, settings.start + index * settings.stagger + settings.duration);
  return sampleFlyIn(local, { distance: viewportWidth * settings.distanceVw, rotation: settings.rotation, overshoot: settings.overshoot, overshootAt: settings.overshootAt });
}

export function sampleHeading(progress, start = motionSettings.heading.start, end = motionSettings.heading.end) {
  const local = progressBetween(progress, start, end);
  return { y: motionSettings.heading.rise * (1 - easeOutCubic(local)), opacity: progressBetween(local, 0, .8) };
}

export function sampleHero(progress, settings = motionSettings.hero) {
  const local = easeOutCubic(progressBetween(progress, settings.start, settings.end));
  return { scale: 1 + (settings.scale - 1) * local, opacity: 1 - local };
}
