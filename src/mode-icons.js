import { modeIconSettings as settings } from './data/modeIconSettings.js';

const controllers = new WeakMap();

/** Native cursor appearance is CSS-only. Favicons follow the existing mode;
 * a trusted discovery gesture warms the small alternate assets, never a scene.
 */
export function initModeIcons(doc = document) {
  if (controllers.has(doc)) return controllers.get(doc);
  const view = doc.defaultView;
  const finePointer = view.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const originals = new Map([...doc.querySelectorAll('[data-mode-icon]')].map(link => [link, link.getAttribute('href')]));
  const warmed = new Set();
  const images = new Set();

  function refresh() {
    const mode = doc.documentElement.dataset.mode === 'xray' ? 'other' : 'normal';
    for (const link of doc.querySelectorAll('[data-mode-icon]')) {
      const href = settings.favicon[mode][link.dataset.modeIcon];
      if (href && link.getAttribute('href') !== href) link.setAttribute('href', href);
    }
  }

  function prepare() {
    const sources = Object.values(settings.favicon.other);
    if (finePointer.matches) {
      sources.push(settings.cursor.other.base);
      if (!reducedMotion.matches) sources.push(settings.cursor.other.hover, settings.cursor.other.pressed);
    }
    for (const href of sources) {
      if (warmed.has(href)) continue;
      warmed.add(href);
      const image = new view.Image();
      images.add(image);
      image.decoding = 'async';
      image.fetchPriority = 'low';
      image.src = href;
      // Favicon / cursor loading must never hold up the actual theme change.
      void image.decode().catch(() => {}).finally(() => images.delete(image));
    }
  }

  doc.addEventListener('h4:modeprepare', prepare);
  doc.addEventListener('h4:modechange', refresh);
  doc.addEventListener('h4:pagechange', refresh);
  refresh(); // Also covers late initialization after a mode has already changed.

  const dispose = () => {
    doc.removeEventListener('h4:modeprepare', prepare);
    doc.removeEventListener('h4:modechange', refresh);
    doc.removeEventListener('h4:pagechange', refresh);
    for (const [link, href] of originals) {
      if (href === null) link.removeAttribute('href');
      else link.setAttribute('href', href);
    }
    images.clear();
    controllers.delete(doc);
  };
  controllers.set(doc, dispose);
  return dispose;
}
