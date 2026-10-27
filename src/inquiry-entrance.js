/** One small entrance per mounted form. No scroll listener or layout mutation:
 * keyboard focus, unavailable observers and reduced motion expose it at once. */
export function initInquiryEntrance(element) {
  const view = element?.ownerDocument?.defaultView;
  if (!view) return () => {};
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  let observer = null;
  let revealed = false;
  function reveal(immediate = false) {
    if (revealed && !immediate) return;
    revealed = true;
    if (immediate) element.dataset.inquiryRevealImmediate = '';
    element.dataset.inquiryReveal = 'visible';
    observer?.disconnect();
  }
  const focus = () => reveal(true);
  const preference = () => { if (reduced.matches) reveal(true); };
  if (reduced.matches || !('IntersectionObserver' in view) || element.contains(element.ownerDocument.activeElement)) {
    reveal(true);
  } else {
    element.dataset.inquiryReveal = 'pending';
    observer = new view.IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) reveal();
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    observer.observe(element);
  }
  element.addEventListener('focusin', focus);
  reduced.addEventListener?.('change', preference);
  return () => {
    observer?.disconnect();
    element.removeEventListener('focusin', focus);
    reduced.removeEventListener?.('change', preference);
    element.removeAttribute('data-inquiry-reveal');
    element.removeAttribute('data-inquiry-reveal-immediate');
  };
}
