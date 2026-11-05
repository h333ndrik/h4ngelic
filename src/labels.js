const twoDigits = value => String(Math.max(0, Number(value) || 0)).padStart(2, '0');

/** One formatting contract for every visible numbered label and NAAVI. */
export const formatIndexedLabel = (number, label) => `${twoDigits(number)}/ ${label}`;
export const formatCounter = (current, total) => `${twoDigits(current)}/ ${twoDigits(total)}`;

/** The four chapter names, one source for INDEX, section headings and routes.
 * B-F26: the second chapter is `about`, not `more about` — the preview link
 * below the section heading keeps its own longer copy. */
export const sectionLabels = Object.freeze({
  home: 'home',
  creative: 'creative',
  about: 'about',
  contact: 'contact',
});
