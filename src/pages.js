import { siteContent } from './data/siteContent.js';
import { artworks } from './data/artworks.js';
import { contentURL, emailURL, escapeHTML as escape } from './content-utils.js';
import { getImageAsset } from './image-assets.js';
import { categoryURL, projectURL, categoryById, groupById, matchesArchive } from './routes.js';
import { renderFooter } from './footer.js';
import { renderHorizontalDrift } from './horizontal-drift-content.js';
import { renderDigitalInk } from './digital-ink-content.js';
import { renderFlashMannequin } from './flash-mannequin-content.js';

const arrow = '<i class="arrow" aria-hidden="true"></i>';

export function normalizeCategory(category) {
  return categoryById(category) || groupById(category) ? category : 'all';
}

function header(page) {
  return `<header class="page-header">
    <a class="brand-link" href="/">${escape(siteContent.name)} © ${escape(siteContent.copyrightYear)}</a>
    <nav class="page-nav" aria-label="Portfolio">
      <a href="/work"${page === 'work' ? ' aria-current="page"' : ''}>work ${arrow}</a>
      <a href="/about"${page === 'about' ? ' aria-current="page"' : ''}>about ${arrow}</a>
      <a href="/#contact">contact ${arrow}</a>
    </nav>
  </header>`;
}

function footer() {
  return renderFooter();
}

function contactLink(label, destination) {
  const classes = 'contact-link';
  const contents = `<span class="kinetic-item"><span class="category-magnet"><span>${escape(label)}</span>${arrow}</span></span>`;
  if (!destination) {
    return `<span class="${classes} is-unconfigured" aria-disabled="true" aria-label="${escape(label)} — link coming soon" title="link coming soon">${contents}</span>`;
  }
  const external = destination.startsWith('https:');
  return `<a class="${classes}" href="${escape(destination)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${contents}</a>`;
}

export function renderHomepageSections() {
  const contact = siteContent.contact;
  const email = emailURL(contact.email);
  return `<section class="content-section selected-work" id="selected-work" aria-labelledby="selected-work-title" data-motion="work"><div class="section-pin">
    <h2 class="kinetic-heading" id="selected-work-title"><span class="kinetic-heading-text">${escape(siteContent.home.selectedWorkLabel)}</span></h2>
    <div class="category-strip" role="navigation" aria-label="Selected work categories" tabindex="0">
      ${siteContent.workGroups.map((group) => `<a class="category-link" href="${categoryURL(group.id)}"><span class="kinetic-item"><span class="category-magnet"><span>${escape(group.label)}</span>${arrow}</span></span></a>`).join('')}
      ${siteContent.workGroups.map((group) => `<div class="category-sublinks" aria-label="${escape(group.label)} subcategories">${group.children.length > 1 ? group.children.map((id) => `<a href="${categoryURL(id)}">${escape(categoryById(id).label)} ${arrow}</a>`).join('') : ''}</div>`).join('')}
    </div>
  </div></section>
  <section class="content-section about-preview" aria-labelledby="about-preview-title" data-motion="about"><div class="section-pin">
    <h2 class="kinetic-heading" id="about-preview-title"><span class="kinetic-heading-text">${escape(siteContent.home.aboutLabel)}</span></h2>
    <p class="about-preview-copy kinetic-item" data-motion-item="copy">${escape(siteContent.home.aboutPreview)}</p>
    <a class="text-link kinetic-item" data-motion-item="link" href="/about">${escape(siteContent.home.moreAboutLabel)} ${arrow}</a>
  </div></section>
  <section class="content-section contact-section" id="contact" aria-labelledby="contact-title" tabindex="-1" data-motion="contact"><div class="section-pin">
    <h2 class="kinetic-heading" id="contact-title"><span class="kinetic-heading-text">${escape(siteContent.home.contactLabel)}</span></h2>
    <div class="contact-links">
      ${contactLink('instagram', contentURL(contact.instagramURL, { relative: false }))}
      ${contactLink('email', email)}
      ${contactLink('book a tat', contentURL(contact.bookingURL))}
    </div>
  </div></section>
  ${renderFooter({ home: true })}`;
}

