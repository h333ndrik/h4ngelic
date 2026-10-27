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
  const ratio = Math.min(1, finite(quality.resolutionScale, 1), quality.maximumWidth / viewportWidth, quality.maximumHeight / viewportHeight);
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

/** Center-cover preserves a damaged composition's aspect ratio on resize. */
export function coverMemoryRect(sourceWidth, sourceHeight, width, height) {
  const sw = Math.max(1, finite(sourceWidth, 1)), sh = Math.max(1, finite(sourceHeight, 1));
  const ratio = Math.max(1, finite(width, 1)) / Math.max(1, finite(height, 1));
  const cropWidth = Math.min(sw, sh * ratio), cropHeight = Math.min(sh, sw / ratio);
  return { x: (sw - cropWidth) / 2, y: (sh - cropHeight) / 2, width: cropWidth, height: cropHeight };
}

/** One bounded visual memory. The image asset is read only when a fresh world
 * is seeded. Every subsequent draw samples the preceding damaged output.
 * Transition preparation freezes these exact two buffers for native capture;
 * activation/finish never replace or repaint the frozen handoff frame. */
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
  // Preserve compressed pixel edges instead of repeatedly interpolating them
  // into a washed-out blur. This affects only the two background buffers.
  context && (context.imageSmoothingEnabled = false);
  historyContext && (historyContext.imageSmoothingEnabled = false);
  const removers = [], times = [];
  let controls = getLivingDecaySettings();
  let active = false, activated = false, disposed = false, validSource = false;
  let timer = 0, frame = 0, scheduledCadence = 0, frames = 0, regenerations = 0;
  let previousTime = null, elapsed = 0, preparationMs = 0, sourceInitializations = 0;
  let viewport = { width: Math.max(1, view.innerWidth), height: Math.max(1, view.innerHeight) };
  let currentSeed = seed === undefined ? controls.seed ?? freshSeed() : normalizeLivingSeed(seed);
  let composition = createLivingComposition(currentSeed, controls);
  let memory = createImageMemoryField({ width: 1, height: 1, seed: currentSeed, maxCells: quality.maximumCells || 600, persistent: true });
  let pendingPointer = null, previousPointer = null, pendingScroll = null;
  let pendingImpulses = [], droppedInputs = 0, consumedInputs = 0;
  let motion = { x: 0, y: 0, strength: 0, time: 0 }, flow = { x: 0, y: 0, strength: 0 };
  let scrollTravel = { x: 0, y: 0 }, lastInputTime = -Infinity;
  let advectedBlocks = 0, recoveredBlocks = 0, carriedSurfaces = 0, resizeCopies = 0;
  let cadence = Math.max(1, quality.framesPerSecond);
  let activeCadence = Math.max(cadence, quality.activeFramesPerSecond || cadence);
  let frozen = false, preparedEntry = false, currentToken = null, tokenSequence = 0;
  let transitionPasses = 0, claimedFrame = null, completedToken = null;
  const now = () => view.performance.now();
  const canRun = () => active && settings.enabled && !disposed && !doc.hidden && !reduced.matches
    && !frozen && validSource && Boolean(context && historyContext);
  const canQueue = () => active && settings.enabled && !disposed && !doc.hidden && !reduced.matches;
  const listen = (target, name, callback) => {
    target.addEventListener(name, callback);
    removers.push(() => target.removeEventListener(name, callback));
  };
  function freshSeed() {
    if (view.crypto?.getRandomValues) return view.crypto.getRandomValues(new Uint32Array(1))[0];
    return Math.floor(Math.random() * 0x100000000) >>> 0;
  }
  function stop() {
    view.clearTimeout(timer); view.cancelAnimationFrame(frame);
    timer = frame = 0; previousTime = null;
  }
  function clearInputs() {
    pendingPointer = previousPointer = pendingScroll = null;
    pendingImpulses.length = 0;
    motion = { x: 0, y: 0, strength: 0, time: 0 }; flow = { x: 0, y: 0, strength: 0 };
  }
  function announceSeed() {
    const EventConstructor = view.CustomEvent || globalThis.CustomEvent;
    if (typeof EventConstructor === 'function') doc.dispatchEvent(new EventConstructor('h4:livingseed', {
      detail: { seed: currentSeed, elapsed, regenerations },
    }));
  }
  function cellSize() {
    return controls.blockSize * Math.min(canvas.width / viewport.width, canvas.height / viewport.height);
  }
  function copyHistory() {
    historyContext.globalAlpha = 1; historyContext.globalCompositeOperation = 'copy';
    historyContext.drawImage(canvas, 0, 0, history.width, history.height);
    historyContext.globalCompositeOperation = 'source-over';
  }
  function recordFrame() {
    canvas.dataset.ambientFrame = String(++frames);
    canvas.dataset.livingSeed = String(currentSeed);
  }
  function initializeEntry(value = currentSeed) {
    stop(); clearInputs();
    const started = now();
    if (validSource) regenerations++;
    currentSeed = normalizeLivingSeed(value, currentSeed);
    controls = getLivingDecaySettings(); composition = createLivingComposition(currentSeed, controls);
    elapsed = 0; frozen = preparedEntry = false; currentToken = null; claimedFrame = null;
    sourceInitializations++;
    const dimensions = ambientFilmSize(viewport.width, viewport.height, quality);
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    context.imageSmoothingEnabled = false;
    // Reuse the history allocation as the temporary source-readback surface.
    // Neither sourcePixels nor a clean material canvas survives this function.
    let sourcePixels = null, sourceWidth = 0, sourceHeight = 0;
    const ratio = Math.min(1, quality.sourceDimension / Math.max(image.naturalWidth, image.naturalHeight));
    history.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    history.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    historyContext.imageSmoothingEnabled = false;
    try {
      historyContext.drawImage(image, 0, 0, history.width, history.height);
      sourcePixels = historyContext.getImageData(0, 0, history.width, history.height);
      sourceWidth = history.width; sourceHeight = history.height;
    } catch { /* Restricted images retain a single image-sampled seed. */ }
    history.width = canvas.width; history.height = canvas.height;
    historyContext.imageSmoothingEnabled = false;
    context.globalAlpha = 1; context.globalCompositeOperation = 'copy';
    if (sourcePixels) {
      const output = context.createImageData(canvas.width, canvas.height);
      renderLivingMaterial({ source: sourcePixels.data, sourceWidth, sourceHeight,
        width: canvas.width, height: canvas.height, composition, settings: controls, output: output.data });
      context.putImageData(output, 0, 0);
    } else {
      const crop = coverMemoryRect(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    }
    sourcePixels = null;
    context.globalCompositeOperation = 'source-over'; copyHistory();
    // Preserve the established broad material crop, only once at world entry.
    context.drawImage(history, canvas.width * .15, canvas.height * .15, canvas.width * .7, canvas.height * .7,
      0, 0, canvas.width, canvas.height); copyHistory();
    const count = quality.codecFragments || (profile === 'mobile' ? 64 : 156);
    for (let index = 0; index < count; index++) {
      const fragment = livingCodecFragment(composition, index, controls);
      const width = Math.max(1, Math.min(canvas.width, fragment.width * canvas.width));
      const height = Math.max(1, Math.min(canvas.height, fragment.height * canvas.height));
      const x = clamp(fragment.x * canvas.width, 0, canvas.width - width);
      const y = clamp(fragment.y * canvas.height, 0, canvas.height - height);
      context.globalAlpha = fragment.opacity * .52;
      context.drawImage(history, clamp(x - fragment.dx * canvas.width, 0, canvas.width - width),
        clamp(y - fragment.dy * canvas.height, 0, canvas.height - height), width, height,
        x, y, Math.min(canvas.width - x, width * fragment.stretch), height);
    }
    context.globalAlpha = 1; copyHistory();
    memory = createImageMemoryField({ width: canvas.width, height: canvas.height, cellSize: cellSize(),
      seed: currentSeed, maxCells: quality.maximumCells || 600, persistent: true });
    validSource = true; preparationMs = now() - started; recordFrame(); announceSeed();
  }
  function apply(point) {
    const sx = canvas.width / viewport.width, sy = canvas.height / viewport.height;
    return memory.impulse({ kind: point.kind, x: point.x * sx, y: point.y * sy,
      dx: point.dx * sx, dy: point.dy * sy, deltaMs: point.deltaMs,
      strength: point.strength, radius: point.radius * Math.max(sx, sy), time: point.time });
  }
  function paintHistory(timestamp, deltaMs) {
    const cells = memory.step({ time: timestamp, deltaMs, persistence: controls.feedbackPersistence,
      recoverySpeed: controls.recoverySpeed, displacement: controls.pixelDisplacement,
      colorBleeding: controls.colorBleeding, negativeExposure: controls.negativeExposure });
    // Crucial: recovery also samples previous damaged OUTPUT. The clean asset
    // is never supplied again, even after velocity and energy have relaxed.
    const result = paintImageMemory({ context, history, historyContext, source: history,
      width: canvas.width, height: canvas.height, cells, reconstruct: false });
    advectedBlocks += result.advected; recoveredBlocks += result.recovered;
    recordFrame();
  }
  function prepareTransition({ variant, seed: entrySeed, force = false } = {}) {
    if (disposed || !context || !historyContext || !settings.enabled) return null;
    if (!force && preparedEntry && currentToken && currentToken.variant === variant) return currentToken;
    stop();
    if (force || !active || !validSource) {
      let next = entrySeed === undefined ? controls.seed ?? (activated || validSource ? freshSeed() : currentSeed)
        : normalizeLivingSeed(entrySeed, currentSeed);
      if (entrySeed === undefined && controls.seed === null && (activated || validSource) && next === currentSeed) next = (next + 0x9e3779b1) >>> 0;
      initializeEntry(next);
    }
    clearInputs();
    const stamp = now(), pattern = normalizeLivingSeed(variant, currentSeed) ^ currentSeed;
    for (let pass = 0; pass < 6; pass++) {
      for (let index = 0; index < 6; index++) {
        const salt = pass * 37 + index * 11;
        const sign = random(pattern, salt + 1) < .5 ? -1 : 1;
        apply({ kind: 'mode', x: ((index % 3) + .5) / 3 * viewport.width,
          y: (Math.floor(index / 3) + .5) / 2 * viewport.height,
          dx: sign * (32 + random(pattern, salt + 2) * 120), dy: (random(pattern, salt + 3) - .5) * 65,
          deltaMs: 55, strength: 1.7 + random(pattern, salt + 4),
          radius: Math.max(viewport.width, viewport.height) * .62, time: stamp });
      }
      paintHistory(stamp, 55); transitionPasses++;
    }
    frozen = true; preparedEntry = !active;
    currentToken = Object.freeze({ id: ++tokenSequence, variant, seed: currentSeed,
      width: canvas.width, height: canvas.height, frame: frames });
    canvas.dataset.memoryTransition = String(currentToken.id);
    canvas.hidden = !active;
    return currentToken;
  }
  function finishTransition(token) {
    if (disposed || !token || token.id !== currentToken?.id || token.seed !== currentSeed) return false;
    completedToken = token.id; frozen = false; previousTime = null;
    delete canvas.dataset.memoryTransition;
    schedule();
    return true;
  }
  function schedule() {
    if (!canRun() || timer || frame) return;
    scheduledCadence = now() - lastInputTime < 900 ? activeCadence : cadence;
    timer = view.setTimeout(() => {
      timer = 0;
      if (canRun()) frame = view.requestAnimationFrame(paint);
    }, 1000 / scheduledCadence);
  }
  function wake() {
    if (!canQueue()) return;
    lastInputTime = now();
    // Upgrade an idle timer once, never postpone an already-active deadline.
    if (timer && scheduledCadence < activeCadence) { view.clearTimeout(timer); timer = 0; }
    schedule();
  }
  function queue(point) {
    if (pendingImpulses.length >= 8) { pendingImpulses.shift(); droppedInputs++; }
    pendingImpulses.push(point); wake();
  }
  function impulse(detail = {}) {
    if (!canQueue() || ![detail.x, detail.y, detail.strength].every(Number.isFinite) || detail.strength <= 0) return false;
    const gains = { cursor: controls.cursorMosh, hover: controls.hoverMosh, focus: controls.hoverMosh,
      'hover-motion': controls.hoverMosh, click: controls.clickMosh, navigation: controls.navigationMosh,
      section: controls.sectionMosh, scroll: controls.scrollMosh, typography: controls.typographyMosh,
      type: controls.typographyMosh, logo: controls.heroMosh, mode: 2 };
    const gain = gains[detail.kind];
    if (!(gain > 0)) return false;
    const radius = detail.kind === 'cursor' ? controls.cursorRadius
      : ['hover-motion', 'hover'].includes(detail.kind) ? 70
        : detail.kind === 'logo' ? 118 : detail.kind === 'mode' ? Math.max(viewport.width, viewport.height) : 135;
    const add = (point, size = radius) => queue({ kind: detail.kind, x: point.x, y: point.y,
      dx: point.dx, dy: point.dy, strength: clamp(detail.strength * gain * finite(point.weight, 1), 0, 3),
      radius: size, deltaMs: clamp(finite(detail.deltaMs, 80), 8, 250), time: now() });
    if (Array.isArray(detail.vectors) && detail.vectors.length) {
      for (const vector of detail.vectors.slice(0, 8)) if ([vector.x, vector.y, vector.dx, vector.dy].every(Number.isFinite)) add(vector);
    } else if (['mode', 'navigation'].includes(detail.kind)) {
      const direction = detail.direction === 'reverse' || detail.direction === 'leaving' || detail.mode === 'normal' ? -1 : 1;
      for (let index = 0; index < 6; index++) {
        const x = ((index % 3) + .5) / 3 * viewport.width, y = (Math.floor(index / 3) + .5) / 2 * viewport.height;
        add({ x, y, dx: direction * (x - viewport.width / 2) * .23,
          dy: direction * (y - viewport.height / 2) * .15 }, Math.max(viewport.width, viewport.height) * .58);
      }
    } else if (Number.isFinite(detail.dx) && Number.isFinite(detail.dy)) add(detail);
    else for (const sign of [-1, 1]) add({ x: detail.x + sign * radius * .26, y: detail.y,
      dx: sign * 25, dy: sign * 5 }, radius * .9);
    return true;
  }
  function stroke(point = {}) {
    if (!canQueue() || ![point.x, point.y, point.time].every(Number.isFinite)) return false;
    const prior = Object.hasOwn(point, 'priorInput') ? point.priorInput : previousPointer;
    const previous = prior && [prior.x, prior.y, prior.time].every(Number.isFinite)
      ? { x: prior.x, y: prior.y, time: prior.time } : null;
    previousPointer = { x: point.x, y: point.y, time: point.time };
    if (!previous || point.time <= previous.time || point.time - previous.time > 500) return false;
    pendingPointer = { x: point.x, y: point.y, time: point.time, previous };
    wake(); return true;
  }
  function setMotion(value = {}) {
    if (!canQueue() || ![value.x, value.y, value.strength].every(Number.isFinite)) return;
    motion = { x: clamp(value.x, -4, 4), y: clamp(value.y, -4, 4), strength: clamp(value.strength, 0, 2),
      time: clamp(finite(value.time, now()), now() - 1000, now()) };
    const dx = clamp(finite(value.deltaX, 0), -viewport.width * 3, viewport.width * 3);
    const dy = clamp(finite(value.deltaY, 0), -viewport.height * 3, viewport.height * 3);
    scrollTravel.x += dx; scrollTravel.y += dy;
    pendingScroll = { dx: clamp((pendingScroll?.dx || 0) + dx, -viewport.width * 3, viewport.width * 3),
      dy: clamp((pendingScroll?.dy || 0) + dy, -viewport.height * 3, viewport.height * 3),
      x: motion.x, y: motion.y, strength: Math.max(pendingScroll?.strength || 0, motion.strength),
      deltaMs: clamp((pendingScroll?.deltaMs || 0) + finite(value.deltaMs, 80), 8, 250), time: motion.time };
    wake();
  }
  function drainInputs(timestamp) {
    if (pendingPointer) {
      const point = pendingPointer; pendingPointer = null;
      const dx = point.x - point.previous.x, dy = point.y - point.previous.y;
      const dt = Math.max(8, point.time - point.previous.time), distance = Math.hypot(dx, dy);
      if (distance >= .25 && controls.cursorMosh > 0) {
        const count = Math.min(3, Math.max(1, Math.ceil(distance / controls.cursorRadius)));
        for (let index = 1; index <= count; index++) apply({ kind: 'cursor',
          x: point.previous.x + dx * index / count, y: point.previous.y + dy * index / count,
          dx, dy, deltaMs: dt, time: timestamp, radius: controls.cursorRadius,
          strength: controls.cursorMosh * (.45 + Math.min(1, distance / dt) * .4) });
        consumedInputs++;
      }
    }
    for (const point of pendingImpulses.splice(0)) { apply(point); consumedInputs++; }
    if (pendingScroll) {
      const point = pendingScroll; pendingScroll = null;
      if (controls.scrollMosh > 0 && point.strength > .001) for (let index = 0; index < 3; index++) {
        apply({ kind: 'scroll', x: (index + .5) / 3 * viewport.width, y: viewport.height * (.35 + index * .15),
          dx: (point.dx ? -point.dx : point.x * point.deltaMs) * controls.scrollStrength * .34,
          dy: (point.dy ? -point.dy : point.y * point.deltaMs) * controls.scrollStrength * .34,
          deltaMs: point.deltaMs, strength: point.strength * controls.scrollMosh * .65,
          radius: Math.max(viewport.width, viewport.height) * .62, time: timestamp });
      }
      consumedInputs++;
    }
  }
  function paint(timestamp = now()) {
    frame = 0;
    if (!canRun()) return stop();
    const started = now();
    const delta = previousTime === null ? 0 : clamp((timestamp - previousTime) / 1000, 0, .18);
    elapsed += delta; previousTime = timestamp;
    drainInputs(timestamp);
    if (controls.idleIntensity > 0 && delta > 0) for (let index = 0; index < 3; index++) {
      const phase = random(currentSeed, index + 1901) * Math.PI * 2;
      memory.impulse({ kind: 'idle', x: canvas.width * (.2 + index * .3),
        y: canvas.height * (.5 + Math.sin(elapsed * .08 + phase) * .29),
        dx: Math.sin(elapsed * (.08 + controls.mutationSpeed * .08) + phase) * delta * 22,
        dy: Math.cos(elapsed * .06 + phase) * delta * 15,
        deltaMs: delta * 1000, strength: controls.idleIntensity * .5,
        radius: Math.max(canvas.width, canvas.height) * .38, time: timestamp });
    }
    paintHistory(timestamp, delta * 1000);
    const decay = Math.exp(-Math.max(0, timestamp - motion.time) / (70 + controls.scrollInertia * 330));
    flow = { x: motion.x * decay, y: motion.y * decay, strength: motion.strength * decay };
    if (flow.strength < .001) flow = { x: 0, y: 0, strength: 0 };
    const duration = now() - started;
    times.push(duration); if (times.length > 180) times.shift();
    if (duration > 18 && activeCadence > 10) activeCadence = Math.max(10, activeCadence - 2);
    if (duration > 24 && cadence > 4) cadence = Math.max(4, cadence - 1);
    schedule();
  }
  function sync() {
    stop();
    canvas.hidden = !active || !validSource;
    if (doc.hidden || reduced.matches) clearInputs();
    schedule();
  }
  function resize(size = { width: view.innerWidth, height: view.innerHeight }) {
    if (disposed) return;
    const next = { width: Math.max(1, finite(size.width, 1)), height: Math.max(1, finite(size.height, 1)) };
    const dimensions = ambientFilmSize(next.width, next.height, quality);
    if (viewport.width === next.width && viewport.height === next.height
      && canvas.width === dimensions.width && canvas.height === dimensions.height) return;
    stop();
    const crop = coverMemoryRect(history.width, history.height, dimensions.width, dimensions.height);
    viewport = next;
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    context.imageSmoothingEnabled = false;
    if (validSource) context.drawImage(history, crop.x, crop.y, crop.width, crop.height, 0, 0, dimensions.width, dimensions.height);
    history.width = dimensions.width; history.height = dimensions.height;
    historyContext.imageSmoothingEnabled = false;
    if (validSource) { copyHistory(); resizeCopies++; }
    memory.resize(dimensions.width, dimensions.height, cellSize(), validSource);
    pendingPointer = previousPointer = pendingScroll = null;
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
    sync();
  }
  function resetComposition(value = currentSeed, age = 0) {
    if (disposed) return currentSeed;
    // An explicit DEV regeneration is deliberate, not a reconstruction timer.
    const token = prepareTransition({ variant: value, seed: value, force: true });
    elapsed = Math.max(0, finite(age, 0));
    if (active) finishTransition(token);
    return currentSeed;
  }
  removers.push(subscribeLivingDecay((next, detail) => {
    if (disposed) return;
    controls = next;
    if (detail.changed.includes('seed') && next.seed !== null && next.seed !== currentSeed) { resetComposition(next.seed); return; }
    if (detail.changed.includes('blockSize')) memory.resize(canvas.width, canvas.height, cellSize(), true);
    // Material-generation knobs apply at the next fresh entry. An active world
    // never goes back to the source image when a knob or viewport changes.
  }));
  listen(doc, 'visibilitychange', sync); listen(reduced, 'change', sync);
  listen(doc, 'h4:pagechange', () => { pendingPointer = previousPointer = null; });
  container.prepend(canvas); resize();
  return {
    canvas,
    get source() { return validSource ? canvas : image; },
    get sourceIsViewport() { return validSource; },
    prepareTransition, finishTransition,
    setActive(value) {
      if (disposed || active === Boolean(value)) return;
      if (value) {
        const supplied = preparedEntry && validSource;
        const token = supplied ? currentToken : prepareTransition();
        active = true; activated = true; preparedEntry = false;
        canvas.hidden = !validSource; claimedFrame = frames;
        // Unsupported/reduced-motion activation has no native finish callback.
        if (!supplied) finishTransition(token);
        else schedule();
      } else {
        active = false; stop(); clearInputs(); frozen = preparedEntry = false;
        currentToken = null; delete canvas.dataset.memoryTransition; canvas.hidden = true;
      }
    },
    setMotion, impulse, stroke,
    clearInputs,
    rememberSurface() { return false; },
    configure: patch => disposed ? controls : configureLivingDecay(patch),
    readSettings: () => controls,
    regenerate: value => resetComposition(value === undefined ? freshSeed() : normalizeLivingSeed(value, currentSeed)),
    restore(value = {}) { if (value.settings) configureLivingDecay(value.settings); return resetComposition(value.seed, value.elapsed); },
    resize,
    snapshot: () => ({ active, queued: Boolean(timer || frame), frames, elapsed, seed: currentSeed, regenerations,
      width: canvas.width, height: canvas.height, framesPerSecond: cadence, activeFramesPerSecond: activeCadence,
      quality: profile, drawMs: [...times], preparationMs, viewport: { ...viewport }, settings: { ...controls }, composition,
      motion: { ...flow }, memory: memory.snapshot(), advectedBlocks, recoveredBlocks, carriedSurfaces,
      parallax: { ...scrollTravel, offsetX: 0, offsetY: 0, sourceX: 0, sourceY: 0, strength: 0, historyOnly: true },
      material: { width: 0, height: 0, codecFragments: quality.codecFragments, sourceReadback: false },
      buffers: 2, recoverySource: 'history', cleanSourceRetained: false, sourceInitializations, resizeCopies,
      pending: { pointer: Boolean(pendingPointer), impulses: pendingImpulses.length, scroll: Boolean(pendingScroll), maximumImpulses: 8 },
      consumedInputs, droppedInputs,
      transition: { token: currentToken?.id ?? null, variant: currentToken?.variant ?? null, frozen,
        frame: currentToken?.frame ?? null, claimedFrame, completedToken, passes: transitionPasses } }),
    dispose() {
      if (disposed) return;
      disposed = true; active = false; stop(); clearInputs(); frozen = false; currentToken = null;
      for (const remove of removers) remove();
      canvas.remove(); canvas.width = canvas.height = history.width = history.height = 1;
    },
  };
}
