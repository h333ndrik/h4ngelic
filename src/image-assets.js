import manifest from './data/imageManifest.json' with { type: 'json' };
import { previewImageURL } from './preview-assets.js';

export function getImageAsset(image = {}, { sizes = '(max-width: 600px) calc(100vw - 44px), calc((100vw - 105px) / 2)', maximumPreviewWidth } = {}) {
  const optimized = manifest[image.src];
  const variants = optimized?.variants || [];
  // A small archive preview must not advertise the viewer's large downloads.
  // Keep fullSrc independent so explicitly opening the detail viewer retains
  // the supplied image's available resolution.
  const previews = positive(maximumPreviewWidth) ? variants.filter(variant => variant.width <= maximumPreviewWidth) : variants;
  const preview = previews.find((variant) => variant.width >= 960) || previews.at(-1) || variants[0];
  const fullVariants = manifest[image.fullSrc]?.variants || [];
  const width = positive(image.width) || positive(optimized?.width) || 4;
  const height = positive(image.height) || positive(optimized?.height) || 5;
  return {
    src: previewImageURL(preview?.src || image.src || ''),
    srcset: previews.map((variant) => `${previewImageURL(variant.src)} ${variant.width}w`).join(', '),
    sizes,
    width,
    height,
    fullSrc: previewImageURL(fullVariants.at(-1)?.src || image.fullSrc || variants.at(-1)?.src || image.src || ''),
  };
}

function positive(value) {
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
