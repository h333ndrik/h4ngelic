const DEFAULT_ASSET = 'h4ngelic-cursor.svg';
const DEFAULT_HOTSPOT = '9 2';

/** Enumerate every painted element so a footer- or state-scoped CSS rule cannot
 * replace the single native cursor image. The custom image is a contract, not
 * merely "not none": image and hotspot must stay identical in every state. */
export async function findCursorOffenders(page, { asset = DEFAULT_ASSET, hotspot = DEFAULT_HOTSPOT } = {}) {
  return page.evaluate(({ asset, hotspot }) => {
    const offenders = [];
    const elements = [...document.querySelectorAll('body, body *')];
    for (const element of elements) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || box.width <= 0 || box.height <= 0) continue;
      const cursor = style.cursor;
      const image = cursor.match(/url\(["']?([^"')]+)["']?\)/)?.[1] || '';
      const hotspotMatch = cursor.match(/url\([^)]*\)\s+(\d+)\s+(\d+)/);
      const actualHotspot = hotspotMatch ? `${hotspotMatch[1]} ${hotspotMatch[2]}` : '';
      if (!image.endsWith(asset) || actualHotspot !== hotspot) {
        offenders.push({ tag: element.tagName.toLowerCase(), className: String(element.className || ''),
          id: element.id, cursor });
      }
    }
    return { total: elements.length, offenders };
  }, { asset, hotspot });
}

export async function cursorOf(locator, { asset = DEFAULT_ASSET, hotspot = DEFAULT_HOTSPOT } = {}) {
  const cursor = await locator.evaluate(element => getComputedStyle(element).cursor);
  const image = cursor.match(/url\(["']?([^"')]+)["']?\)/)?.[1] || '';
  const hotspotMatch = cursor.match(/url\([^)]*\)\s+(\d+)\s+(\d+)/);
  return { cursor, ok: image.endsWith(asset) && hotspotMatch?.[1] + ' ' + hotspotMatch?.[2] === hotspot };
}
