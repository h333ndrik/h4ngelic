/** Guided listening around the existing SOUND switch: state-only unlock on the
 * standard gesture set, then the wordmark or the visible WORKS section fades
 * the active world in. No pointermove, dwell timer, play button or autoplay. */

const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'];
const WORDMARK_SELECTOR = '#stage, #logo-canvas, [data-hero-poster]';
const WORKS_SELECTOR = '#selected-work';
const WORKS_VISIBLE_RATIO = .25;
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
  const removers = [];
  const unlockRemovers = [];
  let disposed = false;
  let unlocked = false;
  let played = false;
  let hintShown = false;
  let hintTimer = 0;
  let worksObserver = null;
  let observedWorks = null;

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
    detachUnlock();
    ensureWorksObserver();
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

  // Stage B: the WORKS section becomes at least 25% visible. The observer is
  // the only visibility source; there is no pointermove, scroll or dwell trigger.
  // #selected-work is re-created by the router on every page change, so the
  // observer is re-attached to the current node instead of being created once.
  function ensureWorksObserver() {
    if (typeof view.IntersectionObserver !== 'function') return;
    const works = doc.querySelector(WORKS_SELECTOR);
    if (works === observedWorks) return;
    if (observedWorks) { worksObserver?.unobserve(observedWorks); observedWorks = null; }
    if (!works) return;
    if (!worksObserver) worksObserver = new view.IntersectionObserver((entries) => {
      if (!unlocked || played) return;
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < WORKS_VISIBLE_RATIO) continue;
        trigger({ isTrusted: true });
        return;
      }
    }, { threshold: [WORKS_VISIBLE_RATIO] });
    observedWorks = works;
    worksObserver.observe(works);
  }

  ensureWorksObserver();
  listen(doc, 'h4:pagechange', ensureWorksObserver);
  if (perf) perf.push({ name: 'guidedInit', ms: performance.now() - initStarted, at: performance.now() });

  return () => {
    disposed = true;
    if (hintTimer) view.clearTimeout(hintTimer);
    hintTimer = 0;
    worksObserver?.disconnect();
    worksObserver = null;
    observedWorks = null;
    detachUnlock();
    doc.querySelector('[data-sound-ios-hint]')?.remove();
  };
}