function imageMarkup(image, { critical = false, href = '', imageIndex = 0, figureId = '' } = {}) {
  const source = contentURL(image?.src);
  if (!source) return '';
  const asset = getImageAsset(image, { sizes: '(max-width: 600px) calc(100vw - 44px), calc((100vw - 105px) / 2)' });
  const responsive = asset.srcset ? ` srcset="${escape(asset.srcset)}" sizes="${escape(asset.sizes)}"` : '';
  const element = href ? 'a' : 'button';
  const action = href ? `href="${escape(href)}" data-artwork-link` : 'type="button" data-artwork-open';
  return `<figure class="project-image"${figureId ? ` id="${escape(figureId)}" tabindex="-1"` : ''}>
    <${element} class="artwork-open" ${action} aria-label="open ${escape(image.alt || 'artwork image')}" style="--artwork-ratio: ${asset.width} / ${asset.height}">
      <img src="${escape(asset.src || source)}" data-full-src="${escape(asset.fullSrc || source)}" data-artwork-image="${imageIndex}" alt="${escape(image.alt || '')}" loading="${critical ? 'eager' : 'lazy'}"${critical ? ' fetchpriority="high"' : ''} decoding="async" width="${asset.width}" height="${asset.height}"${responsive} />
    </${element}>
    ${image.caption ? `<figcaption>${escape(image.caption)}</figcaption>` : ''}
  </figure>`;
}

