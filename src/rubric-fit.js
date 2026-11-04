/** Keep every rubric row inside its own columns so --rubric-gap stays visible.
 * The word list drives the fit, not a magic font-size: a long rubric such as
 * `jewellery` may not spill into the next cell. Pure measurement, no layout
 * writes beyond one custom property; without JS the token size stays active. */
const rows = [
  { row: '.category-strip', item: '.category-link', visual: '.interaction-visual' },
  { row: '.rubric-cross-links', item: '.rubric-cross-links > a', visual: null },
];

const columnWidth = (row) => {
  const tracks = (getComputedStyle(row).gridTemplateColumns || '').split(' ')
    .map(value => parseFloat(value)).filter(value => Number.isFinite(value) && value > 0);
  return tracks.length ? Math.min(...tracks) : row.clientWidth;
};

export function fitRubricRows(doc = document) {
  for (const { row, item, visual } of rows) {
    for (const element of doc.querySelectorAll(row)) {
      element.style.removeProperty('--row-type-fit');
      const entries = [...element.querySelectorAll(item)];
      if (!entries.length) continue;
      // The items own the display size; the row itself may still be 16px.
      const base = parseFloat(getComputedStyle(entries[0]).fontSize);
      const column = columnWidth(element);
      if (!base || !column) continue;
      // Leave the same room the hover fit needs (2.5% plus its glow margin),
      // otherwise the base label would fill its column and hover would clamp.
      const hover = parseFloat(getComputedStyle(element).getPropertyValue('--ui-hover-scale')) || 1;
      const hoverMargin = 5;
      let scale = 1;
      for (const entry of entries) {
        const label = visual ? entry.querySelector(visual) : entry;
        if (!label) continue;
        const inset = parseFloat(getComputedStyle(entry).paddingLeft) || 0;
        const available = (column - inset - 1 - hoverMargin) / hover;
        const width = label.scrollWidth;
        if (width > 0 && available > 0) scale = Math.min(scale, available / width);
      }
      if (scale < .999) {
        element.style.setProperty('--row-type-fit', `${Math.floor(base * scale * 1000) / 1000}px`);
      }
    }
  }
}
