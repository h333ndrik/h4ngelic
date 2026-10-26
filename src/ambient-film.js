import { ambientFilmSettings } from './data/ambientFilmSettings.js';
import { configureLivingDecay, getLivingDecaySettings, normalizeLivingSeed, subscribeLivingDecay } from './data/livingDecaySettings.js';
import { createLivingComposition, renderLivingMaterial, livingCodecFragment } from './living-decay-material.js';
import { createImageMemoryField, paintImageMemory } from './image-memory.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const smooth = value => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };

function random(seed, salt = 0) {
  let value = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  return ((value ^ value >>> 16) >>> 0) / 0x100000000;
}

/** Bounded backing-store size, independent of device pixel ratio. */
export function ambientFilmSize(width, height, quality) {
  const viewportWidth = Math.max(1, finite(width, 1));
  const viewportHeight = Math.max(1, finite(height, 1));
  const ratio = Math.min(1, quality.maximumWidth / viewportWidth, quality.maximumHeight / viewportHeight);
  return { width: Math.max(1, Math.round(viewportWidth * ratio)), height: Math.max(1, Math.round(viewportHeight * ratio)) };
}

/** Two overlapping generations keep new chemical regions from snapping in.
 * This describes texture masks, not particles; every visible pixel is sampled
 * from the provided film or the preceding composite.
 */
export function chemicalPatch(seed, index, generation, age, settings = ambientFilmSettings) {
  const key = (seed ^ Math.imul(index + 1, 19349663) ^ Math.imul(generation + 113, 83492791)) >>> 0;
  const progress = clamp(age, 0, 1);
  const life = smooth(progress * 5) * smooth((1 - progress) * 5);
  return {
    seed: key,
    x: -.08 + random(key, 1) * 1.16 + (random(key, 2) - .5) * .25 * progress,
    y: -.1 + random(key, 3) * 1.2 + (random(key, 4) - .5) * .22 * progress,
    radius: (settings.minimumPatchRadius + random(key, 5) * (settings.maximumPatchRadius - settings.minimumPatchRadius)) * (.72 + smooth(progress) * .55),
    rotation: (random(key, 6) - .5) * .9 + (random(key, 7) - .5) * .24 * progress,
    opacity: life * (.5 + random(key, 8) * .5),
    variant: Math.floor(random(key, 9) * (settings.palette.length + 1)),
    sourceX: random(key, 10), sourceY: random(key, 11),
  };
}

/** Saturated chemical midtones retain the original luminance detail. Only
 * burned highlights converge to white; ordinary light pixels stay chromatic.
 */
export function chemicalColorTables(color) {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : '#7800ff';
  const pigment = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return pigment.map(channel => Uint8ClampedArray.from({ length: 256 }, (_, index) => {
    const luminance = index / 255;
    const light = Math.pow(clamp((luminance - .04) / .83, 0, 1), .76);
    const white = smooth((luminance - .84) / .13);
    return 255 * (clamp(.018 + channel * light * 1.35, 0, 1) * (1 - white) + Math.min(1, luminance * 1.08) * white);
  }));
}

/** One continuous sampled-image material with bounded, independent regional
 * feedback. It owns no WebGL context and never captures the DOM or hero.
 */
