/**
 * All choreography scrubs with native scroll distance, never elapsed time.
 * Entrances begin when the section's top reaches 85% of the viewport, before
 * its short sticky interval. The final item settles immediately before release.
 */
export const motionSettings = Object.freeze({
  mobileBreakpoint: 700,
  approach: .85,
  pin: Object.freeze({ work: .68, contact: .58, mobileWork: .48, mobileContact: .44 }),
  fly: Object.freeze({ start: .025, stagger: .14, duration: .66, distanceVw: 1.35, rotation: 6.5, overshoot: 12, overshootAt: .78, accelerationRamp: .12 }),
  heading: Object.freeze({ start: 0, end: .27, rise: 112 }),
  about: Object.freeze({ approach: .68, finish: .10, headingEnd: .28, copyStart: .16, copyEnd: .90, linkStart: .30, linkEnd: 1, copyDistanceVw: .16, linkDistanceVw: .14, maximumCopyDistance: 130, maximumLinkDistance: 118 }),
  trail: Object.freeze({ layers: 2, distanceVw: .045, maximumDistance: 64, mobileMaximumDistance: 26, opacity: .22, secondaryOpacity: .13, fadeIn: .08, fadeOutStart: .38, fadeOutEnd: .82 }),
  hero: Object.freeze({ start: .02, end: .90, scale: .97 }),
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

/** Start at rest, then meet the established cubic with matching velocity and
 * acceleration. The short ramp preserves the rest of the existing entrance.
 */
function easeFromRest(value, accelerationRamp) {
  const p = clamp01(value);
  const ramp = Math.max(0, Math.min(.3, Number.isFinite(accelerationRamp) ? accelerationRamp : 0));
  if (!ramp || p >= ramp) return easeOutCubic(p);
  const end = easeOutCubic(ramp);
  const velocity = ramp * 3 * (1 - ramp) ** 2;
  const acceleration = ramp ** 2 * -6 * (1 - ramp);
  const a = 10 * end - 4 * velocity + acceleration / 2;
  const b = -15 * end + 7 * velocity - acceleration;
  const c = 6 * end - 3 * velocity + acceleration / 2;
  const q = p / ramp;
  return q ** 3 * (a + q * (b + q * c));
}

function smoothSettle(value) {
  const p = clamp01(value);
  return p ** 3 * (10 + p * (-15 + 6 * p));
}

/** The approach and native pin form one continuous, reversible scroll range. */
export function pinnedProgress(position, top, viewportHeight, pinRun, settings = motionSettings) {
  const approach = Math.max(0, viewportHeight * settings.approach);
  return (position - top + approach) / Math.max(1, approach + pinRun);
}

/** A continuous, deterministic entrance with one small controlled overshoot. */
export function sampleFlyIn(progress, { distance = 0, rotation = 0, overshoot = 0, overshootAt = .78, accelerationRamp = motionSettings.fly.accelerationRamp } = {}) {
  const p = clamp01(progress);
  if (p === 0) return { x: distance, rotation, opacity: 0 };
  if (p === 1) return { x: 0, rotation: 0, opacity: 1 };
  const turn = Math.max(.01, Math.min(.99, overshootAt));
  const settle = clamp01((p - turn) / (1 - turn));
  const x = p < turn
    ? distance + (-overshoot - distance) * easeFromRest(p / turn, accelerationRamp)
    : -overshoot * (1 - smoothSettle(settle));
  return { x, rotation: rotation * (1 - easeFromRest(p, accelerationRamp)), opacity: progressBetween(p, 0, .16) };
}

export function kineticItemProgress(sectionProgress, index, settings = motionSettings.fly) {
  return progressBetween(sectionProgress, settings.start + index * settings.stagger, settings.start + index * settings.stagger + settings.duration);
}

export function sampleKineticItem(sectionProgress, index, viewportWidth, settings = motionSettings.fly) {
  return sampleFlyIn(kineticItemProgress(sectionProgress, index, settings), { distance: viewportWidth * settings.distanceVw, rotation: settings.rotation, overshoot: settings.overshoot, overshootAt: settings.overshootAt, accelerationRamp: settings.accelerationRamp });
}

/** About shares the form's bounded fly-in, with its link arriving just after
 * the copy. Both scrub through the existing scroll clock and end at rest. */
export function sampleAboutItem(sectionProgress, role, viewportWidth, settings = motionSettings.about) {
  const link = role === 'link';
  const local = progressBetween(sectionProgress, link ? settings.linkStart : settings.copyStart, link ? settings.linkEnd : settings.copyEnd);
  const distance = Math.min(link ? settings.maximumLinkDistance : settings.maximumCopyDistance,
    Math.max(0, Number(viewportWidth) || 0) * (link ? settings.linkDistanceVw : settings.copyDistanceVw));
  return sampleFlyIn(local, { distance });
}

/** Empty decorative spans use CSS generated text, keeping real DOM text unique.
 * The echo depends only on progress, so reverse and stopped scroll are exact.
 */
export function sampleMotionTrail(progress, layer, viewportWidth, settings = motionSettings.trail) {
  const p = clamp01(progress);
  const maximum = viewportWidth <= motionSettings.mobileBreakpoint ? settings.mobileMaximumDistance : settings.maximumDistance;
  const distance = Math.min(Math.max(0, viewportWidth) * settings.distanceVw, maximum);
  const envelope = progressBetween(p, 0, settings.fadeIn) * (1 - progressBetween(p, settings.fadeOutStart, settings.fadeOutEnd));
  return {
    x: distance * (layer === 0 ? .55 : 1) * (1 - p) ** 3,
    opacity: (layer === 0 ? settings.opacity : settings.secondaryOpacity) * envelope,
  };
}

export function sampleHeading(progress, start = motionSettings.heading.start, end = motionSettings.heading.end) {
  const local = progressBetween(progress, start, end);
  return { y: motionSettings.heading.rise * (1 - easeOutCubic(local)), opacity: progressBetween(local, 0, .8) };
}

export function sampleHero(progress, settings = motionSettings.hero) {
  const local = easeOutCubic(progressBetween(progress, settings.start, settings.end));
  return { scale: 1 + (settings.scale - 1) * local, opacity: 1 - local };
}
