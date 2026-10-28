export const rubricSelector = '.category-link, .category-sublinks a, .work-subfilters a, .filter-link, .archive-category-heading a, .hero-nav a, .page-nav a, .text-link';

/** A selected label participates in the existing native page transition. No
 * delayed navigation, detached label clone, or extra frame loop is necessary. */
export function activateRubric(target, { reduced = false, duration = 520 } = {}) {
  if (!target?.matches?.(rubricSelector)) return () => {};
  const visual = target.querySelector('.interaction-visual') || target;
  const oldName = visual.style.getPropertyValue('view-transition-name');
  const oldPriority = visual.style.getPropertyPriority('view-transition-name');
  target.setAttribute('data-ui-selected', '');
  if (!reduced) visual.style.setProperty('view-transition-name', 'h4-rubric-selection');
  let cleared = false;
  let timer;
  const clear = () => {
    if (cleared) return;
    cleared = true;
    clearTimeout(timer);
    target.removeAttribute('data-ui-selected');
    if (oldName) visual.style.setProperty('view-transition-name', oldName, oldPriority);
    else visual.style.removeProperty('view-transition-name');
  };
  timer = setTimeout(clear, reduced ? 140 : duration);
  return clear;
}
