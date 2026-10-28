/** Observe actual major sections, without a pointer/scroll render loop. The
 * same Work nodes survive anchor navigation and preserve every carousel pose. */
export function initConnectedWork(root = document) {
  const page = root.querySelector('[data-connected-work]');
  if (!page || typeof IntersectionObserver === 'undefined') return () => {};
  const links = [...page.querySelectorAll('.work-filters a')];
  const sections = ['tattoos', 'jewellery', 'more'].map(id => page.querySelector(`#${id}`)).filter(Boolean);
  const visible = new Set();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    const section = sections.find(element => visible.has(element));
    for (const link of links) {
      const active = section ? link.hash === `#${section.id}` || link.hash.endsWith(`#${section.id}`)
        : !link.hash || link.hash === '#/work';
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
  sections.forEach(section => observer.observe(section));
  return () => { observer.disconnect(); visible.clear(); };
}
