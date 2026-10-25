import { createLivingDecaySettings, normalizeLivingSeed } from './data/livingDecaySettings.js';

const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const smooth = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
const mix = (a, b, amount) => a + (b - a) * amount;

export function livingRandom(seed, salt = 0) {
  let value = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  return ((value ^ value >>> 16) >>> 0) / 0x100000000;
}

/** Continuous correlated noise. No repeated texture cells or panel masks. */
export function livingNoise(seed, x, y) {
  const ix = Math.floor(x); const iy = Math.floor(y);
  const fx = smooth(x - ix); const fy = smooth(y - iy);
  const sample = (dx, dy) => livingRandom(seed ^ Math.imul(ix + dx, 73856093) ^ Math.imul(iy + dy, 19349663), 53);
  return mix(mix(sample(0, 0), sample(1, 0), fx), mix(sample(0, 1), sample(1, 1), fx), fy);
}

function fractal(seed, x, y) {
  return livingNoise(seed, x, y) * .57 + livingNoise(seed ^ 0x71f43, x * 2.13, y * 2.13) * .28
    + livingNoise(seed ^ 0x9e3779, x * 4.57, y * 4.57) * .15;
}

/** Small, serializable descriptors make a seed inspectable and reproducible. */
export function createLivingComposition(seed, settings = {}) {
  const key = normalizeLivingSeed(seed);
  const controls = createLivingDecaySettings({ ...settings, seed: key });
  const angle = (livingRandom(key, 1) - .5) * .7;
  const flowAngle = livingRandom(key, 2) * Math.PI * 2;
  return Object.freeze({
    seed: key,
    source: Object.freeze({ scale: 1.08 + livingRandom(key, 3) * .55,
      x: livingRandom(key, 4), y: livingRandom(key, 5), angle, flip: livingRandom(key, 6) > .5 ? -1 : 1 }),
    flow: Object.freeze({ x: Math.cos(flowAngle), y: Math.sin(flowAngle),
      speed: .55 + livingRandom(key, 7) * .9, curl: (livingRandom(key, 8) - .5) * 2 }),
    tint: Object.freeze({ violet: .65 + livingRandom(key, 9) * .7,
      green: .6 + livingRandom(key, 10) * .8, warm: livingRandom(key, 11) * .26 }),
    field: Object.freeze({ x: livingRandom(key, 12) * 130, y: livingRandom(key, 13) * 130,
      stretch: .65 + livingRandom(key, 14) * .8, frequency: 1.7 + livingRandom(key, 15) * 1.8,
      voidBias: (livingRandom(key, 16) - .5) * .12, bleachBias: (livingRandom(key, 17) - .5) * .12 }),
    controls,
  });
}

/** One integrated image-space governs voids, exposure, color and material flow.
 * Time is deliberately slow and regional, rather than a whole-image pan.
 */
export function sampleLivingField(composition, x, y, time = 0, settings = composition.controls) {
  const { seed, field, flow } = composition;
  const px = x * field.frequency + field.x;
  const py = y * field.frequency * field.stretch + field.y;
  const t = time * .009 * settings.mutationSpeed;
  const warpX = fractal(seed ^ 0x4f21, px + t * flow.x, py - t * .4) - .5;
  const warpY = fractal(seed ^ 0x8a43, px - t * .3, py + t * flow.y) - .5;
  const nx = px + warpX * 1.15;
  const ny = py + warpY * .8;
  const voidNoise = fractal(seed ^ 0x294f, nx * .78, ny * .78);
  const bleachNoise = fractal(seed ^ 0x69bf, nx * .9 + 7, ny * .9 - 3);
  const density = fractal(seed ^ 0x983a, nx * 1.7, ny * 1.7);
  const voidAmount = settings.voidCoverage > 0
    ? smooth((settings.voidCoverage * .9 + .25 + field.voidBias - voidNoise) / .23) : 0;
  const bleachAmount = settings.bleachCoverage > 0
    ? smooth((settings.bleachCoverage * .9 + .12 + field.bleachBias - bleachNoise) / .2) * (1 - voidAmount) : 0;
  return {
    void: voidAmount,
    bleach: bleachAmount,
    density: clamp(.22 + density * 1.1 - voidAmount * .42),
    tint: fractal(seed ^ 0xb93d, nx * .72 - 11, ny * .72 + 5),
    warpX: warpX * settings.organicDecay,
    warpY: warpY * settings.organicDecay,
  };
}

/** Sample a small control field once; full material pixels interpolate it. */
export function createLivingField(composition, width = 72, height = 52, time = 0, settings = composition.controls) {
  const columns = Math.max(2, Math.min(256, Math.round(width)));
  const rows = Math.max(2, Math.min(256, Math.round(height)));
  const names = ['void', 'bleach', 'density', 'tint', 'warpX', 'warpY'];
  const values = new Float32Array(columns * rows * names.length);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const sample = sampleLivingField(composition, column / (columns - 1), row / (rows - 1), time, settings);
    const offset = (row * columns + column) * names.length;
    for (let channel = 0; channel < names.length; channel++) values[offset + channel] = sample[names[channel]];
  }
  return { width: columns, height: rows, channels: names.length, values };
}

function interpolateField(field, x, y, output) {
  const px = clamp(x) * (field.width - 1); const py = clamp(y) * (field.height - 1);
  const ix = Math.min(field.width - 2, Math.floor(px)); const iy = Math.min(field.height - 2, Math.floor(py));
  const fx = px - ix; const fy = py - iy;
  const first = (iy * field.width + ix) * field.channels;
  const next = first + field.width * field.channels;
  for (let channel = 0; channel < field.channels; channel++) {
    output[channel] = mix(mix(field.values[first + channel], field.values[first + field.channels + channel], fx),
      mix(field.values[next + channel], field.values[next + field.channels + channel], fx), fy);
  }
}

