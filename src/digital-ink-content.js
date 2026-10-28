import { contentURL, escapeHTML as escape } from './content-utils.js';
import { getImageAsset } from './image-assets.js';
import { projectURL } from './routes.js';
import { digitalInkSettings } from './data/digitalArtworkSettings.js';
import { artworkImages } from './artwork-content.js';

/** Kept CSS/DOM-free for prerendering and editable-content validation. */
export function renderDigitalInk(projects = []) {
  const entries = projects.filter(project => project?.published !== false && project.category === 'digital-artworks'
    && Array.isArray(project.images) && project.images.some(image => contentURL(image?.src)));
  if (!entries.length) return '<p class="archive-empty" data-digital-asset-slot="green-black-original">archive in progress.</p>';
  return `<div class="digital-ink-archive">${entries.map((project, projectIndex) => {
    const images = artworkImages(project).filter(image => contentURL(image?.src));
    const href = projectURL(project);
    const details = project.details && typeof project.details === 'object'
      ? Object.entries(project.details).filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('') : '';
    return `<article class="project digital-ink-project"${project.id ? ` id="project-${escape(project.id)}"` : ''}${href ? ` data-project-url="${escape(href)}"` : ''}>
      ${images.map((image, imageIndex) => {
        const asset = getImageAsset(image, { sizes: '(max-width: 600px) calc(100vw - 40px), min(82vw, 1100px)' });
        const responsive = asset.srcset ? ` srcset="${escape(asset.srcset)}" sizes="${escape(asset.sizes)}"` : '';
        return `<section class="digital-ink-section" data-digital-ink data-ink-seed="${projectIndex * 101 + imageIndex}" style="--digital-ink-scroll-height: ${digitalInkSettings.scrollViewportLength * 100}svh" aria-label="${escape(image.alt || project.title || 'digital artwork')}">
          <div class="digital-ink-sticky">
            <figure class="digital-ink-figure">
              <button class="artwork-open digital-ink-open" type="button" data-artwork-open aria-label="open ${escape(image.alt || 'digital artwork')}" style="--artwork-ratio: ${asset.width} / ${asset.height}">
                <img src="${escape(asset.src)}" data-full-src="${escape(asset.fullSrc)}" data-artwork-image="${imageIndex}" alt="${escape(image.alt || '')}" width="${asset.width}" height="${asset.height}" loading="lazy" decoding="async"${responsive} />
                <canvas class="digital-ink-canvas" aria-hidden="true"></canvas>
              </button>
              ${image.caption ? `<figcaption>${escape(image.caption)}</figcaption>` : ''}
            </figure>
          </div>
        </section>`;
      }).join('')}
      <div class="project-meta digital-ink-meta">
        ${project.title ? `<h2>${href ? `<a href="${escape(href)}">${escape(project.title)}</a>` : escape(project.title)}</h2>` : ''}
        ${project.year ? `<p class="project-index">${escape(project.year)}</p>` : ''}
        ${project.description ? `<p class="project-description">${escape(project.description)}</p>` : ''}
        ${details ? `<dl class="project-details">${details}</dl>` : ''}
        ${!project.title && href ? `<a class="text-link" href="${escape(href)}">view work</a>` : ''}
      </div>
    </article>`;
  }).join('')}</div>`;
}
