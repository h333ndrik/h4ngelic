import { corruptionSettings, chooseCorruptionProfile } from './data/corruptionSettings.js';
import { temporalMoshSettings } from './data/temporalMoshSettings.js';
import { livingDecayMaterialAssets } from './data/livingDecaySettings.js';

/** Only the original input gesture preloads the film/effect code. Normal page
 * loads allocate neither effect canvases nor an additional rendering context.
 */
export function initCorruptionLifecycle(doc = document) {
  let controller = null;
  let preparing = null;
  let disposed = false;
  let pendingImpulse = null;
  let pendingTransition = null;
  async function prepare() {
    if (disposed || preparing) return preparing;
    preparing = (async () => {
      const image = new Image();
      const profile = chooseCorruptionProfile({ coarsePointer: matchMedia('(pointer: coarse)').matches,
        memory: navigator.deviceMemory, cores: navigator.hardwareConcurrency, saveData: navigator.connection?.saveData });
      image.src = livingDecayMaterialAssets[profile];
      const [{ createCorruption }] = await Promise.all([import('./corruption.js'), image.decode()]);
      if (disposed) return;
      const created = await createCorruption({ image });
      if (disposed) { created.dispose(); return; }
      controller = created;
      controller.setActive(doc.documentElement.dataset.mode === 'xray');
      // Creation can finish between native snapshot intent and its commit.
      // The controller retains this numeric intent until activation as well.
      if (pendingTransition) controller.transition(pendingTransition);
      pendingTransition = null;
      if (pendingImpulse && performance.now() - pendingImpulse.time <= temporalMoshSettings.maximumPendingAgeMs) {
        controller.impulse(pendingImpulse.detail);
      }
      pendingImpulse = null;
      doc.dispatchEvent(new CustomEvent('h4:corruptionready'));
    })().catch(error => {
      preparing = null;
      pendingImpulse = null;
      pendingTransition = null;
      console.warn('The film surface is unavailable; navigation and mode switching remain usable.', error);
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
      pendingImpulse = { detail: event.detail, time: performance.now() };
    }
  };
  const rememberTransition = event => {
    if (!controller && preparing && !disposed && event.detail?.kind === 'mode'
      && event.detail.mode === 'xray') pendingTransition = event.detail;
  };
  const forgetImpulse = () => { pendingImpulse = pendingTransition = null; };
  doc.documentElement.style.setProperty('--corruption-film-opacity', String(Math.min(1, .94 * corruptionSettings.distressIntensity)));
  doc.documentElement.style.setProperty('--corruption-glow-strength', String(corruptionSettings.glowStrength));
  doc.addEventListener('h4:modeprepare', prepare);
  doc.addEventListener('h4:modechange', modeChange);
  doc.addEventListener('h4:moshimpulse', rememberImpulse);
  doc.addEventListener('h4:transitionintent', rememberTransition);
  doc.addEventListener('h4:pagechange', forgetImpulse);
  doc.addEventListener('visibilitychange', forgetImpulse);
  window.addEventListener('blur', forgetImpulse);
  const dispose = () => {
    disposed = true;
    pendingImpulse = null;
    pendingTransition = null;
    doc.removeEventListener('h4:modeprepare', prepare);
    doc.removeEventListener('h4:modechange', modeChange);
    doc.removeEventListener('h4:moshimpulse', rememberImpulse);
    doc.removeEventListener('h4:transitionintent', rememberTransition);
    doc.removeEventListener('h4:pagechange', forgetImpulse);
    doc.removeEventListener('visibilitychange', forgetImpulse);
    window.removeEventListener('blur', forgetImpulse);
    controller?.dispose();
  };
  dispose.getController = () => disposed ? null : controller;
  return dispose;
}
