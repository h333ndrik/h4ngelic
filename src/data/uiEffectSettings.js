/** Shared interaction tuning. Geometry, cursor assets and scroll poses stay separate. */
export const uiEffectSettings = Object.freeze({
  hover: Object.freeze({
    scale: 1.22,
    largeScale: 1.20,
    imageScale: 1.08,
    durationMs: 260,
    releaseMs: 340,
    easing: 'cubic-bezier(.2,.8,.25,1.12)',
    glowStrength: 1,
    otherSideGlowStrength: 1.15,
  }),
  magnetDistance: 3,
  arrow: Object.freeze({ sizeEm: .72, gapEm: .22, minimumGapPx: 7, maximumGapPx: 18, strokePx: 1.25, movementPx: 2 }),
});

/** Magnify a large label only into unused space in its own stationary column. */
export function boundedHoverScale(visualWidth, availableWidth, preferred, margin = 5) {
  if (!(visualWidth > 0) || !(availableWidth > 0)) return 1;
  return Math.max(1, Math.min(preferred, (availableWidth - margin) / visualWidth));
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
