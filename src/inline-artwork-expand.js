import './inline-artwork-expand.css';

const selector = '[data-inline-expand]';
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const rectOf = rect => ({ left: rect.left, top: rect.top, right: rect.right,
  bottom: rect.bottom, width: rect.width, height: rect.height });

export const isInlineArtworkTrigger = element => Boolean(element?.matches?.(selector));

/** Pure geometry: preserve the real image ratio and every external layout slot.
 * `frame` supplies the largest reserved viewing size. `bounds` is the visible
 * portion of the native row (or the Digital frame), after viewport clearance.
 * An edge photo can translate inside the existing row without scrolling it.
 */
export function fitInlineArtwork({ preview, frame, bounds }) {
  const values = [preview?.left, preview?.top, preview?.width, preview?.height,
    frame?.width, frame?.height, bounds?.left, bounds?.top, bounds?.right, bounds?.bottom];
  if (!values.every(Number.isFinite) || preview.width <= 0 || preview.height <= 0) return null;
  const availableWidth = bounds.right - bounds.left, availableHeight = bounds.bottom - bounds.top;
  const scale = Math.min(frame.width / preview.width, frame.height / preview.height,
    availableWidth / preview.width, availableHeight / preview.height);
  // Do not shrink a photo or manufacture an overlay when the row is almost
  // outside the viewport. It remains readable and can be opened after scrolling.
  if (!Number.isFinite(scale) || scale <= 1.04) return null;
  const width = preview.width * scale, height = preview.height * scale;
  const centerX = preview.left + preview.width / 2, centerY = preview.top + preview.height / 2;
  const left = clamp(centerX - width / 2, bounds.left, bounds.right - width);
  const top = clamp(centerY - height / 2, bounds.top, bounds.bottom - height);
  return { scale, x: left + width / 2 - centerX, y: top + height / 2 - centerY,
    left, top, width, height };
}

/** One disposable controller for Tattoo and Digital inline viewing. It never
 * mounts a dialog/canvas/clone, changes body overflow, or writes a scroll offset.
 * No pointer-move/scroll loop: layout is read only on activation or resize.
 */
