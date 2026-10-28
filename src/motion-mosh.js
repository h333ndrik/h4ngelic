import { getLivingDecaySettings } from './data/livingDecaySettings.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const cadence = 1000 / 12;
const motionKinds = ['hover-motion', 'typography', 'section', 'logo'];
const maximumCandidates = 32;
const maximumCandidateAge = 900;
const motionControls = Object.freeze({ section: 'sectionMosh', typography: 'typographyMosh', logo: 'heroMosh', 'hover-motion': 'hoverMosh' });
const controlFor = kind => motionControls[kind];
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

/** Match stable actual geometry points when provided. Bounds remain a
 * compatibility fallback for section publishers and represent scale too. */
function geometryPoints(sample) {
  if (Array.isArray(sample.points)) {
    const valid = sample.points.slice(0, 8).filter(point => point && (typeof point.id === 'string' || Number.isInteger(point.id))
      && Number.isFinite(point.x) && Number.isFinite(point.y));
    if (valid.length) return valid;
  }
  return [
    { id: 'tl', x: sample.x - sample.width / 2, y: sample.y - sample.height / 2 },
    { id: 'tr', x: sample.x + sample.width / 2, y: sample.y - sample.height / 2 },
    { id: 'br', x: sample.x + sample.width / 2, y: sample.y + sample.height / 2 },
    { id: 'bl', x: sample.x - sample.width / 2, y: sample.y + sample.height / 2 },
  ];
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
  let lastServedKind = -1;
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
  function scrollMotion(x, y, strength, time, movement = {}) {
    emitted.scroll++;
    // Only native position changes advance the parallax source. The finite
    // inertia tail continues image advection with zero additional travel.
    doc.dispatchEvent(new view.CustomEvent('h4:scrollmotion', { detail: { x, y, strength, time,
      deltaX: finite(movement.deltaX), deltaY: finite(movement.deltaY),
      scrollX: finite(view.scrollX), scrollY: finite(view.scrollY), deltaMs: Math.max(1, finite(movement.deltaMs, cadence)) } }));
  }
  function clear() {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    tracked.clear();
    candidates.clear();
    lastServedKind = -1;
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
      if (!['section', 'typography', 'logo', 'hover-motion'].includes(input?.kind)
        || !input.target || input.target.isConnected === false || input.target.closest?.(protectedSelector)
        || ![input.x, input.y, input.width, input.height, input.opacity].every(Number.isFinite)
        || input.width <= 0 || input.height <= 0) continue;
      const current = { ...input, time, opacity: clamp(input.opacity, 0, 1) };
      let channels = tracked.get(input.target);
      if (!channels) { channels = new Map(); tracked.set(input.target, channels); }
      const previous = channels.get(input.kind);
      if (previous && time <= previous.time) continue;
      channels.set(input.kind, current);
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
      const opacity = Math.max(current.opacity, previous.opacity);
      if (opacity < .025) continue;
      const anchor = pathAnchor(previous, current, width, height);
      if (!anchor) continue;
      const oldPoints = geometryPoints(previous);
      const newPoints = geometryPoints(current);
      const vectors = [];
      let maximumTravel = 0;
      for (const point of newPoints) {
        const prior = oldPoints.find(value => value.id === point.id);
        if (!prior) continue;
        const vectorX = point.x - prior.x;
        const vectorY = point.y - prior.y;
        maximumTravel = Math.max(maximumTravel, Math.hypot(vectorX, vectorY));
        if (Math.hypot(vectorX, vectorY) < .1) continue;
        // Keep opposing edges separate. A centered expansion or rotation is
        // real motion even when its average vector is exactly zero.
        const midpointX = (point.x + prior.x) / 2;
        const midpointY = (point.y + prior.y) / 2;
        const margin = Math.max(current.width, current.height);
        if (midpointX < -margin || midpointX > width + margin || midpointY < -margin || midpointY > height + margin) continue;
        vectors.push({ x: clamp(midpointX, 0, width), y: clamp(midpointY, 0, height),
          dx: clamp(vectorX, -500, 500), dy: clamp(vectorY, -500, 500), weight: opacity });
      }
      if (maximumTravel < .35 && angular < .015) continue;
      const speed = maximumTravel / dt;
      // Angular fallback supports older publishers; the hero now always sends
      // its eight signed projected geometry corners instead of this estimate.
      const rotationSpeed = vectors.length ? 0 : angular * Math.min(180, Math.max(current.width, current.height) / 2) / 1000;
      const drive = clamp((speed + rotationSpeed) / 2.5, 0, 1);
      const channel = controlFor(current.kind);
      // The renderer applies the current artistic gain exactly once.
      if (finite(settings[channel], 1) <= 0) continue;
      const strength = clamp((.08 + drive * .82) * opacity, 0, 1);
      if (strength <= .005) continue;
      const detail = { kind: current.kind, target: input.target, ...anchor,
        width: current.width, height: current.height,
        rect: { left: current.x - current.width / 2, top: current.y - current.height / 2, width: current.width, height: current.height },
        dx: clamp(dx, -500, 500), dy: clamp(dy, -500, 500), deltaMs: dt, vectors, strength };
      // Use the newest physical direction, never an older stronger movement
      // that could erase an immediate reversal before the next bounded flush.
      const queued = candidates.get(input.target);
      candidates.set(input.target, { ...detail, inputTime: time, queuedAt: queued?.queuedAt ?? time });
      // At most a small current-page queue survives a crowded frame. Updating
      // a waiting target replaces its physical direction without ageing it out.
      while (candidates.size > maximumCandidates) candidates.delete(candidates.keys().next().value);
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
    scroll = { x: clamp(-dx / dt, -4, 4), y: clamp(-dy / dt, -4, 4), updatedAt: current.time, inputAt: current.time,
      deltaX: finite(scroll?.deltaX) + dx, deltaY: finite(scroll?.deltaY) + dy,
      deltaMs: finite(scroll?.deltaMs) + dt };
    schedule();
  }

  function tick(time) {
    frame = 0;
    if (!active()) return clear();
    if (time - lastFlush + .01 < cadence) { schedule(); return; }
    const settings = readSettings();
    lastFlush = time;
    recent = recent.filter(value => time - value < 1000);
    for (const [target, detail] of candidates) {
      if (target.isConnected === false || time - detail.inputTime > maximumCandidateAge
        || finite(settings[controlFor(detail.kind)], 1) <= 0) candidates.delete(target);
    }
    // One event per bounded flush spreads the twelve-event budget across the
    // whole second. Two at once would exhaust it halfway through sustained
    // motion and create a half-second silence. Carry the newest waiting poses.
    if (recent.length < 12 && candidates.size) {
      let chosen = null;
      for (let offset = 1; offset <= motionKinds.length; offset++) {
        const kindIndex = (lastServedKind + offset) % motionKinds.length;
        const kind = motionKinds[kindIndex];
        const waiting = [...candidates.values()].filter(detail => detail.kind === kind)
          .sort((a, b) => a.queuedAt - b.queuedAt || b.strength - a.strength);
        if (!waiting.length) continue;
        chosen = waiting[0];
        lastServedKind = kindIndex;
        break;
      }
      if (chosen && active()) {
        candidates.delete(chosen.target);
        const { inputTime, queuedAt, ...detail } = chosen;
        recent.push(time);
        emitted.motion++;
        doc.dispatchEvent(new view.CustomEvent('h4:moshimpulse', { detail: { ...detail, sequence: ++sequence } }));
      }
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
        scrollMotion(0, 0, 0, time, scroll);
        scroll = null;
      } else {
        const strength = finite(settings.scrollMosh, 1) > 0 ? clamp(speed / 2.5, 0, 1) : 0;
        scrollMotion(scroll.x, scroll.y, strength, time, scroll);
        scroll.deltaX = scroll.deltaY = scroll.deltaMs = 0;
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
    snapshot: () => ({ active: active(), pending: Boolean(frame), trackedTargets: tracked.size, pendingTargets: candidates.size, sequence, emitted: { ...emitted } }),
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      for (const remove of removers) remove();
    },
  };
}
