import { createModeSnapshotTransition } from './mode-snapshot.js';
import { interactionMoshSettings } from './data/interactionMoshSettings.js';
import { getLivingDecaySettings } from './data/livingDecaySettings.js';

const services = new WeakMap();
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

/** Coordinate live inner-visual sampling with native route/mode captures.
 * Controls stay live; application JavaScript never rasterizes DOM pixels.
 */
export function initMoshTransitions({ doc = document } = {}) {
  if (services.has(doc)) return services.get(doc);
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const snapshot = createModeSnapshotTransition({ doc });
  const removers = [];
  let disposed = false;
  let focused = typeof doc.hasFocus !== 'function' || doc.hasFocus();
  let lastScrollAt = -Infinity;
  let lastInteractionAt = -Infinity;
  let interactions = 0;
  let navigations = 0;
  let ignored = 0;
  let cooldowns = new WeakMap();
  const now = () => view.performance.now();
  const enabled = () => !disposed && interactionMoshSettings.enabled !== false && !doc.hidden && !reduced.matches
    && doc.documentElement.dataset.mode === 'xray';
  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  };

  function interaction(detail = {}) {
    const kind = detail.kind === 'click' ? 'click' : detail.kind === 'hover' ? 'hover' : null;
    const time = now();
    const replacesHover = kind === 'click' && snapshot.snapshot().current?.kind === 'hover';
    if (!kind || !enabled() || !focused || time - lastScrollAt < 140
      || time - lastInteractionAt < 90 && !replacesHover) { ignored++; return null; }
    const tune = interactionMoshSettings[kind];
    const amount = getLivingDecaySettings()[`${kind}Mosh`];
    if (amount <= 0) { ignored++; return null; }
    const target = detail.target;
    if (target && (target.isConnected === false || time - (cooldowns.get(target)?.[kind] ?? -Infinity) < tune.cooldownMs)) { ignored++; return null; }
    // Input delegation supplies the bounds from its one geometry read. Direct
    // consumers may supply a rect too; no layout is read while frames animate.
    const rect = detail.rect || detail.region || (target?.getBoundingClientRect ? target.getBoundingClientRect() : null);
    if (!rect) { ignored++; return null; }
    const handle = snapshot.run(() => {}, {
      kind, rect, target, element: detail.element, duration: tune.durationMs,
      strength: clamp(clamp(Number.isFinite(detail.strength) ? detail.strength : tune.strength, 0, tune.strength) * amount, 0, 1),
      dx: Number.isFinite(detail.dx) ? detail.dx : tune.dx,
      dy: Number.isFinite(detail.dy) ? detail.dy : tune.dy,
    });
    if (!handle) { ignored++; return null; }
    interactions++;
    lastInteractionAt = time;
    if (target) cooldowns.set(target, { ...cooldowns.get(target), [kind]: time });
    return handle;
  }

  function navigation(update, context = {}) {
    // A null return always means the caller still owns the update. Once run
    // accepts it, even a thrown native API gets a handled fallback promise.
    if (!enabled() || typeof doc.startViewTransition !== 'function') return null;
    const amount = getLivingDecaySettings().navigationMosh;
    if (amount <= 0) return null;
    const tune = interactionMoshSettings.navigation;
    let updatePromise;
    const commit = detail => {
      if (!updatePromise) updatePromise = Promise.resolve().then(() => update(detail));
      return updatePromise;
    };
    const handle = snapshot.run(commit, {
      kind: 'navigation', duration: tune.durationMs,
      // Mode switching remains the strongest capture even at nav strength 1.
      strength: clamp(clamp(tune.strength, 0, 1) * .8 * amount, 0, 1),
      dx: tune.dx, dy: tune.dy,
      variant: context.variant,
    });
    navigations++;
    if (handle) return handle;
    const finished = updatePromise.then(() => {}, () => {});
    const skip = () => {};
    return { native: false, ready: Promise.resolve(), finished, updateCallbackDone: updatePromise, skip, skipTransition: skip };
  }

  listen(view, 'scroll', () => { lastScrollAt = now(); }, { passive: true });
  listen(view, 'blur', () => { focused = false; });
  listen(view, 'focus', () => { focused = true; });
  listen(doc, 'h4:modechange', () => { cooldowns = new WeakMap(); });
  const service = {
    interaction, navigation,
    prepare(context = {}) { return enabled() ? snapshot.prepare({ ...context, kind: 'navigation' }) : null; },
    snapshot: () => ({ ...snapshot.snapshot(), disposed, interactions, navigations, ignored }),
    dispose() {
      if (disposed) return;
      disposed = true;
      snapshot.dispose();
      for (const remove of removers) remove();
      cooldowns = new WeakMap();
      services.delete(doc);
    },
  };
  services.set(doc, service);
  return service;
}
