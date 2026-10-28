/** A deliberate tap sequence; native scrolling and pointer capture stay with
 * the browser. Only a completed short gesture (or native keyboard activation)
 * counts. This binder owns no mode state, transition or sound implementation. */
export function bindModeTaps(doc, { selector = '[data-mobile-mode]', windowMs = 2000,
  maximumTravel = 12, maximumTapMs = 450, enabled = () => true, getMode,
  onPrepare = () => {}, onComplete, onProgress = () => {} } = {}) {
  const view = doc.defaultView;
  const removers = [];
  let down = null, completed = null, target = null, count = 0, started = 0, lastAccepted = 0, timer = 0, locked = false;
  let expired = null, expiryTimer = 0;
  let ignoreBefore = -Infinity;
  let suppressCompatibilityUntil = -Infinity;
  let keyboardRepeating = false;
  let disposed = false;
  windowMs = Number.isFinite(windowMs) ? Math.max(250, Math.min(5000, windowMs)) : 2000;
  maximumTravel = Number.isFinite(maximumTravel) ? Math.max(4, Math.min(30, maximumTravel)) : 12;
  maximumTapMs = Number.isFinite(maximumTapMs) ? Math.max(80, Math.min(1000, maximumTapMs)) : 450;
  const now = () => view.performance.now();
  // Input timestamps describe when the physical event happened. Expensive
  // rendering can delay dispatch without making a short tap a long hold.
  // Older Safari uses epoch milliseconds; other browsers use timeOrigin.
  const deliveryGraceMs = 5000;
  const timeOrigin = Number.isFinite(view.performance.timeOrigin)
    ? view.performance.timeOrigin : Date.now() - now();
  function eventTime(event) {
    const delivered = now();
    let stamp = event.timeStamp;
    if (!Number.isFinite(stamp) || stamp < 0) return delivered;
    if (stamp >= 1e12) stamp -= timeOrigin;
    // A missing/foreign timestamp retains the existing handler-time fallback.
    if (stamp < 0 || stamp > delivered + 2 || stamp === 0 && delivered > deliveryGraceMs) return delivered;
    if (delivered - stamp > deliveryGraceMs || stamp < ignoreBefore) return null;
    return Math.min(delivered, stamp);
  }
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
  function clearExpired() {
    view.clearTimeout(expiryTimer); expiryTimer = 0; expired = null;
  }
  function expireFeedback() {
    timer = 0;
    if (!target || !count || locked) return;
    const deadline = started + windowMs + deliveryGraceMs;
    if (now() < deadline) {
      expired = { target, count, started, lastAccepted, total: required(), deadline };
      expiryTimer = view.setTimeout(clearExpired, deadline - now());
    }
    const previousTarget = target;
    target = null; count = started = lastAccepted = 0;
    onProgress(previousTarget, 0, required());
    // Keep a completed pointerup until its matching queued click arrives.
    // UI expiry is not a scroll/focus/navigation cancellation.
  }
  function cancel() {
    if (down || completed) suppressPointerClick();
    keyboardRepeating = false;
    view.clearTimeout(timer);
    clearExpired();
    timer = 0; down = completed = null; locked = false;
    if (target) onProgress(target, 0, required());
    target = null; count = started = lastAccepted = 0;
  }
  function hardCancel() {
    ignoreBefore = now();
    cancel();
  }
  function accept(button, event) {
    if (!available(button) || locked) return;
    const time = eventTime(event);
    if (time === null) { cancel(); return; }
    if (count && (target !== button || time < lastAccepted || time - started >= windowMs)) cancel();
    if (!count && expired) {
      const prior = expired;
      clearExpired();
      if (prior.target === button && prior.total === required() && now() <= prior.deadline
        && time >= prior.lastAccepted && time - prior.started < windowMs) {
        ({ target, count, started, lastAccepted } = prior);
      }
    }
    if (!count) { target = button; started = time; onPrepare(event); }
    lastAccepted = time;
    const total = required();
    onProgress(button, ++count, total);
    if (count === total) {
      locked = true;
      view.clearTimeout(timer); timer = 0;
      try { onComplete(getMode() === 'xray' ? 'normal' : 'xray'); }
      catch (error) { cancel(); throw error; }
    } else if (!timer) timer = view.setTimeout(expireFeedback, Math.max(0, started + windowMs - now()));
  }
  listen(doc, 'pointerdown', event => {
    const button = control(event);
    completed = null;
    if (!button) { if (down || count || expired) cancel(); return; }
    if (locked) return;
    if (!available(button) || event.isPrimary === false || event.button !== 0 || !coordinates(event)) {
      suppressPointerClick(); cancel(); return;
    }
    if (down || target && target !== button || expired && expired.target !== button) cancel();
    const time = eventTime(event);
    if (time === null) { cancel(); return; }
    down = { target: button, id: event.pointerId, x: event.clientX, y: event.clientY, time };
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
    const time = eventTime(event);
    if (!available(gesture.target) || control(event) !== gesture.target || !coordinates(event) || time === null
      || time < gesture.time || time - gesture.time > maximumTapMs
      || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > maximumTravel) { cancel(); return; }
    completed = { target: gesture.target, id: gesture.id, time };
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
    const time = eventTime(event);
    const pointerClick = time !== null && completed?.target === button
      && time >= completed.time && time - completed.time <= 500;
    if (!pointerClick && (event.detail !== 0 || event.pointerType || down || keyboardRepeating || now() < suppressCompatibilityUntil)) return;
    if (pointerClick) suppressPointerClick();
    completed = null;
    accept(button, event);
  });
  listen(view, 'scroll', () => { if (down || completed || count || expired) hardCancel(); }, { passive: true });
  listen(view, 'blur', () => { keyboardRepeating = false; hardCancel(); });
  listen(doc, 'visibilitychange', () => { if (doc.hidden) { keyboardRepeating = false; hardCancel(); } });
  for (const name of ['h4:navigationstart', 'h4:pagechange', 'h4:modechange']) listen(doc, name, hardCancel);
  const dispose = () => { if (disposed) return; disposed = true; cancel(); for (const remove of removers) remove(); };
  Object.assign(dispose, { cancel: hardCancel, snapshot: () => ({ count, required: required(), locked, pending: Boolean(timer), retained: Boolean(expired) }) });
  return dispose;
}
