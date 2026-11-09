/** B-F33: a touch device has no hover. The pressed state of a navigation link
 * is written on pointerdown and cleared on pointerup/cancel/leave, so the
 * feedback happens under the finger without delaying the navigation. */
const selector = '.hero-nav a, .page-nav a, .category-link, .filter-link,'
  + ' .rubric-cross-links a, .text-link, .footer-instagram';

export function initPressState(doc = document) {
  let pressed = null;
  const clear = () => {
    if (pressed) pressed.classList.remove('is-pressed');
    pressed = null;
  };
  const down = event => {
    if (event.button !== undefined && event.button !== 0) return;
    const link = event.target.closest?.(selector);
    if (!link) return;
    clear();
    pressed = link;
    link.classList.add('is-pressed');
  };
  doc.addEventListener('pointerdown', down, { passive: true });
  doc.addEventListener('pointerup', clear, { passive: true });
  doc.addEventListener('pointercancel', clear, { passive: true });
  doc.addEventListener('pointerleave', clear, { passive: true });
  return () => {
    clear();
    doc.removeEventListener('pointerdown', down);
    doc.removeEventListener('pointerup', clear);
    doc.removeEventListener('pointercancel', clear);
    doc.removeEventListener('pointerleave', clear);
  };
}
