/** Guided listening around the existing SOUND switch: state-only unlock on the
 * standard gesture set, then one of three pointer/scroll entry points fades the
 * active world in. No play button, no autoplay, no fetch during unlock. */

const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'];
const WORDMARK_SELECTOR = '#stage, #logo-canvas, [data-hero-poster]';
const MOVE_THRESHOLD_PX = 200;
const MOVE_THROTTLE_MS = 100;
const SCROLL_THROTTLE_MS = 120;
const HINT_KEY = 'h4ngelic.sound.ios-hint.v1';

function isIOS(view) {
  const navigator = view?.navigator;
  if (!navigator) return false;
  const platform = navigator.platform || '';
  const userAgent = navigator.userAgent || '';
  return /iP(hone|od|ad)/.test(platform)
    || /iPhone|iPad|iPod/.test(userAgent)
    || (/Macintosh/.test(platform) && (navigator.maxTouchPoints || 0) > 1);
}

export function initGuidedListening({ doc = document, audio, fadeSeconds = 1.8, hintMs = 6000 } = {}) {
  if (!audio) throw new TypeError('Guided listening needs the central audio controller.');
  const view = doc.defaultView;
  const perf = Array.isArray(view.__H4_AUDIO_PERF__) ? view.__H4_AUDIO_PERF__ : null;
  const initStarted = perf ? performance.now() : 0;
  const coarse = view.matchMedia?.('(pointer: coarse)');
  const removers = [];
  const unlockRemovers = [];
  let disposed = false;
  let unlocked = false;
  let played = false;
  let anchor = null;
  let lastMoveCheck = 0;
  let lastScrollCheck = 0;
  let hintShown = false;
  let hintTimer = 0;
  let heroObserver = null;
  let fallbackScroll = false;

  const listen = (target, name, callback, options, registry = removers) => {
    target.addEventListener(name, callback, options);
    registry.push(() => target.removeEventListener(name, callback, options));
  };
  const detachUnlock = () => {
    for (const remove of unlockRemovers.splice(0)) remove();
  };

  function unlock(event) {
    if (disposed || unlocked || event?.isTrusted !== true) return false;
    if (!audio.unlock(event)) return false;
    unlocked = true;
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      anchor = { x: event.clientX, y: event.clientY };
    }
    detachUnlock();
    ensureHeroObserver();
    return true;
  }

  function showIOSHint() {
    if (hintShown || !isIOS(view)) return;
    try { if (view.localStorage?.getItem(HINT_KEY) === 'shown') return; } catch { /* storage denial */ }
    const button = doc.querySelector('[data-mode-mute]');
    const wrapper = button?.closest?.('.sound-control') || button?.parentElement;
    if (!wrapper) return;
    hintShown = true;
    try { view.localStorage?.setItem(HINT_KEY, 'shown'); } catch { /* storage denial */ }
    const hint = doc.createElement('span');
    hint.className = 'sound-ios-hint';
    hint.dataset.soundIosHint = '';
    hint.textContent = 'hearing nothing? check the silent switch.';
    wrapper.append(hint);
    hintTimer = view.setTimeout(() => {
      hintTimer = 0;
      hint.remove();
    }, hintMs);
  }

  function trigger(event) {
    if (disposed || played) return;
    played = true;
    const result = audio.startListening(event, { fadeSeconds });
    void Promise.resolve(result).then((ready) => { if (ready) showIOSHint(); });
  }

  for (const name of UNLOCK_EVENTS) {
    listen(doc, name, unlock, { once: true, passive: true, capture: true }, unlockRemovers);
  }

  // Stage 1: the chrome hero wordmark (canvas, poster or its stage container).
  listen(doc, 'pointerdown', (event) => {
    if (event.isPrimary === false || event.button !== 0) return;
    const target = event.target?.closest?.(WORDMARK_SELECTOR);
    if (!target || !target.closest?.('.hero')) return;
    unlock(event);
    trigger(event);
  }, { passive: true, capture: true });

  // Stage 2: desktop catch-all, throttled and only after a real 200 px travel.
  listen(view, 'pointermove', (event) => {
    if (!unlocked || played || coarse?.matches || event.pointerType === 'touch') return;
    const now = view.performance?.now?.() ?? Date.now();
    if (now - lastMoveCheck < MOVE_THROTTLE_MS) return;
    lastMoveCheck = now;
    if (!anchor) { anchor = { x: event.clientX, y: event.clientY }; return; }
    if (Math.hypot(event.clientX - anchor.x, event.clientY - anchor.y) <= MOVE_THRESHOLD_PX) return;
    trigger(event);
  }, { passive: true });

  // Stage 3: the first scroll that takes the hero out of view (touch + desktop).
  // IntersectionObserver observes visibility only; no per-scroll layout reads.
  function ensureHeroObserver() {
    if (heroObserver || fallbackScroll) return;
    const hero = doc.getElementById('home-hero') || doc.querySelector('.hero');
    if (!hero) return;
    if (typeof view.IntersectionObserver === 'function') {
      heroObserver = new view.IntersectionObserver((entries) => {
        if (!unlocked || played) return;
        for (const entry of entries) {
          if (entry.isIntersecting) continue;
          if (entry.boundingClientRect?.bottom > 0) continue;
          if (entry.boundingClientRect?.height <= 0) continue;
          trigger({ isTrusted: true });
          return;
        }
      }, { threshold: 0 });
      heroObserver.observe(hero);
      return;
    }
    fallbackScroll = true;
    listen(view, 'scroll', (event) => {
      if (!unlocked || played) return;
      const now = view.performance?.now?.() ?? Date.now();
      if (now - lastScrollCheck < SCROLL_THROTTLE_MS) return;
      lastScrollCheck = now;
      const node = doc.getElementById('home-hero') || doc.querySelector('.hero');
      if (!node || !node.isConnected) return;
      const rect = node.getBoundingClientRect();
      if (rect.height <= 0 || rect.bottom > 0) return;
      trigger(event);
    }, { passive: true });
  }

  ensureHeroObserver();
  if (perf) perf.push({ name: 'guidedInit', ms: performance.now() - initStarted, at: performance.now() });

  return () => {
    disposed = true;
    if (hintTimer) view.clearTimeout(hintTimer);
    hintTimer = 0;
    heroObserver?.disconnect();
    heroObserver = null;
    detachUnlock();
    doc.querySelector('[data-sound-ios-hint]')?.remove();
  };
}
