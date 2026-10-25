import './corruption.css';
import { corruptionSettings, chooseCorruptionProfile } from './data/corruptionSettings.js';
import { xraySettings } from './data/xraySettings.js';
import { createCorruptionField, sampleCorruptionBlock } from './corruption-field.js';
import { artworkRect } from './artwork-transitions.js';
import { createAmbientFilm } from './ambient-film.js';
import { temporalMoshSettings } from './data/temporalMoshSettings.js';
import { paintTemporalPixels } from './temporal-mosh.js';
import { getLivingDecaySettings, livingDecayMaterialAssets, subscribeLivingDecay } from './data/livingDecaySettings.js';

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
    source.src = livingDecayMaterialAssets[profile];
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
  let pendingImpulses = [];
  let previous = null;
  let lastPointer = null;
  let lastFrame = -Infinity;
  let frameCount = 0;
  let sequence = 0;
  let disposed = false;
  let receivedImpulses = 0;
  let pendingTransition = null;
  let sharedInputs = 0;
  let rememberedSurfaces = 0;
  let paintedBlocks = 0;
  let reconstructedBlocks = 0;
  let maximumBlocks = quality.maximumBlocks;
  let viewport = { width: innerWidth, height: innerHeight };
  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    removers.push(() => target.removeEventListener(name, callback, options));
  };
  // A new tuning object is created only when calibration changes. The shared
  // frozen defaults and per-frame getters are never mutated or cloned.
  let feedbackSettings = { ...temporalMoshSettings, feedbackOpacity: getLivingDecaySettings().feedbackPersistence };
  removers.push(subscribeLivingDecay(value => {
    feedbackSettings = { ...temporalMoshSettings, feedbackOpacity: value.feedbackPersistence };
  }));

  function removeRegion(region) {
    region.field.clear();
    region.canvas.remove();
    regions.splice(regions.indexOf(region), 1);
    region.history.width = region.history.height = 1;
    region.canvas.width = region.canvas.height = 1;
  }

  function clear({ remember = false } = {}) {
    cancelAnimationFrame(frame);
    frame = 0;
    pending = previous = lastPointer = null;
    pendingImpulses = [];
    for (const region of [...regions]) {
      // Native navigation snapshots retain outgoing DOM pixels separately.
      // Actual photo history can additionally enter the shared material field
      // before its old route container is detached. Never reset that field.
      if (remember && active && region.lastMap) {
        const map = region.lastMap;
        ambient.rememberSurface({ image: region.history, rect: {
          left: map.originX + region.x, top: map.originY + region.y,
          width: region.width, height: region.height,
        }, opacity: .4, time: performance.now() });
        rememberedSurfaces++;
      }
      removeRegion(region);
    }
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
      // Capture the real local source once. Unlike the transparent displayed
      // overlay, this opaque keyframe survives a later ambient/source change.
      copyPixels(region.historyContext, region, map, x, y, width, height, x, y, width, height);
      surface.container.append(canvas);
      regions.push(region);
      if (!point.kind && !point.priorInput && previous?.container === surface.container) region.field.stroke({
        x: previous.x - map.originX, y: previous.y - map.originY, time: previous.time,
      });
    }
    if (point.kind) {
      if (point.vectors?.length) {
        for (const vector of point.vectors.slice(0, 8)) {
          if (![vector.x, vector.y, vector.dx, vector.dy].every(Number.isFinite)) continue;
          region.field.impulse({ x: vector.x - map.originX, y: vector.y - map.originY, time: point.time,
            kind: point.kind, strength: point.strength * clamp(Number.isFinite(vector.weight) ? vector.weight : 1, 0, 1),
            dx: vector.dx, dy: vector.dy });
        }
      } else region.field.impulse({ ...local, kind: point.kind, strength: point.strength, dx: point.dx, dy: point.dy });
      return;
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
    const living = getLivingDecaySettings();
    const samples = region.field.sample(now).map(impulse => {
      if (impulse.eventInput) return { ...impulse, blockSize: Math.max(6, Math.round(living.blockSize * (.55 + impulse.drive * .45))) };
      const strength = living.cursorMosh;
      return { ...impulse, radiusX: living.cursorRadius, radiusY: living.cursorRadius * .7,
        energy: Math.min(1, impulse.energy * strength),
        blockSize: Math.max(6, Math.round(Math.min(living.cursorRadius * .85, living.blockSize * (.35 + impulse.drive * .65)))),
        displacementX: clamp(impulse.displacementX * strength, -living.cursorRadius * 1.3, living.cursorRadius * 1.3),
        displacementY: clamp(impulse.displacementY * strength, -living.cursorRadius, living.cursorRadius),
        smearLength: Math.min(impulse.smearLength * strength, living.cursorRadius * 2),
      };
    });
    const map = mapping(region.surface);
    if (!samples.length || !map || !region.surface.container.isConnected) { removeRegion(region); return; }
    region.lastMap = map;
    const blocks = [];
    // Strongest/recent damage gets a bounded drawing budget. Every rectangle
    // contains sampled image pixels, never a randomly colored square.
    for (const impulse of samples.toSorted((a, b) => b.energy - a.energy)) {
      const cell = impulse.blockSize;
      const firstColumn = Math.floor((impulse.x - impulse.radiusX) / cell);
      const lastColumn = Math.ceil((impulse.x + impulse.radiusX) / cell);
      const firstRow = Math.floor((impulse.y - impulse.radiusY) / cell);
      const lastRow = Math.ceil((impulse.y + impulse.radiusY) / cell);
      for (let row = firstRow; row <= lastRow && blocks.length < maximumBlocks; row++) {
        for (let column = firstColumn; column <= lastColumn && blocks.length < maximumBlocks; column++) {
          const x = column * cell;
          const y = row * cell;
          if (x + cell < region.x || y + cell < region.y || x > region.x + region.width || y > region.y + region.height) continue;
          const distance = ((x + cell / 2 - impulse.x) / impulse.radiusX) ** 2 + ((y + cell / 2 - impulse.y) / impulse.radiusY) ** 2;
          if (distance > 1) continue;
          const block = sampleCorruptionBlock(impulse, column, row);
          const opacity = block.opacity * Math.min(1, (1 - distance) * 3);
          if (opacity < .005) continue;
          const pixels = { x: x - region.x, y: y - region.y, width: cell, height: cell,
            offsetX: block.offsetX, offsetY: block.offsetY, opacity, progress: impulse.progress,
            stretch: Math.min(rendering.maximumHistoryStretch, block.smearLength * rendering.historySmearRatio) };
          if (impulse.drive > .3 && blocks.length % rendering.stripeEvery === 0) pixels.stripe = {
            x: pixels.x - block.channelShift, y: pixels.y + cell * .6, width: cell / 4,
            height: Math.max(2, cell / 6), offsetX: -block.channelShift * (settings.field?.channelOffsetPx || 0), offsetY: cell * .6,
            opacity: opacity * rendering.stripeOpacity, stretch: cell * .75 + block.smearLength,
          };
          blocks.push(pixels);
        }
      }
    }
    const result = paintTemporalPixels({ context: region.context, history: region.history, historyContext: region.historyContext,
      width: region.width, height: region.height, blocks, frame: region.frames,
      settings: feedbackSettings,
      drawSource(context, block) {
        copyPixels(context, region, map, block.x + region.x - block.offsetX, block.y + region.y - block.offsetY,
          block.width, block.height, block.x + region.x, block.y + region.y, block.width + block.stretch, block.height);
      } });
    paintedBlocks += result.drawn;
    reconstructedBlocks += result.reconstructed;
    // Compression blocks and stretches may reach outside their input radius.
    // Keep the displayed damage inside the union of the real input footprints;
    // the opaque history remains available for subsequent pixel feedback.
    region.context.save();
    region.context.globalCompositeOperation = 'destination-in';
    region.context.globalAlpha = 1;
    region.context.beginPath();
    for (const impulse of samples) {
      region.context.moveTo(impulse.x - region.x + impulse.radiusX, impulse.y - region.y);
      region.context.ellipse(impulse.x - region.x, impulse.y - region.y, impulse.radiusX, impulse.radiusY, 0, 0, Math.PI * 2);
    }
    region.context.fill();
    region.context.restore();
    region.canvas.dataset.corruptionFrame = String(++region.frames);
  }

  function tick(now) {
    frame = 0;
    if (!active || disposed || doc.documentElement.dataset.mode !== 'xray' || doc.hidden || reduced.matches) return clear();
    if (now - lastFrame < 1000 / quality.framesPerSecond) { frame = requestAnimationFrame(tick); return; }
    lastFrame = now;
    const started = performance.now();
    if (pending) {
      const point = pending;
      pending = null;
      const surface = surfaceAt(point.target);
      ambient.stroke(point);
      sharedInputs++;
      if (!surface.background) {
        const map = mapping(surface);
        if (map) regionAt(surface, point, map);
      }
    }
    for (const point of pendingImpulses.splice(0)) {
      if (point.target?.isConnected === false) continue;
      const surface = surfaceAt(point.target);
      ambient.impulse(point);
      sharedInputs++;
      if (!surface.background) {
        const living = getLivingDecaySettings();
        const control = { hover: 'hoverMosh', focus: 'hoverMosh', 'hover-motion': 'hoverMosh', click: 'clickMosh',
          navigation: 'navigationMosh', section: 'sectionMosh', scroll: 'scrollMosh', typography: 'typographyMosh', logo: 'heroMosh' }[point.kind];
        const strength = point.strength * (living[control] ?? 1);
        const map = strength > 0 && mapping(surface);
        if (map) regionAt(surface, { ...point, strength: clamp(strength, 0, 1) }, map);
      }
    }
    for (const region of [...regions]) paint(region, now);
    const duration = performance.now() - started;
    timings.push(duration);
    if (timings.length > 240) timings.shift();
    if (duration > 12 && maximumBlocks > quality.minimumBlocks) maximumBlocks = Math.max(quality.minimumBlocks, maximumBlocks - 8);
    frameCount++;
    if (regions.length || pending || pendingImpulses.length) {
      doc.documentElement.setAttribute('data-corruption-running', '');
      frame = requestAnimationFrame(tick);
    } else doc.documentElement.removeAttribute('data-corruption-running');
  }

  function queueImpulse(detail) {
    if (!active || disposed || doc.documentElement.dataset.mode !== 'xray' || reduced.matches || doc.hidden
      || !Object.hasOwn(temporalMoshSettings.impulses, detail?.kind) || ![detail.x, detail.y, detail.strength].every(Number.isFinite)
      || detail.strength <= 0 || typeof detail.target?.closest !== 'function' || detail.target.isConnected === false
      || detail.target?.closest?.('[data-other-side-hint], [data-corruption-protected]')) return;
    // Discrete input already carries viewport coordinates. Keep it on its real
    // surface; do no event-time layout or cross-surface pointer interpolation.
    pendingImpulses.push({ kind: detail.kind, target: detail.target, time: performance.now(),
      x: clamp(detail.x, 0, viewport.width), y: clamp(detail.y, 0, viewport.height),
      strength: clamp(detail.strength, 0, 1), dx: detail.dx, dy: detail.dy, deltaMs: detail.deltaMs,
      vectors: detail.vectors?.slice(0, 8).map(vector => ({ x: vector.x, y: vector.y,
        dx: vector.dx, dy: vector.dy, weight: vector.weight })) });
    if (pendingImpulses.length > temporalMoshSettings.maximumQueuedImpulses) pendingImpulses.shift();
    receivedImpulses++;
    if (!frame) {
      doc.documentElement.setAttribute('data-corruption-running', '');
      frame = requestAnimationFrame(tick);
    }
  }

  listen(doc, 'h4:moshimpulse', event => queueImpulse(event.detail));
  listen(doc, 'h4:scrollmotion', event => {
    if (active && !disposed && !doc.hidden && !reduced.matches) ambient.setMotion(event.detail);
  });
  function transitionIntent(detail) {
    if (disposed || reduced.matches || doc.hidden || !['mode', 'navigation'].includes(detail?.kind)) return;
    const impulse = { kind: detail.kind, x: viewport.width / 2, y: viewport.height / 2,
      strength: clamp(Number(detail.strength) || 1, 0, 2), direction: detail.direction,
      mode: detail.mode, duration: detail.duration, variant: detail.variant, time: performance.now() };
    if (active) ambient.impulse(impulse);
    else if (detail.kind === 'mode' && detail.mode === 'xray') pendingTransition = impulse;
  }
  listen(doc, 'h4:transitionintent', event => transitionIntent(event.detail));

  listen(doc, 'pointermove', event => {
    if (!active || disposed || doc.documentElement.dataset.mode !== 'xray' || reduced.matches || doc.hidden || event.isPrimary === false
      || getLivingDecaySettings().cursorMosh <= 0) return;
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
  listen(doc, 'h4:pagechange', () => clear({ remember: true }));
  listen(window, 'resize', () => {
    viewport = { width: innerWidth, height: innerHeight };
    clear();
    ambient.resize(viewport);
  }, { passive: true });
  listen(reduced, 'change', clear);
  const snapshot = () => ({ active, queued: Boolean(frame), regions: regions.length, frames: frameCount,
    maximumBlocks, pendingImpulses: pendingImpulses.length, receivedImpulses, paintedBlocks, reconstructedBlocks,
    sharedInputs, rememberedSurfaces,
    drawMs: [...timings], source: source.src, quality, ambient: ambient.snapshot() });
  const controller = {
    setActive(value) {
      if (disposed) return;
      active = value;
      if (!active) clear();
      ambient.setActive(active);
      if (active && pendingTransition) ambient.impulse(pendingTransition);
      pendingTransition = null;
    },
    impulse: queueImpulse,
    transition: transitionIntent,
    configureLivingDecay: patch => disposed ? ambient.readSettings() : ambient.configure(patch),
    readLivingDecaySettings: ambient.readSettings,
    regenerateLivingDecay(value) { if (!disposed) clear(); return ambient.regenerate(value); },
    restoreLivingDecay(value) { if (!disposed) clear(); return ambient.restore(value); },
    snapshot,
    dispose() { disposed = true; clear(); ambient.dispose(); for (const remove of removers) remove(); background.remove(); delete window.__H4_CORRUPTION__; },
  };
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) window.__H4_CORRUPTION__ = controller;
  return controller;
}
