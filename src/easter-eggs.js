import './easter-eggs.css';
import { easterSettings, visitorMessage, nextVisit, canRememberVisits } from './data/easterSettings.js';
import { createInkImprint } from './ink-imprint.js';

const interactive = 'a,button,input,textarea,select,label,form,nav,summary,canvas,dialog,[controls],[draggable="true"],[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="radio"],[role="tab"],[role="menuitem"],[role="combobox"],[role="slider"],[role="spinbutton"],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"]),[aria-disabled="true"],.is-unconfigured,[data-no-ink]';
/** Local count/last activity only. A host can opt out or require a consent gate. */
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

  function updateVisitorCopy() {
    for (const element of root.querySelectorAll('[data-visit-message]')) element.textContent = visitorMessage(visit.count);
    for (const element of root.querySelectorAll('[data-visit-number]')) element.textContent = `VISIT ${String(visit.count).padStart(3, '0')}`;
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
    updateVisitorCopy();
  }

  function writeVisit() {
    if (!authorized || !visitStorage) return;
    // Recheck at every write as well as the integration's privacy-change event.
    if (!canRememberVisits(settings.visits, consentGranted())) { forgetVisitorMemory(); return; }
    try { visitStorage.setItem(settings.visits.storageKey, JSON.stringify(visit)); lastWrite = Date.now(); }
    catch { authorized = false; visitStorage = null; /* Retain the in-memory greeting when storage is unavailable. */ }
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
      // An opted-out or consent-gated host does not even access the getter.
      visitStorage = storage || view.localStorage;
      authorized = Boolean(visitStorage);
      if (authorized) {
        visit = nextVisit(readVisit(), Date.now(), settings.visits.separatedVisitMs);
        writeVisit();
      }
    } catch { authorized = false; visitStorage = null; }
    updateVisitorCopy();
  }

  function activity({ flush = false } = {}) {
    if (!authorized) return;
    const now = Date.now();
    // Return after a long idle interval is a new visit, not a page view. Merge
    // the local record with storage so another open tab cannot lower the count.
    if (now - visit.lastSeen >= settings.visits.separatedVisitMs) {
      const stored = readVisit();
      if (!authorized) return;
      const source = stored && Number.isSafeInteger(stored.count) && stored.count >= visit.count
        && Number.isFinite(stored.lastSeen) && stored.lastSeen >= 0 ? stored : visit;
      visit = nextVisit(source, now, settings.visits.separatedVisitMs);
      updateVisitorCopy();
      flush = true;
    } else visit.lastSeen = now;
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
    mark.innerHTML = createInkImprint(Math.random, { pressure: Math.min(heldMs / 1600, 1) });
    mark.style.left = `${event.clientX + view.scrollX}px`;
    mark.style.top = `${event.clientY + view.scrollY}px`;
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

  function revealSecret(hotspot) {
    const message = hotspot?.querySelector('[data-secret-message]');
    if (!message || disposed) return;
    clearHintTimer(message);
    message.classList.add('is-discovered');
    const hide = setTimeout(() => {
      message.classList.remove('is-discovered');
      hintTimers.delete(message);
    }, settings.hint.visibleMs + (reduced.matches ? 0 : settings.hint.fadeMs));
    hintTimers.set(message, [hide]);
  }

  function secretTarget(event) {
    return event.target instanceof view.Element ? event.target.closest('[data-secret-hotspot]') : null;
  }

  function clearSecrets() {
    for (const message of hintTimers.keys()) {
      clearHintTimer(message);
      message.classList.remove('is-discovered');
    }
  }

  listen(root, 'pointerdown', pointerDown, { passive: true });
  listen(root, 'pointermove', pointerMove, { passive: true });
  listen(root, 'pointerup', pointerUp, { passive: true });
  listen(root, 'pointercancel', () => { candidate = null; }, { passive: true });
  listen(root, 'keydown', () => activity(), { passive: true });
  listen(root, 'pointerover', (event) => {
    const hotspot = secretTarget(event);
    if (!hotspot || event.pointerType === 'touch' || hotspot.contains(event.relatedTarget)) return;
    revealSecret(hotspot);
  }, { passive: true });
  listen(root, 'click', (event) => {
    const hotspot = secretTarget(event);
    if (hotspot) revealSecret(hotspot);
  });
  listen(root, 'h4:pagechange', () => {
    clearSecrets();
    updateVisitorCopy();
    candidate = null;
    clearMarks();
  });
  listen(root, 'h4:privacychange', refreshConsent);
  listen(pageDocument, 'visibilitychange', () => {
    candidate = null;
    if (pageDocument.hidden) { activity({ flush: true }); clearMarks(); clearSecrets(); }
    else if (authorized) {
      visit = nextVisit(readVisit(), Date.now(), settings.visits.separatedVisitMs);
      writeVisit();
      updateVisitorCopy();
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
    clearSecrets();
    if (authorized) activity({ flush: true });
    authorized = false;
    visitStorage = null;
  };
}
