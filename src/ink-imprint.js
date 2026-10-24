const tau = Math.PI * 2;
const bounded = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const number = (value) => value.toFixed(2);

/** Smooth a fresh irregular closed contour; no stored silhouettes are reused. */
function contour(points, tension = .72) {
  const result = [`M${number(points[0].x)} ${number(points[0].y)}`];
  const count = points.length;
  for (let index = 0; index < count; index++) {
    const before = points[(index - 1 + count) % count];
    const start = points[index];
    const end = points[(index + 1) % count];
    const after = points[(index + 2) % count];
    result.push(`C${number(start.x + (end.x - before.x) * tension / 6)} ${number(start.y + (end.y - before.y) * tension / 6)} ${number(end.x - (after.x - start.x) * tension / 6)} ${number(end.y - (after.y - start.y) * tension / 6)} ${number(end.x)} ${number(end.y)}`);
  }
  return `${result.join(' ')}Z`;
}

/**
 * Small procedural pigment geometry, not a particle emitter or saved artwork.
 * Supplying a random function makes genuine silhouette variation reproducible
 * in tests. Returned markup contains numeric SVG paths only.
 */
export function createInkImprint(random = Math.random, { pressure = 0 } = {}) {
  const sample = () => {
    const value = Number(random());
    return Number.isFinite(value) ? bounded(value, 0, .999999999) : .5;
  };
  const range = (minimum, maximum) => minimum + sample() * (maximum - minimum);
  const integer = (minimum, maximum) => Math.floor(range(minimum, maximum + 1));
  const held = bounded(Number.isFinite(pressure) ? pressure : 0, 0, 1);
  const center = { x: range(46, 54), y: range(45, 55) };
  const radius = range(23, 29) * (1 + held * .08);
  const points = integer(17, 31);
  const lobes = integer(3, 9);
  const phase = range(0, tau);
  const secondPhase = range(0, tau);
  const stretch = { x: range(.77, 1.13), y: range(.78, 1.14) };
  const main = Array.from({ length: points }, (_, index) => {
    const angle = (index + range(-.13, .13)) / points * tau;
    const edge = radius * (range(.71, 1.05) + Math.sin(angle * lobes + phase) * .19 + Math.sin(angle * 2 + secondPhase) * .1);
    return { x: center.x + Math.cos(angle) * edge * stretch.x, y: center.y + Math.sin(angle) * edge * stretch.y };
  });
  let mainPath = contour(main, range(.55, .86));
  // Dry, uneven gaps change fragmentation/density as well as the outer contour.
  for (let index = 0, gaps = integer(0, 4); index < gaps; index++) {
    const angle = range(0, tau);
    const distance = range(2, radius * .53);
    const x = center.x + Math.cos(angle) * distance;
    const y = center.y + Math.sin(angle) * distance;
    const holeRadius = range(1.2, 4.5);
    const gapPoints = integer(4, 7);
    mainPath += contour(Array.from({ length: gapPoints }, (_, point) => {
      const theta = point / gapPoints * tau;
      return { x: x + Math.cos(theta) * holeRadius * range(.55, 1.3), y: y + Math.sin(theta) * holeRadius * range(.6, 1.25) };
    }));
  }
  const paths = [`<path d="${mainPath}" fill-rule="evenodd" opacity="${number(range(.61, .86))}"/>`];
  const fragments = integer(3, 10) + Math.round(held * 2);
  for (let index = 0; index < fragments; index++) {
    const angle = range(0, tau);
    const distance = range(radius * .85, radius + 16 + held * 3);
    const x = bounded(center.x + Math.cos(angle) * distance, 6, 94);
    const y = bounded(center.y + Math.sin(angle) * distance, 6, 94);
    const dropRadius = range(.9, 3.8);
    const count = integer(4, 7);
    const shape = Array.from({ length: count }, (_, point) => {
      const theta = point / count * tau;
      const edge = dropRadius * range(.55, 1.3);
      return { x: x + Math.cos(theta) * edge * range(.65, 1.5), y: y + Math.sin(theta) * edge };
    });
    paths.push(`<path d="${contour(shape, range(.5, .9))}" opacity="${number(range(.24, .66))}"/>`);
  }
  return paths.join('');
}
