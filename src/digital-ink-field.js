const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => value * value * (3 - 2 * value);
const hash = (x, y, seed) => {
  let value = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
};

function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const sx = smooth(x - ix), sy = smooth(y - iy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/** A stable, domain-warped pigment field. Broad growth is broken by branching
 * ridges and four finer scales; no saved splash, circle or rectangle is used.
 */
export function createDigitalInkField(width = 256, height = width, seed = 42931) {
  width = Math.max(2, Math.round(width)); height = Math.max(2, Math.round(height));
  const values = new Float32Array(width * height);
  let minimum = Infinity, maximum = -Infinity;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / (width - 1), v = y / (height - 1);
    const warpX = (noise(u * 2.6, v * 2.6, seed + 3) - .5) * 1.1;
    const warpY = (noise(u * 2.6, v * 2.6, seed + 7) - .5) * 1.1;
    const px = u * 3.5 + warpX, py = v * 3.5 + warpY;
    const broad = noise(px, py, seed);
    const branches = 1 - Math.abs(noise(px * 1.8, py * 1.8, seed + 11) * 2 - 1);
    const detail = noise(px * 4, py * 4, seed + 17) * .115
      + noise(px * 9, py * 9, seed + 23) * .053
      + noise(px * 19, py * 19, seed + 29) * .021
      + noise(px * 43, py * 43, seed + 31) * .008;
    const value = broad * .62 + branches * .2 + detail + v * .065;
    values[y * width + x] = value;
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
  }
  const spread = Math.max(.0001, maximum - minimum);
  for (let index = 0; index < values.length; index++) values[index] = (values[index] - minimum) / spread;
  return { width, height, values, seed };
}

/** Every pixel is solely a function of source field + scroll. Reverse scroll
 * therefore reconstructs exactly the same contour, without elapsed-time state.
 */
export function paintDigitalInkAlpha(field, progress, target, softness = .035) {
  const amount = clamp(Number.isFinite(progress) ? progress : 0);
  const threshold = amount * (1 + softness * 4) - softness * 2;
  for (let index = 0; index < field.values.length; index++) {
    const edge = clamp((threshold - field.values[index]) / softness + .5);
    const alpha = amount <= 0 ? 0 : amount >= 1 ? 255 : Math.round(smooth(edge) * 255);
    const offset = index * 4;
    target[offset] = target[offset + 1] = target[offset + 2] = 255;
    target[offset + 3] = alpha;
  }
  return target;
}

export function digitalInkProgress({ top = 0, height = 1, viewportHeight = 1, stickyRatio = .12 } = {}) {
  if (![top, height, viewportHeight, stickyRatio].every(Number.isFinite)) return 0;
  return clamp((viewportHeight * stickyRatio - top) / Math.max(1, height - viewportHeight));
}

/** Sample real contour crossings for the existing shared motion publisher. */
export function digitalInkBoundary(field, progress, count = 8) {
  const threshold = clamp(progress) * 1.14 - .07;
  return Array.from({ length: count }, (_, index) => {
    const x = Math.round((index + .5) / count * (field.width - 1));
    let selected = 0, closest = Infinity;
    for (let y = 0; y < field.height; y++) {
      const difference = Math.abs(field.values[y * field.width + x] - threshold);
      if (difference < closest) { closest = difference; selected = y; }
    }
    return { id: `ink-edge-${index}`, x: x / (field.width - 1), y: selected / (field.height - 1) };
  });
}
