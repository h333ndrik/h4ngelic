/** The ON SKIN / archive carousel's single editing surface. Pixel values are
 * CSS pixels; changing this object is sufficient after the next rebuild. */
export const carouselSettings = Object.freeze({
  /** Resting card width; narrow screens cap it at the available page width. */
  cardWidth: 300,
  /** Maximum resting photograph height; its original ratio is preserved. */
  cardHeight: 420,
  /** Resting card clearance from either edge of a narrow viewport, in pixels. */
  cardViewportInset: 24,
  /** Horizontal space between adjacent card slots, in pixels. */
  spacing: 100,
  /** Fraction of velocity lost per 60Hz frame; larger values stop sooner. */
  inertia: 0.05,
  /** Legacy wheel impulse value; vertical wheel capture is disabled by default. */
  wheelSensitivity: 8.0,
  /** Recycle the real cards seamlessly; no duplicate artwork. */
  wrap: true,
  /** Lift the hovered card slightly, retaining the site's own scale/glow. */
  hoverStraighten: true,
  /** Move immediate neighbours aside with transforms while a card is hovered. */
  neighborDisplacement: true,
  /** 'area' is a legacy horizontal-wheel mode; 'none' leaves vertical input native. */
  scrollCapture: 'none',
  /** Enable the approved carousel-only ambient drift. */
  autoDrift: true,
  /** Left-to-right drift distance in CSS pixels per 60 Hz frame (about 18px/s). */
  autoScroll: 0.3,
  /** Pause ambient drift while a fine pointer is inside the carousel. */
  hoverPause: true,
  /** CSS perspective field of view represented by the depth composition. */
  perspectiveZoom: 45,
  /** CSS camera distance in pixels for the perspective plane. */
  cameraDistance: 900,
  /** Apply perspective depth scaling and inward edge rotation. */
  depthScale: true,
  /** Maximum inward edge rotation in degrees. */
  edgeRotation: 12,
  /** Edge cards scale to this floor at the viewport boundary. */
  edgeScaleFloor: 0.92,
  /** Reserved for compatibility: the native h4 cursor is the sole affordance. */
  pointerLabel: false,
  /** Enable the common in-page image expansion; never opens a modal. */
  expandWithinLayout: true,
  /** Largest reserved viewing height relative to the resting card height. */
  expansionScale: 1.65,
  /** Resting photo may occupy at most this fraction of its reserved frame. */
  restingFrameFraction: 0.7,
  /** Horizontal clearance between an expanded photograph and the viewport. */
  viewportInlineInset: 12,
  /** Top/bottom viewport clearance for floating navigation during expansion. */
  viewportBlockInset: 76,
  /** The hovered card's optional vertical lift, in pixels. */
  hoverLift: 6,
  /** Immediate neighbours' optional horizontal displacement, in pixels. */
  neighborShift: 12,
  /** Pointer movement required before a click becomes a horizontal drag. */
  dragThreshold: 8,
  /** Wheel line delta normalization, in pixels. */
  wheelLinePixels: 16,
  /** Per-event wheel limit avoids unusually large device impulses. */
  maximumWheelDelta: 120,
  /** Maximum shared velocity, in pixels per 60Hz frame. */
  maximumVelocity: 100,
  /** Stop scheduling animation when velocity falls below this threshold. */
  velocityCutoff: 0.12,
  /** Suppress the synthetic click immediately following a completed drag. */
  dragClickGuardMs: 350,
  /** Delay before politely announcing the selected artwork to screen readers. */
  announcementDelayMs: 140,
});

/** Server/prerender and live enhancement consume the same dimensions. */
export function carouselStyleProperties(settings = carouselSettings) {
  return {
    '--carousel-card-width': `${settings.cardWidth}px`,
    '--carousel-card-height': `${settings.cardHeight}px`,
    '--carousel-inline-reservation': `${settings.cardViewportInset * 2}px`,
    '--carousel-spacing': `${settings.spacing}px`,
    '--carousel-expansion-scale': String(settings.expansionScale),
    '--carousel-expanded-height': `min(${settings.cardHeight * settings.expansionScale}px, calc(100svh - ${settings.viewportBlockInset * 2}px))`,
    '--carousel-resting-fraction': String(settings.restingFrameFraction),
    '--inline-safe-inline': `${settings.viewportInlineInset}px`,
    '--inline-safe-start': `${settings.viewportBlockInset}px`,
    '--inline-safe-end': `${settings.viewportBlockInset}px`,
    '--carousel-hover-lift': `${settings.hoverStraighten ? settings.hoverLift : 0}px`,
    '--carousel-neighbor-shift': `${settings.neighborDisplacement ? settings.neighborShift : 0}px`,
    '--carousel-perspective': `${settings.cameraDistance}px`,
    '--carousel-perspective-zoom': `${settings.perspectiveZoom}deg`,
    '--carousel-edge-rotation': `${settings.depthScale ? settings.edgeRotation : 0}deg`,
  };
}
