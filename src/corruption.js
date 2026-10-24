import './corruption.css';
import { corruptionSettings, chooseCorruptionProfile } from './data/corruptionSettings.js';
import { xraySettings } from './data/xraySettings.js';
import { createCorruptionField, sampleCorruptionBlock } from './corruption-field.js';
import { artworkRect } from './artwork-transitions.js';
import { createAmbientFilm } from './ambient-film.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Prepare photo pixels once, never read pixels during pointer movement. */
function photoSource(image, maximum, settings) {
  const ratio = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const tables = ['red', 'green', 'blue'].map(name => xraySettings.channels[name]);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance = pixels.data[index] * .2126 + pixels.data[index + 1] * .7152 + pixels.data[index + 2] * .0722;
    for (let channel = 0; channel < 3; channel++) {
      const value = (luminance + (pixels.data[index + channel] - luminance) * xraySettings.saturation) / 255 * 8;
      const low = Math.min(7, Math.floor(value));
      const mapped = 255 * (tables[channel][low] + (tables[channel][low + 1] - tables[channel][low]) * (value - low));
      pixels.data[index + channel] += (mapped - pixels.data[index + channel]) * Math.min(1, settings.colorCorruption);
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** Actual source-pixel displacement with bounded, anchored temporal buffers.
 * The live DOM is never rasterized or made noninteractive. No Three.js import.
 */
export async function createCorruption({ image, settings = corruptionSettings } = {}) {
  const doc = document;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const profile = chooseCorruptionProfile({ coarsePointer: matchMedia('(pointer: coarse)').matches,
    memory: navigator.deviceMemory, cores: navigator.hardwareConcurrency, saveData: navigator.connection?.saveData });
  const quality = settings.quality[profile];
  const rendering = settings.rendering || corruptionSettings.rendering;
  const source = image || new Image();
  if (!image) {
    source.src = settings.assets[profile];
    await source.decode();
  }
  const background = doc.createElement('div');
  background.className = 'corruption-background';
  background.setAttribute('aria-hidden', 'true');
  background.style.backgroundImage = `url("${source.src}")`;
  doc.body.prepend(background);
  const ambient = createAmbientFilm({ image: source, container: background, settings: settings.ambient || corruptionSettings.ambient, profile });
  const backgroundSurface = { container: background, background: true, get source() { return ambient.source; } };
  const photos = new WeakMap();
  const regions = [];
  const removers = [];
  const timings = [];
  let active = false;
  let frame = 0;
  let pending = null;
  let previous = null;
  let lastPointer = null;
  let lastFrame = -Infinity;
  let frameCount = 0;
  let sequence = 0;
  let disposed = false;
  let maximumBlocks = quality.maximumBlocks;
  let viewport = { width: innerWidth, height: innerHeight };
  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  };

  function removeRegion(region) {
    region.field.clear();
    region.canvas.remove();
    regions.splice(regions.indexOf(region), 1);
    region.history.width = region.history.height = 1;
  }

  function clear() {
    cancelAnimationFrame(frame);
    frame = 0;
    pending = previous = lastPointer = null;
    for (const region of [...regions]) removeRegion(region);
    doc.documentElement.removeAttribute('data-corruption-running');
  }

  function surfaceAt(target) {
    const container = target?.closest?.('.artwork-viewer-stage, .artwork-open, .about-portrait');
    const photo = container?.querySelector('img:not(.artwork-flight-copy)');
    if (!photo?.complete || !photo.naturalWidth || container.querySelector('.artwork-flight-copy')
      || container.closest('.is-switching, .is-image-loading')) return backgroundSurface;
    let record = photos.get(photo);
    if (!record || record.url !== photo.currentSrc) {
      try {
        record = { container, photo, url: photo.currentSrc, source: photoSource(photo, quality.maximumPhotoDimension, settings), background: false };
        photos.set(photo, record);
        container.classList.add('corruption-photo-surface');
      } catch { return backgroundSurface; }
    }
    return record;
  }

  function mapping(surface) {
    if (surface.background) {
      if (ambient.sourceIsViewport) return { left: 0, top: 0, width: viewport.width, height: viewport.height,
        originX: 0, originY: 0, clipLeft: 0, clipTop: 0, clipRight: viewport.width, clipBottom: viewport.height };
      const scale = Math.max(viewport.width / source.naturalWidth, viewport.height / source.naturalHeight);
      const width = source.naturalWidth * scale;
      const height = source.naturalHeight * scale;
      return { left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height,
        originX: 0, originY: 0, clipLeft: 0, clipTop: 0, clipRight: viewport.width, clipBottom: viewport.height };
    }
    const rect = artworkRect(surface.photo);
    if (!rect || !surface.container.isConnected) return null;
    // At most one geometry read per active photo frame; magnification can be
    // transitioning. Ordinary pointer events perform no layout work.
    const parent = surface.container.getBoundingClientRect();
    return { left: rect.left - parent.left, top: rect.top - parent.top, width: rect.width, height: rect.height,
      originX: parent.left, originY: parent.top, clipLeft: 0, clipTop: 0, clipRight: parent.width, clipBottom: parent.height };
  }

  function regionAt(surface, point, map) {
    const local = { x: point.x - map.originX, y: point.y - map.originY, time: point.time };
    let region = regions.at(-1);
    if (region?.surface.container !== surface.container || local.x < region.x + 20 || local.x > region.x + region.width - 20
      || local.y < region.y + 20 || local.y > region.y + region.height - 20) {
      while (regions.length >= Math.max(1, Math.min(2, settings.quality.maximumRegions))) removeRegion(regions[0]);
      const width = Math.max(1, Math.min(quality.width, map.clipRight - map.clipLeft));
      const height = Math.max(1, Math.min(quality.height, map.clipBottom - map.clipTop));
      const x = clamp(local.x - width / 2, map.clipLeft, Math.max(map.clipLeft, map.clipRight - width));
      const y = clamp(local.y - height / 2, map.clipTop, Math.max(map.clipTop, map.clipBottom - height));
      const canvas = doc.createElement('canvas');
      canvas.className = 'corruption-region';
      canvas.dataset.corruptionRegion = String(++sequence);
      canvas.setAttribute('aria-hidden', 'true');
      canvas.width = Math.ceil(width);
      canvas.height = Math.ceil(height);
      Object.assign(canvas.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
      const history = doc.createElement('canvas');
      history.width = canvas.width;
      history.height = canvas.height;
      region = { canvas, history, context: canvas.getContext('2d'), historyContext: history.getContext('2d'),
        field: createCorruptionField({ settings, seed: sequence * 4711 }), surface, x, y, width, height, frames: 0 };
      surface.container.append(canvas);
      regions.push(region);
      if (!point.priorInput && previous?.container === surface.container) region.field.stroke({
        x: previous.x - map.originX, y: previous.y - map.originY, time: previous.time,
      });
    }
    // Several native moves may be coalesced before one paint. Preserve the
    // preceding raw position so a fast stroke cannot look like a stationary
    // first point merely because its first event missed the render cadence.
    const prior = point.priorInput;
    const priorContainer = prior?.target?.closest?.('.artwork-viewer-stage, .artwork-open, .about-portrait') || background;
    if (prior && priorContainer === surface.container) region.field.stroke({
      x: prior.x - map.originX, y: prior.y - map.originY, time: prior.time,
    });
    region.field.stroke(local);
    previous = { ...point, container: surface.container };
  }

  function copyPixels(context, region, map, sx, sy, sw, sh, dx, dy, dw, dh) {
    const bitmap = region.surface.source;
    const width = bitmap.naturalWidth || bitmap.width;
    const height = bitmap.naturalHeight || bitmap.height;
    const scaleX = width / map.width;
    const scaleY = height / map.height;
    const sourceWidth = Math.max(1, Math.min(width, sw * scaleX));
    const sourceHeight = Math.max(1, Math.min(height, sh * scaleY));
    context.drawImage(bitmap, clamp((sx - map.left) * scaleX, 0, width - sourceWidth),
      clamp((sy - map.top) * scaleY, 0, height - sourceHeight), sourceWidth, sourceHeight,
      dx - region.x, dy - region.y, dw, dh);
  }

  function paint(region, now) {
    const samples = region.field.sample(now);
    const map = mapping(region.surface);
    if (!samples.length || !map || !region.surface.container.isConnected) { removeRegion(region); return; }
    const context = region.context;
    context.clearRect(0, 0, region.width, region.height);
    let drawn = 0;
    // Strongest/recent damage gets a bounded drawing budget. Every rectangle
    // contains sampled image pixels, never a randomly colored square.
    for (const impulse of samples.toSorted((a, b) => b.energy - a.energy)) {
      const cell = impulse.blockSize;
      const firstColumn = Math.floor((impulse.x - impulse.radiusX) / cell);
      const lastColumn = Math.ceil((impulse.x + impulse.radiusX) / cell);
      const firstRow = Math.floor((impulse.y - impulse.radiusY) / cell);
      const lastRow = Math.ceil((impulse.y + impulse.radiusY) / cell);
      for (let row = firstRow; row <= lastRow && drawn < maximumBlocks; row++) {
        for (let column = firstColumn; column <= lastColumn && drawn < maximumBlocks; column++) {
          const x = column * cell;
          const y = row * cell;
          if (x + cell < region.x || y + cell < region.y || x > region.x + region.width || y > region.y + region.height) continue;
          const distance = ((x + cell / 2 - impulse.x) / impulse.radiusX) ** 2 + ((y + cell / 2 - impulse.y) / impulse.radiusY) ** 2;
          if (distance > 1) continue;
          const block = sampleCorruptionBlock(impulse, column, row);
          const opacity = block.opacity * Math.min(1, (1 - distance) * 3);
          if (opacity < .005) continue;
          context.globalAlpha = opacity;
          copyPixels(context, region, map, x - block.offsetX, y - block.offsetY, cell, cell,
            x, y, cell + Math.min(rendering.maximumSourceStretch, block.smearLength * rendering.sourceSmearRatio), cell);
          // A displaced sample of the previous damaged frame produces actual
          // temporal persistence, rather than a decorative noise overlay.
          if (region.frames && impulse.speed > .15) {
            context.globalAlpha = opacity * rendering.historyOpacity;
            const hx = clamp(x - region.x - block.offsetX * .6, 0, Math.max(0, region.width - cell));
            const hy = clamp(y - region.y, 0, Math.max(0, region.height - cell));
            context.drawImage(region.history, hx, hy, cell, cell, x - region.x, y - region.y,
              cell + Math.min(rendering.maximumHistoryStretch, block.smearLength * rendering.historySmearRatio), cell);
          }
          if (impulse.speed > .3 && drawn % rendering.stripeEvery === 0) {
            context.globalAlpha = opacity * rendering.stripeOpacity;
            copyPixels(context, region, map, x + block.channelShift * settings.field.channelOffsetPx, y, cell / 4, Math.max(2, cell / 6),
              x - block.channelShift, y + cell * .6, cell + block.smearLength, Math.max(2, cell / 6));
          }
          drawn++;
        }
      }
    }
    context.globalAlpha = 1;
    region.historyContext.globalCompositeOperation = 'copy';
    region.historyContext.drawImage(region.canvas, 0, 0);
    region.canvas.dataset.corruptionFrame = String(++region.frames);
  }

  function tick(now) {
    frame = 0;
    if (!active || disposed || doc.hidden || reduced.matches) return clear();
    if (now - lastFrame < 1000 / quality.framesPerSecond) { frame = requestAnimationFrame(tick); return; }
    lastFrame = now;
    const started = performance.now();
    if (pending) {
      const point = pending;
      pending = null;
      const surface = surfaceAt(point.target);
      const map = mapping(surface);
      if (map) regionAt(surface, point, map);
    }
    for (const region of [...regions]) paint(region, now);
    const duration = performance.now() - started;
    timings.push(duration);
    if (timings.length > 240) timings.shift();
    if (duration > 12 && maximumBlocks > quality.minimumBlocks) maximumBlocks = Math.max(quality.minimumBlocks, maximumBlocks - 8);
    frameCount++;
    if (regions.length || pending) {
      doc.documentElement.setAttribute('data-corruption-running', '');
      frame = requestAnimationFrame(tick);
    } else doc.documentElement.removeAttribute('data-corruption-running');
  }

  listen(doc, 'pointermove', event => {
    if (!active || reduced.matches || doc.hidden || event.isPrimary === false) return;
    if (event.target?.closest?.('[data-other-side-hint], [data-corruption-protected]')) {
      pending = null;
      previous = lastPointer = null;
      return;
    }
    // Layout and hover changes can synthesize boundary movement under a still
    // pointer. Only a new physical position refreshes a recovering field.
    if (lastPointer && Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) < .5) return;
    const point = { x: event.clientX, y: event.clientY, time: performance.now(), target: event.target };
    pending = { ...point, priorInput: lastPointer };
    lastPointer = point;
    if (!frame) {
      doc.documentElement.setAttribute('data-corruption-running', '');
      frame = requestAnimationFrame(tick);
    }
  }, { passive: true });
  listen(doc, 'pointerout', event => { if (!event.relatedTarget) { previous = lastPointer = null; for (const region of regions) region.field.resetPointer(); } });
  listen(window, 'blur', clear);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) clear(); });
  listen(doc, 'h4:pagechange', clear);
  listen(window, 'resize', () => {
    viewport = { width: innerWidth, height: innerHeight };
    clear();
    ambient.resize(viewport);
  }, { passive: true });
  listen(reduced, 'change', clear);
  const snapshot = () => ({ active, queued: Boolean(frame), regions: regions.length, frames: frameCount,
    maximumBlocks, drawMs: [...timings], source: source.src, quality, ambient: ambient.snapshot() });
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) window.__H4_CORRUPTION__ = { snapshot };
  return {
    setActive(value) { active = value; if (!active) clear(); ambient.setActive(active); },
    snapshot,
    dispose() { disposed = true; clear(); ambient.dispose(); for (const remove of removers) remove(); background.remove(); delete window.__H4_CORRUPTION__; },
  };
}
