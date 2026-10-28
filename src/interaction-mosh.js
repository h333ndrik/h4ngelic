import { interactionMoshSettings } from './data/interactionMoshSettings.js';
import { rubricSelector } from './rubric-activation.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

/** Delegate discrete input to the bounded pixel renderer. No pointermove,
 * scroll listener, animation loop, or queued snapshot can outlive its gesture.
 * onSnapshot is optional: native page captures are owned by the app/navigation.
 */
export function initInteractionMosh({ doc = document, onSnapshot, settings = interactionMoshSettings } = {}) {
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = view.matchMedia('(hover: hover) and (pointer: fine)');
  const removers = [];
  const counts = { hover: 0, focus: 0, click: 0, section: 0 };
  const rejected = { cooldown: 0, rate: 0, geometry: 0 };
  let cooldowns = new WeakMap();
  let recent = [];
  let lastImpulse = -Infinity;
  let observer = null;
  let observerRevision = 0;
  let observedTargets = 0;
  let sequence = 0;
  let geometryReads = 0;
  let snapshotRequests = 0;
  let disposed = false;
  let focused = typeof doc.hasFocus !== 'function' || doc.hasFocus();
  let navigating = false;
  let hoverEntry = null;

  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    removers.push(() => target.removeEventListener(type, callback, options));
  };
  const now = () => view.performance.now();
  const active = () => !disposed && settings.enabled !== false && !doc.hidden && focused && !navigating
    && !reduced.matches && doc.documentElement.dataset.mode === 'xray';

  function targetAt(source) {
    const element = source?.nodeType === 3 ? source.parentElement : source;
    if (!element?.closest || element.isConnected === false || element.isContentEditable
      || element.closest(settings.excludedSelector)) return null;
    const target = element.closest(settings.targetSelector);
    if (!target || target.isConnected === false || target.disabled || target.isContentEditable
      || target.closest(settings.excludedSelector)) return null;
    return target;
  }

  function mayEmit(kind, target, time) {
    const previous = cooldowns.get(target)?.[kind] ?? -Infinity;
    if (time - previous < settings[kind].cooldownMs) { rejected.cooldown++; return false; }
    recent = recent.filter(value => time - value < settings.rate.windowMs);
    // A deliberate click may immediately follow hover/focus, while the shared
    // rolling-window cap still bounds all input, including repeated clicks.
    if (recent.length >= settings.rate.maximumImpulses
      || kind !== 'click' && time - lastImpulse < settings.rate.minimumGapMs) {
      rejected.rate++;
      return false;
    }
    return true;
  }

  function emit(kind, target, event, bounds) {
    if (!active() || target.isConnected === false) return null;
    const time = now();
    if (!mayEmit(kind, target, time)) return null;
    // IntersectionObserver already supplies geometry; discrete input gets one
    // read only after the mode, target, cooldown and rate checks have passed.
    if (!bounds) { geometryReads++; bounds = target.getBoundingClientRect(); }
    const width = finite(bounds.width);
    const height = finite(bounds.height);
    if (width <= 0 || height <= 0) { rejected.geometry++; return null; }
    const left = finite(bounds.left, finite(bounds.x));
    const top = finite(bounds.top, finite(bounds.y));
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const pointer = kind === 'hover' || kind === 'click' && event?.detail !== 0;
    const x = pointer ? clamp(finite(event.clientX, centerX), left, left + width) : centerX;
    const y = pointer ? clamp(finite(event.clientY, centerY), top, top + height) : centerY;
    const direction = kind === 'section'
      ? (centerX < finite(view.innerWidth, centerX * 2) / 2 ? 1 : -1)
      : (x < centerX ? 1 : -1);
    const tune = settings[kind];
    const detail = { kind, target, x, y, width, height, rect: { left, top, width, height },
      dx: direction * tune.dx, dy: kind === 'section' ? -tune.dy : (y < centerY ? 1 : -1) * tune.dy,
      strength: tune.strength, sequence: ++sequence };
    const record = cooldowns.get(target) || {};
    record[kind] = time;
    cooldowns.set(target, record);
    recent.push(time);
    lastImpulse = time;
    counts[kind]++;
    // Native view-transition hit testing can synthesize boundary events under
    // a stationary pointer. The accepted rectangle marks this physical entry
    // until an actual outside departure or lifecycle interruption occurs.
    if (kind === 'hover') hoverEntry = { target, rect: detail.rect };
    doc.dispatchEvent(new view.CustomEvent('h4:moshimpulse', { detail }));
    return detail;
  }

  function requestSnapshot(detail) {
    // Event consumers may synchronously change mode or start navigation.
    if (!detail || !active() || typeof onSnapshot !== 'function') return;
    // Rubrics illuminate cleanly. Their real hover motion still carries image
    // fragments through the shared field; do not glitch the legible label.
    if (detail.kind === 'hover' && detail.target?.matches(rubricSelector)) return;
    snapshotRequests++;
    try {
      const result = onSnapshot(detail);
      // Rendering capability/failure must never break the original control.
      result?.catch?.(() => {});
    } catch { /* The live control remains functional if capture is unavailable. */ }
  }

  function hover(event) {
    if (!active() || !fine.matches || event.pointerType !== 'mouse' || event.isPrimary === false) return;
    const target = targetAt(event.target);
    if (!target || event.relatedTarget?.nodeType && target.contains(event.relatedTarget)) return;
    if (hoverEntry?.target === target && insideHoverRect(event)) return;
    requestSnapshot(emit('hover', target, event));
  }

  function insideHoverRect(event) {
    const rect = hoverEntry?.rect;
    return Boolean(rect && event.clientX >= rect.left && event.clientX < rect.left + rect.width
      && event.clientY >= rect.top && event.clientY < rect.top + rect.height);
  }

  function leave(event) {
    if (!hoverEntry || event.pointerType !== 'mouse' || event.isPrimary === false
      || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    // Overlay-induced pointerout at the same coordinates is not a departure.
    // Reuse the cached rectangle, without a move listener or another read.
    if (!insideHoverRect(event)) hoverEntry = null;
  }

  function focus(event) {
    if (!active()) return;
    const target = targetAt(event.target);
    if (target) emit('focus', target, event);
  }

  function clickSnapshotAllowed(event, target) {
    if (event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    const anchor = target.closest('a[href]');
    // Every anchor keeps its own navigation semantics. Internal navigation
    // captures the actual page change; external/download/native links must not
    // start a capture that can delay or compete with leaving this document.
    if (anchor) return false;
    return !target.closest('[data-native-navigation], [download]');
  }

  function click(event) {
    // Compatibility clicks can be PointerEvents with isPrimary === false even
    // for a trusted primary-button activation. Button/modifier state defines
    // click intent; pointer-primary filtering belongs to hover boundaries.
    if (!active() || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = targetAt(event.target);
    if (!target) return;
    const capture = clickSnapshotAllowed(event, target);
    const detail = emit('click', target, event);
    if (capture) requestSnapshot(detail);
  }

  function disconnect() {
    ++observerRevision;
    observer?.disconnect();
    observer = null;
    observedTargets = 0;
  }

  function clear() {
    disconnect();
    cooldowns = new WeakMap();
    hoverEntry = null;
    // Keep the bounded rolling budget across page/mode rebinding so repeated
    // navigation or focus changes cannot manufacture extra input capacity.
  }

  function bindSections() {
    disconnect();
    if (!active() || typeof view.IntersectionObserver !== 'function') return;
    const revision = observerRevision;
    const visible = new WeakSet();
    observer = new view.IntersectionObserver(entries => {
      // Disconnected observers may still deliver a queued final notification.
      if (revision !== observerRevision || !active()) return;
      for (const entry of entries) {
        // An impulse consumer can synchronously replace the page/observer.
        if (revision !== observerRevision || !active()) return;
        if (!entry.isIntersecting) { visible.delete(entry.target); continue; }
        if (visible.has(entry.target)) continue;
        visible.add(entry.target);
        if (entry.target.closest(settings.excludedSelector)) continue;
        emit('section', entry.target, null, entry.boundingClientRect);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: .16 });
    const targets = new Set(doc.querySelectorAll(settings.sectionSelector));
    // Preserve section coverage when a future template has no kinetic heading.
    for (const section of doc.querySelectorAll('.content-section')) {
      if (!section.querySelector(settings.sectionSelector)) targets.add(section);
    }
    for (const target of targets) {
      if (target.closest(settings.excludedSelector)) continue;
      observer.observe(target);
      observedTargets++;
    }
  }

  function refresh() {
    clear();
    if (active()) bindSections();
  }

  listen(doc, 'pointerover', hover, { passive: true });
  listen(doc, 'pointerout', leave, { passive: true });
  listen(doc, 'focusin', focus);
  // Capture runs before SPA navigation changes location or replaces the target.
  listen(doc, 'click', click, { capture: true, passive: true });
  listen(doc, 'h4:modechange', refresh);
  listen(doc, 'h4:navigationstart', () => { navigating = true; clear(); });
  listen(doc, 'h4:pagechange', () => { navigating = false; refresh(); });
  listen(doc, 'visibilitychange', refresh);
  listen(reduced, 'change', refresh);
  listen(fine, 'change', refresh);
  listen(view, 'blur', () => { focused = false; clear(); });
  listen(view, 'focus', () => { focused = true; refresh(); });
  bindSections();

  return {
    snapshot: () => ({ active: active(), disposed, observing: Boolean(observer), observedTargets,
      pending: 0, hoverLatched: Boolean(hoverEntry), sequence, geometryReads, snapshotRequests,
      emitted: { ...counts }, rejected: { ...rejected } }),
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      recent = [];
      for (const remove of removers) remove();
    },
  };
}
