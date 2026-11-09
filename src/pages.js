import { siteContent } from './data/siteContent.js';
import { sectionDomId } from './section-id.js';
import { artworks } from './data/artworks.js';
import { contentURL, escapeHTML as escape } from './content-utils.js';
import { getImageAsset } from './image-assets.js';
import { categoryURL, projectURL, categoryById, groupById, workAnchorURL, contactURL, toolURL } from './routes.js';
import { renderFooter } from './footer.js';
import { renderHorizontalDrift } from './horizontal-drift-content.js';
import { renderFlashMannequin } from './flash-mannequin-content.js';
import { renderMannequinPreview } from './mannequin-preview-content.js';
import { renderInquiryForm } from './inquiry-content.js';
import { orderedArtworks, artworkImages, artworkLabel } from './artwork-content.js';
import { formatIndexedLabel } from './labels.js';
import { placeholderProjects } from './data/placeholderProjects.js';
import { carouselStyleProperties } from './carouselSettings.js';

const arrow = '<i class="arrow" aria-hidden="true"></i>';
/** One component for every rubric row: a pair per mobile line, one flex row on
 *  wider screens. Each line stays a real flex line so both rows keep the same
 *  gap and the same slash column instead of inheriting equal-width cells. */
function rubricLines(items, perLine = 2) {
  const lines = [];
  for (let index = 0; index < items.length; index += perLine) lines.push(items.slice(index, index + perLine));
  return lines.map(line => `<span class="rubric-line">${line.join('')}</span>`).join('');
}

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

function renderToolCards() {
  const cards = (siteContent.tools || []).map(tool => {
    const href = contentURL(tool.url);
    if (!href) return '';
    return `<article class="tool-card" data-tool-entry="${escape(tool.id)}">
      <a class="tool-card-link" href="${toolURL(tool.id)}">
        <h3>${escape(tool.title)} ${arrow}</h3>
        <p>${escape(tool.teaser)}</p>
      </a>
      <a class="tool-card-external text-link" href="${escape(href)}" target="_blank" rel="noopener noreferrer">open project ${arrow}</a>
    </article>`;
  }).filter(Boolean).join('');
  return `<div class="tool-grid" data-tool-rubric>${cards || '<p class="archive-empty">archive in progress.</p>'}</div>`;
}

