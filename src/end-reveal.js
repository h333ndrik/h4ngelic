import './end-reveal.css';
import { sampleEndReveal } from './data/endRevealSettings.js';

/** Event-driven local reveal; no idle animation frame or pointer listeners.
 * The original h4 SVG is a CSS mask, so no font or 3D renderer is involved. */
export function initEndReveal(root = document) {
  const section = root.querySelector('[data-end-reveal]');
  if (!section) return () => {};
  const doc = section.ownerDocument;
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  let near = false;
  let dirty = true;
  let disposed = false;
  let frame = 0;
  let top = 0;
  let height = 1;
  let viewport = view.innerHeight;
  let last = '';
  const removers = [];
  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  };

  function update() {
    frame = 0;
    if (disposed || doc.hidden) return;
    if (dirty) {
      const bounds = section.getBoundingClientRect();
      top = bounds.top + view.scrollY;
      height = bounds.height;
      viewport = view.innerHeight;
      dirty = false;
    }
    const sample = sampleEndReveal({ top: top - view.scrollY, height, viewportHeight: viewport, reduced: reduced.matches });
    const key = sample.progress.toFixed(4);
    if (key === last) return;
    last = key;
    section.style.setProperty('--end-reveal-opacity', sample.opacity.toFixed(4));
    section.style.setProperty('--end-reveal-y', `${sample.shift.toFixed(2)}px`);
    section.style.setProperty('--end-reveal-scale', sample.scale.toFixed(4));
    section.dataset.endRevealProgress = key;
  }

  function schedule(remeasure = false) {
    if (disposed) return;
    dirty ||= remeasure;
    if (!frame && !doc.hidden && (near || remeasure)) frame = view.requestAnimationFrame(update);
  }

  const observer = new view.IntersectionObserver(([entry]) => {
    if (disposed) return;
    near = entry.isIntersecting;
    section.toggleAttribute('data-end-reveal-active', near && !doc.hidden);
    if (near) schedule(true);
    else {
      if (frame) view.cancelAnimationFrame(frame);
      frame = 0;
      // Clear the local reveal when it is below the viewport. A fully passed
      // section keeps its pose, avoiding a jump during browser back/forward.
      if (entry.boundingClientRect.top >= view.innerHeight) {
        last = '';
        section.style.setProperty('--end-reveal-opacity', '0');
        section.dataset.endRevealProgress = '0.0000';
      }
    }
  }, { rootMargin: '120px 0px' });
  observer.observe(section);
  const resize = new view.ResizeObserver(() => schedule(true));
  resize.observe(section);
  if (root.nodeType === 1 && root !== section) resize.observe(root);
  listen(view, 'scroll', () => { if (near) schedule(); }, { passive: true });
  listen(view, 'resize', () => schedule(true), { passive: true });
  listen(reduced, 'change', () => { last = ''; schedule(true); });
  listen(doc, 'visibilitychange', () => {
    section.toggleAttribute('data-end-reveal-active', near && !doc.hidden);
    if (doc.hidden) { if (frame) view.cancelAnimationFrame(frame); frame = 0; }
    else if (near) schedule(true);
  });
  update();

  return () => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    for (const remove of removers) remove();
    section.removeAttribute('data-end-reveal-active');
    section.removeAttribute('data-end-reveal-progress');
    for (const property of ['--end-reveal-opacity', '--end-reveal-y', '--end-reveal-scale']) section.style.removeProperty(property);
  };
}
