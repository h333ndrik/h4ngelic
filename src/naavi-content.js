import { escapeHTML } from './content-utils.js';
import { formatCounter } from './labels.js';

/** One shared route model for the prerendered link and live scroll navigation.
 * HOME is a real route destination on interiors, never a missing DOM target. */
export function naaviStops(kind) {
  if (kind === 'home') return [
    { id: 'home-hero', label: 'home', href: '/' },
    { id: 'selected-work', label: 'creative', href: '/#selected-work' },
    { id: 'about-preview', label: 'about', href: '/#about-preview' },
    { id: 'contact', label: 'contact', href: '/#contact' },
    // The fourth chapter is the end reveal that offers the other side. It is a
    // NAAVI stop only; the INDEX keeps its four destinations (B-011).
    { id: 'other-side', label: 'the other side', href: '/#final-secret', selector: '[data-end-reveal]' },
  ];
  if (kind === 'work' || kind === 'artwork' || kind === 'tool') return [
    { label: 'home', href: '/' },
    { id: 'tattoos', label: 'creative / tattoos', href: '/creative/tattoos' },
    { id: 'jewellery', label: 'jewellery', href: '/creative/jewellery' },
    { id: 'tools', label: 'tools', href: '/creative/tools' },
    { id: 'more', label: 'more', href: '/creative/more' },
  ];
  return [{ label: 'home', href: '/' }, { label: kind === 'about' ? 'about' : 'page', href: kind === 'about' ? '/about' : '/' }];
}

export function initialNaaviIndex(route) {
  if (route.kind === 'home') return 0;
  if (route.kind === 'tool') return 3;
  if (['work', 'artwork'].includes(route.kind)) return route.category === 'jewellery' ? 2
    : route.category === 'tools' ? 3
      : ['more', 'digital-artworks', 'analog-photography', 'paintings'].includes(route.category) ? 4 : 1;
  return 1;
}

export function naaviState(stops, current) {
  const index = Math.max(0, Math.min(stops.length - 1, current));
  const next = (index + 1) % stops.length;
  return { current: index, total: stops.length - 1, destination: stops[next],
    label: `NAAVI: ${formatCounter(index, stops.length - 1)}, ${stops[index].label}. go to ${stops[next].label}` };
}

export function renderNAAVI(route) {
  const state = naaviState(naaviStops(route.kind), initialNaaviIndex(route));
  return `<a class="chapter-counter naavi" data-naavi data-chapter-counter data-no-ink data-corruption-protected href="${escapeHTML(state.destination.href)}" aria-label="${escapeHTML(state.label)}" data-chapter="${state.current}" data-chapter-total="${state.total}"><span class="chapter-digit-window" aria-hidden="true"><span class="chapter-digit">${formatCounter(state.current, state.total).slice(0, 2)}</span></span><span class="chapter-total" aria-hidden="true">${formatCounter(state.current, state.total).slice(2)}</span></a>`;
}