export function renderHomepageSections(context = '') {
  return `<section class="content-section selected-work" id="selected-work" aria-labelledby="selected-work-title" data-motion="work"><div class="section-pin">
    <h2 class="kinetic-heading" id="selected-work-title"><span class="kinetic-heading-text">${escape(siteContent.home.selectedWorkLabel)}</span></h2>
    <div class="category-strip" data-row="distributed" data-row-id="home-strip" role="navigation" aria-label="Works categories" tabindex="0">
      ${rubricLines(siteContent.workGroups.map((group) => `<a class="category-link row-item" href="${categoryURL(group.id)}"><span class="kinetic-item"><span class="category-magnet"><span>${escape(group.label)}</span>${arrow}</span></span></a>`))}
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

function digitalPreviewOptions(detail = false) {
  return {
    maximumPreviewWidth: 960,
    // The 60% original-width base is capped by height to reserve a genuinely
    // larger, viewport-fitting inline view of this portrait.
    sizes: detail
      ? '(max-width: 600px) min(calc((100vw - 44px) * .6), calc((100svh - 152px) * .75 / 1.4)), min(calc((100vw - 70px) * .6), 720px, calc((100svh - 152px) * .75 / 1.4))'
      : 'min(49.2vw, 660px, calc((100svh - 152px) * .75 / 1.4))',
  };
}

function imageMarkup(image, { critical = false, href = '', imageIndex = 0, figureId = '', assetOptions = {}, inline = false } = {}) {
  const source = contentURL(image?.src);
  if (!source) return '';
  const asset = getImageAsset(image, assetOptions);
  const responsive = asset.srcset ? ` srcset="${escape(asset.srcset)}" sizes="${escape(asset.sizes)}"` : '';
  const element = href && !inline ? 'a' : 'button';
  const action = href && !inline ? `href="${escape(href)}" data-artwork-link data-artwork-open` : 'type="button" data-artwork-open';
  return `<figure class="project-image${inline ? ' inline-artwork-frame digital-inline-frame' : ''}" style="--artwork-ratio:${asset.width} / ${asset.height}"${figureId ? ` id="${escape(figureId)}" tabindex="-1"` : ''}>
    <${element} class="artwork-open" ${action}${inline ? ' data-inline-expand aria-pressed="false"' : ''} aria-label="${inline ? 'enlarge' : 'open'} ${escape(image.alt || 'artwork image')}" style="--artwork-ratio: ${asset.width} / ${asset.height}">
      <img src="${escape(asset.src || source)}" data-full-src="${escape(asset.fullSrc || source)}" data-artwork-image="${imageIndex}" alt="${escape(image.alt || '')}" loading="${critical ? 'eager' : 'lazy'}"${critical ? ' fetchpriority="high"' : ''} decoding="async" width="${asset.width}" height="${asset.height}"${responsive} />
    </${element}>
    ${image.caption ? `<figcaption>${escape(image.caption)}</figcaption>` : ''}
  </figure>`;
}

export function renderProject(project) {
  const href = projectURL(project);
  const images = artworkImages(project).map((image, index) => imageMarkup(image, {
    href: href ? `${href}${index ? `#image-${index + 1}` : ''}` : '', imageIndex: index,
    assetOptions: project.category === 'digital-artworks' ? digitalPreviewOptions() : {},
    inline: project.category === 'digital-artworks',
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
    </div>
  </article>`;
}

/** The one sub-rubric row: same four destinations on every creative surface. */
function renderWorkFilters(activeGroup) {
  return `<nav class="work-filters" data-row="chips" data-row-id="archive-filters" aria-label="Works sections">
      ${siteContent.workGroups.map(filter => `<a class="filter-link row-item${activeGroup === filter.id ? ' is-active' : ''}" href="${categoryURL(filter.id)}"${activeGroup === filter.id ? ' aria-current="page"' : ''}>${escape(filter.archiveLabel ?? filter.label)}</a>`).join('')}
    </nav>`;
}

/** Type A cross-links: four fixed positions in rubric order. The current
 * rubric is an invisible replica of its own label, arrow spacing included, so
 * the visible words keep the frontpage x positions and nothing jumps between
 * pages. The replica carries no href, no focus and no pointer target. */
const rowSlotMode = 'width';
function renderCrossLinks(selectedGroup) {
  const positions = siteContent.workGroups.map(group => {
    const content = `<span class="category-magnet"><span>${escape(group.archiveLabel ?? group.label)}</span>${arrow}</span>`;
    return group.id === selectedGroup.id
      ? `<span class="row-slot" aria-hidden="true">${content}</span>`
      : `<a class="row-item" href="${categoryURL(group.id)}">${content}</a>`;
  });
  return `<nav class="rubric-cross-links" data-row="distributed" data-row-id="rubric-cross-links" data-slot-mode="${rowSlotMode}" aria-label="Other creative sections">
      ${rubricLines(positions)}<span class="sr-only">current: ${escape(selectedGroup.label)}</span>
    </nav>`;
}

/** /creative is the full archive; each real category URL renders only its own
 * group/leaf through this same renderer and editable content. */
