import { ambientFilmSettings } from './data/ambientFilmSettings.js';

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

/** A deliberately small, low-frequency material compositor. The ordinary DOM
 * and the existing WebGL wordmark are never captured or painted here. It owns
 * no pointer listeners and has an independent lifecycle from the ROI renderer.
 */
export function createAmbientFilm({ image, container, settings = ambientFilmSettings, profile = 'desktop', view = window, doc = document, seed = Math.floor(Math.random() * 0xffffffff) } = {}) {
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
  const variants = [image];
  const removers = [];
  const times = [];
  let active = false;
  let disposed = false;
  let timer = 0;
  let frame = 0;
  let frames = 0;
  let validSource = false;
  let elapsed = 0;
  let previousTime = null;
  let viewport = { width: view.innerWidth, height: view.innerHeight };
  let prepared = false;
  let cadence = Math.max(1, quality.framesPerSecond);
  const now = () => view.performance.now();
  const listen = (target, type, callback) => {
    target.addEventListener(type, callback);
    removers.push(() => target.removeEventListener(type, callback));
  };
  const canRun = () => active && settings.enabled && !disposed && !doc.hidden && !reduced.matches && Boolean(context && historyContext);

  function stop() {
    view.clearTimeout(timer);
    view.cancelAnimationFrame(frame);
    timer = frame = 0;
    previousTime = null;
  }

  function prepareVariants() {
    if (prepared) return;
    prepared = true;
    const ratio = Math.min(1, quality.sourceDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const sample = doc.createElement('canvas');
    sample.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    sample.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    let pixels = null;
    try {
      const sampleContext = sample.getContext('2d', { willReadFrequently: true });
      sampleContext.drawImage(image, 0, 0, sample.width, sample.height);
      pixels = sampleContext.getImageData(0, 0, sample.width, sample.height);
    } catch { /* CORS-restricted material keeps the sampled Canvas fallback. */ }
    for (const color of settings.palette) {
      const variant = doc.createElement('canvas');
      variant.width = sample.width;
      variant.height = sample.height;
      const target = variant.getContext('2d', { alpha: false });
      if (!target) continue;
      // One-time material preparation retains the photographic luminance and
      // burned texture; motion below is actual sampled-pixel compositing.
      if (pixels) {
        const output = target.createImageData(variant.width, variant.height);
        const tables = chemicalColorTables(color);
        for (let index = 0; index < pixels.data.length; index += 4) {
          const luminance = Math.round(pixels.data[index] * .2126 + pixels.data[index + 1] * .7152 + pixels.data[index + 2] * .0722);
          for (let channel = 0; channel < 3; channel++) output.data[index + channel] = tables[channel][luminance] * .92 + pixels.data[index + channel] * .08;
          output.data[index + 3] = 255;
        }
        target.putImageData(output, 0, 0);
      } else {
        target.drawImage(image, 0, 0, variant.width, variant.height);
        target.globalCompositeOperation = 'color';
        target.globalAlpha = .66;
        target.fillStyle = color;
        target.fillRect(0, 0, variant.width, variant.height);
      }
      variants.push(variant);
    }
    sample.width = sample.height = 1;
  }

  function base() {
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  }

  function contour(patch, radius, time) {
    context.beginPath();
    const ring = (x, y, width, height, salt, count = 64) => {
      const phase = random(patch.seed, salt) * Math.PI * 2;
      const points = Array.from({ length: count }, (_, index) => {
        const angle = index / count * Math.PI * 2;
        const ragged = 1 + .16 * Math.sin(angle * 3 + phase) + .09 * Math.sin(angle * 7 - phase + time * .04)
          + .045 * Math.sin(angle * 17 + phase * 2);
        return [x + Math.cos(angle) * width * ragged, y + Math.sin(angle) * height * ragged];
      });
      const first = points[0]; const last = points.at(-1);
      context.moveTo((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
      for (let index = 0; index < points.length; index++) {
        const point = points[index]; const next = points[(index + 1) % points.length];
        context.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
      }
      context.closePath();
    };
    ring(0, 0, radius, radius * (.63 + random(patch.seed, 24) * .3), 22);
    // Irregular eroded openings, without clean ellipse/stencil geometry.
    for (let index = 0; index < 6; index++) {
      const angle = random(patch.seed, 29 + index) * Math.PI * 2;
      const distance = radius * (.15 + random(patch.seed, 33 + index) * .4);
      const hole = radius * (.015 + random(patch.seed, 37 + index) * .065);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance * .7;
      ring(x, y, hole, hole * (.5 + random(patch.seed, 45 + index) * .6), 50 + index, 32);
    }
  }

  function patches(time) {
    const length = Math.max(canvas.width, canvas.height);
    for (let index = 0; index < quality.patches; index++) {
      const life = settings.minimumEvolutionSeconds + random(seed, index + 1) * (settings.maximumEvolutionSeconds - settings.minimumEvolutionSeconds);
      const position = time / life + random(seed, index + 12);
      const current = Math.floor(position);
      // Generations overlap for half a lifetime, eliminating loop resets.
      for (const offset of [0, -1]) {
        const generation = current + offset;
        const age = (position - generation) / 1.5;
        if (age < 0 || age >= 1) continue;
        const patch = chemicalPatch(seed, index, generation, age, settings);
        const radius = patch.radius * length;
        const bitmap = variants[patch.variant % variants.length];
        const width = bitmap.naturalWidth || bitmap.width;
        const height = bitmap.naturalHeight || bitmap.height;
        const cropWidth = width * (.33 + random(patch.seed, 42) * .32);
        const cropHeight = Math.min(height, cropWidth * (.8 + random(patch.seed, 43) * .6));
        context.save();
        context.translate(patch.x * canvas.width, patch.y * canvas.height);
        context.rotate(patch.rotation);
        contour(patch, radius, time);
        context.clip('evenodd');
        context.globalAlpha = clamp(patch.opacity * settings.patchOpacity * settings.chemicalIntensity, 0, 1);
        context.drawImage(bitmap, patch.sourceX * (width - cropWidth), patch.sourceY * (height - cropHeight), cropWidth, cropHeight,
          -radius * 1.2, -radius * 1.15, radius * 2.4, radius * 2.3);
        if (settings.exposureIntensity > 0 && random(patch.seed, 49) > .45) {
          // Slow, local overexposure reuses luminous film information. It does
          // not flash a rectangle or change the whole document's brightness.
          context.globalCompositeOperation = 'screen';
          context.globalAlpha = clamp(patch.opacity * settings.exposureIntensity * (.7 + .3 * Math.sin(time * .11 + random(patch.seed, 50) * 6)), 0, .45);
          context.drawImage(bitmap, patch.sourceX * (width - cropWidth), patch.sourceY * (height - cropHeight), cropWidth, cropHeight,
            -radius * 1.2, -radius * 1.15, radius * 2.4, radius * 2.3);
        }
        context.restore();
      }
    }
  }

  function tears(time) {
    if (frames === 0) return;
    const interval = Math.max(2, settings.bandIntervalSeconds);
    const generation = Math.floor(time / interval);
    const age = time - generation * interval;
    const duration = Math.max(.2, Math.min(interval, settings.bandDurationSeconds));
    if (age >= duration) return;
    const key = (seed ^ Math.imul(generation + 1, 73856093)) >>> 0;
    const envelope = Math.sin(age / duration * Math.PI);
    context.save();
    context.globalAlpha = clamp(envelope * settings.bandOpacity, 0, .85);
    for (let index = 0; index < quality.bands; index++) {
      const x = random(key, index + 2) * canvas.width * .74;
      const y = random(key, index + 8) * canvas.height;
      const width = Math.max(1, canvas.width * (.12 + random(key, index + 14) * .25));
      const height = Math.max(2, canvas.height * (.007 + random(key, index + 20) * .035));
      const shift = (random(key, index + 26) - .5) * canvas.width * .23 * envelope;
      context.drawImage(history, clamp(x - shift, 0, canvas.width - width), clamp(y, 0, canvas.height - height), width, height,
        x, y, width * (1 + .7 * envelope), height);
    }
    context.restore();
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
    if (previousTime !== null) elapsed += clamp((timestamp - previousTime) / 1000, 0, .75);
    previousTime = timestamp;
    prepareVariants();
    if (validSource) { historyContext.globalCompositeOperation = 'copy'; historyContext.drawImage(canvas, 0, 0); }
    base();
    const time = elapsed * Math.max(0, settings.movementSpeed);
    patches(time);
    tears(time);
    validSource = true;
    canvas.hidden = false;
    canvas.dataset.ambientFrame = String(++frames);
    const duration = now() - started;
    times.push(duration);
    if (times.length > 180) times.shift();
    // Graceful one-way degradation avoids oscillation on weaker renderers.
    if (duration > 14 && cadence > 2) cadence = Math.max(2, cadence - 1);
    schedule();
  }

  function sync() {
    stop();
    if (!canRun()) { canvas.hidden = true; return; }
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
    validSource = false;
    sync();
  }

  listen(doc, 'visibilitychange', sync);
  listen(reduced, 'change', sync);
  container.prepend(canvas);
  resize();
  return {
    canvas,
    get source() { return validSource && canRun() ? canvas : image; },
    get sourceIsViewport() { return validSource && canRun(); },
    setActive(value) { if (disposed) return; active = Boolean(value); sync(); },
    resize,
    snapshot: () => ({ active, queued: Boolean(timer || frame), frames, elapsed, width: canvas.width, height: canvas.height,
      framesPerSecond: cadence, quality: profile, drawMs: [...times], viewport: { ...viewport } }),
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      stop();
      for (const remove of removers) remove();
      canvas.remove();
      for (const bitmap of variants.slice(1)) bitmap.width = bitmap.height = 1;
      history.width = history.height = canvas.width = canvas.height = 1;
      variants.length = 0;
    },
  };
}
