/** Discrete Other Side gestures. Normal-mode ink and hover settings stay in
 * uiEffectSettings; these controls only tune the short temporal pixel damage.
 */
export const interactionMoshSettings = Object.freeze({
  enabled: true,
  targetSelector: '[data-ui-interactive], .category-link, .hero-nav a, .page-nav a, .text-link, a[href], button, [role="button"]',
  excludedSelector: '.secret-hotspot, [data-secret-hotspot], [data-mode-hold], [data-mode-mute], [data-xray-toggle], .skip-link, [data-no-hover], [data-no-mosh], [data-other-side-hint], [data-corruption-protected], .is-unconfigured, [aria-disabled="true"], :disabled, [inert], form, input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), canvas, #logo-canvas',
  sectionSelector: '.content-section .kinetic-heading, .page-heading, .section-label, .work-filters',
  rate: Object.freeze({ windowMs: 1000, maximumImpulses: 6, minimumGapMs: 70 }),
  hover: Object.freeze({ strength: .46, durationMs: 340, cooldownMs: 650, dx: 52, dy: 10 }),
  focus: Object.freeze({ strength: .2, durationMs: 240, cooldownMs: 650, dx: 20, dy: 0 }),
  click: Object.freeze({ strength: .78, durationMs: 420, cooldownMs: 320, dx: 90, dy: 14 }),
  navigation: Object.freeze({ strength: 1, durationMs: 340, cooldownMs: 400, dx: 130, dy: 18 }),
  section: Object.freeze({ strength: .38, durationMs: 380, cooldownMs: 1800, dx: 62, dy: 28 }),
});
