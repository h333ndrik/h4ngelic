const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const identity = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
const protectedSelector = '[data-no-mosh], [data-other-side-hint], [data-corruption-protected], [inert]';

/** Four stable, signed corners. `left/top` are the cached document origin;
 * an optional parent basis preserves the direction of a rotated ancestor. */
export function transformedHoverPoints(footprint, matrix) {
  if (!footprint || !matrix || !['left', 'top', 'width', 'height', 'originX', 'originY'].every(key => Number.isFinite(footprint[key]))
    || footprint.width <= 0 || footprint.height <= 0 || !['a', 'b', 'c', 'd', 'e', 'f'].every(key => Number.isFinite(matrix[key]))) return [];
  const { left, top, width, height, originX, originY } = footprint;
  const { parentA = 1, parentB = 0, parentC = 0, parentD = 1, scrollX = 0, scrollY = 0 } = footprint;
  if (![parentA, parentB, parentC, parentD, scrollX, scrollY].every(Number.isFinite)) return [];
  return [['tl', 0, 0], ['tr', width, 0], ['br', width, height], ['bl', 0, height]].map(([id, x, y]) => {
    const localX = originX + matrix.a * (x - originX) + matrix.c * (y - originY) + matrix.e;
    const localY = originY + matrix.b * (x - originX) + matrix.d * (y - originY) + matrix.f;
    return { id, x: left - scrollX + parentA * localX + parentC * localY,
      y: top - scrollY + parentB * localX + parentD * localY };
  });
}

/** Finite CSS-transform observation, independent of the unchanged hit target.
 * Sampling resolves styles only during a real hover/magnet transition; the
 * footprint is measured once and there is no persistent idle RAF loop. */
