import './interactions.css';

/**
 * Small, disposable enhancements for the current page contents. The link hit
 * areas never move: only their .category-magnet label/arrow wrapper translates.
 */
export function initInteractions(root = document) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const sections = [...root.querySelectorAll('.content-section')];
  const links = [...root.querySelectorAll('.category-link')];
  const removers = [];
  let observer = null;
  let resizeObserver = null;
  let active = null;
  let frame = 0;
  let disposed = false;

  function listen(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  }

  function reveal(section, immediately = false) {
    if (!section) return;
    if (immediately) section.classList.add('reveal-instant');
    section.classList.add('is-revealed');
    observer?.unobserve(section);
  }

  function resetMagnet() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (active) {
      active.wrapper.style.removeProperty('--magnet-x');
      active.wrapper.style.removeProperty('--magnet-y');
      active.link.removeAttribute('data-magnet-active');
    }
    active = null;
  }

  function measure(state) {
    const box = state.link.getBoundingClientRect();
    // Document coordinates stay valid through ordinary page scrolling without
    // installing a scroll handler or reading layout on every pointer movement.
    state.bounds = {
      x: box.left + scrollX, y: box.top + scrollY, width: box.width, height: box.height,
      scrollerLeft: state.scroller?.scrollLeft || 0,
    };
  }

  function applyMagnet() {
    frame = 0;
    if (disposed || !active || reduced.matches || !fine.matches) return;
    if (!active.bounds) measure(active);
    const { x, y, width, height, scrollerLeft } = active.bounds;
    if (!width || !height) return;
    const normalize = (value) => Math.max(-1, Math.min(1, value));
    const horizontalScroll = (active.scroller?.scrollLeft || 0) - scrollerLeft;
    const dx = normalize((active.pointerX + scrollX - x + horizontalScroll - width / 2) / (width / 2)) * 3;
    const dy = normalize((active.pointerY + scrollY - y - height / 2) / (height / 2)) * 3;
    active.wrapper.style.setProperty('--magnet-x', `${dx.toFixed(2)}px`);
    active.wrapper.style.setProperty('--magnet-y', `${dy.toFixed(2)}px`);
  }

  function move(event, state) {
    if (event.pointerType !== 'mouse' || reduced.matches || !fine.matches) return;
    if (active !== state) {
      resetMagnet();
      active = state;
      measure(state);
      state.link.setAttribute('data-magnet-active', '');
    }
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    if (!frame) frame = requestAnimationFrame(applyMagnet);
  }

  if (!reduced.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0 });
    for (const section of sections) {
      section.classList.add('reveal-pending');
      observer.observe(section);
    }
  }

  const states = links.map((link) => ({ link, wrapper: link.querySelector('.category-magnet'), scroller: link.closest('.category-strip'), bounds: null }))
    .filter((state) => state.wrapper);
  for (const state of states) {
    listen(state.link, 'pointerenter', (event) => move(event, state), { passive: true });
    listen(state.link, 'pointermove', (event) => move(event, state), { passive: true });
    listen(state.link, 'pointerleave', resetMagnet, { passive: true });
    listen(state.link, 'pointerdown', (event) => {
      if (event.pointerType !== 'mouse') resetMagnet();
    }, { passive: true });
  }

  if ('ResizeObserver' in window && states.length) {
    resizeObserver = new ResizeObserver(() => { for (const state of states) state.bounds = null; });
    for (const state of states) resizeObserver.observe(state.link);
  }

  listen(root, 'focusin', (event) => {
    // Keyboard navigation and anchor jumps must never land in faded content.
    reveal(event.target.closest?.('.content-section'), true);
    resetMagnet();
  });
  listen(reduced, 'change', () => {
    resetMagnet();
    if (reduced.matches) {
      observer?.disconnect();
      for (const section of sections) reveal(section, true);
    }
  });
  listen(fine, 'change', resetMagnet);

  return function dispose() {
    disposed = true;
    resetMagnet();
    observer?.disconnect();
    resizeObserver?.disconnect();
    for (const remove of removers) remove();
    // Cleanup also makes the page usable if enhancements are later replaced.
    for (const section of sections) section.classList.remove('reveal-pending', 'is-revealed', 'reveal-instant');
  };
}
