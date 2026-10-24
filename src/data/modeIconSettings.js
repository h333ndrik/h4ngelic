/** Versioned icon assets keep browser favicon caches separate between modes.
 * Geometry and native hotspots remain in the original SVGs / cursor.css.
 */
export const modeIconSettings = Object.freeze({
  material: '/assets/h4ngelic-cursor-material-r09.png',
  cursor: Object.freeze({
    normal: Object.freeze({
      base: '/assets/h4ngelic-cursor.svg',
      hover: '/assets/h4ngelic-cursor-hover.svg',
      pressed: '/assets/h4ngelic-cursor-pressed.svg',
    }),
    other: Object.freeze({
      base: '/assets/h4ngelic-cursor-other-r09.svg',
      hover: '/assets/h4ngelic-cursor-other-hover-r09.svg',
      pressed: '/assets/h4ngelic-cursor-other-pressed-r09.svg',
    }),
  }),
  favicon: Object.freeze({
    normal: Object.freeze({
      '16': '/assets/h4ngelic-favicon-normal-r09-16.png',
      '32': '/assets/h4ngelic-favicon-normal-r09-32.png',
      svg: '/assets/h4ngelic-cursor.svg',
    }),
    other: Object.freeze({
      '16': '/assets/h4ngelic-favicon-other-r09-16.png',
      '32': '/assets/h4ngelic-favicon-other-r09-32.png',
      svg: '/assets/h4ngelic-favicon-other-r09.svg',
    }),
  }),
});
