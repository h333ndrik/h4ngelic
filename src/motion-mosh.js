import { getLivingDecaySettings } from './data/livingDecaySettings.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const cadence = 1000 / 12;
const protectedSelector = '[data-no-mosh], [data-other-side-hint], [data-corruption-protected], [inert]';

/** A producer uses its existing animation/layout work. Only a final coalesced
 * sample may need a short RAF tail; this publisher never owns an idle loop. */
export function createVisualMotionPublisher({ doc = document, framesPerSecond = 12 } = {}) {
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const interval = 1000 / clamp(finite(framesPerSecond, 12), 1, 12);
  let frame = 0;
  let pending = null;
  let last = -Infinity;
  let emitted = 0;
  const active = () => !doc.hidden && !reduced.matches && doc.documentElement.dataset.mode === 'xray'
    && (typeof doc.hasFocus !== 'function' || doc.hasFocus());

  function reset() {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
    last = -Infinity;
  }
  function flush(time) {
    frame = 0;
    if (!active()) return reset();
    if (!pending) return;
    if (time - last + .01 < interval) { frame = view.requestAnimationFrame(flush); return; }
    const detail = pending;
    pending = null;
    last = time;
    emitted++;
    doc.dispatchEvent(new view.CustomEvent('h4:visualmotion', { detail }));
  }
  return {
    ready(time = view.performance.now()) {
      if (!active()) { reset(); return false; }
      return time - last + .01 >= interval;
    },
    publish(samples, time = view.performance.now()) {
      if (!active()) { reset(); return false; }
      if (!Array.isArray(samples) || !samples.length || !Number.isFinite(time)) return false;
      pending = { time, samples };
      if (time - last + .01 >= interval) {
        if (frame) view.cancelAnimationFrame(frame);
        frame = 0;
        flush(time);
      } else if (!frame) frame = view.requestAnimationFrame(flush);
      return true;
    },
    reset,
    snapshot: () => ({ pending: Boolean(frame || pending), emitted }),
  };
}

// Clip the actual swept center path to the viewport expanded by its footprint.
// This retains entrances and exits even when a fast movement crosses an edge
// between samples. The resulting damage anchor stays inside the viewport.
function pathAnchor(previous, current, width, height) {
  const radiusX = Math.max(previous.width, current.width) / 2;
  const radiusY = Math.max(previous.height, current.height) / 2;
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  let start = 0;
  let end = 1;
  for (const [origin, delta, minimum, maximum] of [
    [previous.x, dx, -radiusX, width + radiusX],
    [previous.y, dy, -radiusY, height + radiusY],
  ]) {
    if (Math.abs(delta) < .0001) {
      if (origin < minimum || origin > maximum) return null;
      continue;
    }
    const first = (minimum - origin) / delta;
    const second = (maximum - origin) / delta;
    start = Math.max(start, Math.min(first, second));
    end = Math.min(end, Math.max(first, second));
    if (start > end) return null;
  }
  const along = (start + end) / 2;
  return { x: clamp(previous.x + dx * along, 0, width), y: clamp(previous.y + dy * along, 0, height) };
}

/** One bounded bridge from actual scroll/element movement into the existing
 * image-history renderer. It reads no DOM geometry and never touches a visual
 * element's transforms, timing, physics, material or random composition seed. */
