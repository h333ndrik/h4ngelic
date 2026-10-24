import { xraySettings } from './data/xraySettings.js';

/** Discreet touch/pointer hold, with native button activation for keyboard/AT.
 * Pointer taps only discover the hint; scrolling or moving cancels the hold.
 */
export function bindModeHold(doc, activate, { onStart = () => {}, onEnd = () => {} } = {}) {
  const view = doc.defaultView;
  const removers = [];
  let held = null;
  let timer = 0;
  let pointerId = null;
  let suppressClickUntil = 0;
  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    removers.push(() => target.removeEventListener(type, callback, options));
  };
  const control = (event) => event.target?.closest?.('[data-mode-hold]');
  const enabled = (button) => button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
  const cancel = () => {
    view.clearTimeout(timer);
    timer = 0;
    if (held && !held.completed) onEnd('cancel');
    held = null;
  };
  const finish = () => {
    timer = 0;
    if (!held || doc.hidden || !enabled(held.button) || held.button.isConnected === false) { cancel(); return; }
    const remaining = xraySettings.shortcutHoldMs - (view.performance.now() - held.started);
    if (remaining > 0) { timer = view.setTimeout(finish, remaining); return; }
    held.completed = true;
    onEnd('complete');
    activate();
  };
  listen(doc, 'pointerdown', (event) => {
    const button = control(event);
    if (!enabled(button) || event.isPrimary === false || event.button !== 0 || doc.hidden) return;
    cancel();
    pointerId = event.pointerId;
    held = { button, id: event.pointerId, x: event.clientX, y: event.clientY, scrollX: view.scrollX, scrollY: view.scrollY, started: view.performance.now() };
    suppressClickUntil = Infinity;
    onStart(event);
    timer = view.setTimeout(finish, xraySettings.shortcutHoldMs);
  }, { passive: true });
  listen(doc, 'pointermove', (event) => {
    if (held && event.pointerId === held.id && Math.hypot(event.clientX - held.x, event.clientY - held.y) > 10) cancel();
  }, { passive: true });
  const release = (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    pointerId = null;
    suppressClickUntil = view.performance.now() + 650;
    cancel();
  };
  listen(doc, 'pointerup', release, { passive: true });
  listen(doc, 'pointercancel', release, { passive: true });
  listen(doc, 'keydown', (event) => {
    if (enabled(control(event)) && ['Enter', ' '].includes(event.key) && !event.repeat) suppressClickUntil = 0;
  });
  listen(view, 'scroll', () => {
    if (held && Math.abs(view.scrollX - held.scrollX) + Math.abs(view.scrollY - held.scrollY) > 2) cancel();
  }, { passive: true });
  listen(doc, 'click', (event) => {
    const button = control(event);
    if (!enabled(button) || event.defaultPrevented || doc.hidden || event.detail > 0 || event.pointerType
      || held || view.performance.now() < suppressClickUntil) return;
    // Native Enter/Space and assistive activation do not require a timed hold.
    onStart(event);
    onEnd('complete');
    activate();
  });
  listen(view, 'blur', () => { pointerId = null; suppressClickUntil = 0; cancel(); });
  listen(doc, 'visibilitychange', () => { if (doc.hidden) { pointerId = null; suppressClickUntil = 0; cancel(); } });
  listen(doc, 'h4:pagechange', () => { pointerId = null; suppressClickUntil = 0; cancel(); });
  listen(doc, 'h4:navigationstart', () => { pointerId = null; suppressClickUntil = 0; cancel(); });
  const dispose = () => {
    cancel();
    for (const remove of removers) remove();
  };
  dispose.cancel = cancel;
  return dispose;
}
