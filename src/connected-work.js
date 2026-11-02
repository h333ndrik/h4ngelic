import { siteContent } from './data/siteContent.js';

/** Route links keep a truthful current-page state. Scrolling cannot turn a
 * different category destination into a tab or silently change the URL. */
export function initConnectedWork(root = document) {
  const page = root.querySelector('[data-connected-work]');
  if (!page) return () => {};
  const selected = page.dataset.workContext;
  const group = siteContent.workGroups.find(entry => entry.id === selected || entry.children.includes(selected));
  for (const link of page.querySelectorAll('.work-filters a')) {
    const active = Boolean(group && link.getAttribute('href')?.replace(/^#(?=\/)/, '').split('#')[0] === `/work/${group.id}`);
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  return () => {};
}
