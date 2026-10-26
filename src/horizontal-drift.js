import './horizontal-drift.css';
import { createVisualMotionPublisher } from './motion-mosh.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Native page scroll provides wheel momentum, vertical touch panning and
 * boundary release. Only genuinely horizontal input needs translation. There
 * is no wheel trap or duplicate carousel scene/animation library. */
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
    start: 0, travel: 0, current: 0, target: 0, near: false, drag: null, inertia: null, suppressClickUntil: 0 }));
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  function measure() {
    for (const state of states) {
      state.section.classList.add('is-drift-enhanced');
      // The scroll track must reserve a full usable viewport, even when its
      // artwork stage is intentionally shorter. Otherwise a short mobile
      // footer can put the document's maximum scroll before the last image.
      const height = Math.max(state.viewport.getBoundingClientRect().height, view.innerHeight - 12);
      state.travel = Math.max(0, state.track.scrollWidth - state.viewport.clientWidth);
      state.section.style.height = `${Math.ceil(height + state.travel)}px`;
      state.start = state.section.getBoundingClientRect().top + view.scrollY - 12;
      state.section.dataset.driftTravel = state.travel.toFixed(2);
    }
    dirty = false;
  }
  function samples() {
    const result = [];
    for (const state of states) {
      if (!state.near) continue;
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
    let moving = false;
    for (const state of states) {
      if (state.section.hasAttribute('data-drift-paused')) continue;
      if (state.inertia && !reduced.matches) {
        const elapsed = clamp(time - state.inertia.time, 0, 32);
        const next = clamp(view.scrollY + state.inertia.velocity * elapsed, state.start, state.start + state.travel);
        view.scrollTo({ top: next, behavior: 'instant' });
        state.inertia.velocity *= Math.exp(-elapsed / 170);
        state.inertia.time = time;
        if (Math.abs(state.inertia.velocity) < .025 || next <= state.start || next >= state.start + state.travel) state.inertia = null;
        else moving = true;
      }
      state.target = clamp(view.scrollY - state.start, 0, state.travel);
      const delta = state.target - state.current;
      // Large jumps (anchors/history/keyboard) are direct; ordinary wheel
      // movement gets a finite damping tail. Nothing animates while idle.
      state.current = reduced.matches || Math.abs(delta) < .2 || Math.abs(delta) > view.innerWidth * 2
        ? state.target : state.current + delta * .22;
      moving ||= Math.abs(state.current - state.target) > .2;
      state.track.style.transform = `translate3d(${-state.current.toFixed(3)}px,0,0)`;
      state.section.dataset.driftPosition = state.current.toFixed(3);
    }
    if (publisher.ready(time)) publisher.publish(samples(), time);
    if (moving) schedule();
  }
  function schedule(remeasure = false) {
    dirty ||= remeasure;
    if (!frame && !disposed && !doc.hidden) frame = view.requestAnimationFrame(update);
  }
  function setPosition(state, position, { smooth = false } = {}) {
    if (dirty) measure();
    view.scrollTo({ top: state.start + clamp(position, 0, state.travel), behavior: smooth && !reduced.matches ? 'smooth' : 'instant' });
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
    observer.observe(state.section);
    resize.observe(state.viewport);
    resize.observe(state.track);
    listen(state.viewport, 'wheel', event => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || event.ctrlKey || doc.querySelector('dialog[open]')) return;
      if (dirty) measure();
      const current = clamp(view.scrollY - state.start, 0, state.travel);
      const delta = event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? state.viewport.clientWidth : 1);
      if (state.travel <= 0 || delta < 0 && current <= 0 || delta > 0 && current >= state.travel) return;
      event.preventDefault();
      setPosition(state, current + delta);
    }, { passive: false });
    listen(state.section, 'keydown', event => {
      if (event.target !== state.section || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const position = event.key === 'Home' ? 0 : event.key === 'End' ? state.travel
        : state.target + (event.key === 'ArrowLeft' ? -1 : 1) * state.viewport.clientWidth * .7;
      setPosition(state, position, { smooth: true });
      const status = state.section.querySelector('.drift-status');
      if (status) status.textContent = `${Math.round(clamp(position / Math.max(1, state.travel), 0, 1) * 100)} percent through archive`;
    });
    listen(state.viewport, 'pointerdown', event => {
      if (event.isPrimary === false || event.button !== 0 || event.target.closest('a')) return;
      state.inertia = null;
      state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
        scroll: view.scrollY, active: false, previousX: event.clientX, time: view.performance.now(), velocity: 0 };
    }, { passive: true });
    listen(state.viewport, 'pointermove', event => {
      const drag = state.drag;
      if (!drag || drag.id !== event.pointerId || state.travel <= 0) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.active) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (Math.abs(dy) >= Math.abs(dx)) { state.drag = null; return; }
        drag.active = true;
        state.viewport.setPointerCapture?.(event.pointerId);
        state.section.classList.add('is-drift-dragging');
      }
      if (event.cancelable) event.preventDefault();
      const now = view.performance.now();
      drag.velocity = clamp((drag.previousX - event.clientX) / clamp(now - drag.time, 8, 100), -3, 3);
      drag.previousX = event.clientX;
      drag.time = now;
      const proposed = drag.scroll - dx;
      view.scrollTo({ top: clamp(proposed, state.start, state.start + state.travel), behavior: 'instant' });
      state.suppressClickUntil = view.performance.now() + 400;
      schedule();
    }, { passive: false });
    const release = event => {
      // Touch starts with implicit capture on the image/button. Transferring
      // it to the viewport emits a bubbling lostpointercapture from that
      // child; that is not the end of our newly captured horizontal drag.
      if (event.type === 'lostpointercapture' && event.target !== state.viewport) return;
      if (!state.drag || state.drag.id !== event.pointerId) return;
      const id = state.drag.id;
      if (event.type === 'pointerup' && state.drag.active && !reduced.matches && view.performance.now() - state.drag.time < 100 && Math.abs(state.drag.velocity) > .08) {
        state.inertia = { velocity: state.drag.velocity, time: view.performance.now() };
        schedule();
      }
      state.drag = null;
      state.section.classList.remove('is-drift-dragging');
      if (state.viewport.hasPointerCapture?.(id)) state.viewport.releasePointerCapture(id);
    };
    listen(state.viewport, 'pointerup', release);
    listen(state.viewport, 'pointercancel', release);
    listen(state.viewport, 'lostpointercapture', release);
    listen(state.viewport, 'click', event => {
      if (view.performance.now() > state.suppressClickUntil) return;
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    // A keyboard tab into an offscreen image moves the same native scroll
    // position, rather than creating an inaccessible clipped focus target.
    listen(state.section, 'focusin', event => {
      const item = event.target.closest('[data-drift-item]');
      if (!item || !state.section.contains(item) || state.section.hasAttribute('data-drift-focus-restore')) return;
      if (dirty) measure();
      const visible = item.getBoundingClientRect();
      const window = state.viewport.getBoundingClientRect();
      if (visible.right > window.left + 16 && visible.left < window.right - 16) return;
      const destination = item.offsetLeft + item.offsetWidth / 2 - state.viewport.clientWidth / 2;
      setPosition(state, destination);
    });
    listen(state.viewport, 'dragstart', event => event.preventDefault());
  }
  listen(view, 'scroll', () => { if (states.some(state => state.near)) schedule(); }, { passive: true });
  listen(view, 'wheel', () => { for (const state of states) state.inertia = null; }, { passive: true });
  listen(view, 'resize', () => schedule(true), { passive: true });
  listen(reduced, 'change', () => schedule(true));
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) { if (frame) view.cancelAnimationFrame(frame); frame = 0; publisher.reset(); for (const state of states) state.inertia = null; }
    else schedule(true);
  });
  update(view.performance.now());
  return () => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    observer.disconnect(); resize.disconnect(); publisher.reset();
    for (const remove of removers) remove();
    for (const state of states) {
      if (state.drag && state.viewport.hasPointerCapture?.(state.drag.id)) state.viewport.releasePointerCapture(state.drag.id);
      state.section.classList.remove('is-drift-enhanced', 'is-drift-dragging');
      state.section.style.removeProperty('height');
      state.track.style.removeProperty('transform');
      delete state.section.dataset.driftPosition; delete state.section.dataset.driftTravel;
    }
  };
}