export function renderWorkPage(category = 'all') {
  const selected = normalizeCategory(category);
  const selectedGroup = groupById(selected);
  const selectedCategory = categoryById(selected);
  const groups = selected === 'all' ? siteContent.workGroups : selectedGroup ? [selectedGroup] : [];
  const title = selected === 'all' ? siteContent.home.selectedWorkLabel
    : selectedGroup?.archiveLabel ?? selectedGroup?.label ?? (selectedCategory?.archiveLabel ?? selectedCategory?.label ?? '').toUpperCase();
  const activeGroup = selectedGroup?.id || siteContent.workGroups.find(group => group.children.includes(selected))?.id;
  const projects = orderedArtworks(artworks.filter(project => project.published !== false && categoryById(project.category)));
  const collection = entry => {
    // B-F31: the mannequin section comes from the same list as every other
    // section; only its body differs.
    if (entry.presentation === 'model') return renderMannequinPreview();
    const items = projects.filter(project => project.category === entry.id);
    const placeholders = placeholderProjects.filter(project => project.category === entry.id);
    const contents = entry.presentation === 'drift' ? renderHorizontalDrift([...items, ...placeholders], { category: entry.id, label: entry.label })
      : items.map(renderProject).filter(Boolean).join('');
    return entry.presentation === 'existing' && contents ? `<div class="project-grid">${contents}</div>` : contents || '<p class="archive-empty">archive in progress.</p>';
  };
  // B-F31: section ids come from the one shared rule in section-id.js.
  const domIdFor = (entry, { rubricPrimary = false } = {}) => sectionDomId(entry.id, rubricPrimary ? entry.id : '', entry.anchor || '');
  const sectionClasses = (entry, rubricPrimary) => `archive-category${rubricPrimary ? ' rubric-primary' : ''}${entry.presentation === 'model' ? ' archive-model' : ''}`;
  // B-F39: the digital archive measures itself with the carousel's own size
  // tokens instead of a second constant, and every archive section announces
  // the touch reveal that section-entrance.js observes. Only the two size
  // tokens travel to the section; the rest of the carousel contract stays
  // scoped to the strips it was written for.
  const carouselTokens = carouselStyleProperties();
  const cardTokens = ['--carousel-card-width', '--carousel-card-height']
    .map(name => `${name}:${carouselTokens[name]}`).join(';');
  const sectionAttributes = entry => {
    if (entry.presentation === 'model') return ' data-deferred-model data-section-entrance';
    return ` data-section-reveal${entry.id === 'digital-artworks' ? ` style="${cardTokens}"` : ''}`;
  };
  // Standalone category pages (digital artworks, analog photography, …) have
  // no rubric context, so their section id is the category id itself. The
  // default used to pass the whole entry object into sectionDomId(), which
  // rendered id="[object Object]" and broke every #category anchor and the
  // suites that address them.
  const leaf = (entry, { id = sectionDomId(entry.id), nested = true } = {}) => {
    const tag = nested ? 'h3' : 'h2';
    const label = escape(entry.archiveLabel || entry.label);
    // B-F31: a section without a route (the 3d model) never renders a link.
    const heading = entry.route === false ? label : `<a href="${categoryURL(entry.id)}">${label}</a>`;
    return `<section class="${sectionClasses(entry, false)}" id="${escape(id)}" tabindex="-1" aria-labelledby="archive-${escape(entry.id)}-title" data-archive-category="${escape(entry.id)}"${sectionAttributes(entry)}>
      <${tag} class="archive-category-heading${entry.presentation === 'model' ? ' rubric-category-heading' : ''}" id="archive-${escape(entry.id)}-title"${entry.id === 'tattoos' ? ' data-motion-static' : ''}>${heading}</${tag}>
      ${collection(entry)}
    </section>`;
  };
  const content = groups.map(group => {
    if (group.id === 'tools') {
      return `<section class="work-group${selectedGroup ? ' is-rubric-archive tool-rubric' : ''}" id="${escape(group.id)}" tabindex="-1" aria-labelledby="${selectedGroup ? 'work-page-title' : `group-${escape(group.id)}-title`}" data-work-group="${escape(group.id)}">
        ${selectedGroup ? '' : `<h2 class="work-group-heading" id="group-${escape(group.id)}-title" data-motion-static><span class="archive-scroll-label">${escape(group.label)}</span></h2>`}
        ${renderToolCards()}
      </section>`;
    }
    if (selectedGroup) {
      const rubricCategories = group.children.map(id => categoryById(id)).filter(Boolean).map(entry => {
        const primary = entry.id === group.id;
        const titleId = primary ? 'work-page-title' : `archive-${escape(entry.id)}-title`;
        const heading = primary ? '' : `<h3 class="archive-category-heading rubric-category-heading" id="${escape(titleId)}" data-motion-static>${escape(entry.archiveLabel || entry.label)}</h3>`;
        return `<section class="${sectionClasses(entry, primary)}" id="${escape(domIdFor(entry, { rubricPrimary: primary }))}" tabindex="-1" aria-labelledby="${escape(titleId)}" data-archive-category="${escape(entry.id)}"${sectionAttributes(entry)}>
          ${heading}${collection(entry)}
        </section>`;
      }).join('');
      return `<section class="work-group is-rubric-archive" id="${escape(group.id)}" tabindex="-1" aria-labelledby="work-page-title" data-work-group="${escape(group.id)}">
        ${rubricCategories}
      </section>`;
    }
    const directCategory = group.children.length === 1 && group.children[0] === group.id;
    return `<section class="work-group${directCategory ? ' archive-category' : ''}" id="${escape(group.id)}" tabindex="-1" aria-labelledby="group-${escape(group.id)}-title" data-work-group="${escape(group.id)}"${directCategory ? ` data-archive-category="${escape(group.id)}"` : ''}>
      <h2 class="work-group-heading" id="group-${escape(group.id)}-title"${group.id === 'tattoos' ? ' data-motion-static' : ''}><a href="${workAnchorURL(group.id)}">${escape(group.label)}${group.id === 'tattoos' ? ` ${arrow}` : ''}</a></h2>
      ${directCategory ? collection(categoryById(group.id)) : group.children.map(id => leaf(categoryById(id), { id: domIdFor(categoryById(id), { rubricPrimary: id === group.id }) })).join('')}
    </section>`;
  }).join('');
  const standalone = selected !== 'all' && !selectedGroup && selectedCategory
    ? leaf(selectedCategory, { nested: false })
    : selected === 'all' ? siteContent.categories.filter(entry => entry.legacy
      && projects.some(project => project.category === entry.id)).map(entry => leaf(entry, { nested: false })).join('') : '';
  const crossLinks = selectedGroup ? renderCrossLinks(selectedGroup) : '';
  return `${header('work')}
  <div class="page-shell work-page${selectedGroup ? ' is-rubric-page' : ''}" data-connected-work data-work-context="${escape(selected)}">
    <h1 class="page-heading${selected === 'all' ? ' numbered-heading' : ''}${selectedGroup?.id === 'more' ? ' sr-only' : ''}" id="work-page-title">${escape(title)}</h1>
    ${renderWorkFilters(activeGroup)}
    <div class="portfolio-archive" aria-label="All artwork">${content}${standalone}</div>
    ${crossLinks}
  </div>${footer()}`;
}