export function createFiniteHoverMotion({ doc = document, publish, maximumHz = 12 } = {}) {
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = view.matchMedia('(hover: hover) and (pointer: fine)');
  const interval = 1000 / clamp(Number.isFinite(maximumHz) ? maximumHz : 12, 1, 12);
  const records = new Map();
  let contexts = new WeakMap();
  const removers = [];
  let timer = 0, frame = 0, disposed = false, last = -Infinity, emitted = 0;
  let navigating = false, focused = typeof doc.hasFocus !== 'function' || doc.hasFocus();
  const active = () => !disposed && !navigating && focused && !doc.hidden && reduced.matches === false && fine.matches
    && doc.documentElement.dataset.mode === 'xray' && (typeof doc.hasFocus !== 'function' || doc.hasFocus());
  const now = () => view.performance.now();
  const listen = (target, type, handler, capture = false) => {
    target.addEventListener(type, handler, capture);
    removers.push(() => target.removeEventListener(type, handler, capture));
  };
  const matrixOf = style => {
    try {
      const Constructor = view.DOMMatrixReadOnly || view.DOMMatrix;
      const value = !style.transform || style.transform === 'none' ? identity : new Constructor(style.transform);
      return ['a', 'b', 'c', 'd', 'e', 'f'].every(key => Number.isFinite(value[key])) ? value : null;
    } catch { return null; }
  };

  function reset() {
    view.clearTimeout(timer);
    view.cancelAnimationFrame(frame);
    timer = frame = 0;
    records.clear();
    contexts = new WeakMap();
    last = -Infinity;
  }

  function sample(record, style) {
    const matrix = matrixOf(style || view.getComputedStyle(record.visual));
    if (!matrix) return null;
    const points = transformedHoverPoints({ ...record.footprint, scrollX: view.scrollX || 0, scrollY: view.scrollY || 0 }, matrix);
    if (points.length !== 4) return null;
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const left = Math.min(...xs), top = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
    const opacity = parseFloat((style || view.getComputedStyle(record.visual)).opacity);
    return { kind: 'hover-motion', target: record.target, points, x: (left + right) / 2, y: (top + bottom) / 2,
      width: Math.max(1, right - left), height: Math.max(1, bottom - top),
      opacity: clamp(Number.isFinite(opacity) ? opacity : 1, 0, 1) };
  }

  function schedule() {
    if (timer || frame || !records.size || !active()) return;
    const delay = Math.max(0, interval - (now() - last));
    timer = view.setTimeout(() => {
      timer = 0;
      if (active()) frame = view.requestAnimationFrame(tick);
      else reset();
    }, delay);
  }

  function tick(time) {
    frame = 0;
    if (!active()) return reset();
    if (time - last + .01 < interval) return schedule();
    const samples = [];
    for (const [target, record] of records) {
      if (target.isConnected === false || record.visual.isConnected === false) { records.delete(target); continue; }
      const style = record.endPose ? null : view.getComputedStyle(record.visual);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) { records.delete(target); continue; }
      const value = record.endPose || sample(record, style);
      if (value) samples.push(value);
      // Include one final resolved pose after the transition duration. Its
      // signed edge movement is needed for a full contraction, then stop.
      if (time >= record.until) records.delete(target);
    }
    if (samples.length) { last = time; emitted++; publish?.(samples, time); }
    schedule();
  }

  function track({ target, visual } = {}, durationMs = 400) {
    if (!active() || !target || !visual || target.isConnected === false || visual.isConnected === false
      || target.closest?.(protectedSelector) || visual.closest?.(protectedSelector)) return false;
    let record = records.get(target);
    const time = now();
    if (!record || record.visual !== visual) {
      const style = view.getComputedStyle(visual);
      const matrix = matrixOf(style);
      if (!matrix) return false;
      const rect = visual.getBoundingClientRect();
      const width = visual.offsetWidth || rect.width, height = visual.offsetHeight || rect.height;
      if (!(width > 0) || !(height > 0)) return false;
      const origin = (style.transformOrigin || '50% 50%').split(/\s+/);
      const coordinate = (value, size) => value?.endsWith('%') ? parseFloat(value) * size / 100 : parseFloat(value);
      const originX = coordinate(origin[0], width), originY = coordinate(origin[1], height);
      let basis = { a: 1, b: 0, c: 0, d: 1 };
      let ancestor = visual.parentElement;
      // A cached linear basis is enough to map local edge deltas through the
      // site's translated/rotated kinetic wrappers. Their own ongoing motion
      // is published separately by the existing choreography controller.
      for (let depth = 0; ancestor?.nodeType === 1 && depth < 16; depth++, ancestor = ancestor.parentElement) {
        const parent = matrixOf(view.getComputedStyle(ancestor));
        if (!parent) continue;
        basis = { a: parent.a * basis.a + parent.c * basis.b, b: parent.b * basis.a + parent.d * basis.b,
          c: parent.a * basis.c + parent.c * basis.d, d: parent.b * basis.c + parent.d * basis.d };
      }
      const footprint = { left: 0, top: 0, width, height, originX, originY,
        parentA: basis.a, parentB: basis.b, parentC: basis.c, parentD: basis.d, scrollX: 0, scrollY: 0 };
      const corners = transformedHoverPoints(footprint, matrix);
      if (corners.length !== 4) return false;
      footprint.left = rect.left + (view.scrollX || 0) - Math.min(...corners.map(point => point.x));
      footprint.top = rect.top + (view.scrollY || 0) - Math.min(...corners.map(point => point.y));
      record = { target, visual, footprint, until: time, duration: 400, endPose: null };
      contexts.set(visual, record);
      while (records.size >= 8) records.delete(records.keys().next().value);
      records.set(target, record);
      // Establish the baseline immediately when possible, before the first
      // animated frame. Further coalesced entries wait for the bounded cadence.
      if (time - last + .01 >= interval) {
        const baseline = sample(record, style);
        if (baseline) { last = time; emitted++; publish?.([baseline], time); }
      }
    }
    record.duration = clamp(Number.isFinite(durationMs) ? durationMs : 400, 80, 1200);
    record.until = time + record.duration;
    record.endPose = null;
    schedule();
    return true;
  }

  function actualTransition(event) {
    if (event.propertyName !== 'transform' || !active()) return;
    const record = contexts.get(event.target);
    if (!record || record.target.isConnected === false || record.visual.isConnected === false) return;
    const time = now();
    // A blocked main thread can consume the original observation window
    // before CSS has even started. Native transition events establish the
    // real animation lifetime, using the original cached footprint.
    if (event.type === 'transitionrun' || event.type === 'transitionstart') {
      record.until = time + record.duration;
      record.endPose = null;
    } else {
      // Capture the resolved final pose at the actual end, even if a stalled
      // RAF already expired its wall-clock window. Keep this immutable pose
      // until the bounded publisher can admit it; do not reread geometry.
      record.endPose = sample(record, view.getComputedStyle(record.visual));
      record.until = time;
    }
    while (records.size >= 8 && !records.has(record.target)) records.delete(records.keys().next().value);
    records.set(record.target, record);
    if (record.endPose && time - last + .01 >= interval) {
      view.clearTimeout(timer); view.cancelAnimationFrame(frame);
      timer = frame = 0;
      tick(time);
    } else schedule();
  }

  for (const type of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']) listen(doc, type, actualTransition, true);
  listen(doc, 'h4:navigationstart', () => { navigating = true; reset(); });
  listen(doc, 'h4:pagechange', () => { navigating = false; reset(); });
  for (const type of ['h4:modechange', 'visibilitychange']) listen(doc, type, reset);
  listen(view, 'blur', event => {
    if (event.target !== view) return;
    focused = false;
    reset();
  });
  listen(view, 'focus', event => {
    if (event.target !== view) return;
    focused = true;
    reset();
  });
  listen(view, 'resize', reset);
  listen(reduced, 'change', reset);
  listen(fine, 'change', reset);
  return { track, reset, snapshot: () => ({ active: active(), pending: Boolean(timer || frame), tracked: records.size, emitted }),
    dispose() { if (disposed) return; reset(); disposed = true; for (const remove of removers) remove(); } };
}
