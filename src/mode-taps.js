/** A deliberate tap sequence; native scrolling and pointer capture stay with
 * the browser. Only a completed short gesture (or native keyboard activation)
 * counts. This binder owns no mode state, transition or sound implementation. */
export function bindModeTaps(doc, { selector = '[data-mobile-mode]', windowMs = 2000,
  maximumTravel = 12, maximumTapMs = 450, enabled = () => true, getMode,
  onPrepare = () => {}, onComplete, onProgress = () => {} } = {}) {
  const view = doc.defaultView;
  const removers = [];
  let down = null, completed = null, target = null, count = 0, started = 0, timer = 0, locked = false;
  let suppressCompatibilityUntil = -Infinity;
  let keyboardRepeating = false;
  let disposed = false;
  windowMs = Number.isFinite(windowMs) ? Math.max(250, Math.min(5000, windowMs)) : 2000;
  maximumTravel = Number.isFinite(maximumTravel) ? Math.max(4, Math.min(30, maximumTravel)) : 12;
  maximumTapMs = Number.isFinite(maximumTapMs) ? Math.max(80, Math.min(1000, maximumTapMs)) : 450;
  const now = () => view.performance.now();
  const listen = (node, name, fn, options) => {
    node.addEventListener(name, fn, options);
    removers.push(() => node.removeEventListener(name, fn, options));
  };
  const control = event => event.target?.closest?.(selector);
  const required = () => getMode() === 'xray' ? 3 : 4;
  const available = button => !disposed && !doc.hidden && enabled() && button && button.isConnected !== false
    && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
  const coordinates = event => Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
  const suppressPointerClick = () => { suppressCompatibilityUntil = now() + 650; };
  function cancel() {
    if (down || completed) suppressPointerClick();
    keyboardRepeating = false;
    view.clearTimeout(timer);
    timer = 0; down = completed = null; locked = false;
    if (target) onProgress(target, 0, required());
    target = null; count = started = 0;
  }
  function accept(button, event) {
    if (!available(button) || locked) return;
    const time = now();
    if (target !== button || time - started >= windowMs) cancel();
    if (!count) { target = button; started = time; onPrepare(event); }
    const total = required();
    onProgress(button, ++count, total);
    if (count === total) {
      locked = true;
      view.clearTimeout(timer); timer = 0;
      try { onComplete(getMode() === 'xray' ? 'normal' : 'xray'); }
      catch (error) { cancel(); throw error; }
    } else if (!timer) timer = view.setTimeout(cancel, Math.max(0, windowMs - (time - started)));
  }
  listen(doc, 'pointerdown', event => {
    const button = control(event);
    completed = null;
    if (!button) { if (down || count) cancel(); return; }
    if (locked) return;
    if (!available(button) || event.isPrimary === false || event.button !== 0 || !coordinates(event)) {
      suppressPointerClick(); cancel(); return;
    }
    if (down || target && target !== button) cancel();
    down = { target: button, id: event.pointerId, x: event.clientX, y: event.clientY, time: now() };
    suppressCompatibilityUntil = Infinity;
  }, { passive: true });
  listen(doc, 'pointermove', event => {
    if (down?.id === event.pointerId && (!coordinates(event)
      || Math.hypot(event.clientX - down.x, event.clientY - down.y) > maximumTravel)) cancel();
  }, { passive: true });
  listen(doc, 'pointerup', event => {
    if (!down || down.id !== event.pointerId) return;
    const gesture = down; down = null;
    suppressPointerClick();
    if (!available(gesture.target) || control(event) !== gesture.target || !coordinates(event) || now() - gesture.time > maximumTapMs
      || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > maximumTravel) { cancel(); return; }
    completed = { target: gesture.target, id: gesture.id, time: now() };
  }, { passive: true });
  listen(doc, 'pointercancel', event => { if (down?.id === event.pointerId || completed?.id === event.pointerId) cancel(); }, { passive: true });
  listen(doc, 'keydown', event => {
    const button = control(event);
    if (!available(button) || !['Enter', ' '].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    keyboardRepeating = event.repeat === true;
    if (!keyboardRepeating) {
      down = completed = null;
      suppressCompatibilityUntil = -Infinity;
    }
  });
  listen(doc, 'keyup', event => { if (['Enter', ' '].includes(event.key)) keyboardRepeating = false; });
  listen(doc, 'click', event => {
    const button = control(event);
    if (!button || locked) return;
    if (!available(button) || event.defaultPrevented || event.button > 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      cancel(); return;
    }
    // Browser compatibility clicks may have isPrimary:false. Match the actual
    // pointer gesture, while detail:0 keeps native Enter/Space/AT activation.
    const pointerClick = completed?.target === button && now() - completed.time <= 500;
    if (!pointerClick && (event.detail !== 0 || event.pointerType || down || keyboardRepeating || now() < suppressCompatibilityUntil)) return;
    if (pointerClick) suppressPointerClick();
    completed = null;
    accept(button, event);
  });
  listen(view, 'scroll', () => { if (down || completed || count) cancel(); }, { passive: true });
  listen(view, 'blur', () => { keyboardRepeating = false; cancel(); });
  listen(doc, 'visibilitychange', () => { if (doc.hidden) { keyboardRepeating = false; cancel(); } });
  for (const name of ['h4:navigationstart', 'h4:pagechange', 'h4:modechange']) listen(doc, name, cancel);
  const dispose = () => { if (disposed) return; disposed = true; cancel(); for (const remove of removers) remove(); };
  Object.assign(dispose, { cancel, snapshot: () => ({ count, required: required(), locked, pending: Boolean(timer) }) });
  return dispose;
}
