/** Keep every Type A row (frontpage strip, rubric cross-links) inside its own
 * insets. The word list drives the fit, not a magic font-size: if the row
 * overflows, the shared fit token shrinks just enough. Both rows render the
 * same four labels, so they receive the same size and the same x positions.
 *
 * The fit is one overflow measurement per row: one custom property, no layout
 * writes per item. Without JavaScript the type token stays active and the
 * strip keeps its own horizontal scrollport. */
const rows = [
  { row: '[data-row="distributed"]', item: '.row-item' },
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
