import './easter-eggs.css';
import { easterSettings, visitorMessage, nextVisit, canRememberVisits } from './data/easterSettings.js';

const interactive = 'a,button,input,textarea,select,label,form,nav,summary,canvas,dialog,[controls],[draggable="true"],[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="radio"],[role="tab"],[role="menuitem"],[role="combobox"],[role="slider"],[role="spinbutton"],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"]),[aria-disabled="true"],.is-unconfigured,[data-no-ink]';
const normalHint = 'PRESS 4 TO SEE THE OTHER SIDE.';
const foundHint = 'YOU FOUND THE OTHER SIDE.';
// Curved, broken pigment shapes with smaller printmaking fragments. No circles
// or generated artwork: these are tiny interface traces, not portfolio images.
const imprints = [
  '<path d="M24 19c7-4 6 4 14 1l8-9 7 12 13-4 1 12 13 3-8 12 8 9-12 4 1 15-13-2-8 12-9-12-13 3 1-13-12-5 9-11-9-10 13-4z" opacity=".74"/><path d="m7 28 8-3 3 5-6 5zm75-8 6 2-2 8-5-3zM16 73l8-4 3 6-6 4zm57 5 6 1 3 7-8 2zM41 3l5 4-1 6-5-5z" opacity=".45"/><path d="m33 34 9-3 3 6-8 5zm23 17 7 3-4 7-5-4z" opacity=".25"/>',
  '<path d="M33 15c8 5 9 3 15-5l4 15c8 0 11-6 17-1l-2 13 13 5-9 10 7 15-14-2-5 15-11-8-11 7-3-15-14-1 6-13-10-9 14-7c-3-7-4-13 3-19z" opacity=".72"/><path d="m8 47 8-4 5 4-5 5zm76 8 6-2 4 6-8 2zM23 83l5-4 6 8-7 3zM67 7l6 3-4 6-5-3zM46 88l8-4 2 8-7 2z" opacity=".4"/><path d="m28 41 8-3 2 6-8 3zm27-8 6 3-2 6-5-4z" opacity=".28"/>',
  '<path d="M30 14c9-4 7 6 15 6l10-8 4 13 16-1-4 14 10 9-12 8 6 14-15-1-6 14-11-9-11 5-4-14-13-5 11-10-7-12 13-6z" opacity=".76"/><path d="M9 21l7 2 3 6-8 1zm72 10 8-4 3 7-7 3zM8 66l9-2 4 6-9 3zm67 14 7 2-1 8-7-4zM33 3l6 2-3 7-5-4z" opacity=".44"/><path d="m34 50 9-2 1 7-7 3zm18-16 8 2-3 7-7-3z" opacity=".24"/>',
];

/**
 * Ephemeral UI only by default. A real consent integration must explicitly
 * enable visits AND supply a synchronous hasVisitorConsent() returning true.
 */
