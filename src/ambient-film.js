import { ambientFilmSettings } from './data/ambientFilmSettings.js';
import { configureLivingDecay, getLivingDecaySettings, normalizeLivingSeed, subscribeLivingDecay } from './data/livingDecaySettings.js';
import { createLivingComposition, renderLivingMaterial, livingRegion, livingCodecFragment, livingRandom } from './living-decay-material.js';

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

  function regionalMotion(time, delta, timestamp) {
    const age = Math.max(0, timestamp - motion.time);
    const decay = Math.exp(-age / (70 + controls.scrollInertia * 330));
    const blend = 1 - Math.exp(-Math.max(.016, delta) * 6);
    const target = motion.strength * decay;
    flow.x += (motion.x * target - flow.x) * blend;
    flow.y += (motion.y * target - flow.y) * blend;
    flow.strength += (target - flow.strength) * blend;
    if (Math.abs(flow.x) + Math.abs(flow.y) + flow.strength < .001) flow = { x: 0, y: 0, strength: 0 };
    const count = quality.regions || (profile === 'mobile' ? 11 : 26);
    const bitmap = validSource ? history : material;
    for (let index = 0; index < count; index++) {
      const region = livingRegion(composition, index, time * (.75 + controls.mutationSpeed * .5), controls);
      const width = Math.max(1, Math.min(canvas.width, region.width * canvas.width));
      const height = Math.max(1, Math.min(canvas.height, region.height * canvas.height));
      const x = clamp(region.x * canvas.width, 0, canvas.width - width);
      const y = clamp(region.y * canvas.height, 0, canvas.height - height);
      const lag = .25 + livingRandom(currentSeed, index + 201) * .75;
      const mx = clamp(flow.x * controls.scrollStrength * lag * 11, -44, 44) * canvas.width / viewport.width;
      const my = clamp(flow.y * controls.scrollStrength * lag * 11, -44, 44) * canvas.height / viewport.height;
      context.globalAlpha = clamp(region.opacity * (.45 + controls.feedbackPersistence * .55)
        + flow.strength * .17 * controls.scrollMosh, 0, .65);
      if (context.globalAlpha <= 0) continue;
      context.drawImage(bitmap, clamp(x - region.dx * canvas.width - mx, 0, canvas.width - width),
        clamp(y - region.dy * canvas.height - my, 0, canvas.height - height), width, height, x, y, width, height);
    }
    // Thin compressed remnants evolve at their own phases and recover from
    // current material pixels; the entire backdrop never moves as one plane.
    const remnants = profile === 'mobile' ? 12 : 30;
    for (let index = 0; index < Math.min(codec.length, remnants); index++) {
      const fragment = codec[index];
      const phase = livingRandom(currentSeed, index + 301) * Math.PI * 2;
      const envelope = .5 + .5 * Math.sin(time * (.04 + controls.mutationSpeed * .08) + phase);
      const width = Math.max(1, Math.min(canvas.width, fragment.width * canvas.width));
      const height = Math.max(1, Math.min(canvas.height, fragment.height * canvas.height));
      const x = clamp(fragment.x * canvas.width, 0, canvas.width - width);
      const y = clamp(fragment.y * canvas.height, 0, canvas.height - height);
      const movement = Math.sin(time * .055 + phase) * controls.idleIntensity;
      context.globalAlpha = fragment.opacity * envelope * controls.idleIntensity * .42;
      context.drawImage(bitmap, clamp(x - fragment.dx * canvas.width * movement, 0, canvas.width - width),
        clamp(y - fragment.dy * canvas.height * movement, 0, canvas.height - height), width, height,
        x, y, Math.min(canvas.width - x, width * (1 + (fragment.stretch - 1) * envelope * .16)), height);
    }
    context.globalAlpha = 1;
  }

  function schedule() {
    if (!canRun() || timer || frame) return;
    timer = view.setTimeout(() => {
      timer = 0;
      if (!canRun()) return;
      frame = view.requestAnimationFrame(paint);
    }, 1000 / cadence);
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
    if (validSource) {
      historyContext.globalCompositeOperation = 'copy';
      historyContext.drawImage(canvas, 0, 0);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.drawImage(material, 0, 0);
    regionalMotion(elapsed, delta, timestamp);
    validSource = true;
    canvas.hidden = false;
    canvas.dataset.ambientFrame = String(++frames);
    canvas.dataset.livingSeed = String(currentSeed);
    const duration = now() - started;
    times.push(duration);
    if (times.length > 180) times.shift();
    // Preparation is paid once per seed/resize/config, never used to lower a
    // healthy steady-state cadence. Later expensive frames degrade one way.
    if (alreadyPrepared && duration > 14 && cadence > 2) cadence = Math.max(2, cadence - 1);
    schedule();
  }

  function sync() {
    stop();
    if (!canRun()) {
      canvas.hidden = true;
      motion = { x: 0, y: 0, strength: 0, time: 0 };
      flow = { x: 0, y: 0, strength: 0 };
      return;
    }
    paint(now());
  }

  function resize(size = { width: view.innerWidth, height: view.innerHeight }) {
    if (disposed) return;
    viewport = { width: Math.max(1, finite(size.width, 1)), height: Math.max(1, finite(size.height, 1)) };
    const dimensions = ambientFilmSize(viewport.width, viewport.height, quality);
    canvas.width = history.width = dimensions.width;
    canvas.height = history.height = dimensions.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    validSource = prepared = false;
    sync();
  }

  removers.push(subscribeLivingDecay((next, detail) => {
    if (disposed) return;
    controls = next;
    if (detail.changed.includes('seed') && next.seed !== null && next.seed !== currentSeed) { resetComposition(next.seed); return; }
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
    setMotion(value = {}) {
      if (disposed || !active || ![value.x, value.y, value.strength].every(Number.isFinite)) return;
      motion = { x: clamp(value.x, -4, 4), y: clamp(value.y, -4, 4), strength: clamp(value.strength, 0, 2),
        time: clamp(finite(value.time, now()), now() - 1000, now()) };
    },
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
      composition, motion: { ...flow }, material: { width: material.width, height: material.height,
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
