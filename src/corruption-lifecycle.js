import { corruptionSettings, chooseCorruptionProfile } from './data/corruptionSettings.js';
import { temporalMoshSettings } from './data/temporalMoshSettings.js';
import { livingDecayMaterialAssets } from './data/livingDecaySettings.js';

/** Only the original input gesture preloads the film/effect code. Normal page
 * loads allocate neither effect canvases nor an additional rendering context.
 */
export function initCorruptionLifecycle(doc = document, { loadController } = {}) {
  const view = doc.defaultView || window;
  let controller = null;
  let preparing = null;
  let disposed = false;
  let pendingImpulse = null;
  let pendingTransition = null;
  let preparedHandoff = null;
  const load = loadController || (async ({ profile }) => {
    const image = new view.Image();
    image.src = livingDecayMaterialAssets[profile];
    let timer;
    let loaded = false;
    try {
      const [{ createCorruption }] = await Promise.race([
        Promise.all([import('./corruption.js'), image.decode()]),
        new Promise((_, reject) => { timer = view.setTimeout(() => reject(new Error('Material preparation timed out.')), 6000); }),
      ]);
      loaded = true;
      return await createCorruption({ image });
    } finally {
      view.clearTimeout(timer);
      if (!loaded) image.src = '';
    }
  });
  async function prepare() {
    if (disposed) return null;
    if (controller) return controller;
    if (preparing) return preparing;
    preparing = (async () => {
      const profile = chooseCorruptionProfile({ coarsePointer: view.matchMedia('(pointer: coarse)').matches,
        memory: view.navigator.deviceMemory, cores: view.navigator.hardwareConcurrency, saveData: view.navigator.connection?.saveData });
      const created = await load({ profile, doc, view });
      if (disposed) { created?.dispose(); return null; }
      if (!created) { preparing = null; return null; }
      controller = created;
      controller.setActive(doc.documentElement.dataset.mode === 'xray');
      // Creation can finish between native snapshot intent and its commit.
      // The controller retains this numeric intent until activation as well.
      if (pendingTransition) controller.transition(pendingTransition);
      pendingTransition = null;
      if (pendingImpulse && view.performance.now() - pendingImpulse.time <= temporalMoshSettings.maximumPendingAgeMs) {
        controller.impulse(pendingImpulse.detail);
      }
      pendingImpulse = null;
      doc.dispatchEvent(new view.CustomEvent('h4:corruptionready'));
      return controller;
    })().catch(error => {
      preparing = null;
      pendingImpulse = null;
      pendingTransition = null;
      console.warn('The film surface is unavailable; normal mode remains usable and activation can be retried.', error);
      return null;
    });
    return preparing;
  }
  const modeChange = () => {
    if (doc.documentElement.dataset.mode !== 'xray') pendingImpulse = pendingTransition = null;
    if (controller) controller.setActive(doc.documentElement.dataset.mode === 'xray');
    else if (doc.documentElement.dataset.mode === 'xray') void prepare();
  };
  // Mode preparation stays gesture-driven. Retain at most one already-active
  // UI impulse while that original asynchronous preparation finishes.
  const rememberImpulse = event => {
    if (!controller && preparing && !disposed && !doc.hidden && doc.documentElement.dataset.mode === 'xray') {
      pendingImpulse = { detail: event.detail, time: view.performance.now() };
    }
  };
  const rememberTransition = event => {
    if (!controller && preparing && !disposed && event.detail?.kind === 'mode'
      && event.detail.mode === 'xray') pendingTransition = event.detail;
  };
  const forgetImpulse = () => { pendingImpulse = pendingTransition = null; };
  function announceHandoff(phase, token, variant) {
    doc.dispatchEvent(new view.CustomEvent('h4:memoryhandoff', { detail: {
      phase, variant, token, snapshot: controller?.snapshot?.()?.ambient || null,
    } }));
  }
  async function prepareTransition(options = {}) {
    const created = await prepare();
    if (disposed || doc.hidden || !created?.prepareMemoryTransition) return null;
    const token = await created.prepareMemoryTransition(options);
    if (disposed || doc.hidden) { created.finishMemoryTransition?.(token); return null; }
    if (!token) return null;
    preparedHandoff = { token, variant: options.variant };
    doc.documentElement.setAttribute('data-memory-mosh-ready', '');
    announceHandoff('prepared', token, options.variant);
    return token;
  }
  function finishTransition(token) {
    if (!token) return false;
    const variant = preparedHandoff?.token === token ? preparedHandoff.variant : token.variant;
    const result = controller?.finishMemoryTransition?.(token);
    if (result !== false) {
      if (preparedHandoff?.token === token) preparedHandoff = null;
      announceHandoff('released', token, variant);
    }
    return result;
  }
  doc.documentElement.style.setProperty('--corruption-film-opacity', '1');
  doc.documentElement.style.setProperty('--corruption-glow-strength', String(corruptionSettings.glowStrength));
  doc.addEventListener('h4:modeprepare', prepare);
  doc.addEventListener('h4:modechange', modeChange);
  doc.addEventListener('h4:moshimpulse', rememberImpulse);
  doc.addEventListener('h4:transitionintent', rememberTransition);
  doc.addEventListener('h4:pagechange', forgetImpulse);
  doc.addEventListener('visibilitychange', forgetImpulse);
  view.addEventListener('blur', forgetImpulse);
  const dispose = () => {
    disposed = true;
    pendingImpulse = null;
    pendingTransition = null;
    preparedHandoff = null;
    doc.removeEventListener('h4:modeprepare', prepare);
    doc.removeEventListener('h4:modechange', modeChange);
    doc.removeEventListener('h4:moshimpulse', rememberImpulse);
    doc.removeEventListener('h4:transitionintent', rememberTransition);
    doc.removeEventListener('h4:pagechange', forgetImpulse);
    doc.removeEventListener('visibilitychange', forgetImpulse);
    view.removeEventListener('blur', forgetImpulse);
    controller?.dispose();
    doc.documentElement.removeAttribute('data-memory-mosh-ready');
  };
  dispose.getController = () => disposed ? null : controller;
  dispose.prepareTransition = prepareTransition;
  dispose.finishTransition = finishTransition;
  dispose.prepare = prepare;
  return dispose;
}