export function initMotionMosh({ doc = document, readSettings = getLivingDecaySettings } = {}) {
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const removers = [];
  const tracked = new Map();
  const candidates = new Map();
  const emitted = { motion: 0, scroll: 0 };
  let disposed = false;
  let focused = typeof doc.hasFocus !== 'function' || doc.hasFocus();
  let navigating = false;
  let frame = 0;
  let lastFlush = -Infinity;
  let recent = [];
  let sequence = 0;
  let scroll = null;
  let previousScroll = scrollPosition();
  const active = () => !disposed && focused && !navigating && !doc.hidden && !reduced.matches
    && doc.documentElement.dataset.mode === 'xray';
  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  };

  function scrollPosition() {
    return { x: finite(view.scrollX), y: finite(view.scrollY), time: view.performance.now() };
  }
  function scrollMotion(x, y, strength, time) {
    emitted.scroll++;
    doc.dispatchEvent(new view.CustomEvent('h4:scrollmotion', { detail: { x, y, strength, time } }));
  }
  function clear() {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    tracked.clear();
    candidates.clear();
    previousScroll = scrollPosition();
    if (scroll) scrollMotion(0, 0, 0, previousScroll.time);
    scroll = null;
    lastFlush = -Infinity;
    // Keep the rolling budget across lifecycle interruptions: mode/navigation
    // rebinding cannot manufacture more capacity in an already busy second.
  }
  function schedule() {
    if (active() && !frame) frame = view.requestAnimationFrame(tick);
  }

  function visualMotion(event) {
    if (!active()) return;
    const { samples, time } = event.detail || {};
    if (!Array.isArray(samples) || !Number.isFinite(time) || time < 0) return;
    const width = finite(view.innerWidth, 1);
    const height = finite(view.innerHeight, 1);
    const settings = readSettings();
    for (const input of samples.slice(0, 32)) {
      if (!['section', 'typography', 'logo'].includes(input?.kind)
        || !input.target || input.target.isConnected === false || input.target.closest?.(protectedSelector)
        || ![input.x, input.y, input.width, input.height, input.opacity].every(Number.isFinite)
        || input.width <= 0 || input.height <= 0) continue;
      const current = { ...input, time, opacity: clamp(input.opacity, 0, 1) };
      const previous = tracked.get(input.target);
      if (previous && time <= previous.time) continue;
      tracked.set(input.target, current);
      if (!previous) continue;
      // Scheduled section producers have no samples while the page rests. A
      // valid same-target pose remains a useful path anchor after that rest;
      // the first resumed observation uses a bounded active sampling window.
      // Lifecycle clears, rather than idle time, break position continuity.
      const elapsed = time - previous.time;
      const dt = Math.max(1, elapsed > 1600 ? 160 : elapsed);
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const angular = Math.abs(finite(input.angularVelocity,
        Number.isFinite(input.angle) && Number.isFinite(previous.angle) ? (input.angle - previous.angle) * 1000 / dt : 0));
      // Bounding-edge changes provide a real projected direction when the
      // sculpture rotates around a stationary center.
      const edgeX = angular ? (current.width - previous.width) / 2 : 0;
      const edgeY = angular ? (current.height - previous.height) / 2 : 0;
      const distance = Math.hypot(dx, dy);
      if ((distance < .35 && angular < .015) || Math.max(current.opacity, previous.opacity) < .025) continue;
      const anchor = pathAnchor(previous, current, width, height);
      if (!anchor) continue;
      const speed = Math.hypot(dx + edgeX, dy + edgeY) / dt;
      const rotationSpeed = angular * Math.min(180, Math.max(current.width, current.height) / 2) / 1000;
      const drive = clamp((speed + rotationSpeed) / 2.5, 0, 1);
      // The renderer applies each calibration gain once. This producer only
      // suppresses disabled channels and reports normalized physical energy.
      if (finite(settings[current.kind === 'section' ? 'sectionMosh' : 'typographyMosh'], 1) <= 0) continue;
      const strength = clamp((.08 + drive * .82) * Math.max(current.opacity, previous.opacity), 0, 1);
      if (strength <= .005) continue;
      const detail = { kind: current.kind, target: input.target, ...anchor,
        width: current.width, height: current.height,
        rect: { left: current.x - current.width / 2, top: current.y - current.height / 2, width: current.width, height: current.height },
        dx: clamp(dx + edgeX, -500, 500), dy: clamp(dy + edgeY, -500, 500), strength };
      const pending = candidates.get(input.target);
      if (!pending || detail.strength >= pending.strength) candidates.set(input.target, detail);
    }
    // Detached page targets never keep a document alive across route changes.
    for (const target of tracked.keys()) if (target.isConnected === false) tracked.delete(target);
    if (candidates.size) schedule();
  }

  function onScroll() {
    const current = scrollPosition();
    const previous = previousScroll;
    previousScroll = current;
    if (!active()) return;
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    if (Math.hypot(dx, dy) < .1) return;
    const dt = clamp(current.time - previous.time, 8, 160);
    // Native scroll position, rather than wheel delta, also covers keyboard,
    // touch inertia, reverse scrolling and programmatic anchor movement.
    scroll = { x: clamp(-dx / dt, -4, 4), y: clamp(-dy / dt, -4, 4), updatedAt: current.time, inputAt: current.time };
    schedule();
  }

  function tick(time) {
    frame = 0;
    if (!active()) return clear();
    if (time - lastFlush + .01 < cadence) { schedule(); return; }
    const settings = readSettings();
    lastFlush = time;
    recent = recent.filter(value => time - value < 1000);
    const selected = [...candidates.values()].sort((a, b) => b.strength - a.strength).slice(0, Math.min(2, 12 - recent.length));
    candidates.clear();
    for (const detail of selected) {
      if (detail.target.isConnected === false || !active()) continue;
      recent.push(time);
      emitted.motion++;
      doc.dispatchEvent(new view.CustomEvent('h4:moshimpulse', { detail: { ...detail, sequence: ++sequence } }));
    }
    if (scroll) {
      const elapsed = Math.max(0, time - scroll.updatedAt);
      const inertia = clamp(finite(settings.scrollInertia, .72), 0, 1);
      const decay = Math.exp(-elapsed / (65 + inertia * 285));
      scroll.x *= decay;
      scroll.y *= decay;
      scroll.updatedAt = time;
      const speed = Math.hypot(scroll.x, scroll.y);
      if (speed < .008 || time - scroll.inputAt > 2500) {
        scrollMotion(0, 0, 0, time);
        scroll = null;
      } else {
        const strength = finite(settings.scrollMosh, 1) > 0 ? clamp(speed / 2.5, 0, 1) : 0;
        scrollMotion(scroll.x, scroll.y, strength, time);
      }
    }
    if (scroll || candidates.size) schedule();
  }

  listen(view, 'scroll', onScroll, { passive: true });
  listen(doc, 'h4:visualmotion', visualMotion);
  listen(doc, 'h4:modechange', clear);
  listen(doc, 'h4:navigationstart', () => { navigating = true; clear(); });
  listen(doc, 'h4:pagechange', () => { navigating = false; clear(); });
  listen(doc, 'visibilitychange', clear);
  listen(reduced, 'change', clear);
  listen(view, 'blur', () => { focused = false; clear(); });
  listen(view, 'focus', () => { focused = true; clear(); });
  listen(view, 'resize', clear, { passive: true });
  return {
    snapshot: () => ({ active: active(), pending: Boolean(frame), trackedTargets: tracked.size, sequence, emitted: { ...emitted } }),
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      for (const remove of removers) remove();
    },
  };
}