export function renderToolPage(tool) {
  if (!tool) return renderNotFoundPage();
  const external = contentURL(tool.url);
  const screenshot = screen => {
    const asset = getImageAsset(screen, { sizes: '(max-width: 600px) calc(100vw - 44px), 33vw' });
    const responsive = asset.srcset ? ` srcset="${escape(asset.srcset)}" sizes="${escape(asset.sizes)}"` : '';
    return `<figure class="tool-shot"><img src="${escape(asset.src)}" alt="${escape(screen.alt)}" loading="lazy" decoding="async" width="${asset.width}" height="${asset.height}"${responsive} /></figure>`;
  };
  return `${header('tools')}
  <div class="page-shell tool-detail-page" data-tool-detail="${escape(tool.id)}">
    ${renderWorkFilters('tools')}
    <article>
      <h1 class="page-heading tool-headline">${escape(tool.oneLiner)}</h1>
      <p class="tool-lede">${escape(tool.teaser)}</p>
      ${external ? `<a class="tool-external-cta" href="${escape(external)}" target="_blank" rel="noopener noreferrer">open ${escape(tool.title)} ${arrow}</a>` : ''}
      <section class="tool-section" aria-labelledby="tool-what-${escape(tool.id)}"><h2 id="tool-what-${escape(tool.id)}">what it does</h2><p>${escape(tool.teaser)}</p></section>
      <section class="tool-section" aria-labelledby="tool-how-${escape(tool.id)}"><h2 id="tool-how-${escape(tool.id)}">how it works</h2>
        <ol class="tool-steps">${tool.works.map(step => `<li>${escape(step)}</li>`).join('')}</ol>
      </section>
      <section class="tool-gallery" aria-label="${escape(tool.title)} screens">${tool.screens.map(screenshot).join('')}
        <p class="tool-video-slot">video slot reserved. no video has been supplied.</p>
      </section>
      <section class="tool-mobile" aria-labelledby="tool-mobile-${escape(tool.id)}"><h2 id="tool-mobile-${escape(tool.id)}">install on mobile</h2>
        <p><strong>ios</strong> share → add to home screen</p><p><strong>android</strong> ⋮ → install</p>
      </section>
    </article>
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
    <h1 class="page-heading numbered-heading">${formatIndexedLabel(2, siteContent.about.label)}</h1>
    <div class="about-layout${portraitURL ? ' has-portrait' : ''}">
      <div class="about-copy">
        <p class="about-intro">${escape(about.intro)}</p>
        <p class="about-location">${escape(about.location)}</p>
        ${(about.paragraphs || []).map((paragraph) => `<p class="about-paragraph">${escape(paragraph)}</p>`).join('')}
        <a class="text-link" href="${contactURL()}">get in touch ${arrow}</a>
      </div>
      ${portrait ? `<figure class="about-portrait" style="--artwork-ratio: ${portrait.width} / ${portrait.height}"><img src="${escape(portrait.src || portraitURL)}" alt="${escape(about.portrait.alt || '')}" loading="lazy" decoding="async" width="${portrait.width}" height="${portrait.height}"${portraitResponsive} /></figure>` : ''}
    </div>
    ${references ? `<section class="about-references" aria-labelledby="references-title"><h2 class="section-label" id="references-title">references</h2><ul>${references}</ul></section>` : ''}
  </div>
  ${footer()}`;
}