export function renderProject(project) {
  const href = projectURL(project);
  const images = (Array.isArray(project.images) ? project.images : []).map((image, index) => imageMarkup(image, {
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
      ${project.title ? `<h2>${projectURL(project) ? `<a href="${projectURL(project)}">${escape(project.title)} ${arrow}</a>` : escape(project.title)}</h2>` : ''}
      <p class="project-index">${escape(label)}${project.year ? ` <span aria-hidden="true">/</span> ${escape(project.year)}` : ''}</p>
      ${project.description ? `<p class="project-description">${escape(project.description)}</p>` : ''}
      ${details ? `<dl class="project-details">${details}</dl>` : ''}
      ${!project.title && projectURL(project) ? `<a class="text-link" href="${projectURL(project)}">view work ${arrow}</a>` : ''}
    </div>
  </article>`;
}

export function renderWorkPage(category = 'all') {
  const selected = normalizeCategory(category);
  const selectedCategory = categoryById(selected);
  const parent = groupById(selectedCategory?.group || selected);
  const archiveLabel = selectedCategory?.label || groupById(selected)?.label || 'all artwork';
  const projects = artworks.filter((project) => project.published !== false && categoryById(project.category)
    && matchesArchive(project, selected));
  const visibleCategories = selectedCategory ? [selectedCategory] : selected === 'all'
    ? siteContent.categories.filter((entry) => !entry.legacy || projects.some((project) => project.category === entry.id))
    : (groupById(selected)?.children || []).map(categoryById);
  const filters = [{ id: 'all', label: 'all' }, ...siteContent.workGroups,
    ...(selectedCategory?.legacy ? [selectedCategory] : [])];
  const content = visibleCategories.map((entry) => {
    const items = projects.filter((project) => project.category === entry.id);
    const contents = entry.presentation === 'drift' ? renderHorizontalDrift(items, { category: entry.id, label: entry.label })
      : entry.presentation === 'ink' ? renderDigitalInk(items)
        : items.map(renderProject).filter(Boolean).join('');
    const inner = contents || '<p class="archive-empty">archive in progress.</p>';
    return `<section class="archive-category" id="${escape(entry.id)}" aria-labelledby="archive-${escape(entry.id)}-title" data-archive-category="${escape(entry.id)}">
      ${visibleCategories.length > 1 ? `<h2 class="archive-category-heading" id="archive-${escape(entry.id)}-title"><a href="${categoryURL(entry.id)}">${escape(entry.label)} ${arrow}</a></h2>` : `<h2 class="sr-only" id="archive-${escape(entry.id)}-title">${escape(entry.label)}</h2>`}
      ${entry.presentation === 'existing' && contents ? `<div class="project-grid">${inner}</div>` : inner}
    </section>`;
  }).join('');
  return `${header('work')}
  <div class="page-shell work-page">
    <p class="page-kicker">portfolio archive</p>
    <h1 class="page-heading">${selected === 'all' ? 'work' : escape(archiveLabel)}</h1>
    <nav class="work-filters" aria-label="Filter artwork by category">
      ${filters.map((filter) => {
        const active = selected === filter.id || parent?.id === filter.id;
        const current = selected === filter.id ? selectedCategory && parent?.children.length > 1 ? 'location' : 'page'
          : parent?.id === filter.id ? 'location' : '';
        return `<a class="filter-link${active ? ' is-active' : ''}" href="${filter.id === 'all' ? '/work' : categoryURL(filter.id)}"${current ? ` aria-current="${current}"` : ''}>${escape(filter.label)}</a>`;
      }).join('')}
    </nav>
    ${parent?.children.length > 1 ? `<nav class="work-subfilters" aria-label="${escape(parent.label)} subcategories">${parent.children.map((id) => `<a class="filter-link${selected === id ? ' is-active' : ''}" href="${categoryURL(id)}"${selected === id ? ' aria-current="page"' : ''}>${escape(categoryById(id).label)}</a>`).join('')}</nav>` : ''}
    <section class="portfolio-archive" aria-label="${selected === 'all' ? 'All artwork' : escape(archiveLabel)}">
      ${content || '<p class="archive-empty">archive in progress.</p>'}
    </section>
  </div>
  ${footer()}`;
}

export function renderAboutPage() {
  const about = siteContent.about;
  const portraitURL = contentURL(about.portrait?.src);
  const portrait = portraitURL ? getImageAsset(about.portrait, { sizes: '(max-width: 600px) calc(100vw - 44px), 40vw' }) : null;
  const portraitResponsive = portrait?.srcset ? ` srcset="${escape(portrait.srcset)}" sizes="${escape(portrait.sizes)}"` : '';
  const references = (about.references || []).map((reference) => {
    const url = contentURL(reference.url);
    return url ? `<li><a class="text-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(reference.title)} ${arrow}</a></li>` : '';
  }).filter(Boolean).join('');
  return `${header('about')}
  <div class="page-shell about-page">
    <h1 class="page-heading">about</h1>
    <div class="about-layout${portraitURL ? ' has-portrait' : ''}">
      <div class="about-copy">
        <p class="about-intro">${escape(about.intro)}</p>
        <p class="about-location">${escape(about.location)}</p>
        ${(about.paragraphs || []).map((paragraph) => `<p class="about-paragraph">${escape(paragraph)}</p>`).join('')}
        <a class="text-link" href="/#contact">get in touch ${arrow}</a>
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
    <a class="text-link" href="/">back home ${arrow}</a>
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
        <div class="project-images">${project.images.map((image, index) => imageMarkup(image, { critical: index === 0, imageIndex: index, figureId: `image-${index + 1}` })).join('')}</div>
        ${renderFlashMannequin(project)}
        <div class="project-meta">
          <p class="project-index">${escape(category.label)}${project.year ? ` / ${escape(project.year)}` : ''}</p>
          ${project.description ? `<p class="project-description">${escape(project.description)}</p>` : ''}
          ${details.length ? `<dl class="project-details">${details.map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>` : ''}
          <a class="text-link" href="${categoryURL(category.id)}">back to ${escape(category.label)} ${arrow}</a>
        </div>
      </article>
    </div>${footer()}`;
}

export function renderRoutePage(route) {
  if (route.kind === 'home') return renderHomepageSections();
  if (route.kind === 'work') return renderWorkPage(route.category);
  if (route.kind === 'about') return renderAboutPage();
  if (route.kind === 'artwork') return renderArtworkPage(route.project);
  return renderNotFoundPage();
}
