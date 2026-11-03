const DEFAULT_HOTSPOT = '9 2';

/** Enumerate every painted element so a footer- or state-scoped CSS rule cannot
 * replace the blanket cursor. Without the runtime class the same page must fall
 * back to ordinary system cursors. The xray allowlist alone keeps the mode image. */
export async function findCursorOffenders(page, { mode = 'auto', asset, hotspot = DEFAULT_HOTSPOT } = {}) {
  return page.evaluate(({ requestedMode, explicitAsset, hotspot }) => {
    const html = document.documentElement;
    const mode = requestedMode !== 'auto' ? requestedMode
      : !html.classList.contains('h4-custom-cursor') ? 'system'
        : html.dataset.cursor === 'xray' ? 'xray' : 'blanket';
    const asset = explicitAsset || (html.dataset.mode === 'xray' ? 'h4ngelic-cursor-other-r09.svg' : 'h4ngelic-cursor.svg');
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
      const matches = mode === 'blanket' ? cursor === 'none'
        : mode === 'system' ? cursor !== 'none' && !/h4ngelic-cursor(?:-other-r09)?\.svg/.test(image)
          : image.endsWith(asset) && actualHotspot === hotspot;
      if (!matches) {
        offenders.push({ tag: element.tagName.toLowerCase(), className: String(element.className || ''),
          id: element.id, cursor });
      }
    }
    return { mode, total: elements.length, offenders };
  }, { requestedMode: mode, explicitAsset: asset, hotspot });
}

export async function cursorOf(locator, { mode = 'auto', asset, hotspot = DEFAULT_HOTSPOT } = {}) {
  const result = await locator.evaluate((element, { requestedMode, explicitAsset, hotspot }) => {
    const html = document.documentElement;
    const mode = requestedMode !== 'auto' ? requestedMode
      : !html.classList.contains('h4-custom-cursor') ? 'system'
        : html.dataset.cursor === 'xray' ? 'xray' : 'blanket';
    const expectedAsset = explicitAsset || (html.dataset.mode === 'xray' ? 'h4ngelic-cursor-other-r09.svg' : 'h4ngelic-cursor.svg');
    return { cursor: getComputedStyle(element).cursor, mode, expectedAsset, hotspot };
  }, { requestedMode: mode, explicitAsset: asset, hotspot });
  const cursor = result.cursor;
  const image = cursor.match(/url\(["']?([^"')]+)["']?\)/)?.[1] || '';
  const hotspotMatch = cursor.match(/url\([^)]*\)\s+(\d+)\s+(\d+)/);
  const actualHotspot = hotspotMatch ? `${hotspotMatch[1]} ${hotspotMatch[2]}` : '';
  const ok = result.mode === 'blanket' ? cursor === 'none'
    : result.mode === 'system' ? cursor !== 'none' && !/h4ngelic-cursor(?:-other-r09)?\.svg/.test(image)
      : image.endsWith(result.expectedAsset) && actualHotspot === result.hotspot;
  return { cursor, mode: result.mode, ok };
}
