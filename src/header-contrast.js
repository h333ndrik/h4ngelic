import './header-contrast.css';

const floatingSelector = '[data-floating-brand], [data-global-index] > summary, .work-filters, .hero-nav';
const copiedProperties = ['display', 'align-items', 'justify-content', 'flex-direction', 'flex-wrap', 'gap',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-numeric', 'line-height', 'letter-spacing',
  'white-space', 'text-align', 'text-transform', 'text-underline-offset', 'text-decoration-thickness', 'vertical-align', 'flex-grow', 'flex-shrink', 'flex-basis',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom',
  'margin-left', 'min-width', 'min-height', 'max-width', 'max-height', 'overflow-x', 'overflow-y'];

/** Normal dark strokes sit separately below the difference fill. In particular,
 * they must NOT be children of the blended surface: that would invert the
 * strokes too. Presentation-only copies have no IDs/classes/links/bindings.
 * Layout is read on entry, resize, route/font/content changes, never scroll.
 */
export function initHeaderContrast(doc = document) {
  const view = doc.defaultView;
  // Subtract the real glyph alpha from its dilation: an ordinary text stroke
  // also paints inside thin letters and would become their blend backdrop.
  const edgeDefinitions = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  edgeDefinitions.setAttribute('aria-hidden', 'true');
  edgeDefinitions.setAttribute('data-header-edge-definitions', '');
  edgeDefinitions.setAttribute('width', '0'); edgeDefinitions.setAttribute('height', '0');
  edgeDefinitions.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden';
  edgeDefinitions.innerHTML = `<defs><filter id="h4-header-edge" x="-8%" y="-30%" width="116%" height="160%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius=".8" result="expanded"/>
    <feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge"/>
    <feFlood flood-color="#080808" result="ink"/>
    <feComposite in="ink" in2="edge" operator="in"/>
  </filter></defs>`;
  (doc.querySelector('[data-page-composition]') || doc.body).append(edgeDefinitions);
  const records = new Map();
  let frame = 0, disposed = false;
  const removers = [];
  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    removers.push(() => target.removeEventListener(type, callback, options));
  };
  function copyNode(source, record) {
    if (source.nodeType === 3) return doc.createTextNode(source.textContent);
    if (source.nodeType !== 1) return null;
    const copy = doc.createElement('span');
    const style = view.getComputedStyle(source);
    for (const key of copiedProperties) copy.style.setProperty(key, style.getPropertyValue(key));
    if (source.matches('.interaction-visual, .category-magnet')) {
      copy.setAttribute('data-outline-visual', ''); record.visuals.set(source, copy);
    }
    if (source.matches('.arrow')) copy.setAttribute('data-outline-arrow', '');
    if (source.matches('.index-sign')) {
      copy.setAttribute('data-outline-index-sign', ''); record.indexSigns.push({ source, copy });
      if (source.closest('details')?.open) copy.setAttribute('data-outline-index-open', '');
    }
    if (source.matches('[aria-current], .is-active')) copy.setAttribute('data-outline-active', '');
    for (const child of source.childNodes) {
      const node = copyNode(child, record); if (node) copy.append(node);
    }
    return copy;
  }
  function syncVisuals(record) {
    const { source, copy } = record;
    copy.toggleAttribute('data-outline-hover', source.matches('[data-ui-interactive]:is(:hover, :focus-visible)'));
    for (const [visual, outline] of record.visuals) {
      const target = visual.closest('[data-ui-interactive]');
      outline.style.setProperty('--outline-scale', target?.style.getPropertyValue('--ui-target-scale') || '1.025');
      outline.style.setProperty('--outline-arrow', target?.style.getPropertyValue('--ui-fit-arrow-movement') || '2px');
      outline.style.setProperty('--outline-magnet-x', visual.style.getPropertyValue('--magnet-x') || '0px');
      outline.style.setProperty('--outline-magnet-y', visual.style.getPropertyValue('--magnet-y') || '0px');
      outline.toggleAttribute('data-outline-hover', Boolean(target?.matches(':hover, :focus-visible')));
    }
    for (const { source: sign, copy: outline } of record.indexSigns) {
      outline.toggleAttribute('data-outline-index-open', Boolean(sign.closest('details')?.open));
    }
  }
  const stationaryStyle = value => (value || '').split(';').map(part => part.trim())
    .filter(part => part && !/^--(?:magnet-x|magnet-y|ui-target-scale|ui-fit-arrow-movement)\s*:/.test(part)).join(';');
  function mirrorMutations(record, mutations) {
    const presentationOnly = mutations.every(mutation => mutation.type === 'attributes' && (
      ['aria-expanded', 'aria-label'].includes(mutation.attributeName)
      || mutation.attributeName === 'style'
        && stationaryStyle(mutation.oldValue) === stationaryStyle(mutation.target.getAttribute('style'))));
    // Pointer motion only changes cached presentation values. Keep the same
    // clone nodes so their CSS transitions share the source's target/clock;
    // rebuilding here would jump the stroke to the final hover pose.
    if (presentationOnly) syncVisuals(record);
    else schedule();
  }
  function update(record) {
    const { source, copy } = record;
    const style = view.getComputedStyle(source);
    const box = source.getBoundingClientRect();
    copy.hidden = source.hidden || style.display === 'none' || !box.width || !box.height;
    for (const key of copiedProperties) copy.style.setProperty(key, style.getPropertyValue(key));
    copy.style.setProperty('position', style.position);
    if (style.position === 'fixed') {
      copy.style.left = `${box.left}px`; copy.style.top = `${box.top}px`;
    } else {
      // Hero route navigation is absolute in the unchanged relative hero.
      copy.style.left = `${source.offsetLeft}px`; copy.style.top = `${source.offsetTop}px`;
    }
    copy.style.right = copy.style.bottom = 'auto';
    copy.style.width = `${box.width}px`; copy.style.height = `${box.height}px`;
    copy.style.margin = '0';
    copy.style.zIndex = String((Number(style.zIndex) || 11) - 1);
    copy.style.setProperty('--outline-scale', style.getPropertyValue('--ui-target-scale') || '1.025');
    copy.style.setProperty('--outline-arrow', style.getPropertyValue('--ui-fit-arrow-movement') || '2px');
    copy.toggleAttribute('data-outline-hover', source.matches('[data-ui-interactive]:is(:hover, :focus-visible)'));
    record.visuals.clear(); record.indexSigns.length = 0;
    copy.replaceChildren(...[...source.childNodes].map(child => copyNode(child, record)).filter(Boolean));
    syncVisuals(record);
    copy.scrollLeft = source.scrollLeft;
  }
  function refresh() {
    if (disposed) return;
    for (const [source, record] of records) if (!source.isConnected) {
      record.observer.disconnect(); record.removers.forEach(remove => remove()); resize?.unobserve(source); record.copy.remove(); records.delete(source);
    }
    for (const source of doc.querySelectorAll(floatingSelector)) if (!records.has(source)) {
      const copy = doc.createElement('span');
      copy.setAttribute('data-header-outline', ''); copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('data-no-ink', ''); copy.setAttribute('data-no-mosh', '');
      copy.setAttribute('data-corruption-protected', ''); copy.inert = true;
      if (source.matches('.hero-nav')) {
        copy.setAttribute('data-hero-outline', ''); source.parentElement.append(copy);
      } else (doc.querySelector('[data-page-composition]') || doc.body).append(copy);
      const record = { source, copy, removers: [], visuals: new Map(), indexSigns: [] };
      const listenSource = (type, handler) => { source.addEventListener(type, handler, { passive: true });
        record.removers.push(() => source.removeEventListener(type, handler)); };
      record.observer = new view.MutationObserver(mutations => mirrorMutations(record, mutations));
      record.observer.observe(source, { attributes: true, attributeOldValue: true, subtree: true, childList: true, characterData: true });
      records.set(source, record); resize?.observe(source);
      listenSource('scroll', () => { copy.scrollLeft = source.scrollLeft; });
      for (const type of ['pointerenter', 'pointerleave', 'focusin', 'focusout']) listenSource(type, () => syncVisuals(record));
    }
    for (const record of records.values()) update(record);
  }
  function schedule() {
    if (!frame && !disposed) frame = view.requestAnimationFrame(() => { frame = 0; refresh(); });
  }
  const resize = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
  listen(view, 'resize', schedule, { passive: true });
  listen(doc, 'h4:pagechange', schedule);
  listen(doc, 'h4:modechange', schedule);
  doc.fonts?.ready.then(schedule);
  refresh();
  return Object.assign(() => {
    disposed = true; if (frame) view.cancelAnimationFrame(frame);
    resize?.disconnect(); removers.forEach(remove => remove());
    for (const record of records.values()) { record.observer.disconnect(); record.removers.forEach(remove => remove()); record.copy.remove(); }
    records.clear();
    edgeDefinitions.remove();
  }, { refresh: schedule });
}
