import { siteContent } from './data/siteContent.js';
import { artworks } from './data/artworks.js';
import { contentURL, escapeHTML as escape } from './content-utils.js';
import { getImageAsset } from './image-assets.js';
import { categoryURL, projectURL, categoryById, groupById, workAnchorURL, contactURL } from './routes.js';
import { renderFooter } from './footer.js';
import { renderHorizontalDrift } from './horizontal-drift-content.js';
import { renderFlashMannequin } from './flash-mannequin-content.js';
import { renderInquiryForm } from './inquiry-content.js';
import { orderedArtworks, artworkImages } from './artwork-content.js';

const arrow = '<i class="arrow" aria-hidden="true"></i>';

export function normalizeCategory(category) {
  return categoryById(category) || groupById(category) ? category : 'all';
}

function header() {
  // The one persistent brand and INDEX live in the document shell, outside
  // route content. Reserve their original header rhythm without duplicates.
  return '<header class="page-header" aria-hidden="true"></header>';
}

function footer() {
  return renderFooter();
}

export function renderHomepageSections(context = '') {
  return `<section class="content-section selected-work" id="selected-work" aria-labelledby="selected-work-title" data-motion="work"><div class="section-pin">
    <h2 class="kinetic-heading" id="selected-work-title"><span class="kinetic-heading-text">${escape(siteContent.home.selectedWorkLabel)}</span></h2>
    <div class="category-strip" role="navigation" aria-label="Works categories" tabindex="0">
      ${siteContent.workGroups.map((group) => `<a class="category-link" href="${workAnchorURL(group.id)}"><span class="kinetic-item"><span class="category-magnet"><span>${escape(group.label)}</span>${arrow}</span></span></a>`).join('')}
    </div>
  </div></section>
  <section class="content-section about-preview" id="about-preview" tabindex="-1" aria-labelledby="about-preview-title" data-motion="about"><div class="section-pin">
    <h2 class="kinetic-heading" id="about-preview-title"><span class="kinetic-heading-text">${escape(siteContent.home.aboutLabel)}</span></h2>
    <p class="about-preview-copy kinetic-item" data-motion-item="copy">${escape(siteContent.home.aboutPreview)}</p>
    <a class="text-link kinetic-item" data-motion-item="link" href="/about">${escape(siteContent.home.moreAboutLabel)} ${arrow}</a>
  </div></section>
  <section class="content-section contact-section" id="contact" aria-labelledby="contact-title" tabindex="-1" data-motion="contact"><div class="section-pin">
    <h2 class="kinetic-heading" id="contact-title"><span class="kinetic-heading-text">${escape(siteContent.home.contactLabel)}</span></h2>
    <div class="inquiry-enter">${renderInquiryForm({ context, id: 'home-inquiry' })}</div>
  </div></section>
  ${renderFooter({ home: true })}`;
}

function imageMarkup(image, { critical = false, href = '', imageIndex = 0, figureId = '' } = {}) {
  const source = contentURL(image?.src);
  if (!source) return '';
  const asset = getImageAsset(image, { sizes: '(max-width: 600px) calc(100vw - 44px), calc((100vw - 105px) / 2)' });
  const responsive = asset.srcset ? ` srcset="${escape(asset.srcset)}" sizes="${escape(asset.sizes)}"` : '';
  const element = href ? 'a' : 'button';
  const action = href ? `href="${escape(href)}" data-artwork-link data-artwork-open` : 'type="button" data-artwork-open';
  return `<figure class="project-image"${figureId ? ` id="${escape(figureId)}" tabindex="-1"` : ''}>
    <${element} class="artwork-open" ${action} aria-label="open ${escape(image.alt || 'artwork image')}" style="--artwork-ratio: ${asset.width} / ${asset.height}">
      <img src="${escape(asset.src || source)}" data-full-src="${escape(asset.fullSrc || source)}" data-artwork-image="${imageIndex}" alt="${escape(image.alt || '')}" loading="${critical ? 'eager' : 'lazy'}"${critical ? ' fetchpriority="high"' : ''} decoding="async" width="${asset.width}" height="${asset.height}"${responsive} />
    </${element}>
    ${image.caption ? `<figcaption>${escape(image.caption)}</figcaption>` : ''}
  </figure>`;
}

