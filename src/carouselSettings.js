/** The ON SKIN / archive carousel's single editing surface. Pixel values are
 * CSS pixels; changing this object is sufficient after the next rebuild. */
export const carouselSettings = Object.freeze({
  /** Exact resting card width in every supported viewport. */
  cardWidth: 300,
  /** Exact resting card height; photographs are center-covered. */
  cardHeight: 420,
  /** Resting card clearance from either edge of a narrow viewport, in pixels. */
  cardViewportInset: 24,
  /** Horizontal space between adjacent card slots, in pixels. */
  spacing: 100,
  /** Fraction of velocity lost per 60Hz frame; larger values stop sooner. */
  inertia: 0.05,
  /** Shared wheel impulse strength, normalized per event. */
  wheelSensitivity: 8.0,
  /** Recycle the real cards seamlessly; no duplicate artwork. */
  wrap: true,
  /** Lift the hovered card slightly, retaining the site's own scale/glow. */
  hoverStraighten: true,
  /** Move immediate neighbours aside with transforms while a card is hovered. */
  neighborDisplacement: true,
  /** Translate wheel input only while it occurs over the enhanced viewport. */
  scrollCapture: 'area',
  /** Enable the approved carousel-only ambient drift. */
  autoDrift: true,
  /** Left-to-right drift distance in CSS pixels per 60 Hz frame (about 18px/s). */
  autoScroll: 0.3,
  /** Pause ambient drift while a fine pointer is inside the carousel. */
  hoverPause: true,
  /** Retained compatibility values; the live row is intentionally flat. */
  perspectiveZoom: 45,
  cameraDistance: 900,
  depthScale: false,
  edgeRotation: 0,
  edgeScaleFloor: 1,
  /** Reserved for compatibility: the native h4 cursor is the sole affordance. */
  pointerLabel: false,
  /** Enable the common in-page image expansion; never opens a modal. */
  expandWithinLayout: true,
  /** Largest reserved viewing height relative to the resting card height. */
  expansionScale: 1.65,
  /** Horizontal clearance between an expanded photograph and the viewport. */
  viewportInlineInset: 0,
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
    '--inline-safe-inline': `${settings.viewportInlineInset}px`,
    '--inline-safe-start': `${settings.viewportBlockInset}px`,
    '--inline-safe-end': `${settings.viewportBlockInset}px`,
    '--carousel-hover-lift': `${settings.hoverStraighten ? settings.hoverLift : 0}px`,
    '--carousel-neighbor-shift': `${settings.neighborDisplacement ? settings.neighborShift : 0}px`,
  };
}
