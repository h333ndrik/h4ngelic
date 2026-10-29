import './global-navigation.css';
import { resolveRoute } from './routes.js';
import { activeChapter, naaviUsesDisplayContrast } from './global-navigation-state.js';
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
  let displayBounds = [], quietBounds = [], footerBounds = null, dockBounds = null;
  const displaySelector = '.kinetic-heading, .page-heading, .work-group-heading > a, .archive-category-heading > a, .about-preview-copy, .category-link .interaction-visual';
  const quietSelector = '.inquiry, [data-inquiry-form], [data-controls], [data-global-index], .work-filters, [data-footer-row]';
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
      const homeDestination = ['home', 'work', 'about', 'contact', 'secret'][chapter] || 'home';
      const active = item.dataset.indexPage === (primary === 'home' ? homeDestination : primary);
      if (active) item.setAttribute('aria-current', primary === 'home' && chapter > 0 ? 'location' : 'page');
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
  const documentBounds = element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left + view.scrollX, right: rect.right + view.scrollX,
      top: rect.top + view.scrollY, bottom: rect.bottom + view.scrollY, width: rect.width, height: rect.height };
  };
  function measureChrome() {
    // Layout is measured only when routes, fonts or sizes change. The existing
    // scroll RAF reuses these document coordinates for contrast and docking.
    link.style.removeProperty('--naavi-dock-y');
    dockBounds = link.getBoundingClientRect();
    const brand = doc.querySelector('[data-floating-brand]');
    const filters = doc.querySelector('.work-filters');
    if (brand && filters && index) {
      const brandBox = brand.getBoundingClientRect();
      const indexBox = index.getBoundingClientRect();
      const left = brandBox.right + 12;
      filters.style.setProperty('--work-row-top', `${brandBox.top}px`);
      filters.style.setProperty('--work-row-left', `${left}px`);
      filters.style.setProperty('--work-row-width', `${Math.max(0, indexBox.left - left - 12)}px`);
    }
    displayBounds = [...doc.querySelectorAll(displaySelector)].flatMap(element => {
      const style = view.getComputedStyle(element);
      const channels = style.color.match(/[\d.]+/g)?.map(Number) || [];
      const largeWhiteType = parseFloat(style.fontSize) >= 32 && channels.length >= 3
        && channels.slice(0, 3).every(value => value >= 215);
      const rect = documentBounds(element);
      return largeWhiteType && rect.width > 0 && rect.height > 0
        ? [{ ...rect, element, paintedElement: element.matches('.kinetic-heading')
          ? element.querySelector('.kinetic-heading-text') || element : element }] : [];
    });
    quietBounds = [...doc.querySelectorAll(quietSelector)].map(documentBounds).filter(rect => rect.width > 0 && rect.height > 0);
    const footer = doc.querySelector('[data-footer-row]');
    footerBounds = footer ? documentBounds(footer) : null;
  }
  function displayIsPainted(rect) {
    // Geometry stays cached. Read only the paint styles of a geometrically
    // overlapping candidate and its ancestors; an invisible scrubbed heading
    // must not activate contrast. The numbered heading's child owns its fade.
    let element = rect.paintedElement;
    if (!element?.isConnected) return false;
    let opacity = 1;
    while (element) {
      const style = view.getComputedStyle(element);
      if (style.display === 'none' || style.visibility !== 'visible') return false;
      opacity *= Number(style.opacity);
      if (opacity <= .001) return false;
      element = element.parentElement;
    }
    return true;
  }
  function paintChrome() {
    if (!dockBounds) return;
    const defaultCentre = dockBounds.top + dockBounds.height / 2;
    const footerCentre = footerBounds ? footerBounds.top - view.scrollY + footerBounds.height / 2 : Infinity;
    const docked = footerCentre <= defaultCentre && footerCentre >= dockBounds.height / 2;
    const offset = docked ? footerCentre - defaultCentre : 0;
    const value = `${offset}px`;
    if (link.style.getPropertyValue('--naavi-dock-y') !== value) link.style.setProperty('--naavi-dock-y', value);
    link.toggleAttribute('data-naavi-footer-docked', docked);
    const bounds = { left: dockBounds.left + view.scrollX, right: dockBounds.right + view.scrollX,
      top: dockBounds.top + offset + view.scrollY, bottom: dockBounds.bottom + offset + view.scrollY };
    const contrast = !docked && naaviUsesDisplayContrast(bounds, displayBounds, quietBounds)
      && displayBounds.some(rect => naaviUsesDisplayContrast(bounds, [rect]) && displayIsPainted(rect));
    link.toggleAttribute('data-naavi-display-contrast', contrast);
  }
  function update() {
    frame = 0;
    if (disposed || doc.hidden || !stops.length) return;
    if (dirty) {
      measureChrome();
      const maximum = Math.max(0, doc.documentElement.scrollHeight - view.innerHeight);
      measured = stops.map((stop, index) => ({ index, element: stop.element,
        top: stop.element ? Math.min(maximum, stop.element.getBoundingClientRect().top + view.scrollY) : Infinity }))
        .filter(stop => Number.isFinite(stop.top));
      dirty = false;
    }
    const active = measured.length ? activeChapter(measured.map(stop => stop.top), view.scrollY, view.innerHeight) : -1;
    paint(active < 0 ? initialIndex : measured[active].index);
    paintChrome();
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
    const footer = doc.querySelector('[data-footer-row]');
    if (footer) resizeObserver?.observe(footer);
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
  doc.fonts?.ready.then(() => schedule(true));
  return Object.assign(() => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    digitAnimation?.cancel();
    link.style.removeProperty('--naavi-dock-y');
    link.removeAttribute('data-naavi-footer-docked');
    link.removeAttribute('data-naavi-display-contrast');
    resizeObserver?.disconnect();
    listeners.forEach(remove => remove());
  }, { refresh });
}
