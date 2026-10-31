# Editing the horizontal archive

The carousel uses the published projects in `src/data/artworks.js`. All eight supplied tattoo photographs remain in their original order. The renderer derives its total from the filtered project list; the live controller derives its cycle length, wrap index and counter from the mounted slides. There is no fixed five- or eight-photo cycle.

To add a photograph, place its original file in `public/images/tattoos/`, then add an entry in `src/data/artworks.js` with a unique ID, `category: 'tattoos'`, `published: true` and an image containing its real path, descriptive `alt`, original `width` and `height`. Remove an entry, or set `published: false`, to remove it from the row. Run `npm run images:optimize` and rebuild; the existing pipeline supplies responsive WebP previews. Original files remain unchanged.

`src/carouselSettings.js` is the single carousel tuning file. Each exported field has a JSDoc explanation. The complete field/default table is recorded in `PROJECT_PLAN.md`. Start with `cardWidth`, `cardHeight`, `spacing`, `inertia` and `wheelSensitivity`; photo proportions and viewport limits remain enforced. `wrap` controls cycling, `hoverStraighten` controls the optional lift, and `neighborDisplacement` controls the adjacent-image shift. `scrollCapture: 'area'` confines wheel capture to the image strip. `expandWithinLayout` enables the shared in-page viewer.

`autoDrift` and `pointerLabel` intentionally remain false. Movement starts with wheel, drag, swipe or keyboard input and stops after the finite run-out. Reduced motion removes inertia and animated hover changes. Outside the carousel, page scrolling remains native; vertical touch scrolling also passes through the carousel.

Additional fields tune the reserved expansion space, viewport clearances, hover lift, neighbour shift, drag threshold, wheel normalization, velocity limits and announcements. The shared `src/inline-artwork-expand.js` controls activation, viewport fitting, full-resolution loading, outside-click/second-click collapse and Escape. It preserves the image's layout slot and uses no modal, WebGL surface or page-wide zoom.