export function initInlineArtworkExpand(root = document) {
  const doc = root.ownerDocument || root, view = doc.defaultView;
  const records = [...root.querySelectorAll(selector)].filter(trigger => !trigger.closest('[hidden]'))
    .map(trigger => ({ trigger, frame: trigger.closest('.inline-artwork-frame'), image: trigger.querySelector('img') }))
    .filter(record => record.frame && record.image)
    .map(record => ({ ...record, project: record.trigger.closest('[data-drift-item]'),
      pose: { scale: 1, x: 0, y: 0 }, token: 0, upgraded: false,
      label: record.trigger.getAttribute('aria-label'),
      section: record.trigger.closest('[data-horizontal-drift]'),
      previousPaused: null,
      originalAttributes: Object.fromEntries(['src', 'srcset', 'sizes'].map(name => [name, record.image.getAttribute(name)])),
      originalProperties: new Map(['--inline-view-scale', '--inline-view-x', '--inline-view-y', '--inline-view-radius']
        .map(name => [name, record.trigger.style.getPropertyValue(name)])),
    }));
  if (!records.length) return () => {};
  const byTrigger = new Map(records.map(record => [record.trigger, record]));
  const removers = [], decoded = new Map();
  let active = null, disposed = false, resizeFrame = 0;
  const listen = (element, type, handler, options) => {
    element.addEventListener(type, handler, options);
    removers.push(() => element.removeEventListener(type, handler, options));
  };
  const recordAt = target => byTrigger.get(target?.closest?.(selector));
  const pixels = (style, name, fallback) => {
    const value = Number.parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  };

  function measure(record) {
    const { trigger, frame } = record;
    const current = trigger.getBoundingClientRect(), frameRect = rectOf(frame.getBoundingClientRect());
    if (!current.width || !current.height || !frameRect.width || !frameRect.height) return null;
    // Undo only our own known outer transform. The shared hover is on the
    // inner .interaction-visual. Read the actual interpolated matrix so a rapid
    // collapse/reopen or mid-transition resize cannot fit against a stale pose.
    const transform = view.getComputedStyle(trigger).transform;
    const matrix = new view.DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
    const scale = Math.hypot(matrix.m11, matrix.m12) || 1;
    const width = current.width / scale, height = current.height / scale;
    const preview = { width, height,
      left: current.left + current.width / 2 - matrix.m41 - width / 2,
      top: current.top + current.height / 2 - matrix.m42 - height / 2 };
    const clip = frame.closest('.drift-viewport') || frame;
    const clipRect = clip.getBoundingClientRect(), style = view.getComputedStyle(frame);
    const viewport = view.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0, viewportTop = viewport?.offsetTop || 0;
    const bounds = {
      left: Math.max(clipRect.left + clip.clientLeft, viewportLeft + pixels(style, '--inline-safe-inline', 12)),
      right: Math.min(clipRect.left + clip.clientLeft + clip.clientWidth,
        viewportLeft + (viewport?.width || view.innerWidth) - pixels(style, '--inline-safe-inline', 12)),
      top: Math.max(clipRect.top + clip.clientTop, viewportTop + pixels(style, '--inline-safe-start', 76)),
      bottom: Math.min(clipRect.top + clip.clientTop + clip.clientHeight,
        viewportTop + (viewport?.height || view.innerHeight) - pixels(style, '--inline-safe-end', 76)),
    };
    // A carousel frame reserves vertical space before first paint. Expansion
    // can occupy neighbouring horizontal space inside its actual scrollport;
    // it never widens the flex item or changes the document's layout slots.
    const maximum = record.section ? { width: bounds.right - bounds.left, height: frameRect.height } : frameRect;
    const next = fitInlineArtwork({ preview, frame: maximum, bounds });
    if (!next) return null;
    return { ...next, radius: Number.parseFloat(style.borderTopLeftRadius) || 0 };
  }

  function apply(record, pose) {
    record.pose = pose;
    record.trigger.style.setProperty('--inline-view-scale', String(pose.scale));
    record.trigger.style.setProperty('--inline-view-x', `${pose.x}px`);
    record.trigger.style.setProperty('--inline-view-y', `${pose.y}px`);
    // Read from the existing shared radius, not a second hardcoded radius.
    record.trigger.style.setProperty('--inline-view-radius', `${pose.radius / pose.scale}px`);
  }

  function collapse({ restoreFocus = false } = {}) {
    if (!active) return;
    const record = active;
    active = null;
    record.token++;
    record.trigger.removeAttribute('data-inline-expanded');
    record.trigger.setAttribute('aria-pressed', 'false');
    record.frame.classList.remove('is-inline-expanded');
    record.project?.classList.remove('is-inline-expanded');
    if (record.section) {
      if (record.previousPaused === null) record.section.removeAttribute('data-drift-paused');
      else record.section.setAttribute('data-drift-paused', record.previousPaused);
      record.section.dispatchEvent(new view.CustomEvent('inline-artwork:change', { bubbles: true, detail: { expanded: false } }));
    }
    if (record.label === null) record.trigger.removeAttribute('aria-label');
    else record.trigger.setAttribute('aria-label', record.label);
    for (const [name, value] of record.originalProperties) {
      if (value) record.trigger.style.setProperty(name, value);
      else record.trigger.style.removeProperty(name);
    }
    record.pose = { scale: 1, x: 0, y: 0 };
    if (record.upgraded) {
      // Restore source-selection attributes exactly; the browser keeps its
      // explicit large-source cache without advertising it to resting previews.
      for (const [name, value] of Object.entries(record.originalAttributes)) {
        if (value === null) record.image.removeAttribute(name);
        else record.image.setAttribute(name, value);
      }
      record.upgraded = false;
    }
    if (restoreFocus && record.trigger.isConnected) {
      record.trigger.setAttribute('data-inline-focus-restore', '');
      try { record.trigger.focus({ preventScroll: true }); }
      finally { record.trigger.removeAttribute('data-inline-focus-restore'); }
    }
  }

  function upgrade(record, token) {
    const source = record.image.dataset.fullSrc;
    if (!source || source === record.image.currentSrc) return;
    if (!decoded.has(source)) {
      const pending = (async () => {
        const candidate = new view.Image();
        candidate.decoding = 'async'; candidate.src = source;
        await candidate.decode();
      })();
      decoded.set(source, pending);
      pending.catch(() => { if (decoded.get(source) === pending) decoded.delete(source); });
    }
    void decoded.get(source).then(() => {
      if (disposed || active !== record || record.token !== token || !record.image.isConnected) return;
      record.image.removeAttribute('srcset'); record.image.removeAttribute('sizes');
      record.image.src = source;
      record.upgraded = true;
    }).catch(() => { /* Keep the genuine readable thumbnail when large decoding fails. */ });
  }

  function activate(record) {
    if (active === record) { collapse(); return; }
    collapse();
    const pose = measure(record);
    if (!pose) return;
    active = record;
    const token = ++record.token;
    apply(record, pose);
    record.trigger.setAttribute('data-inline-expanded', '');
    record.trigger.setAttribute('aria-pressed', 'true');
    if (record.label) record.trigger.setAttribute('aria-label', record.label.replace(/^(enlarge|open)\b/i, 'restore'));
    record.frame.classList.add('is-inline-expanded');
    record.project?.classList.add('is-inline-expanded');
    if (record.section) {
      record.previousPaused = record.section.getAttribute('data-drift-paused');
      record.section.setAttribute('data-drift-paused', '');
      record.section.dispatchEvent(new view.CustomEvent('inline-artwork:change', { bubbles: true, detail: { expanded: true } }));
    }
    upgrade(record, token);
  }

  // Suppress browser mouse/pen focus scrolling, not native touch panning.
  // horizontal-drift's focusin guard must also ignore data-inline-pointer-focus
  // and data-inline-focus-restore (integration note), preserving keyboard browse.
  listen(root, 'pointerdown', event => {
    const record = recordAt(event.target);
    if (!record || event.isPrimary === false || event.button !== 0 || event.pointerType === 'touch'
      || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    record.trigger.setAttribute('data-inline-pointer-focus', '');
    try { record.trigger.focus({ preventScroll: true }); }
    finally { record.trigger.removeAttribute('data-inline-pointer-focus'); }
  }, { capture: true });
  listen(root, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const record = recordAt(event.target);
    if (!record || record.trigger.disabled || record.trigger.closest('[inert]')) return;
    event.preventDefault();
    activate(record);
  });
  listen(doc, 'click', event => { if (active && !active.trigger.contains(event.target)) collapse(); });
  listen(doc, 'keydown', event => {
    if (!active || event.defaultPrevented || event.key !== 'Escape') return;
    const ownsFocus = active.trigger.contains(doc.activeElement);
    event.preventDefault(); collapse({ restoreFocus: ownsFocus });
  });
  const resize = () => {
    if (!active || resizeFrame || disposed) return;
    resizeFrame = view.requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!active || disposed) return;
      const pose = measure(active);
      if (pose) apply(active, pose);
      else collapse();
    });
  };
  const observer = 'ResizeObserver' in view ? new view.ResizeObserver(resize) : null;
  for (const record of records) { observer?.observe(record.frame); observer?.observe(record.trigger); }
  listen(view, 'resize', resize, { passive: true });
  if (view.visualViewport) listen(view.visualViewport, 'resize', resize, { passive: true });

  return () => {
    disposed = true;
    collapse();
    observer?.disconnect();
    if (resizeFrame) view.cancelAnimationFrame(resizeFrame);
    for (const remove of removers) remove();
    decoded.clear();
  };
}