export function renderProject(project) {
  const href = projectURL(project);
  const images = artworkImages(project).map((image, index) => imageMarkup(image, {
    href: href ? `${href}${index ? `#image-${index + 1}` : ''}` : '', imageIndex: index,
  })).filter(Boolean).join('');
  if (!images) return '';
  const label = categoryById(project.category)?.label || '';
  const details = project.details && typeof project.details === 'object'
    ? Object.entries(project.details).filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('') : '';
  return `<article class="project"${project.id ? ` id="project-${escape(project.id)}"` : ''}${href ? ` data-project-url="${escape(href)}"` : ''}>
    <div class="project-images">${images}</div>
    <div class="project-meta">
      ${project.title ? `<h2>${projectURL(project) ? `<a href="${projectURL(project)}">${escape(project.title)}</a>` : escape(project.title)}</h2>` : ''}
      <p class="project-index">${escape(label)}${project.year ? ` <span aria-hidden="true">/</span> ${escape(project.year)}` : ''}</p>
      ${project.description ? `<p class="project-description">${escape(project.description)}</p>` : ''}
      ${details ? `<dl class="project-details">${details}</dl>` : ''}
      ${!project.title && projectURL(project) ? `<a class="text-link" href="${projectURL(project)}">view work</a>` : ''}
    </div>
  </article>`;
}

/** All archives share one document. Category URLs are retained as deep links,
 * never used to unmount the other groups or lose their carousel context. */
export function renderWorkPage(category = 'all') {
  const selected = normalizeCategory(category);
  const projects = orderedArtworks(artworks.filter(project => project.published !== false && categoryById(project.category)));
  const collection = entry => {
    const items = projects.filter(project => project.category === entry.id);
    const contents = entry.presentation === 'drift' ? renderHorizontalDrift(items, { category: entry.id, label: entry.label })
      : items.map(renderProject).filter(Boolean).join('');
    return entry.presentation === 'existing' && contents ? `<div class="project-grid">${contents}</div>` : contents || '<p class="archive-empty">archive in progress.</p>';
  };
  const leaf = (entry, { id = entry.id, nested = true } = {}) => {
    return `<section class="archive-category" id="${escape(id)}" tabindex="-1" aria-labelledby="archive-${escape(entry.id)}-title" data-archive-category="${escape(entry.id)}">
      <${nested ? 'h3' : 'h2'} class="archive-category-heading" id="archive-${escape(entry.id)}-title"><a href="${workAnchorURL(id)}">${escape(entry.archiveLabel || entry.label)}</a></${nested ? 'h3' : 'h2'}>
      ${collection(entry)}
    </section>`;
  };
  const content = siteContent.workGroups.map(group => {
    const directCategory = group.children.length === 1 && group.children[0] === group.id;
    return `<section class="work-group${directCategory ? ' archive-category' : ''}" id="${escape(group.id)}" tabindex="-1" aria-labelledby="group-${escape(group.id)}-title" data-work-group="${escape(group.id)}"${directCategory ? ` data-archive-category="${escape(group.id)}"` : ''}>
      <h2 class="work-group-heading" id="group-${escape(group.id)}-title"><a href="${workAnchorURL(group.id)}">${escape(group.label)}</a></h2>
      ${directCategory ? collection(categoryById(group.id)) : group.children.map(id => leaf(categoryById(id), { id: id === group.id ? 'finished-tattoos' : id })).join('')}
      ${group.id === 'tattoos' ? '<section class="archive-category archive-model" id="model-3d" tabindex="-1" aria-labelledby="archive-model-title" data-deferred-model><h3 class="archive-category-heading" id="archive-model-title">3d model</h3></section>' : ''}
    </section>`;
  }).join('');
  const legacy = siteContent.categories.filter(entry => entry.legacy && (selected === entry.id || projects.some(project => project.category === entry.id))).map(entry => leaf(entry, { nested: false })).join('');
  return `${header('work')}
  <div class="page-shell work-page" data-connected-work data-work-context="${escape(selected)}">
    <h1 class="page-heading">01 / WORKS</h1>
    <nav class="work-filters" aria-label="Works sections">
      ${[{ id: 'all', label: 'all' }, ...siteContent.workGroups].map(filter => `<a class="filter-link${selected === filter.id ? ' is-active' : ''}" href="${workAnchorURL(filter.id)}"${selected === filter.id ? ' aria-current="location"' : ''}>${escape(filter.label)}</a>`).join('')}
    </nav>
    <div class="portfolio-archive" aria-label="All artwork">${content}${legacy}</div>
  </div>${footer()}`;
}

