import { contentURL, escapeHTML as escape } from './content-utils.js';
import { getImageAsset } from './image-assets.js';
import { projectURL } from './routes.js';

export const horizontalDriftCategories = Object.freeze(['tattoos', 'flashes', 'analog-photography']);

/** Stable, restrained art direction: it depends on position, never on random
 * render order or world mode. The same archive therefore keeps its geometry. */
export function driftPlacement(index = 0) {
  const position = Math.abs(Math.trunc(Number(index) || 0)) % 5;
  return [
    { y: -13, z: -28, angle: -4 },
    { y: 23, z: -74, angle: 5 },
    { y: -29, z: 0, angle: -2 },
    { y: 12, z: -49, angle: 4 },
    { y: -3, z: -18, angle: -3 },
  ][position];
}

function imageMarkup(image, index, { hidden = false } = {}) {
  if (!contentURL(image?.src)) return '';
  const asset = getImageAsset(image, { sizes: '(max-width: 600px) 76vw, min(66vw, 720px)' });
  const responsive = asset.srcset ? ` srcset="${escape(asset.srcset)}" sizes="${escape(asset.sizes)}"` : '';
  return `<figure class="project-image${hidden ? ' drift-detail-image' : ''}"${hidden ? ' hidden' : ''}>
    <button class="artwork-open drift-artwork" type="button" data-artwork-open aria-label="open ${escape(image.alt || 'artwork image')}" style="--artwork-ratio:${asset.width} / ${asset.height}">
      <img src="${escape(asset.src)}" data-full-src="${escape(asset.fullSrc)}" data-artwork-image="${index}" alt="${escape(image.alt || '')}" loading="lazy" decoding="async" width="${asset.width}" height="${asset.height}"${responsive} />
    </button>
    ${image.caption ? `<figcaption>${escape(image.caption)}</figcaption>` : ''}
  </figure>`;
}

/** Shared archive markup. No renderer, stylesheet or made-up artwork enters
 * prerendering; genuinely empty archives remain a quiet textual state. */
export function renderHorizontalDrift(projects = [], { category = '', label = category } = {}) {
  if (!horizontalDriftCategories.includes(category)) return '';
  const entries = projects.filter(project => project.published !== false && project.category === category
    && Array.isArray(project.images) && project.images.some(image => contentURL(image?.src)));
  if (!entries.length) return '<p class="archive-empty">archive in progress.</p>';
  const instruction = `drift-instruction-${category}`;
  return `<section class="horizontal-drift" data-horizontal-drift="${escape(category)}" role="region" aria-label="${escape(label)} artwork archive" aria-describedby="${instruction}" tabindex="0">
    <div class="drift-viewport">
      <p class="drift-instruction" id="${instruction}">scroll to drift <span aria-hidden="true">·</span> select to explore<span class="sr-only">. Use left and right arrow keys while the archive is focused. Drag horizontally on touch screens.</span></p>
      <div class="drift-track">
        ${entries.map((project, index) => {
          const images = project.images.filter(image => contentURL(image?.src));
          const asset = getImageAsset(images[0]);
          const pose = driftPlacement(index);
          const href = projectURL(project);
          const details = Object.entries(project.details || {}).filter(([, value]) => value !== '' && value != null);
          return `<article class="project drift-item" data-drift-item${href ? ` data-project-url="${escape(href)}"` : ''} style="--drift-ratio:${asset.width / asset.height};--drift-y:${pose.y}px;--drift-z:${pose.z}px;--drift-angle:${pose.angle}deg">
            <div class="project-images drift-images">${images.map((image, imageIndex) => imageMarkup(image, imageIndex, { hidden: imageIndex > 0 })).join('')}</div>
            <div class="project-meta drift-meta">${project.title ? `<h2>${href ? `<a href="${escape(href)}">${escape(project.title)}</a>` : escape(project.title)}</h2>` : ''}${project.year ? `<p class="project-index">${escape(project.year)}</p>` : ''}${project.description ? `<p class="project-description drift-description">${escape(project.description)}</p>` : ''}${details.length ? `<dl class="project-details">${details.map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>` : ''}</div>
          </article>`;
        }).join('')}
      </div>
      <p class="sr-only drift-status" role="status" aria-live="polite"></p>
    </div>
  </section>`;
}
