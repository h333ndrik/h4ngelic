import { isXRayShortcut, xraySettings } from './data/xraySettings.js';

/** A single hold timer, installed only with the postponed mode controller. */
export function bindXRayShortcut(doc, activate) {
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
    held = null;
  };
  const matches = (event) => held && (held.code ? event.code === held.code : event.key === held.key);
  const eligible = () => !doc.hidden && isXRayShortcut({ key: '4', target: doc.activeElement }, doc.activeElement);
  const finish = () => {
    timer = 0;
    if (!held || !eligible()) { cancel(); return; }
    const remaining = xraySettings.shortcutHoldMs - (view.performance.now() - held.started);
    if (remaining > 0) { timer = view.setTimeout(finish, remaining); return; }
    // Keep the key latched until release: browser key repeat cannot toggle twice.
    activate();
  };
  listen(doc, 'keydown', (event) => {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) { cancel(); return; }
    if (held) {
      if (matches(event)) event.preventDefault();
      return;
    }
    if (doc.hidden || !isXRayShortcut(event, doc.activeElement)) return;
    event.preventDefault();
    held = { key: event.key, code: event.code, started: view.performance.now() };
    timer = view.setTimeout(finish, xraySettings.shortcutHoldMs);
  });
  listen(doc, 'keyup', (event) => { if (matches(event)) cancel(); });
  listen(view, 'blur', cancel);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) cancel(); });
  listen(doc, 'compositionstart', cancel);
  listen(doc, 'focusin', () => { if (!eligible()) cancel(); });
  listen(doc, 'h4:pagechange', cancel);
  return () => {
    cancel();
    for (const remove of removers) remove();
  };
}
