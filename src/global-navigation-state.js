/** Chapter state derives from measured, real sections rather than page labels.
 * The activation line is slightly above the viewport centre so a new chapter
 * becomes current as its heading enters the main reading area. */
export function activeChapter(tops, scrollTop, viewportHeight) {
  if (!tops.length) return -1;
  const gaps = tops.slice(1).map((top, index) => top - tops[index]).filter(gap => gap > 0);
  // A direct jump to a short mobile section must not already select the next
  // chapter. Derive the look-ahead from real section spacing as well as height.
  const offset = Math.min(Math.max(0, viewportHeight) * .42, gaps.length ? Math.min(...gaps) * .6 : Infinity);
  const readingLine = scrollTop + offset;
  let current = 0;
  for (let index = 1; index < tops.length; index++) {
    if (tops[index] > readingLine) break;
    current = index;
  }
  return current;
}

export function primaryIndexPage(kind) {
  return kind === 'artwork' ? 'work' : ['home', 'work', 'about', 'contact'].includes(kind) ? kind : '';
}

/** The final h4 belongs to Contact, rather than inventing another chapter.
 * On a short final area its reachable scroll position is the document end. */
export function hasFinalChapterStop({ current, count, scrollTop, finalTop, maximumScroll }) {
  return count > 0 && current === count - 1 && Number.isFinite(finalTop)
    && scrollTop < Math.min(finalTop, Math.max(0, maximumScroll)) - 2;
}

/** Keep the counter near the bottom centre, moving only when its actual hit
 * area would cover a form control. All inputs are cached document geometry;
 * ordinary scroll never needs a layout measurement. */
export function clearChapterTop({ preferredTop, previousTop = preferredTop, height, viewportTop = 0, viewportBottom, obstacles = [], margin = 6 }) {
  const low = viewportTop + margin;
  const high = Math.max(low, viewportBottom - height - margin);
  const clamp = value => Math.max(low, Math.min(high, value));
  const preferred = clamp(preferredTop);
  const clear = top => obstacles.every(obstacle => top + height + margin <= obstacle.top || top - margin >= obstacle.bottom);
  if (clear(preferred)) return preferred;
  const previous = clamp(previousTop);
  if (Math.abs(previous - preferred) <= 160 && clear(previous)) return previous;
  const candidates = [low, high, ...obstacles.flatMap(obstacle => [obstacle.top - height - margin, obstacle.bottom + margin])]
    .map(clamp).filter(clear).sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
  return candidates[0] ?? preferred;
}
