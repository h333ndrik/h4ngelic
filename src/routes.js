import { siteContent } from './data/siteContent.js';
import { artworks } from './data/artworks.js';
import { contentURL } from './content-utils.js';

export const contactURL = (artworkId = '') => `/${artworkId ? `?artwork=${encodeURIComponent(artworkId)}` : ''}#contact`;

export const categoryURL = (category) => `/work/${encodeURIComponent(category)}`;
/** New navigation uses one connected Work document; old category URLs remain valid. */
export const workAnchorURL = (category) => category === 'all' ? '/work' : `/work#${encodeURIComponent(category)}`;
export const categoryById = (id) => siteContent.categories.find((category) => category.id === id);
export const groupById = (id) => siteContent.workGroups.find((group) => group.id === id);
const knownCategory = (category) => Boolean(categoryById(category));
const knownArchive = (category) => knownCategory(category) || Boolean(groupById(category));

/** Shared category matching for rendering, metadata and group navigation. */
export function matchesArchive(project, category = 'all') {
  return category === 'all' || project.category === category
    || (!knownCategory(category) && groupById(category)?.children.includes(project.category));
}

export function projectURL(project) {
  return project && knownCategory(project.category) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id || '')
    ? `${categoryURL(project.category)}/${project.id}` : '';
}

export function publishedProjects() {
  return artworks.filter((project) => project.published !== false && projectURL(project)
    && Array.isArray(project.images) && project.images.some((image) => contentURL(image?.src)));
}

export function resolveRoute(input) {
  const url = input instanceof URL ? input : new URL(input, 'https://routing.invalid');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  let kind = 'not-found';
  let category = 'all';
  let project;
  let canonicalPath = path;
  if (path === '/' || path === '/index.html') {
    kind = 'home'; canonicalPath = '/';
  } else if (path === '/about') {
    kind = 'about';
  } else if (path === '/contact') {
    kind = 'home'; canonicalPath = '/';
  } else if (path === '/work') {
    kind = 'work';
    const requested = url.searchParams.get('category');
    if (knownArchive(requested)) { category = requested; canonicalPath = categoryURL(category); }
  } else {
    const segments = path.split('/').filter(Boolean);
    if (segments[0] === 'work' && knownArchive(segments[1])) {
      category = segments[1];
      if (segments.length === 2) kind = 'work';
      else if (segments.length === 3 && knownCategory(category)) {
        project = publishedProjects().find((entry) => projectURL(entry) === path);
        if (project) kind = 'artwork';
      }
    }
  }
  const redirectPath = path === '/contact' ? contactURL(url.searchParams.get('artwork') || '') : kind !== 'not-found' && (url.pathname !== canonicalPath || (path === '/work' && category !== 'all'))
    ? `${canonicalPath}${url.hash}` : undefined;
  return { kind, category, project, path, canonicalPath, redirectPath };
}

/** Only genuine, published projects can produce detail routes. */
export function routeDefinitions() {
  const paths = ['/', '/work', ...new Set([...siteContent.categories, ...siteContent.workGroups].map(({ id }) => categoryURL(id))), '/about', ...publishedProjects().map(projectURL)];
  if (new Set(paths).size !== paths.length) throw new Error('Published artwork IDs must have unique category URLs.');
  return paths.map((path) => resolveRoute(path));
}
