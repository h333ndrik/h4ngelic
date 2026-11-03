/** First-paint hero poster. Vite injects these values into the document head so
 * the poster is present before application styles or WebGL are available. */
export const heroPosterSettings = Object.freeze({
  /** Static vector wordmark shown until the first WebGL frame is ready. */
  src: '/assets/wordmark-fallback.svg',
  /** Accessible description retained by the poster and failure fallback. */
  alt: 'h4ngelic wordmark',
  /** Poster and canvas crossfade duration after the first rendered 3D frame. */
  fadeDurationMs: 650,
  /** Reduced motion keeps this poster and never imports or initializes WebGL. */
  reducedMotionStatic: true,
  /** Optional tattoo texture is loaded only after the chrome's first frame. */
  artwork: Object.freeze({
    desktop: '/assets/tattoo-texture.webp',
    mobile: '/assets/tattoo-texture-640.webp',
  }),
});
