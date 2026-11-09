/** B-F31: the one rule that turns a section entry into its DOM id/anchor.
 *
 * The rubric's own section keeps the historical `finished-<rubric>` id (it
 * carries the rubric page heading); every other section uses its own id, which
 * doubles as its anchor. Renderer and NAAVI both call this function, so the
 * id is built in exactly one place.
 */
/** An explicit `anchor` on the section entry wins; otherwise the rubric's own
 * section keeps `finished-<rubric>` and everything else uses its own id. */
export const sectionDomId = (id, rubricId = '', anchor = '') => anchor || (rubricId && id === rubricId ? `finished-${id}` : id);