export function renderAboutPage() {
  const about = siteContent.about;
  const portraitURL = contentURL(about.portrait?.src);
  const portrait = portraitURL ? getImageAsset(about.portrait, { sizes: '(max-width: 600px) calc(100vw - 44px), 40vw' }) : null;
  const portraitResponsive = portrait?.srcset ? ` srcset="${escape(portrait.srcset)}" sizes="${escape(portrait.sizes)}"` : '';
  const references = (about.references || []).map((reference) => {
    const url = contentURL(reference.url);
    return url ? `<li><a class="text-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(reference.title)}</a></li>` : '';
  }).filter(Boolean).join('');
  return `${header('about')}
  <div class="page-shell about-page">
    <h1 class="page-heading">about</h1>
    <div class="about-layout${portraitURL ? ' has-portrait' : ''}">
      <div class="about-copy">
        <p class="about-intro">${escape(about.intro)}</p>
        <p class="about-location">${escape(about.location)}</p>
        ${(about.paragraphs || []).map((paragraph) => `<p class="about-paragraph">${escape(paragraph)}</p>`).join('')}
        <a class="text-link" href="${contactURL()}">get in touch</a>
      </div>
      ${portrait ? `<figure class="about-portrait" style="--artwork-ratio: ${portrait.width} / ${portrait.height}"><img src="${escape(portrait.src || portraitURL)}" alt="${escape(about.portrait.alt || '')}" loading="lazy" decoding="async" width="${portrait.width}" height="${portrait.height}"${portraitResponsive} /></figure>` : ''}
    </div>
    ${references ? `<section class="about-references" aria-labelledby="references-title"><h2 class="section-label" id="references-title">references</h2><ul>${references}</ul></section>` : ''}
  </div>
  ${footer()}`;
}

export function renderNotFoundPage() {
  return `${header('')}
  <div class="page-shell not-found-page">
    <p class="page-kicker">404</p>
    <h1 class="page-heading">page not found.</h1>
    <a class="text-link" href="/">back home</a>
  </div>
  ${footer()}`;
}

export function renderArtworkPage(project) {
  if (!project || !projectURL(project)) return renderNotFoundPage();
  const category = categoryById(project.category);
  const details = Object.entries(project.details || {}).filter(([, value]) => value !== '' && value != null);
  return `${header('work')}
    <div class="page-shell artwork-page">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">home</a><span aria-hidden="true">/</span><a href="${categoryURL(category.id)}">${escape(category.label)}</a></nav>
      <article class="project artwork-detail" data-project-url="${escape(projectURL(project))}">
        <h1 class="page-heading">${escape(project.title || category.label)}</h1>
        <div class="project-images">${artworkImages(project).map((image, index) => imageMarkup(image, { critical: index === 0, imageIndex: index, figureId: `image-${index + 1}` })).join('')}</div>
        ${renderFlashMannequin(project)}
        <div class="project-meta">
          <p class="project-index">${escape(category.label)}${project.year ? ` / ${escape(project.year)}` : ''}</p>
          ${project.description ? `<p class="project-description">${escape(project.description)}</p>` : ''}
          ${details.length ? `<dl class="project-details">${details.map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>` : ''}
          <a class="text-link" href="${escape(contactURL(project.id))}">inquire about this work</a>
          <a class="text-link" href="${workAnchorURL(category.id)}">back to ${escape(category.label)}</a>
        </div>
      </article>
    </div>${footer()}`;
}

export function renderRoutePage(route, { context = '' } = {}) {
  if (route.kind === 'home') return renderHomepageSections(context);
  if (route.kind === 'work') return renderWorkPage(route.category);
  if (route.kind === 'about') return renderAboutPage();
  if (route.kind === 'artwork') return renderArtworkPage(route.project);
  return renderNotFoundPage();
}
