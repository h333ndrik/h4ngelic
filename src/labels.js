const twoDigits = value => String(Math.max(0, Number(value) || 0)).padStart(2, '0');

/** One formatting contract for every visible numbered label and NAAVI. */
export const formatIndexedLabel = (number, label) => `${twoDigits(number)}/ ${label}`;
export const formatCounter = (current, total) => `${twoDigits(current)}/ ${twoDigits(total)}`;
