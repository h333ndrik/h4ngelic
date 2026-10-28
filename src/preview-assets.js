// Only the downloadable HTML supplies this map. Authored data keeps logical
// local paths; the served website's URLs and validation remain unchanged.
function assets() {
  return typeof document !== 'undefined' && document.documentElement?.dataset.preview === 'standalone'
    ? globalThis.__H4_PREVIEW_IMAGES__ : null;
}

export function previewImageURL(path) {
  const images = assets();
  return images && Object.hasOwn(images, path) ? images[path] : path;
}

export function logicalPreviewURL(value) {
  const images = assets();
  if (!images || !value.startsWith('data:image/')) return value;
  // Hero resources may also be authored as portfolio images. Recognize only
  // bytes explicitly embedded by our exporter, never arbitrary data URLs.
  for (const [path, inline] of Object.entries(images)) if (inline === value) return path;
  return value;
}
