import './image-reveals.css';

/** Below-fold image masks only; the first critical artwork image stays visible. */
export function initImageReveals(root = document) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const figures = [...root.querySelectorAll('.project-image, .about-portrait')]
    .filter((figure) => figure.querySelector('img[loading="lazy"]'));
  if (!figures.length || !('IntersectionObserver' in window)) return () => {};
  let observer;
  const reveal = (figure, immediate = false) => {
    if (!figure) return;
    if (immediate) figure.classList.add('image-reveal-instant');
    figure.classList.add('is-image-revealed');
    observer?.unobserve(figure);
  };
  if (!reduced.matches) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
    }, { threshold: .08 });
    for (const figure of figures) {
      figure.classList.add('image-reveal-pending');
      observer.observe(figure);
    }
  }
  const focus = (event) => reveal(event.target.closest?.('.project-image, .about-portrait'), true);
  const preference = () => {
    if (!reduced.matches) return;
    observer?.disconnect();
    for (const figure of figures) reveal(figure, true);
  };
  root.addEventListener('focusin', focus);
  reduced.addEventListener('change', preference);
  return () => {
    observer?.disconnect();
    root.removeEventListener('focusin', focus);
    reduced.removeEventListener('change', preference);
    for (const figure of figures) figure.classList.remove('image-reveal-pending', 'is-image-revealed', 'image-reveal-instant');
  };
}
