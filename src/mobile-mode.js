import './mobile-mode.css';
import { bindModeTaps } from './mode-taps.js';
import { modeIconSettings } from './data/modeIconSettings.js';

/** One persistent, touch-sized brand control delegates to the existing mode
 * controller. Contact's hidden message is deliberately unchanged (Phase 2). */
export function initMobileMode({ doc = document, getMode, isBusy, onPrepare, onChange }) {
  const view = doc.defaultView;
  const coarse = view.matchMedia('(pointer: coarse)');
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'mobile-mode';
  for (const name of ['data-mobile-mode', 'data-no-ink', 'data-no-mosh', 'data-corruption-protected']) button.setAttribute(name, '');
  const image = doc.createElement('img');
  image.alt = ''; image.width = 28; image.height = 42; image.draggable = false;
  const status = doc.createElement('span');
  status.className = 'sr-only'; status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
  button.append(image, status);
  doc.body.append(button);
  function progress(element, count, total) {
    element.dataset.mobileTaps = String(count);
    element.style.setProperty('--mobile-mode-progress', String(count / total));
    status.textContent = count ? `${count} of ${total} taps` : '';
  }
  function refresh() {
    const other = getMode() === 'xray';
    button.setAttribute('aria-pressed', String(other));
    button.setAttribute('aria-label', other
      ? 'tap h4 three times within two seconds to return to normal mode'
      : 'tap h4 four times within two seconds to enter the other side');
    image.src = other ? modeIconSettings.cursor.other.base : modeIconSettings.cursor.normal.base;
  }
  const taps = bindModeTaps(doc, { getMode, onPrepare, onComplete: onChange, onProgress: progress,
    enabled: () => coarse.matches && !doc.hidden && !isBusy() });
  const change = () => { taps.cancel(); refresh(); };
  coarse.addEventListener('change', change);
  doc.addEventListener('h4:modechange', refresh);
  progress(button, 0, getMode() === 'xray' ? 3 : 4); refresh();
  const dispose = () => {
    taps(); coarse.removeEventListener('change', change);
    doc.removeEventListener('h4:modechange', refresh); button.remove();
  };
  return Object.assign(dispose, { cancel: taps.cancel, refresh, snapshot: taps.snapshot });
}
