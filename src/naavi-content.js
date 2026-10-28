import { escapeHTML } from './content-utils.js';

/** One shared route model for the prerendered link and live scroll navigation.
 * HOME is a real route destination on interiors, never a missing DOM target. */
export function naaviStops(kind) {
  if (kind === 'home') return [
    { id: 'home-hero', label: 'home', href: '/' },
    { id: 'selected-work', label: 'works', href: '/#selected-work' },
    { id: 'about-preview', label: 'about', href: '/#about-preview' },
    { id: 'contact', label: 'contact', href: '/#contact' },
    { id: 'final-secret', selector: '[data-footer-secret-space]', label: 'the final h4', href: '/#final-secret' },
  ];
  if (kind === 'work' || kind === 'artwork') return [
    { label: 'home', href: '/' },
    { id: 'tattoos', label: 'works / tattoos', href: '/work#tattoos' },
    { id: 'jewellery', label: 'jewellery', href: '/work#jewellery' },
    { id: 'more', label: 'more', href: '/work#more' },
  ];
  return [{ label: 'home', href: '/' }, { label: kind === 'about' ? 'about' : 'page', href: kind === 'about' ? '/about' : '/' }];
}

export function initialNaaviIndex(route) {
  if (route.kind === 'home') return 0;
  if (['work', 'artwork'].includes(route.kind)) return ['jewellery'].includes(route.category) ? 2
    : ['more', 'digital-artworks', 'analog-photography', 'paintings'].includes(route.category) ? 3 : 1;
  return 1;
}

export function naaviState(stops, current) {
  const index = Math.max(0, Math.min(stops.length - 1, current));
  const next = (index + 1) % stops.length;
  return { current: index, total: stops.length - 1, destination: stops[next],
    label: `NAAVI: ${String(index).padStart(2, '0')} / ${String(stops.length - 1).padStart(2, '0')}, ${stops[index].label}. go to ${stops[next].label}` };
}

export function renderNAAVI(route) {
  const state = naaviState(naaviStops(route.kind), initialNaaviIndex(route));
  return `<a class="chapter-counter naavi" data-naavi data-chapter-counter data-no-ink data-corruption-protected href="${escapeHTML(state.destination.href)}" aria-label="${escapeHTML(state.label)}" data-chapter="${state.current}" data-chapter-total="${state.total}"><span class="chapter-digit-window" aria-hidden="true"><span class="chapter-digit">${String(state.current).padStart(2, '0')}</span></span><span class="chapter-total" aria-hidden="true"> / ${String(state.total).padStart(2, '0')}</span></a>`;
}
