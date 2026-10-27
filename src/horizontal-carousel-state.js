const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

/** Native scroll positions center each real image, including both end images. */
export function carouselPositions(items, viewportWidth, maximum) {
  const width = Math.max(0, Number(viewportWidth) || 0);
  const travel = Math.max(0, Number(maximum) || 0);
  return items.map(item => clamp(item.left + item.width / 2 - width / 2, 0, travel));
}

export function carouselIndex(position, positions) {
  if (!positions.length) return -1;
  let index = 0, distance = Infinity;
  positions.forEach((target, candidate) => {
    const next = Math.abs(target - position);
    if (next < distance) { index = candidate; distance = next; }
  });
  return index;
}

/** Plain vertical scrolling belongs to the document. Shift+wheel is an
 * explicit horizontal gesture, and is released unchanged at either end. */
export function shiftedWheelDelta({ deltaX = 0, deltaY = 0, deltaMode = 0, shiftKey = false, ctrlKey = false }, position, maximum, viewportWidth) {
  if (!shiftKey || ctrlKey || Math.abs(deltaX) >= Math.abs(deltaY)) return 0;
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? viewportWidth : 1;
  const delta = deltaY * unit;
  if (!delta || maximum <= 0 || delta < 0 && position <= .5 || delta > 0 && position >= maximum - .5) return 0;
  return delta;
}
