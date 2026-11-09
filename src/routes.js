import { siteContent } from './data/siteContent.js';
import { artworks } from './data/artworks.js';
import { contentURL } from './content-utils.js';

export const contactURL = (artworkId = '') => `/${artworkId ? `?artwork=${encodeURIComponent(artworkId)}` : ''}#contact`;

/** /creative/<category> is the canonical URL for every rubric. */
const categorySlugs = Object.freeze({});
export const categorySlug = (category) => categorySlugs[category] || category;
/** Retired slugs keep working through a 301 instead of a second canonical URL. */
const retiredCategorySlugs = Object.freeze({ onskin: 'tattoos' });
const retiredCategoryPath = (segments) => {
  const replacement = retiredCategorySlugs[segments[0]];
  return replacement ? [replacement, ...segments.slice(1)] : null;
};
/** B-F31: a section can live in the list without owning a route (`route: false`),
 * e.g. the 3d model section, which is rendered inside its rubric. */
const routableCategory = category => category.id !== 'all' && category.route !== false;
const categoryFromSlug = (slug) => siteContent.categories.find((category) => routableCategory(category) && categorySlug(category.id) === slug)
  || siteContent.workGroups.find((group) => group.id === slug);
export const categoryURL = (category) => category === 'all' ? '/creative' : `/creative/${encodeURIComponent(categorySlug(category))}`;
export const toolURL = (id) => `${categoryURL('tools')}/${encodeURIComponent(id)}`;
/** B-F28/B-F30: the creative landing target is the first section of the first
 * rubric, derived from the data list instead of a second hard-coded string.
 * INDEX and the hero bar both render this one constant. */
export const creativeLandingURL = (() => {
  const rubric = siteContent.workGroups[0];
  return categoryURL(rubric.children[0] ?? rubric.id);
})();
/** Compatibility export: rubric destinations are real routes, never hash tabs. */
export const workAnchorURL = (category) => categoryURL(category === 'all' ? 'tattoos' : category);
export const categoryById = (id) => siteContent.categories.find((category) => category.id === id);
export const groupById = (id) => siteContent.workGroups.find((group) => group.id === id);
const knownCategory = (category) => Boolean(categoryById(category));
const knownArchive = (category) => knownCategory(category) || Boolean(groupById(category));

/** Shared category matching for rendering, metadata and group navigation. */
export function matchesArchive(project, category = 'all') {
  return category === 'all' || project.category === category
    || Boolean(groupById(category)?.children.includes(project.category));
}

export function projectURL(project) {
  return project && knownCategory(project.category) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id || '')
    ? `/creative/${project.id}` : '';
}

export function publishedProjects() {
  return artworks.filter((project) => project.published !== false && projectURL(project)
    && Array.isArray(project.images) && project.images.some((image) => contentURL(image?.src)));
}

/** The complete 301 matrix for the retired /work namespace. */
export function legacyWorkDestination(input) {
  const url = input instanceof URL ? input : new URL(input, 'https://routing.invalid');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/work' && !path.startsWith('/work/')) return null;
  if (path === '/work' || path === '/work/index.html') {
    const raw = url.searchParams.get('category');
    const requested = retiredCategorySlugs[raw] || raw;
    return requested && knownArchive(requested) ? categoryURL(requested) : '/creative';
  }
  const raw = path.split('/').filter(Boolean).slice(1);
  const segments = retiredCategoryPath(raw) || raw;
  if (segments[0] === 'tools') {
    return segments[1] && siteContent.tools.some((tool) => tool.id === segments[1])
      ? toolURL(segments[1]) : '/creative/tools';
  }
  if (segments.length >= 2 && knownArchive(segments[0])) {
    const project = publishedProjects().find((entry) => entry.id === segments[segments.length - 1]);
    if (project && segments.length === 2) return projectURL(project);
    if (segments.length === 1) return categoryURL(segments[0]);
  }
  if (segments.length === 1 && knownArchive(segments[0])) return categoryURL(segments[0]);
  return '/creative';
}

