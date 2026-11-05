/** Keep every rubric row inside its own scrollport so --rubric-gap stays
 * visible. The word list drives the fit, not a magic font-size: if the row
 * overflows its container, the shared row token shrinks just enough.
 *
 * The rows no longer use equal grid columns (that made the gap depend on the
 * label length), so the fit is a single overflow measurement per row: one
 * custom property, no layout writes per item. Without JavaScript the token
 * size stays active and the strip keeps its own horizontal scrollport. */
const rows = [
  { row: '.category-strip', item: '.category-link' },
  { row: '.rubric-cross-links', item: 'a' },
];

export function fitRubricRows(doc = document) {
  for (const { row, item } of rows) {
    for (const element of doc.querySelectorAll(row)) {
      element.style.removeProperty('--row-type-fit');
      const entries = [...element.querySelectorAll(item)];
      if (!entries.length) continue;
      const base = parseFloat(getComputedStyle(entries[0]).fontSize);
      if (!base) continue;
      const style = getComputedStyle(element);
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const available = element.clientWidth - padding;
      // The hover fit adds 2.5% plus its glow margin; keep that room free.
      const needed = element.scrollWidth + 5;
      if (available <= 0 || needed <= available) continue;
      const scale = available / needed;
      element.style.setProperty('--row-type-fit', `${Math.floor(base * scale * 1000) / 1000}px`);
    }
  }
}