export function initEasterEggs(root = document, { settings = easterSettings, hasVisitorConsent = () => false, storage } = {}) {
  const pageDocument = root.ownerDocument || root;
  const view = pageDocument.defaultView || window;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const removers = [];
  const marks = new Map();
  const hintTimers = new Map();
  let candidate = null;
  let layer = null;
  let disposed = false;
  let authorized = false;
  let visitStorage = null;
  let visit = { count: 1, lastSeen: Date.now() };
  let lastWrite = 0;

  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    removers.push(() => target.removeEventListener(type, callback, options));
  }

  function updateFooters() {
    for (const element of root.querySelectorAll('[data-visit-message]')) element.textContent = visitorMessage(visit.count);
    for (const element of root.querySelectorAll('[data-visit-number]')) element.textContent = `visit ${String(visit.count).padStart(3, '0')}`;
  }

  function consentGranted() {
    if (settings.visits.enabled !== true) return false;
    try { return hasVisitorConsent() === true; } catch { return false; }
  }

  function forgetVisitorMemory() {
    if (authorized && visitStorage) {
      try { visitStorage.removeItem(settings.visits.storageKey); } catch { /* Best-effort deletion after consent withdrawal. */ }
    }
    authorized = false;
    visitStorage = null;
    visit = { count: 1, lastSeen: Date.now() };
    updateFooters();
  }

  function writeVisit() {
    if (!authorized || !visitStorage) return;
    // Recheck at every write as well as the integration's privacy-change event.
    if (!canRememberVisits(settings.visits, consentGranted())) { forgetVisitorMemory(); return; }
    try { visitStorage.setItem(settings.visits.storageKey, JSON.stringify(visit)); lastWrite = Date.now(); } catch { /* Storage may be denied or full. */ }
  }

  function readVisit() {
    if (!authorized || !visitStorage) return null;
    if (!canRememberVisits(settings.visits, consentGranted())) { forgetVisitorMemory(); return null; }
    try { return JSON.parse(visitStorage.getItem(settings.visits.storageKey)); } catch { return null; }
  }

  function refreshConsent() {
    if (!canRememberVisits(settings.visits, consentGranted())) { forgetVisitorMemory(); return; }
    if (authorized) return;
    try {
      // Do not even access localStorage's getter until both gates are satisfied.
      visitStorage = storage || view.localStorage;
      authorized = Boolean(visitStorage);
      if (authorized) {
        visit = nextVisit(readVisit(), Date.now(), settings.visits.separatedVisitMs);
        writeVisit();
      }
    } catch { authorized = false; visitStorage = null; }
    updateFooters();
  }

  function activity({ flush = false } = {}) {
    if (!authorized) return;
    visit.lastSeen = Date.now();
    if (flush || visit.lastSeen - lastWrite >= settings.visits.writeIntervalMs) writeVisit();
  }

  function forgetMark(mark) {
    const record = marks.get(mark);
    if (!record) return;
    clearTimeout(record.timer);
    mark.removeEventListener('animationend', record.finish);
    marks.delete(mark);
    mark.remove();
  }

  function clearMarks() { for (const mark of marks.keys()) forgetMark(mark); }

  function imprint(event, heldMs) {
    if (disposed || !settings.ink.enabled) return;
    if (!layer) {
      layer = pageDocument.createElement('div');
      layer.className = 'ink-layer';
      layer.setAttribute('aria-hidden', 'true');
      pageDocument.body.append(layer);
    }
    while (marks.size >= Math.max(1, settings.ink.maximumMarks)) forgetMark(marks.keys().next().value);
    const random = Math.random();
    const size = settings.ink.minimumSize + random * (settings.ink.maximumSize - settings.ink.minimumSize);
    const lifetime = settings.ink.minimumLifetimeMs + Math.random() * (settings.ink.maximumLifetimeMs - settings.ink.minimumLifetimeMs);
    const mark = pageDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mark.classList.add('ink-mark');
    mark.setAttribute('data-ink-mark', '');
    mark.setAttribute('data-pigment', String(1 + Math.floor(Math.random() * 4)));
    mark.setAttribute('viewBox', '0 0 100 100');
    mark.setAttribute('focusable', 'false');
    mark.innerHTML = imprints[Math.floor(Math.random() * imprints.length)];
    mark.style.left = `${event.clientX}px`;
    mark.style.top = `${event.clientY}px`;
    mark.style.setProperty('--ink-size', `${size * (1 + Math.min(heldMs / 1600, .5))}px`);
    mark.style.setProperty('--ink-angle', `${Math.round(Math.random() * 360)}deg`);
    mark.style.setProperty('--ink-lifetime', `${lifetime}ms`);
    const finish = () => forgetMark(mark);
    const timer = setTimeout(finish, lifetime + 50);
    marks.set(mark, { finish, timer });
    mark.addEventListener('animationend', finish, { once: true });
    layer.append(mark);
  }

  function ignore(target) { return !(target instanceof view.Element) || Boolean(target.closest(interactive)); }

  function pointerDown(event) {
    activity();
    if (!settings.ink.enabled || !event.isPrimary || event.button !== 0 || ignore(event.target)) { candidate = null; return; }
    candidate = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), scrollX: view.scrollX, scrollY: view.scrollY };
  }

  function pointerMove(event) {
    if (!candidate || event.pointerId !== candidate.id) return;
    if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > settings.ink.maximumPointerTravel) candidate = null;
  }

  function pointerUp(event) {
    if (!candidate || event.pointerId !== candidate.id) return;
    const down = candidate;
    candidate = null;
    if (ignore(event.target) || Math.hypot(event.clientX - down.x, event.clientY - down.y) > settings.ink.maximumPointerTravel
      || Math.abs(view.scrollX - down.scrollX) + Math.abs(view.scrollY - down.scrollY) > 2
      || pageDocument.getSelection()?.isCollapsed === false) return;
    imprint(event, performance.now() - down.started);
  }

  function clearHintTimer(hint) {
    const timers = hintTimers.get(hint);
    if (!timers) return;
    for (const timer of timers) clearTimeout(timer);
    hintTimers.delete(hint);
  }

  function revealHint(hint, text = normalHint) {
    if (!hint) return;
    clearHintTimer(hint);
    const label = hint.querySelector('[data-xray-hint-text]');
    if (label) label.textContent = text;
    hint.classList.add('is-discovered');
    const hide = setTimeout(() => {
      hint.classList.remove('is-discovered');
      const restore = setTimeout(() => {
        if (label) label.textContent = normalHint;
        hintTimers.delete(hint);
      }, reduced.matches ? 0 : settings.hint.fadeMs);
      hintTimers.set(hint, [restore]);
    }, settings.hint.visibleMs + (reduced.matches ? 0 : settings.hint.fadeMs));
    hintTimers.set(hint, [hide]);
  }

  function hintTarget(event) {
    return event.target instanceof view.Element ? event.target.closest('[data-xray-toggle]') : null;
  }

  listen(root, 'pointerdown', pointerDown, { passive: true });
  listen(root, 'pointermove', pointerMove, { passive: true });
  listen(root, 'pointerup', pointerUp, { passive: true });
  listen(root, 'pointercancel', () => { candidate = null; }, { passive: true });
  listen(root, 'keydown', () => activity(), { passive: true });
  listen(root, 'pointerover', (event) => {
    const button = hintTarget(event);
    if (!button || button.contains(event.relatedTarget)) return;
    revealHint(button.querySelector('[data-xray-hint]'));
  }, { passive: true });
  listen(root, 'h4:modechange', (event) => {
    if (event.detail?.mode === 'xray') {
      for (const hint of root.querySelectorAll('[data-xray-hint]')) revealHint(hint, foundHint);
    } else if (event.detail?.mode === 'normal') {
      for (const hint of root.querySelectorAll('[data-xray-hint]')) {
        clearHintTimer(hint);
        hint.classList.remove('is-discovered');
        const label = hint.querySelector('[data-xray-hint-text]');
        if (label) label.textContent = normalHint;
      }
    }
  });
  listen(root, 'h4:pagechange', () => {
    for (const hint of hintTimers.keys()) if (!hint.isConnected) clearHintTimer(hint);
    updateFooters();
    candidate = null;
    clearMarks();
  });
  listen(root, 'h4:privacychange', refreshConsent);
  listen(pageDocument, 'visibilitychange', () => {
    candidate = null;
    if (pageDocument.hidden) { activity({ flush: true }); clearMarks(); }
    else if (authorized) {
      visit = nextVisit(readVisit(), Date.now(), settings.visits.separatedVisitMs);
      writeVisit();
      updateFooters();
    }
  });
  listen(view, 'pagehide', () => { if (!pageDocument.hidden) activity({ flush: true }); });
  listen(view, 'blur', () => { candidate = null; });
  listen(reduced, 'change', clearMarks);
  refreshConsent();

  return () => {
    disposed = true;
    candidate = null;
    for (const remove of removers) remove();
    clearMarks();
    layer?.remove();
    for (const hint of hintTimers.keys()) {
      clearHintTimer(hint);
      hint.classList.remove('is-discovered');
      const label = hint.querySelector('[data-xray-hint-text]');
      if (label) label.textContent = normalHint;
    }
    if (authorized) activity({ flush: true });
    authorized = false;
    visitStorage = null;
  };
}
