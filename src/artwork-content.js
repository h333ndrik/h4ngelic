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

/** Use an existing catalogue identifier when the artist has not supplied a title.
 * This display fallback never changes authored title/description/year fields. */
export function artworkLabel(project = {}) {
  const title = typeof project.title === 'string' ? project.title.trim() : '';
  if (title) return title;
  const id = typeof project.id === 'string' ? project.id.trim() : '';
  return id ? id.replaceAll('-', ' ') : typeof project.category === 'string' ? project.category : '';
}
