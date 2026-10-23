import { siteContent } from './data/siteContent.js';
import { artworks } from './data/artworks.js';
import { contentURL, emailURL, escapeHTML as escape } from './content-utils.js';
import { getImageAsset } from './image-assets.js';

const arrow = '<i class="arrow" aria-hidden="true"></i>';
const categoryById = (id) => siteContent.categories.find((category) => category.id === id);

export function normalizeCategory(category) {
  return categoryById(category) ? category : 'all';
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
  return `<footer class="page-footer"><span>${escape(siteContent.name)}</span><span>${escape(siteContent.location)}</span></footer>`;
}

function contactLink(label, destination, { primary = false } = {}) {
  const classes = `contact-link${primary ? ' contact-link-primary' : ''}`;
  if (!destination) {
    return `<span class="${classes} is-unconfigured" aria-disabled="true" aria-label="${escape(label)} — link coming soon" title="link coming soon">${escape(label)} ${arrow}</span>`;
  }
  const external = destination.startsWith('https:');
  return `<a class="${classes}" href="${escape(destination)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(label)} ${arrow}</a>`;
}

export function renderHomepageSections() {
  const contact = siteContent.contact;
  const email = emailURL(contact.email);
  return `<section class="content-section selected-work" id="selected-work" aria-labelledby="selected-work-title">
    <h2 class="section-label" id="selected-work-title">${escape(siteContent.home.selectedWorkLabel)}</h2>
    <div class="category-strip" role="navigation" aria-label="Selected work categories" tabindex="0">
      ${siteContent.categories.map((category) => `<a class="category-link" href="/work?category=${encodeURIComponent(category.id)}"><span class="category-magnet"><span>${escape(category.label)}</span>${arrow}</span></a>`).join('')}
    </div>
  </section>
  <section class="content-section about-preview" aria-labelledby="about-preview-title">
    <h2 class="section-label" id="about-preview-title">${escape(siteContent.home.aboutLabel)}</h2>
    <p class="about-preview-copy">${escape(siteContent.home.aboutPreview)}</p>
    <a class="text-link" href="/about">about ${arrow}</a>
  </section>
  <section class="content-section contact-section" id="contact" aria-labelledby="contact-title" tabindex="-1">
    <h2 class="section-label" id="contact-title">contact</h2>
    ${contactLink('get in touch', contentURL(contact.getInTouchURL) || email, { primary: true })}
    <div class="contact-links">
      ${contactLink('instagram', contentURL(contact.instagramURL, { relative: false }))}
      ${contactLink('email', email)}
      ${contactLink('book a tattoo', contentURL(contact.bookingURL))}
    </div>
  </section>
  ${footer()}`;
}

function imageMarkup(image) {
  const source = contentURL(image?.src);
  if (!source) return '';
  const asset = getImageAsset(image, { sizes: '(max-width: 600px) calc(100vw - 44px), calc((100vw - 105px) / 2)' });
  const responsive = asset.srcset ? ` srcset="${escape(asset.srcset)}" sizes="${escape(asset.sizes)}"` : '';
  return `<figure class="project-image">
    <button class="artwork-open" type="button" data-artwork-open aria-label="open ${escape(image.alt || 'artwork image')}" style="--artwork-ratio: ${asset.width} / ${asset.height}">
      <img src="${escape(asset.src || source)}" data-full-src="${escape(asset.fullSrc || source)}" alt="${escape(image.alt || '')}" loading="lazy" decoding="async" width="${asset.width}" height="${asset.height}"${responsive} />
    </button>
    ${image.caption ? `<figcaption>${escape(image.caption)}</figcaption>` : ''}
  </figure>`;
}

export function renderProject(project) {
  const images = (Array.isArray(project.images) ? project.images : []).map(imageMarkup).filter(Boolean).join('');
  if (!images) return '';
  const label = categoryById(project.category)?.label || '';
  const details = project.details && typeof project.details === 'object'
    ? Object.entries(project.details).filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('') : '';
  return `<article class="project"${project.id ? ` id="project-${escape(project.id)}"` : ''}>
    <div class="project-images">${images}</div>
    <div class="project-meta">
      ${project.title ? `<h2>${escape(project.title)}</h2>` : ''}
      <p class="project-index">${escape(label)}${project.year ? ` <span aria-hidden="true">/</span> ${escape(project.year)}` : ''}</p>
      ${project.description ? `<p class="project-description">${escape(project.description)}</p>` : ''}
      ${details ? `<dl class="project-details">${details}</dl>` : ''}
    </div>
  </article>`;
}

export function renderWorkPage(category = 'all') {
  const selected = normalizeCategory(category);
  const projects = artworks.filter((project) => project.published !== false && categoryById(project.category)
    && (selected === 'all' || project.category === selected)).map(renderProject).filter(Boolean);
  const filters = [{ id: 'all', label: 'all' }, ...siteContent.categories];
  return `${header('work')}
  <div class="page-shell work-page">
    <p class="page-kicker">portfolio archive</p>
    <h1 class="page-heading">work</h1>
    <nav class="work-filters" aria-label="Filter artwork by category">
      ${filters.map((filter) => `<a class="filter-link${selected === filter.id ? ' is-active' : ''}" href="${filter.id === 'all' ? '/work' : `/work?category=${encodeURIComponent(filter.id)}`}"${selected === filter.id ? ' aria-current="page"' : ''}>${escape(filter.label)}</a>`).join('')}
    </nav>
    <section class="portfolio-archive" aria-label="${selected === 'all' ? 'All artwork' : escape(categoryById(selected).label)}">
      ${projects.length ? `<div class="project-grid">${projects.join('')}</div>` : '<p class="archive-empty">archive in progress.</p>'}
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