export function resolveRoute(input) {
  const url = input instanceof URL ? input : new URL(input, 'https://routing.invalid');
  const requestedPath = url.pathname.replace(/\/+$/, '') || '/';
  const legacyDestination = legacyWorkDestination(url);
  if (legacyDestination) {
    const destination = resolveRoute(new URL(legacyDestination, 'https://routing.invalid'));
    return { ...destination, path: requestedPath, redirectPath: `${destination.canonicalPath}${url.hash}` };
  }

  const path = requestedPath;
  const retiredSegments = path.split('/').filter(Boolean);
  if (retiredSegments[0] === 'creative' && retiredSegments.length > 1) {
    const mapped = retiredCategoryPath(retiredSegments.slice(1));
    if (mapped) {
      const destination = resolveRoute(new URL(`/creative/${mapped.join('/')}`, 'https://routing.invalid'));
      return { ...destination, path, redirectPath: `${destination.canonicalPath}${url.hash}` };
    }
  }
  let kind = 'not-found';
  let category = 'all';
  let project;
  let tool;
  let canonicalPath = path;
  if (path === '/' || path === '/index.html') {
    kind = 'home'; canonicalPath = '/';
  } else if (path === '/about') {
    kind = 'about';
  } else if (path === '/contact') {
    kind = 'home'; canonicalPath = '/';
  } else if (path === '/impressum') {
    kind = 'impressum';
  } else if (path === '/creative' || path === '/creative/index.html') {
    kind = 'work';
    const raw = url.searchParams.get('category');
    const requested = retiredCategorySlugs[raw] || raw;
    if (knownArchive(requested)) category = requested;
    canonicalPath = category === 'all' ? '/creative' : categoryURL(category);
  } else {
    const segments = path.split('/').filter(Boolean);
    if (segments[0] === 'creative') {
      if (segments.length === 2) {
        const selected = categoryFromSlug(segments[1]);
        if (selected) {
          kind = 'work'; category = selected.id; canonicalPath = categoryURL(selected.id);
        } else {
          project = publishedProjects().find((entry) => entry.id === segments[1]);
          if (project) { kind = 'artwork'; category = project.category; canonicalPath = projectURL(project); }
        }
      } else if (segments.length === 3) {
        const selected = categoryFromSlug(segments[1]);
        if (segments[1] === categorySlug('tools') && siteContent.tools.some((entry) => entry.id === segments[2])) {
          kind = 'tool'; category = 'tools'; tool = siteContent.tools.find((entry) => entry.id === segments[2]); canonicalPath = toolURL(tool.id);
        } else if (selected) {
          project = publishedProjects().find((entry) => entry.id === segments[2] && matchesArchive(entry, selected.id));
          if (project) { kind = 'artwork'; category = project.category; canonicalPath = projectURL(project); }
        }
      }
    }
  }
  const redirectPath = path === '/contact'
    ? contactURL(url.searchParams.get('artwork') || '')
    : kind !== 'not-found' && url.pathname !== canonicalPath ? `${canonicalPath}${url.hash}` : undefined;
  return { kind, category, project, tool, path, canonicalPath, redirectPath };
}

/** Only genuine, published routes produce prerendered documents. */
export function routeDefinitions() {
  const collectionPaths = new Set([
    ...siteContent.categories.filter(routableCategory).map(({ id }) => categoryURL(id)),
    ...siteContent.workGroups.map(({ id }) => categoryURL(id)),
    ...siteContent.tools.map(({ id }) => toolURL(id)),
    '/about', '/impressum',
  ]);
  const paths = ['/', '/creative', ...collectionPaths, ...publishedProjects().map(projectURL)];
  if (new Set(paths).size !== paths.length) throw new Error('Published routes must be unique.');
  return paths.map((path) => resolveRoute(path));
}
