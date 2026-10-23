import manifest from './data/imageManifest.json' with { type: 'json' };

export function getImageAsset(image = {}, { sizes = '(max-width: 600px) calc(100vw - 44px), calc((100vw - 105px) / 2)' } = {}) {
  const optimized = manifest[image.src];
  const variants = optimized?.variants || [];
  const preview = variants.find((variant) => variant.width >= 960) || variants.at(-1);
  const fullVariants = manifest[image.fullSrc]?.variants || [];
  const width = positive(image.width) || positive(optimized?.width) || 4;
  const height = positive(image.height) || positive(optimized?.height) || 5;
  return {
    src: preview?.src || image.src || '',
    srcset: variants.map((variant) => `${variant.src} ${variant.width}w`).join(', '),
    sizes,
    width,
    height,
    fullSrc: fullVariants.at(-1)?.src || image.fullSrc || variants.at(-1)?.src || image.src || '',
  };
}

function positive(value) {
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
