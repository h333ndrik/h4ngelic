const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

/** The mark belongs to the final section. Scroll changes its physical relief
 * depth and the light's elevation, rather than only fading in a flat shape. */
export function sampleEndReveal({ top, height, viewportHeight, reduced = false }) {
  if (![top, height, viewportHeight].every(Number.isFinite) || height <= 0 || viewportHeight <= 0) {
    return { progress: 0, opacity: 0, shift: 48, scale: .96, depth: 0, blur: .6, edge: 0, lightY: -130 };
  }
  const visible = top < viewportHeight * .45 && top + height > 0;
  const progress = reduced ? Number(visible) : clamp((viewportHeight * .9 - top) / (viewportHeight * .8));
  const eased = progress * progress * (3 - 2 * progress);
  return { progress, opacity: eased, shift: 48 * (1 - eased), scale: .96 + .04 * eased,
    depth: 19 * eased, blur: .6 + 1.5 * eased, edge: 1.65 * eased, lightY: -130 + 350 * eased };
}

/** Normalized local pointer coordinates drive a restrained point light.
 * Invalid/outside input returns to the default rather than leaking transforms. */
export function sampleEndLighting({ x = .5, y = .5, progress = 1, reduced = false } = {}) {
  const sample = value => Number.isFinite(value) ? clamp(value) : .5;
  const px = reduced ? .5 : sample(x), py = reduced ? .5 : sample(y);
  const amount = Number.isFinite(progress) ? clamp(progress) : 0;
  return { x: 110 + (px - .5) * 440, y: -130 + 350 * amount + (py - .5) * 360,
    z: 560, edgeX: (px - .5) * 1.2, edgeY: (py - .5) * 1.2 };
}