export function renderImpressumPage() {
  return `${header('impressum')}
  <div class="page-shell impressum-page">
    <h1 class="page-heading">impressum</h1>
    <div class="legal-copy">
      <p class="section-label">ddg disclosure — placeholders must be replaced before launch</p>
      <dl>
        <div><dt>name</dt><dd>[VOLLNAME]</dd></div>
        <div><dt>address</dt><dd>[STRASSE+HAUSNUMMER], [PLZ+ORT]</dd></div>
        <div><dt>contact</dt><dd>[E-MAIL]</dd></div>
        <div><dt>vat</dt><dd>[UST-IDNR. ODER §19-HINWEIS]</dd></div>
      </dl>
      <p>this route is mode-neutral. entering it ends the other side.</p>
      <a class="text-link" href="/">back home ${arrow}</a>
    </div>
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
      <article class="project artwork-detail" data-artwork-category="${escape(project.category)}" data-project-url="${escape(projectURL(project))}">
        <h1 class="page-heading">${escape(artworkLabel(project) || category.label)}</h1>
        <div class="project-images">${artworkImages(project).map((image, index) => imageMarkup(image, {
          critical: project.category !== 'digital-artworks' && index === 0, imageIndex: index, figureId: `image-${index + 1}`,
          assetOptions: project.category === 'digital-artworks' ? digitalPreviewOptions(true) : {},
          inline: project.category === 'digital-artworks',
        })).join('')}</div>
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
  if (route.kind === 'tool') return renderToolPage(route.tool);
  if (route.kind === 'about') return renderAboutPage();
  if (route.kind === 'impressum') return renderImpressumPage();
  if (route.kind === 'artwork') return renderArtworkPage(route.project);
  return renderNotFoundPage();
}
