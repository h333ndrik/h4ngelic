import './easter-eggs.css';
import { easterSettings, visitorMessage, nextVisit, canRememberVisits } from './data/easterSettings.js';
import { createInkImprint } from './ink-imprint.js';
import { createTouchInkSampler } from './touch-ink.js';
import { isExposedHeroBackground } from './hero-background-ink.js';

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
  const touchSettings = settings.ink.touch;
  let touchSampler = createTouchInkSampler(touchSettings);
  let touching = null;
  let touchFrame = 0;
  let touchProtected = null;

  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    removers.push(() => target.removeEventListener(type, callback, options));
  }

  function updateVisitorCopy() {
    for (const element of root.querySelectorAll('[data-visit-message]')) element.textContent = visitorMessage(visit.count);
    for (const element of root.querySelectorAll('[data-visit-number]')) element.textContent = `visit ${visit.count}`;
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

  function protectedBounds() {
    const hint = root.querySelector('[data-other-side-hint]');
    const rect = hint?.getBoundingClientRect();
    return rect?.width && rect.height ? { left: rect.left + view.scrollX, right: rect.right + view.scrollX,
      top: rect.top + view.scrollY, bottom: rect.bottom + view.scrollY } : null;
  }

  const intersectsHint = (record, bounds) => bounds && record.x + record.extent > bounds.left
    && record.x - record.extent < bounds.right && record.y + record.extent > bounds.top && record.y - record.extent < bounds.bottom;

  function readTouchProtected() {
    return [...root.querySelectorAll('[data-mobile-mode], [data-other-side-hint], [data-corruption-protected]')].flatMap(element => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      const fixed = view.getComputedStyle(element).position === 'fixed';
      return [{ fixed, left: rect.left + (fixed ? 0 : view.scrollX), right: rect.right + (fixed ? 0 : view.scrollX),
        top: rect.top + (fixed ? 0 : view.scrollY), bottom: rect.bottom + (fixed ? 0 : view.scrollY) }];
    });
  }

  function imprint(event, heldMs, { touch = false } = {}) {
    if (disposed || !settings.ink.enabled || pageDocument.documentElement.dataset.mode === 'xray') return;
    const random = Math.random();
    const size = settings.ink.minimumSize + random * (settings.ink.maximumSize - settings.ink.minimumSize);
    const lifetimeSettings = touch ? touchSettings : settings.ink;
    const lifetime = lifetimeSettings.minimumLifetimeMs + Math.random() * (lifetimeSettings.maximumLifetimeMs - lifetimeSettings.minimumLifetimeMs);
    const scale = 1 + Math.min(heldMs / 1600, .5);
    const position = { x: event.clientX + view.scrollX, y: event.clientY + view.scrollY,
      extent: size * scale * .8 + (settings.ink.otherGlowPx || 6) * 2 };
    // Touch geometry is measured at gesture start, not on move/scroll. The
    // fixed logo's bounds stay in viewport coordinates as the page moves.
    const protectedAreas = touch ? (touchProtected ?? readTouchProtected()).map(bounds => bounds.fixed ? {
      left: bounds.left + view.scrollX, right: bounds.right + view.scrollX,
      top: bounds.top + view.scrollY, bottom: bounds.bottom + view.scrollY,
    } : bounds) : [protectedBounds()];
    if (protectedAreas.some(bounds => intersectsHint(position, bounds))) return;
    if (!layer) {
      layer = pageDocument.createElement('div');
      layer.className = 'ink-layer';
      layer.setAttribute('aria-hidden', 'true');
      pageDocument.body.append(layer);
    }
    while (marks.size >= Math.max(1, settings.ink.maximumMarks)) forgetMark(marks.keys().next().value);
    const mark = pageDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mark.classList.add('ink-mark');
    mark.setAttribute('data-ink-mark', '');
    if (touch) {
      mark.setAttribute('data-touch-ink', '');
      for (const [key, value] of Object.entries({ clientX: event.clientX, clientY: event.clientY,
        scrollX: view.scrollX, scrollY: view.scrollY })) mark.dataset[`touch${key[0].toUpperCase()}${key.slice(1)}`] = String(value);
    }
    mark.setAttribute('data-pigment', String(1 + Math.floor(Math.random() * 4)));
    mark.setAttribute('viewBox', '0 0 100 100');
    mark.setAttribute('focusable', 'false');
    mark.innerHTML = createInkImprint(Math.random, { pressure: Math.min(heldMs / 1600, 1), texture: settings.ink.texture });
    mark.style.left = `${position.x}px`;
    mark.style.top = `${position.y}px`;
    mark.style.setProperty('--ink-size', `${size * scale}px`);
    mark.style.setProperty('--ink-angle', `${Math.round(Math.random() * 360)}deg`);
    mark.style.setProperty('--ink-lifetime', `${lifetime}ms`);
    const colors = touch ? touchSettings.palette : settings.ink.palette;
    const offset = Math.floor(Math.random() * colors.length);
    mark.style.setProperty('--ink-primary', colors[offset]);
    for (let index = 1; index <= 3; index++) mark.style.setProperty(`--ink-accent-${index}`, colors[(offset + index) % colors.length]);
    mark.style.setProperty('--ink-texture-opacity', String(settings.ink.textureOpacity));
    mark.style.setProperty('--ink-other-texture-opacity', String(settings.ink.otherTextureOpacity));
    mark.style.setProperty('--ink-smear-distance', `${settings.ink.smearDistance}px`);
    mark.style.setProperty('--ink-fracture-duration', `${settings.ink.fractureMs}ms`);
    mark.style.setProperty('--ink-glow', `${settings.ink.glowPx}px`);
    mark.style.setProperty('--ink-other-glow', `${settings.ink.otherGlowPx}px`);
    const finish = (event) => { if (event.target === mark) forgetMark(mark); };
    const timer = setTimeout(() => forgetMark(mark), lifetime + 50);
    marks.set(mark, { finish, timer, ...position });
    // Child tear animations end first and must not consume the lifetime listener.
    mark.addEventListener('animationend', finish);
    layer.append(mark);
  }

  function ignore(target, event) {
    if (event && isExposedHeroBackground(event)) return false;
    return !(target instanceof view.Element) || Boolean(target.closest(interactive));
  }

  function pointerDown(event) {
    activity();
    if (pageDocument.documentElement.dataset.mode === 'xray') { candidate = null; return; }
    if (!settings.ink.enabled || !event.isPrimary || event.button !== 0 || ignore(event.target, event)) { candidate = null; return; }
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
    if (ignore(event.target, event) || Math.hypot(event.clientX - down.x, event.clientY - down.y) > settings.ink.maximumPointerTravel
      || Math.abs(view.scrollX - down.scrollX) + Math.abs(view.scrollY - down.scrollY) > 2
      || pageDocument.getSelection()?.isCollapsed === false) return;
    imprint(event, performance.now() - down.started, { touch: event.pointerType === 'touch' && Boolean(touchSettings?.enabled) });
  }

  function clearTouch() {
    touching = null;
    touchSampler.end();
    if (touchFrame) view.cancelAnimationFrame(touchFrame);
    touchFrame = 0;
    touchProtected = null;
  }

  function sampleTouch() {
    touchFrame = 0;
    if (!touching || disposed || pageDocument.hidden) return;
    // A sculpture grab stays clean. Only its native vertical page pan can
    // create traces; no geometry lookup or pointer-capture interception.
    if (touching.canvas && Math.abs(view.scrollY - touching.startScrollY) < 2) return;
    const sample = touchSampler.sample({ id: touching.id, x: touching.x, y: touching.y,
      scrollX: view.scrollX, scrollY: view.scrollY, time: view.performance.now() });
    if (sample) imprint(sample, 0, { touch: true });
  }

  function scheduleTouch() {
    if (touching && !touchFrame && !disposed && !pageDocument.hidden) touchFrame = view.requestAnimationFrame(sampleTouch);
  }

  function touchStart(event) {
    clearTouch();
    if (pageDocument.documentElement.dataset.mode === 'xray') return;
    if (!settings.ink.enabled || !touchSettings?.enabled || event.touches.length !== 1 || pageDocument.hidden) return;
    const target = event.target;
    const heroCanvas = target instanceof view.Element && target.matches('#logo-canvas');
    if (ignore(target) && !heroCanvas) return;
    const finger = event.touches[0];
    touchProtected = readTouchProtected();
    touchSampler = createTouchInkSampler({ ...touchSettings,
      minimumIntervalMs: reduced.matches ? Math.max(320, touchSettings.minimumIntervalMs) : touchSettings.minimumIntervalMs });
    touching = { id: finger.identifier, x: finger.clientX, y: finger.clientY, canvas: heroCanvas, startScrollY: view.scrollY };
    touchSampler.begin({ id: touching.id, x: touching.x, y: touching.y,
      scrollX: view.scrollX, scrollY: view.scrollY, time: view.performance.now() });
  }

  function touchMove(event) {
    if (!touching) return;
    if (event.touches.length !== 1) return clearTouch();
    const finger = [...event.touches].find(item => item.identifier === touching.id);
    if (!finger) return clearTouch();
    touching.x = finger.clientX;
    touching.y = finger.clientY;
    scheduleTouch();
  }

  function touchEnd(event) {
    if (touching && ![...event.touches].some(item => item.identifier === touching.id)) clearTouch();
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
    const hideAfter = settings.hint.visibleMs
      + (hotspot.hasAttribute('data-other-side-hint') || reduced.matches ? 0 : settings.hint.fadeMs);
    const hide = setTimeout(() => {
      message.classList.remove('is-discovered');
      hintTimers.delete(message);
    }, hideAfter);
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
  // Native TouchEvents continue through the pointercancel that begins a page
  // pan. All listeners are passive; only live fingers can schedule stamps.
  listen(root, 'touchstart', touchStart, { passive: true });
  listen(root, 'touchmove', touchMove, { passive: true });
  listen(root, 'touchend', touchEnd, { passive: true });
  listen(root, 'touchcancel', clearTouch, { passive: true });
  listen(view, 'scroll', scheduleTouch, { passive: true });
  listen(view, 'resize', clearTouch, { passive: true });
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
  listen(root, 'focusin', (event) => {
    const hotspot = secretTarget(event);
    if (hotspot) revealSecret(hotspot);
  });
  listen(root, 'h4:pagechange', () => {
    clearSecrets();
    updateVisitorCopy();
    candidate = null;
    clearTouch();
    clearMarks();
  });
  listen(root, 'h4:navigationstart', clearTouch);
  listen(root, 'h4:modechange', () => {
    clearTouch();
    candidate = null;
    if (pageDocument.documentElement.dataset.mode === 'xray') { clearMarks(); return; }
    const bounds = protectedBounds();
    // The larger Other Side hint can intersect a mark that was safe before it.
    for (const [mark, record] of marks) if (intersectsHint(record, bounds)) forgetMark(mark);
  });
  listen(root, 'h4:privacychange', refreshConsent);
  listen(pageDocument, 'visibilitychange', () => {
    candidate = null;
    clearTouch();
    if (pageDocument.hidden) { activity({ flush: true }); clearMarks(); clearSecrets(); }
    else if (authorized) {
      visit = nextVisit(readVisit(), Date.now(), settings.visits.separatedVisitMs);
      writeVisit();
      updateVisitorCopy();
    }
  });
  listen(view, 'pagehide', () => { if (!pageDocument.hidden) activity({ flush: true }); });
  listen(view, 'blur', () => { candidate = null; clearTouch(); });
  listen(reduced, 'change', () => { clearMarks(); clearTouch(); });
  refreshConsent();

  return () => {
    disposed = true;
    candidate = null;
    clearTouch();
    for (const remove of removers) remove();
    clearMarks();
    layer?.remove();
    clearSecrets();
    if (authorized) activity({ flush: true });
    authorized = false;
    visitStorage = null;
  };
}
