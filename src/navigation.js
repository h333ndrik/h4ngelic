import { resolveRoute } from './routes.js';
import './navigation.css';

/** Enhance ordinary anchors; without JavaScript the prerendered URLs still work. */
export function initNavigation({ render }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const previousRestoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  let key = Number(history.state?.h4NavigationKey) || 0;
  let nextKey = key;
  let transition;
  let revision = 0;
  const positions = new Map([[key, [scrollX, scrollY]]]);
  history.replaceState({ ...history.state, h4NavigationKey: key }, '');

  function remember() { positions.set(key, [scrollX, scrollY]); }

  function update(options) {
    const currentRevision = ++revision;
    transition?.skipTransition();
    const commit = async () => {
      if (currentRevision !== revision) return;
      try {
        // Include scroll restoration and focus in the new view snapshot.
        await render(options);
        if (currentRevision === revision) document.dispatchEvent(new CustomEvent('h4:pagechange'));
      } catch {
        // A normal document navigation remains the fallback for every browser,
        // including reduced motion and browsers without View Transitions.
        location.assign(location.href);
      }
    };
    if (typeof document.startViewTransition === 'function' && !reduced.matches && !document.hidden) {
      try {
        transition = document.startViewTransition(commit);
        transition.finished.catch(() => {});
        transition.updateCallbackDone.catch(() => location.assign(location.href));
      } catch { commit(); }
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
    key = ++nextKey;
    const destination = route.redirectPath || `${url.pathname}${url.search}${url.hash}`;
    history.pushState({ h4NavigationKey: key }, '', destination);
    positions.set(key, [0, 0]);
    update({ reset: true });
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
    history.scrollRestoration = previousRestoration;
    removeEventListener('scroll', remember);
    removeEventListener('pagehide', remember);
    removeEventListener('popstate', pop);
    document.removeEventListener('click', click);
    positions.clear();
  };
}
