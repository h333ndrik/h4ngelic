import { contentURL, escapeHTML as escape } from './content-utils.js';
import { getImageAsset } from './image-assets.js';
import { projectURL } from './routes.js';
import { artworkImages } from './artwork-content.js';
import { carouselSettings, carouselStyleProperties } from './carouselSettings.js';
import { formatCounter } from './labels.js';

export const horizontalDriftCategories = Object.freeze(['tattoos', 'flashes', 'jewellery', 'analog-photography']);

function imageMarkup(image, index, { hidden = false } = {}) {
  if (!contentURL(image?.src)) return '';
  const coverWidth = Math.ceil(carouselSettings.cardHeight * (image.width || 4) / (image.height || 5));
  const asset = getImageAsset(image, { maximumPreviewWidth: 640, sizes: `${coverWidth}px` });
  const responsive = asset.srcset ? ` srcset="${escape(asset.srcset)}" sizes="${escape(asset.sizes)}"` : '';
  return `<figure class="project-image inline-artwork-frame${hidden ? ' drift-detail-image' : ''}" style="--artwork-ratio:${asset.width} / ${asset.height}"${hidden ? ' hidden' : ''}>
    <button class="artwork-open drift-artwork" type="button" data-artwork-open${carouselSettings.expandWithinLayout ? ' data-inline-expand' : ''} aria-pressed="false" aria-label="enlarge ${escape(image.alt || 'artwork image')} in place" style="--artwork-ratio:${asset.width} / ${asset.height}">
      <img src="${escape(asset.src)}" data-full-src="${escape(asset.fullSrc)}" data-artwork-image="${index}" alt="${escape(image.alt || '')}" loading="lazy" decoding="async" width="${asset.width}" height="${asset.height}"${responsive} />
    </button>
    ${image.caption ? `<figcaption>${escape(image.caption)}</figcaption>` : ''}
  </figure>`;
}

/** Every agreed archive has the same native horizontal shell. Empty archives
 * show their real state instead of fabricated imagery or placeholder cards. */
export function renderHorizontalDrift(projects = [], { category = '', label = category } = {}) {
  if (!horizontalDriftCategories.includes(category)) return '';
  const entries = projects.filter(project => project.published !== false && project.category === category
    && (project.placeholder === true || Array.isArray(project.images) && project.images.some(image => contentURL(image?.src))));
  const instruction = `drift-instruction-${category}`;
  const viewport = `drift-viewport-${category}`;
  const style = Object.entries(carouselStyleProperties()).map(([name, value]) => `${name}:${value}`).join(';');
  return `<section class="horizontal-drift${entries.length ? '' : ' is-empty'}" style="${style}" data-horizontal-drift="${escape(category)}" data-carousel-total="${entries.length}" role="region" aria-roledescription="carousel" aria-label="${escape(label)} artwork archive" aria-describedby="${instruction}" tabindex="0">
    <div class="drift-toolbar">
      <p class="drift-instruction${entries.length ? '' : ' sr-only'}" id="${instruction}">${entries.length ? 'drifting <span aria-hidden="true">·</span> drag to explore' : 'this carousel will contain published artworks.'}<span class="sr-only"> Use left and right arrow keys to browse. Swipe horizontally on touch screens. Vertical wheel scrolling and touch panning continue through the page.</span></p>
      <div class="drift-controls" aria-label="${escape(label)} carousel navigation">
        <button class="drift-previous" type="button" data-drift-previous aria-controls="${viewport}" aria-label="previous ${escape(label)} artwork" disabled><span aria-hidden="true">←</span></button>
        <output class="drift-count" data-drift-count aria-hidden="true">${entries.length ? formatCounter(1, entries.length) : formatCounter(0, 0)}</output>
        <button class="drift-next" type="button" data-drift-next aria-controls="${viewport}" aria-label="next ${escape(label)} artwork" disabled><span aria-hidden="true">→</span></button>
      </div>
    </div>
    <div class="drift-viewport" id="${viewport}">
      <div class="drift-track">
        ${entries.map((project, index) => {
          if (project.placeholder === true) {
            return `<article class="project drift-item placeholder-project" data-drift-item data-placeholder="true" aria-roledescription="slide" aria-label="${index + 1} of ${entries.length}, editorial placeholder" style="--drift-ratio:300 / 420">
              <div class="project-images drift-images"><button class="placeholder-card" type="button" data-placeholder-expand aria-pressed="false" aria-label="expand ${escape(project.title)} placeholder"><span aria-hidden="true">${escape(project.title)}</span></button></div>
            </article>`;
          }
          const images = artworkImages(project).filter(image => contentURL(image?.src));
          const asset = getImageAsset(images[0]);
          const href = projectURL(project);
          const details = Object.entries(project.details || {}).filter(([, value]) => value !== '' && value != null);
          return `<article class="project drift-item" data-drift-item aria-roledescription="slide" aria-label="${index + 1} of ${entries.length}"${href ? ` data-project-url="${escape(href)}"` : ''} style="--drift-ratio:${asset.width / asset.height}">
            <div class="project-images drift-images">${images.map((image, imageIndex) => imageMarkup(image, imageIndex, { hidden: imageIndex > 0 })).join('')}</div>
            <div class="project-meta drift-meta">${project.title ? `<h2>${href ? `<a href="${escape(href)}">${escape(project.title)}</a>` : escape(project.title)}</h2>` : ''}${project.year ? `<p class="project-index">${escape(project.year)}</p>` : ''}${project.description ? `<p class="project-description drift-description">${escape(project.description)}</p>` : ''}${details.length ? `<dl class="project-details">${details.map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>` : ''}</div>
          </article>`;
        }).join('')}${entries.length ? '' : '<p class="archive-empty">archive in progress.</p>'}
      </div>
      <p class="sr-only drift-status" role="status" aria-live="polite"></p>
    </div>
  </section>`;
}
