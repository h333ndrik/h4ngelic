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
