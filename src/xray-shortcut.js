import { isXRayShortcut, isModeDigit, xraySettings } from './data/xraySettings.js';

/** A single hold timer; user audio is primed inside the initial key gesture. */
export function bindXRayShortcut(doc, activate, { onStart = () => {}, onEnd = () => {}, isEnabled = () => true } = {}) {
  const view = doc.defaultView;
  const removers = [];
  let held = null;
  let timer = 0;
  const listen = (target, name, handler) => {
    target.addEventListener(name, handler);
    removers.push(() => target.removeEventListener(name, handler));
  };
  const cancel = () => {
    view.clearTimeout(timer);
    timer = 0;
    if (held && !held.completed) onEnd('cancel');
    held = null;
  };
  const matches = (event) => held && (held.code ? event.code === held.code : event.key === held.key);
  const eligible = () => isEnabled() && !doc.hidden && isXRayShortcut({ key: '4', target: doc.activeElement }, doc.activeElement);
  const finish = () => {
    timer = 0;
    if (!held || !eligible()) { cancel(); return; }
    const remaining = xraySettings.shortcutHoldMs - (view.performance.now() - held.started);
    if (remaining > 0) { timer = view.setTimeout(finish, remaining); return; }
    // Keep the key latched until release: browser key repeat cannot toggle twice.
    held.completed = true;
    onEnd('complete');
    activate();
  };
  listen(doc, 'keydown', (event) => {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) { cancel(); return; }
    if (held) {
      if (matches(event)) event.preventDefault();
      return;
    }
    if (!isEnabled() || doc.hidden || !isXRayShortcut(event, doc.activeElement)) return;
    event.preventDefault();
    held = { key: event.key, code: event.code, started: view.performance.now() };
    onStart(event);
    timer = view.setTimeout(finish, xraySettings.shortcutHoldMs);
  });
  listen(doc, 'keyup', (event) => { if (matches(event)) cancel(); });
  listen(view, 'blur', cancel);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) cancel(); });
  listen(doc, 'compositionstart', cancel);
  listen(doc, 'focusin', () => { if (!eligible()) cancel(); });
  listen(doc, 'h4:pagechange', cancel);
  listen(doc, 'h4:navigationstart', cancel);
  const dispose = () => {
    cancel();
    for (const remove of removers) remove();
  };
  dispose.cancel = cancel;
  return dispose;
}

/** Three released presses inside one fixed window, active only on the Other Side.
 * No repeat, overlapping physical keys or stale sequence can count as a press.
 */
export function bindReverseShortcut(doc, reverse, { isEnabled = () => true, onStart = () => {} } = {}) {
  const view = doc.defaultView;
  const removers = [];
  let held = null;
  let count = 0;
  let started = 0;
  let timer = 0;
  const listen = (target, name, handler) => {
    target.addEventListener(name, handler);
    removers.push(() => target.removeEventListener(name, handler));
  };
  const resetSequence = () => { view.clearTimeout(timer); timer = 0; count = 0; started = 0; };
  const cancel = () => { held = null; resetSequence(); };
  const eligible = () => !doc.hidden && isEnabled() && isModeDigit({ key: '3', target: doc.activeElement }, '3', doc.activeElement);
  listen(doc, 'keydown', event => {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) { cancel(); return; }
    if (!eligible()) { cancel(); return; }
    if (!isModeDigit(event, '3', doc.activeElement)) return;
    event.preventDefault();
    if (held !== null) return;
    held = event.code || event.key;
    const now = view.performance.now();
    if (count && now - started >= xraySettings.reverseWindowMs) resetSequence();
    if (!count) {
      started = now;
      timer = view.setTimeout(resetSequence, xraySettings.reverseWindowMs);
    }
    onStart(event);
    if (++count === xraySettings.reversePresses) {
      resetSequence();
      reverse();
    }
  });
  listen(doc, 'keyup', event => { if ((event.code || event.key) === held) held = null; });
  listen(view, 'blur', cancel);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) cancel(); });
  listen(doc, 'compositionstart', cancel);
  listen(doc, 'focusin', () => { if (!eligible()) cancel(); });
  listen(doc, 'h4:pagechange', cancel);
  listen(doc, 'h4:navigationstart', cancel);
  listen(doc, 'h4:modechange', cancel);
  const dispose = () => { cancel(); for (const remove of removers) remove(); };
  dispose.cancel = cancel;
  return dispose;
}
