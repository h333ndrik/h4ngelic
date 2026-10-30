import { seoContent } from './data/seoContent.js';
import { siteContent } from './data/siteContent.js';
import { contentURL, escapeHTML } from './content-utils.js';
import { publishedProjects, projectURL, categoryURL, matchesArchive } from './routes.js';
import { artworkLabel } from './artwork-content.js';

const cleanText = (value) => typeof value === 'string' ? value.trim() : '';

/** Only an HTTPS origin is a suitable canonical domain; never infer it from a request. */
export function normalizeProductionURL(value = '') {
  if (!value) return '';
  const candidate = cleanText(value);
  let url;
  try { url = new URL(candidate); } catch { throw new Error('SEO productionURL must be a confirmed HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SEO productionURL must be an HTTPS origin without credentials, a path, query or fragment.');
  }
  return url.origin;
}

/** The Vite constant keeps client navigation consistent with the prerendered build. */
export function getSEOConfig(overrides = {}) {
  const embedded = typeof __H4_SEO_CONFIG__ === 'undefined' ? {} : __H4_SEO_CONFIG__;
  const config = { productionURL: seoContent.productionURL, deployment: seoContent.deployment, ...embedded, ...overrides };
  if (!['preview', 'production'].includes(config.deployment)) throw new Error('SEO deployment must be preview or production.');
  config.productionURL = normalizeProductionURL(config.productionURL);
  if (config.deployment === 'production' && !config.productionURL) {
    throw new Error('Production indexing requires a confirmed HTTPS productionURL.');
  }
  // A preview cannot be made indexable by setting indexing=true accidentally.
  config.indexing = config.deployment === 'production' && config.indexing !== false;
  return config;
}

/** Explicit public build settings only. No hostname detection or secret environment values. */
export function seoEnvironment(env = {}) {
  return getSEOConfig({
    deployment: env.H4_DEPLOYMENT || seoContent.deployment,
    productionURL: env.H4_PRODUCTION_URL ?? seoContent.productionURL,
  });
}

const absoluteURL = (value, origin) => {
  const safe = contentURL(value);
  return safe && (safe.startsWith('/') ? origin && `${origin}${safe}` : safe) || '';
};

function realImages(project) {
  return (Array.isArray(project?.images) ? project.images : []).filter((image) => contentURL(image?.src));
}

/** Drafts and incomplete artwork may be displayed, but must not produce thin indexed pages. */
export function isIndexableProject(project) {
  return Boolean(project && project.published !== false && projectURL(project)
    && cleanText(project.title) && cleanText(project.description)
    && realImages(project).some((image) => cleanText(image.alt)));
}

function imageMetadata(image, origin) {
  if (!image) return null;
  const src = typeof image === 'string' ? image : image.src;
  const url = absoluteURL(src, origin);
  if (!url) return null;
  const result = { url, alt: cleanText(image.alt) };
  if (Number.isInteger(image.width) && image.width > 0 && Number.isInteger(image.height) && image.height > 0) {
    result.width = image.width; result.height = image.height;
  }
  return result;
}

