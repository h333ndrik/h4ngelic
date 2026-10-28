const tau = Math.PI * 2;
const bounded = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const number = (value) => value.toFixed(2);
const attribute = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
let imprintSequence = 0;

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
 * in tests. Images are clipped to that contour; displaced image bands retain
 * actual film pixels instead of drawing decorative particle rectangles.
 */
export function createInkImprint(random = Math.random, { pressure = 0, texture = '', id } = {}) {
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
  const prefix = id && /^[a-z][a-z0-9-]*$/i.test(id) ? id : `h4-ink-${++imprintSequence}`;
  const paths = [`<path d="${mainPath}" fill="currentColor" data-ink-pigment="base" fill-rule="evenodd" opacity="${number(range(.66, .92))}"/>`];
  const definitions = [`<clipPath id="${prefix}-contour"><path d="${mainPath}" clip-rule="evenodd"/></clipPath>`];
  const chemical = [];
  for (let index = 0, count = integer(3, 5); index < count; index++) {
    const x = range(25, 73);
    const y = range(23, 75);
    const rx = range(13, 27);
    const ry = range(9, 24);
    const countPoints = integer(6, 12);
    const edge = Array.from({ length: countPoints }, (_, point) => {
      const angle = point / countPoints * tau;
      return { x: x + Math.cos(angle) * rx * range(.6, 1.2), y: y + Math.sin(angle) * ry * range(.6, 1.2) };
    });
    chemical.push(`<path d="${contour(edge, range(.45, .82))}" data-ink-pigment="chemical-${index}" fill="var(--ink-accent-${1 + index % 3})" opacity="${number(range(.42, .84))}"/>`);
  }
  const image = (x, y, width, height, extra = '') => `<image data-ink-film href="${attribute(texture)}" x="${number(x)}" y="${number(y)}" width="${number(width)}" height="${number(height)}" preserveAspectRatio="xMidYMid slice" ${extra}/>`;
  const width = range(130, 220);
  const height = width * 1.5;
  const origin = { x: -range(0, width - 100), y: -range(0, height - 100) };
  const material = texture ? image(origin.x, origin.y, width, height, 'class="ink-film"') : '';
  const tears = [];
  for (let index = 0, count = integer(3, 6); index < count; index++) {
    const x = range(12, 33);
    const y = range(25, 73);
    const length = range(28, 66);
    const thickness = range(1.3, 5.8);
    const cut = `M${number(x)} ${number(y)}h${number(length)}l${number(range(-7, 7))} ${number(thickness)}h-${number(length)}Z`;
    definitions.push(`<clipPath id="${prefix}-tear-${index}"><path d="${cut}"/></clipPath>`);
    const shift = range(-23, 23);
    tears.push(`<g class="ink-tear" style="--ink-slip:${number(range(-1, 1))};--ink-tear-delay:${integer(0, 80)}ms" clip-path="url(#${prefix}-tear-${index})">${texture ? image(origin.x + shift, origin.y + range(-18, 18), width, height) : ''}<path d="${cut}" data-ink-pigment="tear-${index}" fill="var(--ink-accent-${1 + index % 3})" opacity="${number(range(.18, .5))}"/></g>`);
  }
  paths.push(`<defs>${definitions.join('')}</defs><g clip-path="url(#${prefix}-contour)">${chemical.join('')}${material}${tears.join('')}<g class="ink-channel" fill="none" stroke-width=".9"><path d="${mainPath}" transform="translate(${number(range(-1.8, -.6))} .4)" stroke="var(--ink-accent-1)"/><path d="${mainPath}" transform="translate(${number(range(.6, 1.8))} -.4)" stroke="var(--ink-accent-2)"/></g></g>`);
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
    paths.push(`<path d="${contour(shape, range(.5, .9))}" data-ink-pigment="satellite-${index}" fill="var(--ink-accent-${1 + index % 3})" opacity="${number(range(.4, .9))}"/>`);
  }
  return paths.join('');
}
