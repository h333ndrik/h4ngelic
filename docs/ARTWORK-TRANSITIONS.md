# Artwork transitions

The production archive remains empty until genuine project photographs are supplied. No texture, stock image or placeholder is published as portfolio content.

Add a published project to `src/data/artworks.js` with a stable lowercase `id`, a supported category, descriptive image `alt` text, and each photograph's real `width` and `height`. Run `npm run images:optimize` after adding local images. An optional `fullSrc` should show the same photograph and composition at higher resolution, with the same aspect ratio.

Archive photographs are ordinary anchors to `/work/<category>/<id>`. Additional photographs link to `#image-2`, `#image-3`, and so on. Those URLs also work without JavaScript and retain the detail page's canonical metadata and prerendered HTML. Detail photographs are buttons that open the native, keyboard-accessible dialog. Arrow keys and previous/next buttons switch between photographs; Escape, close and a backdrop click dismiss it and return focus to the opener.

`src/artwork-transitions.js` temporarily names the matching old and new photograph for the View Transitions API. It waits briefly for the destination image to decode and reveals it before the new-page snapshot. Browser Back/Forward restores the gallery scroll position and focuses the matching photograph. A detail page's category return link also restores that category's last gallery position when one was visited. Offscreen or unavailable photographs use the surrounding page transition instead.

The dialog uses one temporary, decorative image in its existing top layer for expansion and return. It measures the actual painted photograph, uses a uniform transform scale to preserve proportions, and removes the copy after completion or cancellation. Closing during an expansion resumes from the current displayed rectangle. Closing during an image change returns the photograph actually displayed. Navigation, resizing and reduced-motion changes cancel active copies and restore the originals. Cleanup removes the dialog, event handlers and body scroll lock.

Reduced motion and browsers without View Transitions retain immediate URL navigation, focus and scroll restoration. Browsers without Web Animations use the existing short dialog opacity transition. Reduced motion removes that transition too. No extra WebGL scene, animation dependency, scroll listener or continuous frame loop is needed for the image effect.

Validation uses the supplied reflection texture only inside temporary browser fixtures; it never changes `artworks.js`. With the Vite development server running, run `node tests/artwork-transitions-browser.mjs` and `npm run test:gallery`. These cover desktop, touch, reduced motion, API fallback, matching photograph selection, canonical metadata, Back/Forward, aspect ratios, interrupted opening, rapid navigation, focus and cleanup.
