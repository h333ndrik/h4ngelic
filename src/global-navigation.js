import './global-navigation.css';
import { resolveRoute } from './routes.js';
import { activeChapter } from './global-navigation-state.js';
import { naaviStops, naaviState, initialNaaviIndex, renderNAAVI } from './naavi-content.js';

/** Persistent shared NAAVI. Geometry is cached on layout changes; ordinary
 * scrolling schedules one paint, with no frame loop or scroll measurements. */
export function initGlobalNavigation(doc = document) {
  const view = doc.defaultView;
  if (!view) return Object.assign(() => {}, { refresh: () => {} });
  let link = doc.querySelector('[data-naavi]');
  if (!link) {
    doc.body.insertAdjacentHTML('beforeend', renderNAAVI({ kind: doc.documentElement.dataset.page || 'home' }));
    link = doc.querySelector('[data-naavi]');
  }
  const index = doc.querySelector('[data-global-index]');
  const summary = index?.querySelector('summary');
  const indexLinks = [...doc.querySelectorAll('[data-index-page]')];
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = [];
  let stops = [], measured = [], frame = 0, dirty = true, disposed = false;
  let current = -1, digitAnimation, routeKind = '', initialIndex = 0, resizeObserver;
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    listeners.push(() => target.removeEventListener(name, handler, options));
  };
  const href = value => doc.documentElement.dataset.preview === 'standalone' ? `#${value}` : value;

  function closeIndex({ focus = false } = {}) {
    if (!index?.open) return;
    index.open = false;
    summary.setAttribute('aria-expanded', 'false');
    summary.setAttribute('aria-label', 'open index');
    if (focus) summary.focus({ preventScroll: true });
  }
  function paintIndex(chapter) {
    const primary = routeKind === 'artwork' ? 'work' : routeKind;
    for (const item of indexLinks) {
      const contactActive = primary === 'home' && chapter === 3;
      const active = item.dataset.indexPage === (contactActive ? 'contact' : primary);
      if (active) item.setAttribute('aria-current', contactActive ? 'location' : 'page');
      else item.removeAttribute('aria-current');
    }
  }
  function paint(index) {
    const state = naaviState(stops, index);
    paintIndex(state.current);
    const destination = href(state.destination.href);
    if (link.getAttribute('href') !== destination) link.setAttribute('href', destination);
    if (link.getAttribute('aria-label') !== state.label) link.setAttribute('aria-label', state.label);
    link.dataset.chapterTarget = state.destination.id || 'home';
    link.dataset.chapter = String(state.current);
    link.dataset.chapterTotal = String(state.total);
    const digit = link.querySelector('.chapter-digit');
    const total = link.querySelector('.chapter-total');
    const currentText = String(state.current).padStart(2, '0');
    const totalText = ` / ${String(state.total).padStart(2, '0')}`;
    if (digit && digit.textContent !== currentText) digit.textContent = currentText;
    if (total && total.textContent !== totalText) total.textContent = totalText;
    if (index !== current && current >= 0 && !reduced.matches && digit?.animate) {
      digitAnimation?.cancel();
      digitAnimation = digit.animate([{ transform: `translateY(${index > current ? '80%' : '-80%'})`, opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,.8,.25,1)' });
    }
    current = index;
  }
  function update() {
    frame = 0;
    if (disposed || doc.hidden || !stops.length) return;
    if (dirty) {
      const maximum = Math.max(0, doc.documentElement.scrollHeight - view.innerHeight);
      measured = stops.map((stop, index) => ({ index, element: stop.element,
        top: stop.element ? Math.min(maximum, stop.element.getBoundingClientRect().top + view.scrollY) : Infinity }))
        .filter(stop => Number.isFinite(stop.top));
      dirty = false;
    }
    const active = measured.length ? activeChapter(measured.map(stop => stop.top), view.scrollY, view.innerHeight) : -1;
    paint(active < 0 ? initialIndex : measured[active].index);
  }
  function schedule(remeasure = false) {
    dirty ||= remeasure;
    if (!frame && !disposed && !doc.hidden) frame = view.requestAnimationFrame(update);
  }
  function refresh() {
    closeIndex();
    routeKind = doc.documentElement.dataset.page || 'home';
    const standalone = doc.documentElement.dataset.preview === 'standalone';
    const url = standalone ? new URL(view.location.hash.slice(1) || '/', 'https://preview.invalid') : new URL(view.location.href);
    initialIndex = initialNaaviIndex(resolveRoute(url));
    resizeObserver?.disconnect();
    const isWork = routeKind === 'work';
    stops = naaviStops(routeKind).map(stop => {
      // Only the current page's actual sections participate in scroll state.
      const element = routeKind === 'home' ? doc.querySelector(stop.selector || `#${stop.id}`)
        : isWork && stop.id ? doc.getElementById(stop.id) : null;
      if (element) {
        if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
        resizeObserver?.observe(element);
      }
      return { ...stop, element };
    });
    if (doc.getElementById('page-content')) resizeObserver?.observe(doc.getElementById('page-content'));
    current = -1;
    dirty = true;
    update();
  }
  if (index && summary) {
    // Reuse the original native-details INDEX, independently of NAAVI. Native
    // summary keyboard/touch behaviour also works in the prerendered document.
    listen(index, 'toggle', () => {
      summary.setAttribute('aria-expanded', String(index.open));
      summary.setAttribute('aria-label', index.open ? 'close index' : 'open index');
    });
    listen(index, 'click', event => { if (event.target.closest?.('a[href]')) closeIndex(); });
    listen(doc, 'keydown', event => {
      if (event.key === 'Escape' && index.open) { event.preventDefault(); closeIndex({ focus: true }); }
    });
    listen(doc, 'pointerdown', event => { if (index.open && !index.contains(event.target)) closeIndex(); }, { passive: true });
    listen(doc, 'focusin', event => { if (index.open && !index.contains(event.target)) closeIndex(); });
    listen(doc, 'h4:navigationstart', () => closeIndex());
    summary.setAttribute('aria-expanded', String(index.open));
  }
  listen(link, 'click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const state = naaviState(stops, current);
    const target = stops.find(stop => stop.id === state.destination.id && stop.href === state.destination.href)?.element;
    if (!target) return; // The normal route enhancer handles cross-route HOME.
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    schedule();
  });
  // Fixed navigation remains bottom-centred. Keep focused inputs above its
  // reserved dock rather than moving the navigation over neighbouring fields.
  listen(doc, 'focusin', event => {
    const control = event.target;
    if (!control.matches?.('[data-inquiry-form] input:not([type=hidden]), [data-inquiry-form] textarea, [data-inquiry-form] button')) return;
    const box = control.getBoundingClientRect();
    const bottom = (view.visualViewport?.height || view.innerHeight) + (view.visualViewport?.offsetTop || 0) - 76;
    if (box.bottom > bottom && box.top < bottom + 76) view.scrollBy({ top: box.bottom - bottom + 12, behavior: 'instant' });
  });
  if ('ResizeObserver' in view) resizeObserver = new view.ResizeObserver(() => schedule(true));
  listen(reduced, 'change', () => {
    if (reduced.matches) digitAnimation?.cancel();
    schedule();
  });
  listen(doc, 'h4:pagechange', refresh);
  listen(view, 'scroll', () => schedule(), { passive: true });
  listen(view, 'resize', () => schedule(true), { passive: true });
  if (view.visualViewport) listen(view.visualViewport, 'resize', () => schedule(true), { passive: true });
  listen(doc, 'visibilitychange', () => { if (!doc.hidden) schedule(true); });
  refresh();
  return Object.assign(() => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    digitAnimation?.cancel();
    resizeObserver?.disconnect();
    listeners.forEach(remove => remove());
  }, { refresh });
}