const reflect = value => { const fraction = ((value % 2) + 2) % 2; return fraction > 1 ? 2 - fraction : fraction; };

/** One-time source-pixel synthesis. The photograph remains continuous while
 * seeded low-frequency fields redistribute its scale, color, voids and bleach.
 * This is never a collage and needs no frame-time pixel readback.
 */
export function renderLivingMaterial({ source, sourceWidth, sourceHeight, width, height, composition,
  settings = composition.controls, field = createLivingField(composition, 72, 52, 0, settings), output = new Uint8ClampedArray(width * height * 4) }) {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = width / height;
  const spanX = Math.min(1, targetAspect / sourceAspect) / composition.source.scale;
  const spanY = Math.min(1, sourceAspect / targetAspect) / composition.source.scale;
  const cosine = Math.cos(composition.source.angle); const sine = Math.sin(composition.source.angle);
  const sample = new Float32Array(field.channels);
  const tintStrength = clamp(settings.colorVariation / 2) * .42;
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const x = column / Math.max(1, width - 1); const y = row / Math.max(1, height - 1);
    interpolateField(field, x, y, sample);
    const voidAmount = sample[0]; const bleach = sample[1]; const density = sample[2];
    const tint = sample[3]; const warpX = sample[4]; const warpY = sample[5];
    const dx = (x - .5) * spanX * composition.source.flip; const dy = (y - .5) * spanY;
    const sx = reflect(.5 + cosine * dx - sine * dy + (composition.source.x - .5) * .32 + warpX * .13);
    const sy = reflect(.5 + sine * dx + cosine * dy + (composition.source.y - .5) * .32 + warpY * .13);
    const sourceOffset = (Math.min(sourceHeight - 1, Math.floor(sy * sourceHeight)) * sourceWidth
      + Math.min(sourceWidth - 1, Math.floor(sx * sourceWidth))) * 4;
    const target = (row * width + column) * 4;
    const red = source[sourceOffset]; const green = source[sourceOffset + 1]; const blue = source[sourceOffset + 2];
    const luminance = (red * .2126 + green * .7152 + blue * .0722) / 255;
    const midtone = smooth(luminance * 3) * (1 - smooth((luminance - .67) / .28));
    const violet = smooth((.6 - tint) * 3) * composition.tint.violet;
    const lime = smooth((tint - .42) * 3) * composition.tint.green;
    const warm = smooth((tint - .76) * 5) * composition.tint.warm;
    const tintMix = midtone * tintStrength;
    const shade = (1 - voidAmount * .985) * (.8 + density * .28);
    const exposure = bleach * (.36 + luminance * .46);
    output[target] = mix((red + (violet * 136 + lime * 80 + warm * 150 - red) * tintMix) * shade, 239, exposure);
    output[target + 1] = mix((green + (lime * 188 + warm * 75 + 16 - green) * tintMix) * shade, 235, exposure);
    output[target + 2] = mix((blue + (violet * 216 + warm * 48 + 20 - blue) * tintMix) * shade, 226, exposure);
    output[target + 3] = 255;
  }
  return output;
}

/** Coherent regional movement: each fragment is still sampled from the same
 * composite. Sizes and independent phases vary with the composition seed.
 */
export function livingRegion(composition, index, time, settings = composition.controls) {
  const key = composition.seed ^ Math.imul(index + 1, 83492791);
  const phase = livingRandom(key, 1) * Math.PI * 2;
  const speed = (.055 + livingRandom(key, 2) * .085) * composition.flow.speed;
  const movement = settings.idleIntensity * (1 + settings.organicDecay * .18);
  return {
    x: livingRandom(key, 3), y: livingRandom(key, 4),
    width: .1 + livingRandom(key, 5) * .34,
    height: .015 + livingRandom(key, 6) ** 2 * .23,
    dx: movement ? (Math.sin(time * speed + phase) - Math.sin(phase)) * (.006 + livingRandom(key, 7) * .012) * movement : 0,
    dy: movement ? (Math.cos(time * speed * .71 + phase) - Math.cos(phase)) * (.004 + livingRandom(key, 8) * .008) * movement : 0,
    opacity: (.22 + livingRandom(key, 9) * .32) * settings.idleIntensity,
    density: livingRandom(key, 10),
  };
}

/** Irregular codec remnants are pieces of the same continuous image-space,
 * never independent texture cards. Broad tears and small blocks intermingle.
 */
export function livingCodecFragment(composition, index, settings = composition.controls) {
  const key = composition.seed ^ Math.imul(index + 31, 19349663);
  const x = livingRandom(key, 1); const y = livingRandom(key, 2);
  const material = sampleLivingField(composition, x, y, 0, settings);
  const band = livingRandom(key, 3) > .7;
  const size = settings.blockSize / 1120;
  return {
    x, y,
    width: band ? .06 + livingRandom(key, 4) * .29 : size * (.35 + livingRandom(key, 4) ** 2 * 4.2),
    height: band ? .002 + livingRandom(key, 5) * .013 : size * (.2 + livingRandom(key, 5) ** 2 * 2.1),
    dx: (livingRandom(key, 6) - .5) * (band ? .17 : .055) * settings.organicDecay,
    dy: (livingRandom(key, 7) - .5) * .018 * settings.organicDecay,
    stretch: .78 + livingRandom(key, 8) * (band ? 1.6 : .54),
    opacity: (.15 + livingRandom(key, 9) * .5) * material.density * (1 - material.void * .7),
  };
}
