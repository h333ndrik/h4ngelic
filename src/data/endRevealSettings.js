/** The mark belongs to the final section. It cannot become visible before
 * that section approaches the viewport, including under reduced motion. */
export function sampleEndReveal({ top, height, viewportHeight, reduced = false }) {
  if (![top, height, viewportHeight].every(Number.isFinite) || height <= 0 || viewportHeight <= 0) {
    return { progress: 0, opacity: 0, shift: 48, scale: .96 };
  }
  const visible = top < viewportHeight * .45 && top + height > 0;
  const progress = reduced ? Number(visible) : Math.max(0, Math.min(1, (viewportHeight * .9 - top) / (viewportHeight * .8)));
  const eased = progress * progress * (3 - 2 * progress);
  return { progress, opacity: eased, shift: 48 * (1 - eased), scale: .96 + .04 * eased };
}
