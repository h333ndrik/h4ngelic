import './horizontal-drift.css';
import { createVisualMotionPublisher } from './motion-mosh.js';
import { carouselPositions, carouselIndex, shiftedWheelDelta } from './horizontal-carousel-state.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** One native horizontal scroller per archive. The document never becomes a
 * horizontal timeline: wheel/touch vertical movement remains ordinary page
 * scrolling, while native swipe, trackpad, controls and mouse drag browse art. */
export function initHorizontalDrift(root = document) {
  const sections = [...root.querySelectorAll('[data-horizontal-drift]')];
  if (!sections.length) return () => {};
  const doc = root.ownerDocument || root;
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const publisher = createVisualMotionPublisher({ doc });
  const removers = [];
  let frame = 0, disposed = false, dirty = true;
  const states = sections.map(section => ({ section, viewport: section.querySelector('.drift-viewport'),
    track: section.querySelector('.drift-track'), items: [...section.querySelectorAll('[data-drift-item]')],
    previous: section.querySelector('[data-drift-previous]'), next: section.querySelector('[data-drift-next]'),
    counter: section.querySelector('[data-drift-count]'), status: section.querySelector('.drift-status'),
    travel: 0, width: 0, index: 0, targets: [], near: false, drag: null, pending: null,
    announcement: 0, suppressClickUntil: 0 }));
  const listen = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  const property = (element, name, value) => {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  };
  function measure() {
    for (const state of states) {
      const width = state.viewport.clientWidth;
      const changed = state.width > 0 && state.width !== width;
      const beforeIndex = state.index;
      state.width = width;
      const first = state.items[0], last = state.items.at(-1);
      // Centering edge space lets the first and last image align exactly like
      // every middle image. It also reserves room for their shared hover glow.
      property(state.track, '--drift-leading', `${first ? Math.max(0, (width - first.offsetWidth) / 2) : 0}px`);
      property(state.track, '--drift-trailing', `${last ? Math.max(0, (width - last.offsetWidth) / 2) : 0}px`);
      state.travel = Math.max(0, state.viewport.scrollWidth - width);
      state.targets = carouselPositions(state.items.map(item => ({ left: item.offsetLeft, width: item.offsetWidth })), width, state.travel);
      if (changed && !state.section.hasAttribute('data-drift-paused')) {
        state.viewport.scrollLeft = state.targets[beforeIndex] || 0;
      }
      state.section.dataset.driftTravel = state.travel.toFixed(2);
    }
    dirty = false;
  }
  function announce(state) {
    view.clearTimeout(state.announcement);
    state.announcement = view.setTimeout(() => {
      state.announcement = 0;
      if (!disposed && state.status) state.status.textContent = state.items.length
        ? `artwork ${state.index + 1} of ${state.items.length}` : 'archive in progress.';
    }, 140);
  }
  function samples() {
    const result = [];
    for (const state of states) {
      if (!state.near || state.section.hasAttribute('data-drift-paused')) continue;
      for (const item of state.items) {
        const target = item.querySelector('.drift-artwork');
        const bounds = target?.getBoundingClientRect();
        if (!bounds || bounds.right < 0 || bounds.left > view.innerWidth || bounds.bottom < 0 || bounds.top > view.innerHeight) continue;
        result.push({ kind: 'section', target, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
          width: bounds.width, height: bounds.height, opacity: 1 });
        if (result.length >= 12) return result;
      }
    }
    return result;
  }
  function update(time) {
    frame = 0;
    if (disposed || doc.hidden) return;
    if (dirty) measure();
    for (const state of states) {
      if (state.pending !== null && !state.section.hasAttribute('data-drift-paused')) {
        state.viewport.scrollLeft = clamp(state.pending, 0, state.travel);
        state.pending = null;
      }
      const current = clamp(state.viewport.scrollLeft, 0, state.travel);
      const index = carouselIndex(current, state.targets);
      if (state.index !== index) { state.index = index; announce(state); }
      state.section.dataset.driftPosition = current.toFixed(3);
      state.section.dataset.carouselIndex = String(Math.max(0, index));
      if (state.counter) state.counter.textContent = `${index < 0 ? 0 : index + 1} / ${state.items.length}`;
      // Fractional photo widths can put an edge photograph's centred target
      // just inside the integer scroll limit. Disable at the actual target,
      // otherwise the final arrow remains enabled but cannot advance.
      if (state.previous) state.previous.disabled = state.travel <= 1 || current <= (state.targets[0] ?? 0) + .5;
      if (state.next) state.next.disabled = state.travel <= 1 || current >= (state.targets.at(-1) ?? state.travel) - .5;
    }
    if (publisher.ready(time)) publisher.publish(samples(), time);
  }
  function schedule(remeasure = false) {
    dirty ||= remeasure;
    if (!frame && !disposed && !doc.hidden) frame = view.requestAnimationFrame(update);
  }
  function goTo(state, index, { smooth = true } = {}) {
    if (state.section.hasAttribute('data-drift-paused') || !state.items.length) return;
    if (dirty) measure();
    const destination = clamp(index, 0, state.items.length - 1);
    state.viewport.scrollTo({ left: state.targets[destination], behavior: smooth && !reduced.matches ? 'smooth' : 'instant' });
    announce(state);
    schedule();
  }
  const observer = new view.IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.find(candidate => candidate.section === entry.target);
      if (state) state.near = entry.isIntersecting;
    }
    schedule();
  }, { rootMargin: '100px 0px' });
  const resize = new view.ResizeObserver(() => schedule(true));
  for (const state of states) {
    state.section.classList.add('is-drift-enhanced');
    observer.observe(state.section);
    resize.observe(state.viewport);
    resize.observe(state.track);
    listen(state.previous, 'click', () => goTo(state, state.index - 1));
    listen(state.next, 'click', () => goTo(state, state.index + 1));
    listen(state.viewport, 'scroll', () => { schedule(); announce(state); }, { passive: true });
    listen(state.viewport, 'wheel', event => {
      if (state.section.hasAttribute('data-drift-paused') || doc.querySelector('dialog[open]')) return;
      if (dirty) measure();
      const delta = shiftedWheelDelta(event, state.viewport.scrollLeft, state.travel, state.width);
      // Native horizontal trackpad movement requires no JS cancellation. Only
      // explicit Shift+vertical-wheel gestures need translation.
      if (!delta) return;
      event.preventDefault();
      state.viewport.scrollLeft = clamp(state.viewport.scrollLeft + delta, 0, state.travel);
      schedule();
    }, { passive: false });
    listen(state.section, 'keydown', event => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey
        || event.target.closest('input, textarea, select') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
        || state.section.hasAttribute('data-drift-paused') || !state.items.length) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? state.items.length - 1
        : state.index + (event.key === 'ArrowLeft' ? -1 : 1);
      goTo(state, index);
    });
    listen(state.viewport, 'pointerdown', event => {
      if (event.isPrimary === false || event.button !== 0 || event.target.closest('a')
        || state.section.hasAttribute('data-drift-paused')) return;
      state.drag = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY,
        start: state.viewport.scrollLeft, active: false, moved: false };
    }, { passive: true });
    listen(state.viewport, 'pointermove', event => {
      const drag = state.drag;
      if (!drag || drag.id !== event.pointerId || state.travel <= 0) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 8) drag.moved = true;
      // Let the browser own touch axis locking, horizontal momentum and native
      // vertical panning. Only mouse/pen need a custom horizontal drag.
      if (drag.type === 'touch') return;
      if (!drag.active) {
        if (!drag.moved) return;
        if (Math.abs(dy) >= Math.abs(dx)) { state.drag = null; return; }
        drag.active = true;
        state.section.classList.add('is-drift-dragging');
        state.viewport.setPointerCapture?.(event.pointerId);
      }
      if (event.cancelable) event.preventDefault();
      state.pending = drag.start - dx;
      state.suppressClickUntil = view.performance.now() + 350;
      schedule();
    }, { passive: false });
    function release(event) {
      if (event.type === 'lostpointercapture' && event.target !== state.viewport) return;
      const drag = state.drag;
      if (!drag || event.pointerId !== drag.id) return;
      state.drag = null;
      if (drag.moved) state.suppressClickUntil = view.performance.now() + 350;
      if (drag.active && state.pending !== null) {
        state.viewport.scrollLeft = clamp(state.pending, 0, state.travel);
        state.pending = null;
      }
      state.section.classList.remove('is-drift-dragging');
      if (state.viewport.hasPointerCapture?.(drag.id)) state.viewport.releasePointerCapture(drag.id);
      if (drag.active) goTo(state, carouselIndex(state.viewport.scrollLeft, state.targets));
    }
    listen(state.viewport, 'pointerup', release);
    listen(state.viewport, 'pointercancel', release);
    listen(state.viewport, 'lostpointercapture', release);
    listen(state.viewport, 'click', event => {
      if (view.performance.now() > state.suppressClickUntil) return;
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    listen(state.section, 'focusin', event => {
      const item = event.target.closest('[data-drift-item]');
      if (!item || !state.section.contains(item) || state.section.hasAttribute('data-drift-focus-restore')
        || state.section.hasAttribute('data-drift-paused') || state.drag
        || !event.target.matches(':focus-visible')) return;
      if (dirty) measure();
      goTo(state, state.items.indexOf(item), { smooth: false });
    });
    listen(state.viewport, 'dragstart', event => event.preventDefault());
  }
  listen(view, 'scroll', () => { if (states.some(state => state.near)) schedule(); }, { passive: true });
  listen(view, 'resize', () => schedule(true), { passive: true });
  listen(view, 'blur', () => {
    for (const state of states) {
      const drag = state.drag;
      state.drag = null; state.pending = null;
      state.section.classList.remove('is-drift-dragging');
      if (drag && state.viewport.hasPointerCapture?.(drag.id)) state.viewport.releasePointerCapture(drag.id);
    }
  });
  listen(reduced, 'change', () => {
    for (const state of states) if (reduced.matches) state.viewport.scrollTo({ left: state.viewport.scrollLeft, behavior: 'instant' });
    schedule(true);
  });
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) {
      if (frame) view.cancelAnimationFrame(frame);
      frame = 0; publisher.reset();
      for (const state of states) { view.clearTimeout(state.announcement); state.announcement = 0; }
    } else schedule(true);
  });
  update(view.performance.now());
  return () => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    observer.disconnect(); resize.disconnect(); publisher.reset();
    for (const remove of removers) remove();
    for (const state of states) {
      if (state.drag && state.viewport.hasPointerCapture?.(state.drag.id)) state.viewport.releasePointerCapture(state.drag.id);
      view.clearTimeout(state.announcement);
      state.section.classList.remove('is-drift-enhanced', 'is-drift-dragging');
      state.track.style.removeProperty('--drift-leading'); state.track.style.removeProperty('--drift-trailing');
      delete state.section.dataset.driftPosition; delete state.section.dataset.driftTravel; delete state.section.dataset.carouselIndex;
    }
  };
}