function structuredData(route, metadata, config) {
  const origin = config.productionURL;
  if (!origin || route.kind === 'not-found') return null;
  const personID = `${origin}/#artist`;
  const siteID = `${origin}/#website`;
  const pageID = `${metadata.canonicalURL}#webpage`;
  const profiles = [siteContent.contact.instagramURL].map((url) => contentURL(url, { relative: false })).filter(Boolean);
  const person = {
    '@type': 'Person', '@id': personID,
    name: seoContent.identity.name, alternateName: seoContent.identity.alternateName,
    description: seoContent.identity.description, url: `${origin}/about`,
    workLocation: { '@type': 'Place', name: seoContent.identity.location },
    knowsAbout: ['Tattooing', 'Jewellery', 'Painting', 'Mixed media', 'Visual art'],
    ...(profiles.length ? { sameAs: profiles } : {}),
  };
  const website = {
    '@type': 'WebSite', '@id': siteID, name: seoContent.siteName, url: `${origin}/`,
    inLanguage: seoContent.language, creator: { '@id': personID },
  };
  const page = {
    '@type': route.kind === 'about' ? 'AboutPage' : route.kind === 'work' ? 'CollectionPage' : 'WebPage',
    '@id': pageID, url: metadata.canonicalURL, name: metadata.title, description: metadata.description,
    inLanguage: seoContent.language, isPartOf: { '@id': siteID }, about: { '@id': personID },
  };
  const graph = [person, website, page];
  const crumbs = [{ name: 'h4ngelic', path: '/' }];
  if (route.kind === 'work' || route.kind === 'artwork') crumbs.push({ name: 'work', path: '/work' });
  if ((route.kind === 'work' || route.kind === 'artwork') && route.category !== 'all') {
    crumbs.push({ name: route.category, path: categoryURL(route.category) });
  }
  if (route.kind === 'about') crumbs.push({ name: 'about', path: '/about' });
  if (route.kind === 'artwork') crumbs.push({ name: artworkLabel(route.project) || route.category, path: route.canonicalPath });
  if (crumbs.length > 1) {
    page.breadcrumb = { '@id': `${metadata.canonicalURL}#breadcrumbs` };
    graph.push({
      '@type': 'BreadcrumbList', '@id': page.breadcrumb['@id'],
      itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: `${origin}${crumb.path}` })),
    });
  }
  if (route.kind === 'artwork') {
    const project = route.project;
    const images = realImages(project).map((image) => imageMetadata(image, origin)).filter(Boolean);
    const artworkID = `${metadata.canonicalURL}#artwork`;
    page.mainEntity = { '@id': artworkID };
    const artwork = {
      '@type': 'VisualArtwork', '@id': artworkID, url: metadata.canonicalURL,
      name: artworkLabel(project) || route.category,
      ...(cleanText(project.description) ? { description: cleanText(project.description) } : {}),
      creator: { '@id': personID }, artform: route.category,
      image: images.map((image, index) => ({
        '@type': 'ImageObject', '@id': `${metadata.canonicalURL}#image-${index + 1}`, contentUrl: image.url,
        ...(image.alt ? { description: image.alt } : {}),
        ...(image.width ? { width: image.width, height: image.height } : {}),
      })),
    };
    // Preserve only supplied, parseable year/date information; do not infer creation dates.
    if (/^\d{4}(?:-\d{2}-\d{2})?$/.test(String(project.year || ''))) artwork.dateCreated = String(project.year);
    graph.push(artwork);
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** All page metadata is derived from editable copy and genuine route/content data. */
export function getPageMetadata(route, options = {}) {
  const config = getSEOConfig(options);
  const projects = options.projects ?? publishedProjects();
  let copy = seoContent.pages[route.kind] || seoContent.pages['not-found'];
  if (route.kind === 'work' && route.category !== 'all') copy = seoContent.categories[route.category] || copy;
  if (route.kind === 'artwork') {
    copy = {
      title: cleanText(route.project.seo?.title) || `${artworkLabel(route.project) || route.category} — h4ngelic`,
      description: cleanText(route.project.seo?.description) || cleanText(route.project.description) || seoContent.categories[route.category]?.description,
    };
  }
  const contentReady = route.kind === 'home' || route.kind === 'about'
    || (route.kind === 'artwork' && isIndexableProject(route.project))
    || (route.kind === 'work' && projects.some((project) => isIndexableProject(project) && matchesArchive(project, route.category)));
  // Legacy category documents now contain the same connected archive. Retain
  // their working URLs, but consolidate search indexing on the Work document.
  const archiveAlias = route.kind === 'work' && route.category !== 'all';
  const indexable = config.indexing && Boolean(contentReady) && !archiveAlias;
  const canonicalURL = route.kind !== 'not-found' && config.productionURL ? `${config.productionURL}${archiveAlias ? '/work' : route.canonicalPath}` : '';
  const image = imageMetadata(route.project?.seo?.image || realImages(route.project)[0] || seoContent.openGraphImage, config.productionURL);
  const metadata = {
    path: route.canonicalPath, status: route.kind === 'not-found' ? 404 : 200,
    title: copy.title, description: copy.description || '', canonicalURL,
    deployment: config.deployment, indexable, robots: indexable ? 'index, follow' : 'noindex, follow',
    openGraph: {
      title: copy.title, description: copy.description || '', type: 'website',
      siteName: seoContent.siteName, locale: seoContent.locale, url: canonicalURL,
      ...(image ? { image } : {}),
    },
  };
  metadata.structuredData = structuredData(route, metadata, config);
  return metadata;
}

/** Escape JSON for an inline script, including hostile editable text containing </script>. */
export function serializeJSONLD(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function renderHead(metadata) {
  const meta = (name, content, property = false) => `<meta data-seo ${property ? 'property' : 'name'}="${escapeHTML(name)}" content="${escapeHTML(content)}" />`;
  const lines = [
    `<title data-seo>${escapeHTML(metadata.title)}</title>`,
    meta('description', metadata.description), meta('robots', metadata.robots),
  ];
  if (metadata.canonicalURL) lines.push(`<link data-seo rel="canonical" href="${escapeHTML(metadata.canonicalURL)}" />`);
  const og = metadata.openGraph;
  for (const [key, value] of Object.entries({ title: og.title, description: og.description, type: og.type, site_name: og.siteName, locale: og.locale, url: og.url })) {
    if (value) lines.push(meta(`og:${key}`, value, true));
  }
  lines.push(meta('twitter:card', og.image ? 'summary_large_image' : 'summary'));
  lines.push(meta('twitter:title', metadata.title), meta('twitter:description', metadata.description));
  if (og.image) {
    lines.push(meta('og:image', og.image.url, true), meta('twitter:image', og.image.url));
    if (og.image.alt) lines.push(meta('og:image:alt', og.image.alt, true), meta('twitter:image:alt', og.image.alt));
    if (og.image.width) lines.push(meta('og:image:width', og.image.width, true), meta('og:image:height', og.image.height, true));
  }
  if (metadata.structuredData) lines.push(`<script data-seo id="structured-data" type="application/ld+json">${serializeJSONLD(metadata.structuredData)}</script>`);
  return lines.join('\n');
}

/** Update metadata after client navigation without duplicates or stale preview directives. */
export function applyMetadata(metadata, documentObject = globalThis.document) {
  if (!documentObject) return;
  documentObject.head.querySelectorAll('[data-seo], title, meta[name="description"], meta[name="robots"], link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"], #structured-data').forEach((node) => node.remove());
  const template = documentObject.createElement('template');
  template.innerHTML = renderHead(metadata);
  documentObject.head.append(template.content);
}