export function createAmbientFilm({ image, container, settings = ambientFilmSettings, profile = 'desktop', view = window, doc = document, seed } = {}) {
  const quality = settings[profile] || settings.desktop;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = doc.createElement('canvas');
  canvas.className = 'corruption-ambient';
  canvas.setAttribute('data-corruption-ambient', '');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const history = doc.createElement('canvas');
  const historyContext = history.getContext('2d', { alpha: false });
  const material = doc.createElement('canvas');
  const materialContext = material.getContext('2d', { alpha: false });
  const sample = doc.createElement('canvas');
  const removers = [];
  const times = [];
  let active = false;
  let activated = false;
  let disposed = false;
  let timer = 0;
  let scheduledCadence = 0;
  let frame = 0;
  let frames = 0;
  let regenerations = 0;
  let validSource = false;
  let elapsed = 0;
  let previousTime = null;
  let viewport = { width: view.innerWidth, height: view.innerHeight };
  let prepared = false;
  let sourcePixels = null;
  let preparationMs = 0;
  let cadence = Math.max(1, quality.framesPerSecond);
  let controls = getLivingDecaySettings();
  // Null in the shared controls means automatic seeds. The actual runtime
  // seed is reported separately, so a fresh seed never changes that policy.
  let currentSeed = seed === undefined ? controls.seed ?? freshSeed() : normalizeLivingSeed(seed);
  let composition = createLivingComposition(currentSeed, controls);
  let motion = { x: 0, y: 0, strength: 0, time: 0 };
  let flow = { x: 0, y: 0, strength: 0 };
  let codec = [];
  let memory = createImageMemoryField({ width: canvas.width, height: canvas.height, seed: currentSeed,
    maxCells: quality.maximumCells || 1400, persistent: true });
  let parallax = { x: 0, y: 0 };
  let previousPointer = null;
  let advectedBlocks = 0, recoveredBlocks = 0, carriedSurfaces = 0;
  let lastInputTime = -Infinity;
  let activeCadence = quality.activeFramesPerSecond || (profile === 'mobile' ? 18 : 24);
  const now = () => view.performance.now();
  const listen = (target, type, callback) => {
    target.addEventListener(type, callback);
    removers.push(() => target.removeEventListener(type, callback));
  };
  const canRun = () => active && settings.enabled && !disposed && !doc.hidden && !reduced.matches
    && Boolean(context && historyContext && materialContext);

  function freshSeed() {
    let value;
    if (view.crypto?.getRandomValues) value = view.crypto.getRandomValues(new Uint32Array(1))[0];
    else value = Math.floor(Math.random() * 0x100000000) >>> 0;
    return value;
  }

  function stop() {
    view.clearTimeout(timer);
    view.cancelAnimationFrame(frame);
    timer = frame = 0;
    previousTime = null;
  }

  function announceSeed() {
    const EventConstructor = view.CustomEvent || globalThis.CustomEvent;
    if (typeof EventConstructor === 'function') doc.dispatchEvent(new EventConstructor('h4:livingseed', {
      detail: { seed: currentSeed, elapsed, regenerations },
    }));
  }

  function resetComposition(value, age = 0) {
    stop();
    currentSeed = normalizeLivingSeed(value, currentSeed);
    controls = getLivingDecaySettings();
    composition = createLivingComposition(currentSeed, controls);
    elapsed = Math.max(0, finite(age, 0));
    validSource = prepared = false;
    motion = { x: 0, y: 0, strength: 0, time: 0 };
    flow = { x: 0, y: 0, strength: 0 };
    memory = createImageMemoryField({ width: canvas.width, height: canvas.height, cellSize: controls.blockSize,
      seed: currentSeed, maxCells: quality.maximumCells || 1400, persistent: true });
    parallax = { x: 0, y: 0 }; previousPointer = null;
    regenerations++;
    canvas.dataset.livingSeed = String(currentSeed);
    if (active) sync();
    announceSeed();
    return currentSeed;
  }

  function regenerate(value) {
    let next = value === undefined ? freshSeed() : normalizeLivingSeed(value, currentSeed);
    if (value === undefined && next === currentSeed) next = (next + 0x9e3779b1) >>> 0;
    return resetComposition(next);
  }

  function prepareMaterial() {
    if (prepared) return;
    const started = now();
    material.width = canvas.width;
    material.height = canvas.height;
    if (!sourcePixels) {
      const ratio = Math.min(1, quality.sourceDimension / Math.max(image.naturalWidth, image.naturalHeight));
      sample.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      sample.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      try {
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        sampleContext.drawImage(image, 0, 0, sample.width, sample.height);
        sourcePixels = { pixels: sampleContext.getImageData(0, 0, sample.width, sample.height), width: sample.width, height: sample.height };
      } catch { /* A restricted source retains sampled-image compositing. */ }
      sample.width = sample.height = 1;
    }
    composition = createLivingComposition(currentSeed, controls);
    if (sourcePixels) {
      const output = materialContext.createImageData(material.width, material.height);
      renderLivingMaterial({ source: sourcePixels.pixels.data, sourceWidth: sourcePixels.width, sourceHeight: sourcePixels.height,
        width: material.width, height: material.height, composition, settings: controls, output: output.data });
      materialContext.putImageData(output, 0, 0);
    } else {
      const width = image.naturalWidth / composition.source.scale;
      const height = Math.min(image.naturalHeight, width * material.height / material.width);
      materialContext.drawImage(image, (image.naturalWidth - width) * composition.source.x,
        (image.naturalHeight - height) * composition.source.y, width, height, 0, 0, material.width, material.height);
    }
    const count = quality.codecFragments || (profile === 'mobile' ? 64 : 156);
    codec = Array.from({ length: count }, (_, index) => livingCodecFragment(composition, index, controls));
    // Pixel remnants come from the same composed image. No independent source
    // rectangles, material cards or smooth oval masks are introduced.
    materialContext.globalCompositeOperation = 'source-over';
    for (const fragment of codec) {
      const width = Math.max(1, Math.min(material.width, fragment.width * material.width));
      const height = Math.max(1, Math.min(material.height, fragment.height * material.height));
      const x = clamp(fragment.x * material.width, 0, material.width - width);
      const y = clamp(fragment.y * material.height, 0, material.height - height);
      materialContext.globalAlpha = fragment.opacity * .52;
      materialContext.drawImage(material, clamp(x - fragment.dx * material.width, 0, material.width - width),
        clamp(y - fragment.dy * material.height, 0, material.height - height), width, height,
        x, y, Math.min(material.width - x, width * fragment.stretch), height);
    }
    materialContext.globalAlpha = 1;
    prepared = true;
    preparationMs = now() - started;
  }

  function parallaxOffset() {
    // Finite source images cannot travel forever at a constant ratio without
    // tiling. Ease continuously into overscan instead of a hard frozen clamp.
    const soften = (value, limit) => limit * 2 / Math.PI * Math.atan(value / limit * Math.PI / 2);
    return { x: soften(parallax.x, viewport.width * .205), y: soften(parallax.y, viewport.height * .205) };
  }

  function sourceRect() {
    // A continuous overscanned source, not a translated DOM layer or tiles.
    // At .70 crop there is ~21% viewport travel available in either direction.
    const width = material.width * .7, height = material.height * .7;
    const offset = parallaxOffset();
    return { x: (material.width - width) / 2 + offset.x / viewport.width * width,
      y: (material.height - height) / 2 + offset.y / viewport.height * height, width, height };
  }

  function wake() {
    if (!canRun()) return;
    lastInputTime = now();
    // Replace the idle timer with the *same* scheduler at its active cadence.
    // A burst of DOM input never creates one render per event.
    if (timer && scheduledCadence < activeCadence) { view.clearTimeout(timer); timer = 0; }
    schedule();
  }

  function input(point, gain = 1, radius = 70) {
    const sx = canvas.width / viewport.width, sy = canvas.height / viewport.height;
    const result = memory.impulse({ kind: point.kind, x: point.x * sx, y: point.y * sy,
      dx: point.dx * sx, dy: point.dy * sy, deltaMs: point.deltaMs,
      strength: point.strength * gain, radius: radius * Math.max(sx, sy), time: point.time ?? now() });
    if (result) wake();
    return result;
  }

  function impulse(detail = {}) {
    if (!canRun() || ![detail.x, detail.y, detail.strength].every(Number.isFinite) || detail.strength <= 0) return false;
    const gains = { cursor: controls.cursorMosh, hover: controls.hoverMosh, focus: controls.hoverMosh,
      'hover-motion': controls.hoverMosh, click: controls.clickMosh, navigation: controls.navigationMosh,
      section: controls.sectionMosh, scroll: controls.scrollMosh, typography: controls.typographyMosh,
      type: controls.typographyMosh, logo: controls.heroMosh, mode: 2 };
    if (!Object.hasOwn(gains, detail.kind) || gains[detail.kind] <= 0) return false;
    const gain = gains[detail.kind];
    const radius = detail.kind === 'cursor' ? controls.cursorRadius
      : detail.kind === 'hover-motion' || detail.kind === 'hover' ? 70
      : detail.kind === 'logo' ? 118 : detail.kind === 'mode' ? Math.max(viewport.width, viewport.height) : 135;
    if (Array.isArray(detail.vectors) && detail.vectors.length) {
      let accepted = false;
      for (const vector of detail.vectors.slice(0, 12)) {
        if (![vector.x, vector.y, vector.dx, vector.dy].every(Number.isFinite)) continue;
        accepted = input({ ...vector, kind: detail.kind, time: detail.time,
          deltaMs: detail.deltaMs, strength: detail.strength * clamp(finite(vector.weight, 1), 0, 1) }, gain, radius) || accepted;
      }
      return accepted;
    }
    if (detail.kind === 'mode' || detail.kind === 'navigation') {
      const reverse = detail.direction === 'reverse' || detail.direction === 'leaving' || detail.mode === 'normal';
      let accepted = false;
      for (let index = 0; index < 6; index++) {
        const x = ((index % 3) + .5) / 3 * viewport.width;
        const y = (Math.floor(index / 3) + .5) / 2 * viewport.height;
        const direction = reverse ? -1 : 1;
        accepted = input({ kind: detail.kind, x, y, dx: direction * (x - viewport.width / 2) * .23,
          dy: direction * (y - viewport.height / 2) * .15, deltaMs: 80,
          strength: detail.strength, time: detail.time }, gain, radius * .58) || accepted;
      }
      return accepted;
    }
    if (Number.isFinite(detail.dx) && Number.isFinite(detail.dy)) return input(detail, gain, radius);
    // A stationary click pushes the *existing* image away from the target.
    // No fresh randomized texture is generated by this event.
    let accepted = false;
    for (const sign of [-1, 1]) accepted = input({ ...detail, x: detail.x + sign * radius * .26,
      dx: sign * 18, dy: sign * 3, deltaMs: 70 }, gain, radius * .72) || accepted;
    return accepted;
  }

  function stroke(point = {}) {
    if (!canRun() || ![point.x, point.y, point.time].every(Number.isFinite)) return false;
    const previous = Object.hasOwn(point, 'priorInput') ? point.priorInput : previousPointer;
    previousPointer = { x: point.x, y: point.y, time: point.time };
    if (!previous || point.time - previous.time > 250 || point.time < previous.time) return false;
    const dx = point.x - previous.x, dy = point.y - previous.y;
    if (Math.hypot(dx, dy) < .25) return false;
    const count = Math.min(8, Math.max(1, Math.ceil(Math.hypot(dx, dy) / controls.cursorRadius)));
    let accepted = false;
    for (let index = 1; index <= count; index++) accepted = impulse({ kind: 'cursor',
      x: previous.x + dx * index / count, y: previous.y + dy * index / count, dx, dy,
      deltaMs: Math.max(8, point.time - previous.time), time: point.time,
      strength: finite(point.strength, .45 + Math.min(1, Math.hypot(dx, dy) / Math.max(8, point.time - previous.time)) * .4) }) || accepted;
    return accepted;
  }

  function setMotion(value = {}) {
    if (!canRun() || ![value.x, value.y, value.strength].every(Number.isFinite)) return;
    motion = { x: clamp(value.x, -4, 4), y: clamp(value.y, -4, 4), strength: clamp(value.strength, 0, 2),
      time: clamp(finite(value.time, now()), now() - 1000, now()) };
    const dx = clamp(finite(value.deltaX), -1e7, 1e7), dy = clamp(finite(value.deltaY), -1e7, 1e7);
    // Only native displacement changes the source position. Inertia-tail
    // events explicitly carry delta=0 and cannot fabricate parallax travel.
    parallax.x = clamp(parallax.x + dx * controls.parallaxStrength, -1e7, 1e7);
    parallax.y = clamp(parallax.y + dy * controls.parallaxStrength, -1e7, 1e7);
    if (motion.strength <= .001 || controls.scrollMosh <= 0) return;
    const dt = clamp(finite(value.deltaMs, 80), 8, 150);
    for (let index = 0; index < 6; index++) input({ kind: 'scroll',
      x: ((index % 3) + .5) / 3 * viewport.width, y: (Math.floor(index / 3) + .5) / 2 * viewport.height,
      dx: motion.x * dt * controls.scrollStrength * .34,
      dy: motion.y * dt * controls.scrollStrength * .34,
      deltaMs: dt, strength: motion.strength * .65, time: motion.time },
      controls.scrollMosh, Math.max(viewport.width / 3, viewport.height / 2));
  }

  function rememberSurface({ image: bitmap, rect, opacity = .4, time = now() } = {}) {
    if (!canRun() || !bitmap || !rect || ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
      || rect.width <= 0 || rect.height <= 0 || !validSource) return false;
    const sx = canvas.width / viewport.width, sy = canvas.height / viewport.height;
    historyContext.globalCompositeOperation = 'source-over'; historyContext.globalAlpha = clamp(opacity, 0, .8);
    historyContext.drawImage(bitmap, rect.left * sx, rect.top * sy, rect.width * sx, rect.height * sy);
    historyContext.globalAlpha = 1;
    context.drawImage(history, 0, 0);
    carriedSurfaces++;
    input({ kind: 'navigation', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
      dx: -12, dy: -4, deltaMs: 80, strength: .5, time }, controls.navigationMosh, Math.max(rect.width, rect.height) * .65);
    return true;
  }

  function schedule() {
    if (!canRun() || timer || frame) return;
    const energy = memory.snapshot().energy;
    const moving = now() - lastInputTime < 650 || energy > .012;
    const requested = moving ? activeCadence : cadence;
    scheduledCadence = requested;
    timer = view.setTimeout(() => {
      timer = 0;
      if (!canRun()) return;
      frame = view.requestAnimationFrame(paint);
    }, 1000 / requested);
  }

  function paint(timestamp = now()) {
    frame = 0;
    if (!canRun()) { stop(); return; }
    const started = now();
    const delta = previousTime === null ? 0 : clamp((timestamp - previousTime) / 1000, 0, .75);
    elapsed += delta;
    previousTime = timestamp;
    const alreadyPrepared = prepared;
    prepareMaterial();
    const rect = sourceRect();
    if (!validSource) {
      context.globalAlpha = 1; context.globalCompositeOperation = 'copy';
      context.drawImage(material, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
      historyContext.globalAlpha = 1; historyContext.globalCompositeOperation = 'copy';
      historyContext.drawImage(canvas, 0, 0);
    } else {
      // Slow chemical drift is distinct from interaction motion. Stable source
      // regions evolve continuously; they never rehash or flash on a timer.
      if (controls.idleIntensity > 0 && delta > 0) for (let index = 0; index < 4; index++) {
        const phase = random(currentSeed, index + 1901) * Math.PI * 2;
        memory.impulse({ kind: 'idle', x: random(currentSeed, index + 2001) * canvas.width,
          y: random(currentSeed, index + 2101) * canvas.height,
          dx: Math.sin(elapsed * (.08 + controls.mutationSpeed * .08) + phase) * delta * 45,
          dy: Math.cos(elapsed * .06 + phase) * delta * 25,
          deltaMs: delta * 1000, strength: controls.idleIntensity * .5,
          radius: Math.min(canvas.width, canvas.height) * .15, time: timestamp });
      }
      const cells = memory.step({ time: timestamp, deltaMs: delta * 1000,
        persistence: controls.feedbackPersistence, recoverySpeed: controls.recoverySpeed,
        displacement: controls.pixelDisplacement, colorBleeding: controls.colorBleeding,
        negativeExposure: controls.negativeExposure });
      const result = paintImageMemory({ context, history, historyContext, source: material,
        width: canvas.width, height: canvas.height, cells, sourceRect: rect });
      advectedBlocks += result.advected; recoveredBlocks += result.recovered;
    }
    const age = Math.max(0, timestamp - motion.time);
    const decay = Math.exp(-age / (70 + controls.scrollInertia * 330));
    flow = { x: motion.x * decay, y: motion.y * decay, strength: motion.strength * decay };
    if (flow.strength < .001) flow = { x: 0, y: 0, strength: 0 };
    validSource = true;
    canvas.hidden = false;
    canvas.dataset.ambientFrame = String(++frames);
    canvas.dataset.livingSeed = String(currentSeed);
    const duration = now() - started;
    times.push(duration);
    if (times.length > 180) times.shift();
    if (alreadyPrepared && duration > 14 && activeCadence > 10) activeCadence = Math.max(10, activeCadence - 2);
    schedule();
  }

  function sync() {
    stop();
    if (!canRun()) {
      canvas.hidden = true;
      motion = { x: 0, y: 0, strength: 0, time: 0 };
      flow = { x: 0, y: 0, strength: 0 };
      previousPointer = null;
      return;
    }
    paint(now());
  }

  function resize(size = { width: view.innerWidth, height: view.innerHeight }) {
    if (disposed) return;
    const nextViewport = { width: Math.max(1, finite(size.width, 1)), height: Math.max(1, finite(size.height, 1)) };
    const dimensions = ambientFilmSize(nextViewport.width, nextViewport.height, quality);
    if (viewport.width === nextViewport.width && viewport.height === nextViewport.height
      && canvas.width === dimensions.width && canvas.height === dimensions.height) return;
    // Reuse the existing scratch canvas for a bounded resize copy. Mobile
    // browser chrome/resizing must not replace the damaged world with source.
    const retain = validSource;
    if (retain) {
      sample.width = history.width; sample.height = history.height;
      sample.getContext('2d').drawImage(history, 0, 0);
    }
    viewport = nextViewport;
    canvas.width = history.width = dimensions.width;
    canvas.height = history.height = dimensions.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    prepared = false;
    if (retain) {
      context.globalAlpha = historyContext.globalAlpha = 1;
      context.drawImage(sample, 0, 0, dimensions.width, dimensions.height);
      historyContext.drawImage(sample, 0, 0, dimensions.width, dimensions.height);
      sample.width = sample.height = 1;
    }
    memory.resize(dimensions.width, dimensions.height, controls.blockSize, retain);
    sync();
  }

  removers.push(subscribeLivingDecay((next, detail) => {
    if (disposed) return;
    controls = next;
    if (detail.changed.includes('seed') && next.seed !== null && next.seed !== currentSeed) { resetComposition(next.seed); return; }
    if (detail.changed.includes('blockSize')) memory.resize(canvas.width, canvas.height, controls.blockSize, true);
    if (detail.changed.some(key => ['organicDecay', 'colorVariation', 'voidCoverage', 'bleachCoverage', 'blockSize'].includes(key))) {
      prepared = false;
      composition = createLivingComposition(currentSeed, controls);
    }
    // The running cadence picks up settings on its next scheduled paint.
    // Pointer/control input cannot add extra ambient frames or reset its clock.
  }));
  listen(doc, 'visibilitychange', sync);
  listen(reduced, 'change', sync);
  container.prepend(canvas);
  resize();
  return {
    canvas,
    get source() { return validSource && canRun() ? canvas : image; },
    get sourceIsViewport() { return validSource && canRun(); },
    setActive(value) {
      if (disposed || active === Boolean(value)) return;
      active = Boolean(value);
      if (active && activated) regenerate(controls.seed ?? undefined);
      else { if (active) activated = true; sync(); if (active) announceSeed(); }
    },
    setMotion, impulse, stroke, rememberSurface,
    configure: patch => disposed ? controls : configureLivingDecay(patch),
    readSettings: () => controls,
    regenerate: value => disposed ? currentSeed : regenerate(value),
    restore(value = {}) {
      if (disposed) return currentSeed;
      if (value.settings) configureLivingDecay(value.settings);
      return resetComposition(value.seed, value.elapsed);
    },
    resize,
    snapshot: () => ({ active, queued: Boolean(timer || frame), frames, elapsed, seed: currentSeed, regenerations,
      width: canvas.width, height: canvas.height, framesPerSecond: cadence, quality: profile,
      drawMs: [...times], preparationMs, viewport: { ...viewport }, settings: { ...controls },
      composition, motion: { ...flow }, memory: memory.snapshot(),
      parallax: { ...parallax, offsetX: parallaxOffset().x, offsetY: parallaxOffset().y,
        sourceX: sourceRect().x, sourceY: sourceRect().y, strength: controls.parallaxStrength },
      advectedBlocks, recoveredBlocks, carriedSurfaces, activeFramesPerSecond: activeCadence, material: { width: material.width, height: material.height,
        codecFragments: codec.length, sourceReadback: Boolean(sourcePixels) } }),
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      stop();
      for (const remove of removers) remove();
      canvas.remove();
      for (const bitmap of [canvas, history, material, sample]) bitmap.width = bitmap.height = 1;
      sourcePixels = null;
      codec.length = 0;
    },
  };
}
