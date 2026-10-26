import './digital-ink.css';
import { digitalInkSettings as settings } from './data/digitalArtworkSettings.js';
import { createDigitalInkField, paintDigitalInkAlpha, digitalInkProgress, digitalInkBoundary } from './digital-ink-field.js';
import { createVisualMotionPublisher } from './motion-mosh.js';

/** A progressive enhancement of real <img>s. No renderer is created for an
 * empty archive, unsupported Canvas, reduced motion, or unloaded artwork.
 * Native vertical scrolling is never intercepted, and there is no idle loop.
 */
export function initDigitalInk(root = document) {
  const sections = [...root.querySelectorAll('[data-digital-ink]')];
  if (!sections.length) return () => {};
  const doc = sections[0].ownerDocument;
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  if (!view.IntersectionObserver) {
    for (const section of sections) section.classList.add('is-ink-fallback');
    return () => { for (const section of sections) section.classList.remove('is-ink-fallback'); };
  }
  const publisher = createVisualMotionPublisher({ doc });
  const removers = [];
  const entries = [];
  let frame = 0, disposed = false, dirty = true;
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  const schedule = (remeasure = false) => {
    dirty ||= remeasure;
    if (!disposed && !doc.hidden && !frame) frame = view.requestAnimationFrame(update);
  };

  function disable(entry) {
    entry.section.classList.remove('is-ink-enhanced', 'is-ink-complete');
    entry.section.removeAttribute('data-ink-progress');
    entry.last = -1;
  }

  function release(entry) {
    disable(entry);
    entry.canvas.width = entry.canvas.height = 0;
    if (entry.mask) entry.mask.width = entry.mask.height = 0;
    entry.field = entry.maskPixels = entry.context = entry.maskContext = entry.mask = null;
  }

  function prepare(entry) {
    if (entry.unsupported || reduced.matches || !entry.near || !entry.image.complete || !entry.image.naturalWidth) return false;
    if (!entry.context) {
      entry.context = entry.canvas.getContext('2d', { alpha: true });
      if (!entry.context) { entry.unsupported = true; entry.section.classList.add('is-ink-fallback'); return false; }
      entry.mask = doc.createElement('canvas');
      entry.maskContext = entry.mask.getContext('2d', { alpha: true });
      if (!entry.maskContext) { entry.unsupported = true; entry.section.classList.add('is-ink-fallback'); return false; }
    }
    const size = view.innerWidth <= 600 ? settings.mobileMaskSize : settings.desktopMaskSize;
    if (!entry.field || entry.field.width !== size) {
      entry.field = createDigitalInkField(size, size, settings.seed + entry.seed);
      entry.mask.width = entry.mask.height = size;
      entry.maskPixels = entry.maskContext.createImageData(size, size);
      entry.last = -1;
    }
    if (!entry.section.classList.contains('is-ink-enhanced')) {
      entry.section.style.setProperty('--digital-ink-scroll-height', `${settings.scrollViewportLength * 100}svh`);
      entry.section.classList.add('is-ink-enhanced');
      dirty = true;
    }
    return true;
  }

  function update(time) {
    frame = 0;
    if (disposed || doc.hidden) return;
    if (reduced.matches) { for (const entry of entries) release(entry); publisher.reset(); return; }
    const available = entries.filter(prepare);
    if (dirty) {
      for (const entry of available) {
        const bounds = entry.section.getBoundingClientRect();
        entry.top = bounds.top + view.scrollY;
        entry.height = bounds.height;
        entry.bounds = entry.canvas.getBoundingClientRect();
        const pixelRatio = Math.min(view.devicePixelRatio || 1, settings.maximumPixelRatio);
        const scale = Math.min(pixelRatio, settings.maximumCanvasDimension / Math.max(entry.bounds.width, entry.bounds.height, 1));
        const width = Math.max(1, Math.round(entry.bounds.width * scale));
        const height = Math.max(1, Math.round(entry.bounds.height * scale));
        if (entry.canvas.width !== width || entry.canvas.height !== height) {
          entry.canvas.width = width; entry.canvas.height = height; entry.last = -1;
        }
      }
      dirty = false;
    }
    const samples = [];
    const motionReady = publisher.ready(time);
    for (const entry of available) {
      const progress = digitalInkProgress({ top: entry.top - view.scrollY, height: entry.height,
        viewportHeight: view.innerHeight, stickyRatio: settings.stickyViewportRatio });
      if (Math.abs(progress - entry.last) < .0001) continue;
      entry.last = progress;
      entry.section.dataset.inkProgress = progress.toFixed(5);
      entry.section.classList.toggle('is-ink-complete', progress >= .99999);
      if (progress >= .99999) continue; // The final image uses its original <img>, not a canvas resample.
      const width = entry.canvas.width, height = entry.canvas.height;
      entry.context.clearRect(0, 0, width, height);
      if (progress > 0) {
        paintDigitalInkAlpha(entry.field, progress, entry.maskPixels.data, settings.edgeSoftness);
        entry.maskContext.putImageData(entry.maskPixels, 0, 0);
        const imageRatio = entry.image.naturalWidth / entry.image.naturalHeight;
        const w = Math.min(width, height * imageRatio), h = w / imageRatio;
        const left = (width - w) / 2, top = (height - h) / 2;
        entry.context.globalCompositeOperation = 'source-over';
        entry.context.drawImage(entry.image, left, top, w, h);
        entry.context.globalCompositeOperation = 'destination-in';
        entry.context.drawImage(entry.mask, left, top, w, h);
        entry.context.globalCompositeOperation = 'source-over';
        if (motionReady) {
          // Contour points come from the same mask data actually drawn above.
          const bounds = entry.image.getBoundingClientRect();
          samples.push({ kind: 'section', target: entry.canvas, opacity: 1,
            x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2,
            width: bounds.width, height: bounds.height,
            points: digitalInkBoundary(entry.field, progress).map(point => ({ id: point.id,
              x: bounds.left + point.x * bounds.width, y: bounds.top + point.y * bounds.height })) });
        }
      }
    }
    if (samples.length) publisher.publish(samples, time);
  }

  const observer = new view.IntersectionObserver(records => {
    for (const record of records) {
      const entry = entries.find(value => value.section === record.target);
      if (entry) {
        entry.near = record.isIntersecting;
        // Long archives retain only nearby mask buffers. The seeded field is
        // recreated exactly when scrolling back; no gallery position changes.
        if (!entry.near) release(entry);
      }
    }
    schedule(true);
  }, { rootMargin: '50% 0px' });
  const resize = view.ResizeObserver ? new view.ResizeObserver(() => schedule(true)) : null;
  for (const section of sections) {
    const image = section.querySelector('.digital-ink-open img');
    const canvas = section.querySelector('.digital-ink-canvas');
    if (!image || !canvas) continue;
    const entry = { section, image, canvas, seed: Number(section.dataset.inkSeed) || 0, near: false, last: -1,
      originalHeight: section.style.getPropertyValue('--digital-ink-scroll-height'),
      originalHeightPriority: section.style.getPropertyPriority('--digital-ink-scroll-height') };
    entries.push(entry);
    listen(image, 'load', () => schedule(true));
    listen(image, 'error', () => { disable(entry); entry.section.classList.add('is-ink-fallback'); });
    observer.observe(section);
    resize?.observe(section.querySelector('.digital-ink-open'));
  }
  listen(view, 'scroll', () => { if (entries.some(entry => entry.near)) schedule(); }, { passive: true });
  listen(view, 'resize', () => schedule(true), { passive: true });
  listen(reduced, 'change', () => schedule(true));
  listen(doc, 'h4:modechange', () => { publisher.reset(); for (const entry of entries) entry.last = -1; schedule(); });
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) { if (frame) view.cancelAnimationFrame(frame); frame = 0; publisher.reset(); }
    else schedule(true);
  });
  return () => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    observer.disconnect(); resize?.disconnect(); publisher.reset();
    for (const remove of removers) remove();
    for (const entry of entries) {
      release(entry);
      entry.section.classList.remove('is-ink-fallback');
      if (entry.originalHeight) entry.section.style.setProperty('--digital-ink-scroll-height', entry.originalHeight, entry.originalHeightPriority);
      else entry.section.style.removeProperty('--digital-ink-scroll-height');
    }
  };
}
