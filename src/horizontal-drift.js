import './horizontal-drift.css';
import { createVisualMotionPublisher } from './motion-mosh.js';
import { carouselSettings as settings, carouselStyleProperties } from './carouselSettings.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const modulo = (value, length) => ((value % length) + length) % length;
const frameMs = 1000 / 60;

/** Input-driven horizontal carousel. Wheel, drag and touch use this one finite
 * momentum integrator. A stopped row schedules no animation frames. Original
 * cards recycle with translations, never with clones or a page-sized canvas. */
export function initHorizontalDrift(root = document) {
  const sections = [...root.querySelectorAll('[data-horizontal-drift]')];
  if (!sections.length) return () => {};
  const doc = root.ownerDocument || root, view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const publisher = createVisualMotionPublisher({ doc });
  const removers = [];
  let frame = 0, disposed = false, dirty = true, lastTime = 0;
  const states = sections.map(section => ({ section, viewport: section.querySelector('.drift-viewport'),
    track: section.querySelector('.drift-track'), items: [...section.querySelectorAll('[data-drift-item]')],
    previous: section.querySelector('[data-drift-previous]'), next: section.querySelector('[data-drift-next]'),
    counter: section.querySelector('[data-drift-count]'), status: section.querySelector('.drift-status'),
    position: 0, velocity: 0, width: 0, cardWidth: 0, step: 0, cycle: 0, leading: 0,
    travel: 0, index: 0, near: false, wrap: false, drag: null, hover: -1, pointerInside: false, keyboardPaused: false,
    announcement: 0, suppressClickUntil: 0 }));
  const listen = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  const property = (element, name, value) => {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  };
  const paused = state => state.section.hasAttribute('data-drift-paused');
  function measure() {
    for (const state of states) {
      const oldStep = state.step;
      const progress = oldStep ? state.position / oldStep : 0;
      state.width = state.viewport.clientWidth;
      state.cardWidth = state.items[0]?.offsetWidth || settings.cardWidth;
      state.step = state.cardWidth + settings.spacing;
      state.cycle = state.step * state.items.length;
      state.leading = Math.max(0, (state.width - state.cardWidth) / 2);
      state.travel = Math.max(0, state.step * (state.items.length - 1));
      // Recycling requires enough real material to cover the entire viewport.
      state.wrap = settings.wrap && state.items.length > 1 && state.cycle >= state.width + state.cardWidth;
      if (oldStep && oldStep !== state.step) state.position = progress * state.step;
      if (!state.wrap) state.position = clamp(state.position, 0, state.travel);
      property(state.track, '--drift-leading', `${state.leading}px`);
      property(state.track, '--drift-trailing', `${state.leading}px`);
      state.section.dataset.driftTravel = state.travel.toFixed(2);
      state.section.dataset.carouselWrap = String(state.wrap);
    }
    dirty = false;
  }
  function announce(state) {
    view.clearTimeout(state.announcement);
    state.announcement = view.setTimeout(() => {
      state.announcement = 0;
      if (!disposed && state.status) state.status.textContent = state.items.length
        ? `artwork ${state.index + 1} of ${state.items.length}` : 'archive in progress.';
    }, settings.announcementDelayMs);
  }
  function samples() {
    const result = [];
    for (const state of states) {
      if (!state.near || paused(state)) continue;
      for (const item of state.items) {
        const target = item.querySelector('.drift-artwork'), bounds = target?.getBoundingClientRect();
        if (!bounds || bounds.right < 0 || bounds.left > view.innerWidth || bounds.bottom < 0 || bounds.top > view.innerHeight) continue;
        result.push({ kind: 'section', target, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
          width: bounds.width, height: bounds.height, opacity: 1 });
        if (result.length >= 12) return result;
      }
    }
    return result;
  }
  function render(state) {
    const nearest = Math.round(state.position / (state.step || 1));
    const index = state.items.length ? state.wrap ? modulo(nearest, state.items.length) : clamp(nearest, 0, state.items.length - 1) : -1;
    if (index !== state.index) { state.index = index; announce(state); }
    property(state.track, '--carousel-position', `${-state.position}px`);
    state.items.forEach((item, itemIndex) => {
      const base = state.leading + itemIndex * state.step;
      const cycleOffset = state.wrap ? Math.ceil((state.position - base - state.cardWidth) / state.cycle) * state.cycle : 0;
      property(item, '--carousel-cycle-offset', `${cycleOffset}px`);
      const visualCenter = state.leading + itemIndex * state.step + cycleOffset - state.position + state.cardWidth / 2;
      const depthOffset = state.width ? clamp((visualCenter - state.width / 2) / (state.width / 2), -1, 1) : 0;
      const depthMagnitude = Math.abs(depthOffset);
      const depthScale = settings.depthScale ? 1 - depthMagnitude * (1 - settings.edgeScaleFloor) : 1;
      const depthRotation = settings.depthScale ? -depthOffset * settings.edgeRotation : 0;
      property(item, '--carousel-depth-scale', String(depthScale));
      property(item, '--carousel-depth-rotate', `${depthRotation}deg`);
      let neighbour = 0;
      if (!reduced.matches && state.hover >= 0 && settings.neighborDisplacement && !paused(state)) {
        const distance = state.wrap ? modulo(itemIndex - state.hover + state.items.length / 2, state.items.length) - state.items.length / 2 : itemIndex - state.hover;
        if (distance === -1 || distance === 1) neighbour = distance * settings.neighborShift;
      }
      property(item, '--carousel-neighbor-x', `${neighbour}px`);
      property(item, '--carousel-lift-y', `${!reduced.matches && settings.hoverStraighten && state.hover === itemIndex ? -settings.hoverLift : 0}px`);
    });
    state.section.dataset.driftPosition = state.position.toFixed(3);
    state.section.dataset.carouselIndex = String(Math.max(0, index));
    state.section.dataset.carouselVelocity = state.velocity.toFixed(4);
    const drifting = !reduced.matches && settings.autoDrift && settings.autoScroll > 0 && !paused(state)
      && !(settings.hoverPause && (state.pointerInside || state.keyboardPaused)) && !state.drag?.active && state.near && state.items.length > 1
      && Math.abs(state.velocity) <= settings.velocityCutoff;
    state.section.dataset.carouselPhase = paused(state) ? 'expanded' : state.drag?.active ? 'dragging'
      : Math.abs(state.velocity) > settings.velocityCutoff ? 'momentum' : drifting ? 'drift' : 'idle';
    state.section.dataset.carouselWrapCount = String(state.cycle ? Math.floor(state.position / state.cycle) : 0);
    state.section.dataset.carouselHoverPaused = String(settings.hoverPause && (state.pointerInside || state.keyboardPaused));
    state.section.dataset.carouselPointerInside = String(state.pointerInside);
    state.section.dataset.carouselKeyboardPaused = String(state.keyboardPaused);
    if (state.counter) state.counter.textContent = `${index < 0 ? 0 : index + 1} / ${state.items.length}`;
    if (state.previous) state.previous.disabled = !state.items.length || !state.wrap && state.position <= .5;
    if (state.next) state.next.disabled = !state.items.length || !state.wrap && state.position >= state.travel - .5;
  }
  function update(time) {
    frame = 0;
    if (disposed || doc.hidden) return;
    const ticks = lastTime ? clamp((time - lastTime) / frameMs, .25, 3) : 1;
    lastTime = time;
    if (dirty) measure();
    let moving = false;
    for (const state of states) {
      if (paused(state) || reduced.matches || !state.near) state.velocity = 0;
      let driftMoving = false;
      if (!state.drag?.active && Math.abs(state.velocity) > settings.velocityCutoff) {
        state.position += state.velocity * ticks;
        state.velocity *= Math.pow(1 - clamp(settings.inertia, .001, 1), ticks);
        if (Math.abs(state.velocity) <= settings.velocityCutoff) state.velocity = 0;
        if (!state.wrap) {
          const bounded = clamp(state.position, 0, state.travel);
          if (bounded !== state.position) state.velocity = 0;
          state.position = bounded;
        }
        moving ||= Math.abs(state.velocity) > settings.velocityCutoff;
      } else if (!state.drag?.active) {
        state.velocity = 0;
        driftMoving = !reduced.matches && settings.autoDrift && settings.autoScroll > 0
          && !paused(state) && !(settings.hoverPause && (state.pointerInside || state.keyboardPaused))
          && state.near && state.items.length > 1;
        if (driftMoving) {
          state.position -= settings.autoScroll * ticks;
          moving = true;
        }
      }
      if (state.wrap && !state.drag?.active && state.cycle) state.position = modulo(state.position, state.cycle);
      render(state);
    }
    if (publisher.ready(time)) publisher.publish(samples(), time);
    if (moving) schedule();
    else lastTime = 0;
  }
  function schedule(remeasure = false) {
    dirty ||= remeasure;
    if (!frame && !disposed && !doc.hidden) frame = view.requestAnimationFrame(update);
  }
  function goTo(state, index, { instant = false } = {}) {
    if (paused(state) || !state.items.length) return;
    if (dirty) measure();
    let destination = index * state.step;
    if (state.wrap) {
      const normalized = modulo(index, state.items.length);
      const cycle = Math.round((state.position - normalized * state.step) / state.cycle);
      destination = normalized * state.step + cycle * state.cycle;
      // Adjacent navigation must cross the seam in the requested direction.
      if (index === state.index + 1 && destination < state.position) destination += state.cycle;
      if (index === state.index - 1 && destination > state.position) destination -= state.cycle;
    } else destination = clamp(destination, 0, state.travel);
    if (instant || reduced.matches) { state.position = destination; state.velocity = 0; }
    else state.velocity = clamp((destination - state.position) * settings.inertia, -settings.maximumVelocity, settings.maximumVelocity);
    announce(state); schedule();
  }
  function stop(state) {
    const drag = state.drag;
    state.drag = null; state.velocity = 0;
    state.section.classList.remove('is-drift-dragging');
    if (drag && state.viewport.hasPointerCapture?.(drag.id)) state.viewport.releasePointerCapture(drag.id);
  }
  const observer = new view.IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.find(candidate => candidate.section === entry.target);
      if (state) { state.near = entry.isIntersecting; if (!state.near) stop(state); }
    }
    schedule();
  }, { rootMargin: '100px 0px' });
  const resize = new view.ResizeObserver(() => schedule(true));
  for (const state of states) {
    for (const [name, value] of Object.entries(carouselStyleProperties())) property(state.section, name, value);
    state.section.classList.add('is-drift-enhanced');
    observer.observe(state.section); resize.observe(state.viewport);
    listen(state.previous, 'click', () => goTo(state, state.index - 1));
    listen(state.next, 'click', () => goTo(state, state.index + 1));
    listen(state.viewport, 'scroll', () => {
      // Browser focus scrolling must not combine with the transform coordinate.
      if (state.viewport.scrollLeft) state.viewport.scrollLeft = 0;
    }, { passive: true });
    listen(state.viewport, 'wheel', event => {
      if (settings.scrollCapture !== 'area' || event.ctrlKey || paused(state) || !state.items.length || doc.querySelector('dialog[open]')) return;
      if (dirty) measure();
      const unit = event.deltaMode === 1 ? settings.wheelLinePixels : event.deltaMode === 2 ? state.width : 1;
      const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const delta = clamp(raw * unit, -settings.maximumWheelDelta, settings.maximumWheelDelta);
      if (!delta || !state.wrap && (delta < 0 && state.position <= 0 || delta > 0 && state.position >= state.travel)) return;
      event.preventDefault();
      if (reduced.matches) { state.position += delta * settings.wheelSensitivity; if (!state.wrap) state.position = clamp(state.position, 0, state.travel); }
      else state.velocity = clamp(state.velocity + delta * settings.wheelSensitivity / 60, -settings.maximumVelocity, settings.maximumVelocity);
      schedule();
    }, { passive: false });
    listen(state.section, 'keydown', () => { state.keyboardPaused = true; schedule(); });
    listen(state.section, 'pointerdown', () => { state.keyboardPaused = false; schedule(); }, { passive: true });
    listen(state.section, 'keydown', event => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey
        || event.target.closest('input, textarea, select') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
        || paused(state) || !state.items.length) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? state.items.length - 1
        : state.index + (event.key === 'ArrowLeft' ? -1 : 1);
      goTo(state, index, { instant: true });
    });
    listen(state.viewport, 'pointerdown', event => {
      if (event.isPrimary === false || event.button !== 0 || event.target.closest('a') || paused(state)) return;
      state.keyboardPaused = false;
      state.velocity = 0;
      state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: state.position,
        lastX: event.clientX, lastTime: view.performance.now(), active: false, moved: false };
    }, { passive: true });
    listen(state.viewport, 'pointermove', event => {
      const drag = state.drag;
      if (!drag || drag.id !== event.pointerId || !state.items.length) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.active) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < settings.dragThreshold) return;
        if (Math.abs(dy) >= Math.abs(dx)) { state.drag = null; return; }
        drag.active = drag.moved = true;
        state.section.classList.add('is-drift-dragging');
        state.viewport.setPointerCapture?.(event.pointerId);
      }
      if (event.cancelable) event.preventDefault();
      const now = view.performance.now(), elapsed = Math.max(1, now - drag.lastTime);
      state.velocity = reduced.matches ? 0 : clamp((drag.lastX - event.clientX) * frameMs / elapsed,
        -settings.maximumVelocity, settings.maximumVelocity);
      state.position = state.wrap ? drag.start - dx : clamp(drag.start - dx, 0, state.travel);
      drag.lastX = event.clientX; drag.lastTime = now;
      state.suppressClickUntil = now + settings.dragClickGuardMs;
      schedule();
    }, { passive: false });
    function release(event) {
      // A touch starts with implicit capture on its exact image/figure. Moving
      // capture to the viewport emits a bubbling loss on that old descendant;
      // it is not the end of the user's still-active drag.
      if (event.type === 'lostpointercapture' && event.target !== state.viewport) return;
      const drag = state.drag;
      if (!drag || event.pointerId !== drag.id) return;
      state.drag = null;
      if (drag.moved) state.suppressClickUntil = view.performance.now() + settings.dragClickGuardMs;
      if (event.type !== 'pointerup' || reduced.matches || view.performance.now() - drag.lastTime > settings.dragClickGuardMs) state.velocity = 0;
      state.section.classList.remove('is-drift-dragging');
      if (state.viewport.hasPointerCapture?.(drag.id)) state.viewport.releasePointerCapture(drag.id);
      schedule();
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
      if (!item || !state.section.contains(item) || event.target.hasAttribute('data-inline-pointer-focus')
        || event.target.hasAttribute('data-inline-focus-restore') || paused(state) || state.drag
        || !event.target.matches(':focus-visible')) return;
      goTo(state, state.items.indexOf(item), { instant: true });
    });
    listen(state.section, 'focusin', () => schedule());
    listen(state.section, 'focusout', event => {
      if (!state.section.contains(event.relatedTarget)) state.keyboardPaused = false;
      schedule();
    });
    listen(state.section, 'pointerenter', event => {
      if (event.pointerType === 'touch' || reduced.matches || !settings.hoverPause) return;
      state.pointerInside = true; schedule();
    });
    listen(state.section, 'pointerleave', event => {
      if (event.pointerType === 'touch' || !state.pointerInside) return;
      state.pointerInside = false; schedule();
    });
    state.items.forEach((item, index) => {
      listen(item, 'pointerenter', event => {
        if (event.pointerType === 'touch' || reduced.matches) return;
        state.hover = index; schedule();
      });
      listen(item, 'pointerleave', () => { state.hover = -1; schedule(); });
    });
    listen(state.section, 'inline-artwork:change', () => { stop(state); schedule(); });
    listen(state.viewport, 'dragstart', event => event.preventDefault());
  }
  listen(view, 'scroll', () => { if (states.some(state => state.near)) schedule(); }, { passive: true });
  listen(view, 'resize', () => schedule(true), { passive: true });
  listen(view, 'blur', () => { for (const state of states) stop(state); schedule(); });
  listen(reduced, 'change', () => { for (const state of states) { stop(state); state.hover = -1; } schedule(true); });
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) {
      if (frame) view.cancelAnimationFrame(frame);
      frame = 0; lastTime = 0; publisher.reset();
      for (const state of states) { stop(state); view.clearTimeout(state.announcement); state.announcement = 0; }
    } else schedule(true);
  });
  update(view.performance.now());
  return () => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    observer.disconnect(); resize.disconnect(); publisher.reset();
    for (const remove of removers) remove();
    for (const state of states) {
      stop(state); view.clearTimeout(state.announcement);
      state.section.classList.remove('is-drift-enhanced', 'is-drift-dragging');
      for (const name of ['--drift-leading', '--drift-trailing', '--carousel-position']) state.track.style.removeProperty(name);
      for (const item of state.items) for (const name of ['--carousel-cycle-offset', '--carousel-neighbor-x', '--carousel-lift-y', '--carousel-depth-scale', '--carousel-depth-rotate']) item.style.removeProperty(name);
      for (const name of ['driftPosition', 'driftTravel', 'carouselIndex', 'carouselVelocity', 'carouselPhase', 'carouselWrap', 'carouselWrapCount']) delete state.section.dataset[name];
    }
  };
}
