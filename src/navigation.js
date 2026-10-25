import { resolveRoute } from './routes.js';
import { prepareArtworkTransition } from './artwork-transitions.js';
import './navigation.css';

/** Enhance ordinary anchors; without JavaScript the prerendered URLs still work. */
export function initNavigation({ render, moshTransitions } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const previousRestoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  let key = Number(history.state?.h4NavigationKey) || 0;
  let nextKey = key;
  let transition;
  let revision = 0;
  let renderedRoute = resolveRoute(location.href);
  let renderedHash = location.hash;
  let sharedArtwork = null;
  const positions = new Map([[key, [scrollX, scrollY]]]);
  const galleryPositions = new Map();
  history.replaceState({ ...history.state, h4NavigationKey: key }, '');

  function remember() {
    positions.set(key, [scrollX, scrollY]);
    if (renderedRoute.kind === 'work') galleryPositions.set(renderedRoute.canonicalPath, [scrollX, scrollY]);
  }

  function update(options, trigger) {
    document.dispatchEvent(new CustomEvent('h4:navigationstart'));
    const currentRevision = ++revision;
    transition?.skipTransition();
    sharedArtwork?.cleanup();
    sharedArtwork = null;
    const destination = resolveRoute(location.href);
    const destinationHash = location.hash;
    const fromHash = renderedHash;
    const enhanced = typeof document.startViewTransition === 'function' && !reduced.matches && !document.hidden;
    let artwork = prepareArtworkTransition(destination, trigger, { animate: enhanced, fromHash });
    sharedArtwork = artwork;
    const commit = async () => {
      if (currentRevision !== revision) return;
      try {
        // Include scroll restoration and focus in the new view snapshot.
        await render(options);
        if (currentRevision !== revision) return;
        renderedRoute = destination;
        renderedHash = destinationHash;
        await artwork?.afterRender();
        if (currentRevision === revision) document.dispatchEvent(new CustomEvent('h4:pagechange'));
      } catch {
        // A normal document navigation remains the fallback for every browser,
        // including reduced motion and browsers without View Transitions.
        if (currentRevision === revision) location.assign(location.href);
      }
    };
    if (enhanced) {
      try {
        // Route capture owns the one native transition. Awaiting commit includes
        // artwork decode, focus and scroll before the destination is captured.
        transition = document.documentElement.dataset.mode === 'xray'
          ? moshTransitions?.navigation(commit, { destination, trigger, fromHash })
          : null;
        if (!transition) transition = document.startViewTransition(commit);
        transition.ready?.catch(() => {});
        transition.finished.then(() => artwork?.cleanup(), () => artwork?.cleanup());
        transition.updateCallbackDone.catch(() => { if (currentRevision === revision) location.assign(location.href); });
      } catch {
        artwork?.cleanup();
        artwork = prepareArtworkTransition(destination, trigger, { animate: false, fromHash });
        sharedArtwork = artwork;
        commit();
      }
    } else commit();
  }

  function click(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.hasAttribute('download') || anchor.dataset.nativeNavigation !== undefined
      || (anchor.target && anchor.target !== '_self') || anchor.relList.contains('external')) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash === '#page-content') return;
    const route = resolveRoute(url);
    if (route.kind === 'not-found') return;
    event.preventDefault();
    remember();
    const restoreScroll = route.kind === 'work' && renderedRoute.kind === 'artwork'
      ? galleryPositions.get(route.canonicalPath) : undefined;
    key = ++nextKey;
    const destination = route.redirectPath || `${url.pathname}${url.search}${url.hash}`;
    history.pushState({ h4NavigationKey: key }, '', destination);
    positions.set(key, [0, 0]);
    update({ reset: true, restoreScroll }, anchor);
  }

  function pop(event) {
    remember();
    key = Number(event.state?.h4NavigationKey) || 0;
    nextKey = Math.max(nextKey, key);
    update({ reset: true, restoreScroll: positions.get(key) || [0, 0] });
  }

  // Two viewport coordinates are retained in memory; no layout measurement or
  // frame loop is needed to restore forward navigation after a popstate.
  addEventListener('scroll', remember, { passive: true });
  addEventListener('pagehide', remember);
  addEventListener('popstate', pop);
  document.addEventListener('click', click);
  return () => {
    ++revision;
    transition?.skipTransition();
    sharedArtwork?.cleanup();
    history.scrollRestoration = previousRestoration;
    removeEventListener('scroll', remember);
    removeEventListener('pagehide', remember);
    removeEventListener('popstate', pop);
    document.removeEventListener('click', click);
    positions.clear();
    galleryPositions.clear();
  };
}
