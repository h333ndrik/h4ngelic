import './corruption.css';
import { corruptionSettings, chooseCorruptionProfile } from './data/corruptionSettings.js';
import { createAmbientFilm } from './ambient-film.js';
import { getLivingDecaySettings, livingDecayMaterialAssets } from './data/livingDecaySettings.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const protectedTarget = '[data-other-side-hint], [data-corruption-protected], [data-no-mosh]';
const interactive = 'a, button, input, select, textarea, label, summary, [role="button"], [contenteditable]:not([contenteditable="false"])';

/** One evolving background owns all raster history and its sole paint clock.
 * This adapter delegates numeric input; no recovering image overlays, photo
 * readbacks, DOM captures, extra animation frame loop or per-click surfaces. */
export async function createCorruption({ image, settings = corruptionSettings } = {}) {
  const doc = document, view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const profile = chooseCorruptionProfile({ coarsePointer: view.matchMedia('(pointer: coarse)').matches,
    memory: navigator.deviceMemory, cores: navigator.hardwareConcurrency, saveData: navigator.connection?.saveData });
  const source = image || new view.Image();
  if (!image) { source.src = livingDecayMaterialAssets[profile]; await source.decode(); }
  const background = doc.createElement('div');
  background.className = 'corruption-background'; background.setAttribute('aria-hidden', 'true');
  doc.body.prepend(background);
  let ambient;
  try {
    ambient = createAmbientFilm({ image: source, container: background,
      settings: settings.ambient || corruptionSettings.ambient, profile, view, doc });
  } catch (error) {
    background.remove();
    throw error;
  }
  let active = false, disposed = false, receivedImpulses = 0, sharedInputs = 0;
  let lastPointer = null, clickCandidate = null, completedClick = null;
  let viewport = { width: view.innerWidth, height: view.innerHeight };
  const removers = [];
  const listen = (target, name, fn, options) => { target.addEventListener(name, fn, options); removers.push(() => target.removeEventListener(name, fn, options)); };
  const enabled = () => active && !disposed && !doc.hidden && !reduced.matches && doc.documentElement.dataset.mode === 'xray';
  const protectedEvent = target => Boolean(target?.closest?.(protectedTarget));
  function clearInput() { lastPointer = clickCandidate = completedClick = null; }
  function queueImpulse(detail = {}) {
    if (!enabled() || ![detail.x, detail.y, detail.strength].every(Number.isFinite) || detail.strength <= 0
      || detail.target?.isConnected === false || protectedEvent(detail.target)) return false;
    const point = { kind: detail.kind, x: clamp(detail.x, 0, viewport.width), y: clamp(detail.y, 0, viewport.height),
      strength: clamp(detail.strength, 0, 2), time: view.performance.now(), dx: detail.dx, dy: detail.dy,
      deltaMs: detail.deltaMs, direction: detail.direction, mode: detail.mode,
      vectors: detail.vectors?.slice(0, 8).map(v => ({ x: v.x, y: v.y, dx: v.dx, dy: v.dy, weight: v.weight })) };
    // The ambient queue is bounded and coalesces before walking its cell field.
    // No DOM target is retained after this event boundary.
    const accepted = ambient.impulse(point);
    if (accepted) { receivedImpulses++; sharedInputs++; }
    return accepted;
  }
  listen(doc, 'h4:moshimpulse', event => queueImpulse(event.detail));
  listen(doc, 'h4:scrollmotion', event => { if (enabled()) ambient.setMotion(event.detail); });
  function transitionIntent(detail) {
    if (enabled() && detail?.kind === 'navigation') queueImpulse({ ...detail,
      x: viewport.width / 2, y: viewport.height / 2, strength: detail.strength || 1 });
    // Mode entry has already rasterized its final damaged memory before the
    // native destination capture. Do not add a second competing transition.
  }
  listen(doc, 'h4:transitionintent', event => transitionIntent(event.detail));
  listen(doc, 'pointerdown', event => {
    if (!enabled() || event.isPrimary === false || event.button !== 0 || protectedEvent(event.target)) return;
    lastPointer = { x: event.clientX, y: event.clientY, time: view.performance.now() };
    clickCandidate = { id: event.pointerId, x: event.clientX, y: event.clientY, time: view.performance.now(), travel: 0 };
  }, { passive: true });
  listen(doc, 'pointermove', event => {
    if (!enabled() || event.isPrimary === false) return;
    if (protectedEvent(event.target)) { clearInput(); return; }
    if (clickCandidate) clickCandidate.travel = Math.max(clickCandidate.travel, Math.hypot(event.clientX - clickCandidate.x, event.clientY - clickCandidate.y));
    if (getLivingDecaySettings().cursorMosh <= 0 || lastPointer && Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) < .5) return;
    const point = { x: event.clientX, y: event.clientY, time: view.performance.now() };
    ambient.stroke({ ...point, priorInput: lastPointer }); lastPointer = point; sharedInputs++;
  }, { passive: true });
  listen(doc, 'pointerup', event => {
    const candidate = clickCandidate; clickCandidate = null;
    completedClick = candidate && candidate.id === event.pointerId && candidate.travel <= 12
      && Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) <= 12
      && view.performance.now() - candidate.time <= 600 ? { time: view.performance.now() } : null;
  }, { passive: true });
  listen(doc, 'pointercancel', clearInput, { passive: true });
  listen(doc, 'click', event => {
    const completed = completedClick; completedClick = null;
    // UI clicks are already delegated by interaction-mosh. This adds deliberate
    // empty-background clicks exactly once without generating decorative ink.
    if (!completed || !enabled() || event.button !== 0 || event.detail === 0
      || view.performance.now() - completed.time > 600 || event.target.closest?.(interactive) || protectedEvent(event.target)) return;
    queueImpulse({ kind: 'click', x: event.clientX, y: event.clientY, strength: 1.5 });
  });
  listen(doc, 'pointerout', event => { if (!event.relatedTarget) clearInput(); });
  listen(view, 'blur', clearInput);
  listen(doc, 'visibilitychange', clearInput);
  listen(doc, 'h4:pagechange', clearInput);
  listen(view, 'resize', () => { viewport = { width: view.innerWidth, height: view.innerHeight }; clearInput(); ambient.resize(viewport); }, { passive: true });
  listen(reduced, 'change', clearInput);
  const controller = {
    setActive(value) { if (disposed) return; active = Boolean(value); if (!active) clearInput(); ambient.setActive(active); },
    prepareMemoryTransition(options) {
      if (disposed) return null;
      const token = ambient.prepareTransition(options);
      if (token) doc.documentElement.setAttribute('data-memory-mosh-ready', '');
      return token;
    },
    finishMemoryTransition(token) { return !disposed && ambient.finishTransition(token); },
    impulse: queueImpulse, transition: transitionIntent,
    configureLivingDecay: patch => ambient.configure(patch), readLivingDecaySettings: ambient.readSettings,
    regenerateLivingDecay: value => ambient.regenerate(value), restoreLivingDecay: value => ambient.restore(value),
    snapshot() {
      const memory = ambient.snapshot();
      return { active, queued: memory.queued, regions: 0, frames: memory.frames, maximumBlocks: 0,
        pendingImpulses: memory.pendingImpulses || 0, receivedImpulses, sharedInputs,
        paintedBlocks: memory.advectedBlocks, reconstructedBlocks: 0, rememberedSurfaces: 0,
        drawMs: memory.drawMs, source: source.src, quality: settings.quality[profile], ambient: memory,
        renderer: 'single-memory-field', localImageOverlays: 0 };
    },
    dispose() {
      if (disposed) return; disposed = true; active = false; clearInput();
      for (const remove of removers) remove(); ambient.dispose(); background.remove();
      doc.documentElement.removeAttribute('data-memory-mosh-ready');
      delete view.__H4_CORRUPTION__;
    },
  };
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) view.__H4_CORRUPTION__ = controller;
  return controller;
}
