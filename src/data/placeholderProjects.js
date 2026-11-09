/** Honest editorial placeholders: generated locally, never presented as artwork. */
const entries = (category, label) => Array.from({ length: 8 }, (_, index) => ({
  id: `${category}-placeholder-${String(index + 1).padStart(2, '0')}`,
  category,
  title: `${label} ${String(index + 1).padStart(2, '0')}`,
  placeholder: true,
  published: true,
  images: [],
}));

export const placeholderProjects = Object.freeze([
  ...entries('flashes', 'flash'),
  ...entries('jewellery', 'jewellery'),
]);
