import { corruptionSettings } from './data/corruptionSettings.js';

/** Only the original input gesture preloads the film/effect code. Normal page
 * loads allocate neither effect canvases nor an additional rendering context.
 */
export function initCorruptionLifecycle(doc = document) {
  let controller = null;
  let preparing = null;
  let disposed = false;
  async function prepare() {
    if (disposed || preparing) return preparing;
    preparing = (async () => {
      const image = new Image();
      const mobile = matchMedia('(pointer: coarse)').matches || navigator.deviceMemory > 0 && navigator.deviceMemory <= 4;
      image.src = corruptionSettings.assets[mobile ? 'mobile' : 'desktop'];
      const [{ createCorruption }] = await Promise.all([import('./corruption.js'), image.decode()]);
      if (disposed) return;
      controller = await createCorruption({ image });
      controller.setActive(doc.documentElement.dataset.mode === 'xray');
      doc.dispatchEvent(new CustomEvent('h4:corruptionready'));
    })().catch(error => {
      preparing = null;
      console.warn('The film surface is unavailable; navigation and mode switching remain usable.', error);
    });
    return preparing;
  }
  const modeChange = () => {
    if (controller) controller.setActive(doc.documentElement.dataset.mode === 'xray');
    else if (doc.documentElement.dataset.mode === 'xray') void prepare();
  };
  doc.documentElement.style.setProperty('--corruption-film-opacity', String(Math.min(1, .94 * corruptionSettings.distressIntensity)));
  doc.documentElement.style.setProperty('--corruption-glow-strength', String(corruptionSettings.glowStrength));
  doc.addEventListener('h4:modeprepare', prepare);
  doc.addEventListener('h4:modechange', modeChange);
  return () => {
    disposed = true;
    doc.removeEventListener('h4:modeprepare', prepare);
    doc.removeEventListener('h4:modechange', modeChange);
    controller?.dispose();
  };
}
