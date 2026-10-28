/** Small editor-facing conventions shared by every archive presentation. */
export function orderedArtworks(projects = []) {
  const order = project => Number.isFinite(project.order) ? project.order : Infinity;
  return [...projects].sort((a, b) => order(a) - order(b));
}

export function artworkImages(project = {}) {
  const images = Array.isArray(project.images) ? project.images : [];
  const cover = typeof project.cover === 'string' ? images.find(image => image.src === project.cover) : null;
  return cover ? [cover, ...images.filter(image => image !== cover)] : images;
}
