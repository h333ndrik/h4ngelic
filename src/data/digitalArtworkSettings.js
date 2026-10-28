/** The artist's original 1440×1920 JPEG, received in the supplied ZIP.
 * Its bytes are preserved; the existing pipeline creates responsive WebP files.
 * Title, description and year remain empty until supplied by the artist.
 */
export const featuredDigitalArtwork = {
  id: 'green-black-original',
  category: 'digital-artworks',
  title: '',
  description: '',
  published: true,
  images: [{
    src: '/images/digital-artworks/green-black-original.jpg',
    alt: 'green-and-black digital artwork with fine vertical ripples, broad white and grey brushstrokes, and a signature at the lower left.',
    width: 1440,
    height: 1920,
  }],
};

/** Scroll distance is local to each artwork; no wheel event is intercepted. */
export const digitalInkSettings = Object.freeze({
  seed: 42931,
  desktopMaskSize: 256,
  mobileMaskSize: 192,
  maximumCanvasDimension: 1440,
  maximumPixelRatio: 1.25,
  edgeSoftness: .035,
  stickyViewportRatio: .12,
  scrollViewportLength: 2.15,
});
