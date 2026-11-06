import { siteContent } from './data/siteContent.js';
import { sectionDomId } from './section-id.js';

/** B-F31: the sections of one rubric, straight from the section list.
 *
 * `domId` uses the one shared rule (section-id.js). The tools rubric owns no
 * archive sections; it is one section by itself.
 */
export function rubricSections(context) {
  const group = siteContent.workGroups.find(entry => entry.id === context);
  if (!group) return [];
  if (group.id === 'tools') return [{ id: 'tools', domId: 'tools', label: group.label }];
  return group.children
    .map(id => siteContent.categories.find(category => category.id === id))
    .filter(Boolean)
    .map(entry => ({ id: entry.id, domId: sectionDomId(entry.id, group.id), label: entry.archiveLabel || entry.label }));
}
