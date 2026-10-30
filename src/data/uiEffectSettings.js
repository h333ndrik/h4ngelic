/** Shared interaction tuning. Geometry, cursor assets and scroll poses stay separate. */
export const uiEffectSettings = Object.freeze({
  hover: Object.freeze({
    scale: 1.025,
    largeScale: 1.025,
    imageScale: 1.025,
    durationMs: 300,
    releaseMs: 300,
    easing: 'cubic-bezier(.2,.8,.25,1)',
    glowStrength: .2,
    otherSideGlowStrength: 1.15,
  }),
  magnetDistance: 2,
  arrow: Object.freeze({ sizeEm: .72, gapEm: .22, minimumGapPx: 7, maximumGapPx: 18, strokePx: 1.25, movementPx: 2 }),
});

/** Magnify a large label only into unused space in its own stationary column. */
export function boundedHoverScale(visualWidth, availableWidth, preferred, margin = 5) {
  if (!(visualWidth > 0) || !(availableWidth > 0)) return 1;
  return Math.max(1, Math.min(preferred, (availableWidth - margin) / visualWidth));
}

/** Fit the visual's enlarged edges, including its finite magnetic travel.
 * The stationary target keeps its own geometry. An already partly offscreen
 * carousel item is never enlarged further or pulled away from its hit area. */
export function fitHoverFrame({ left, width, boundsLeft = 0, boundsRight,
  preferred = uiEffectSettings.hover.scale, origin = 0, padding = 8, translation = 0 } = {}) {
  const still = { scale: 1, minimumTranslation: 0, maximumTranslation: 0 };
  if (![left, width, boundsLeft, boundsRight].every(Number.isFinite) || width <= 0
    || boundsRight <= boundsLeft || left < boundsLeft - .5 || left + width > boundsRight + .5) return still;
  const fraction = Math.max(0, Math.min(1, Number.isFinite(origin) ? origin : 0));
  const distance = Math.max(0, Number.isFinite(translation) ? translation : 0);
  const inset = Math.max(0, Number.isFinite(padding) ? padding : 0);
  // Do not shift a base label that already sits closer to an edge than the
  // preferred glow inset. Its resting position remains the minimum boundary.
  const minimum = Math.min(left, boundsLeft + inset);
  const maximum = Math.max(left + width, boundsRight - inset);
  const anchor = left + width * fraction;
  const leftRoom = fraction ? (anchor - minimum - distance) / (width * fraction) : Infinity;
  const rightRoom = fraction < 1 ? (maximum - anchor - distance) / (width * (1 - fraction)) : Infinity;
  const scale = Math.max(1, Math.min(Number.isFinite(preferred) ? preferred : 1, leftRoom, rightRoom));
  const enlargedLeft = anchor - width * fraction * scale;
  const enlargedRight = anchor + width * (1 - fraction) * scale;
  return { scale,
    minimumTranslation: Math.max(-distance, minimum - enlargedLeft),
    maximumTranslation: Math.min(distance, maximum - enlargedRight) };
}

export function uiEffectProperties(settings = uiEffectSettings) {
  return {
    '--ui-hover-scale': String(settings.hover.scale),
    '--ui-image-scale': String(settings.hover.imageScale),
    '--ui-hover-duration': `${settings.hover.durationMs}ms`,
    '--ui-release-duration': `${settings.hover.releaseMs}ms`,
    '--ui-hover-easing': settings.hover.easing,
    '--ui-glow-strength': String(settings.hover.glowStrength),
    '--ui-other-glow-strength': String(settings.hover.otherSideGlowStrength),
    '--ui-arrow-size': `${settings.arrow.sizeEm}em`,
    '--ui-arrow-gap': `clamp(${settings.arrow.minimumGapPx}px, ${settings.arrow.gapEm}em, ${settings.arrow.maximumGapPx}px)`,
    '--ui-arrow-stroke': `${settings.arrow.strokePx}px`,
    '--ui-arrow-movement': `${settings.arrow.movementPx}px`,
  };
}
