# Digital Artworks: original file and reveal

The actual original arrived in `90BA527C-F86C-46F7-B5B9-EF625AB7578E.JPG.zip`. Its JPEG bytes are preserved unchanged at:

```
public/images/digital-artworks/green-black-original.jpg
```

Dimensions: **1440×1920**. Size: **836,625 bytes**. SHA-256:
`df0781e4f572ba9e644c3471fbb6060e228c34f02acf32d01f4b0e1dce68132f`.

`featuredDigitalArtwork` in `src/data/digitalArtworkSettings.js` is published and imported by the central `src/data/artworks.js` archive. No title, year or description has been invented. Its alt text describes the visible green/black ripples, white/grey brushstrokes and lower-left signature. The normal pipeline generated 320, 640, 960 and 1440px WebP variants. The original stays intact. The artwork appears under More → Digital Artworks and has its own ordinary detail URL.

Further digital projects use the same `category: 'digital-artworks'` data format. Setting a project to `published: false` hides it; genuinely empty categories retain `archive in progress.` without placeholder images.

## Reveal behavior

`digital-ink-content.js` renders real images with native dimensions and ordinary artwork controls. `digital-ink.js` progressively enhances them with a bounded Canvas2D mask, driven by normal vertical scroll. The temporarily sticky local section is 2.15 viewport heights. No wheel events are intercepted and no click is needed to start the reveal.

The mask comes from a seeded, domain-warped multiscale pigment field with branching contours and local edge variation. Scroll progress determines every alpha value; upward scroll restores the same earlier contour rather than playing a new animation. At full reveal, the mask canvas is hidden and the original responsive `<img>` is displayed directly, retaining its colors, composition and sharpness.

In The Other Side, sampled points on the actual moving mask boundary feed the existing shared motion/image-history system. There is no added palette or independent glitch renderer. A stationary reveal creates no animation-frame loop. Hidden documents stop pending work. Mask buffers are retained only for nearby artworks and released outside the observer's local margin; scrolling back regenerates the exact seeded contour. Reduced motion, unsupported Canvas and keyboard focus show the original image directly. Navigation disposes observers, event listeners and mask buffers.

The reference at `https://ink.niccolofanton.dev/` returned HTTP 403 through this environment's proxy. The implementation follows the written organic reveal requirements; a direct visual comparison with that reference was unavailable.

## Validation

`node --test tests/digital-ink.test.js` checks the supplied original and draft/empty fallback, safe real-image rendering, seeded independent growth islands, monotonic masks, exact reverse-scroll reconstruction, endpoint alpha fidelity and contour samples. `tests/digital-ink-browser.mjs` exercises real Canvas pixels at 1000, 390 and 320px using a clearly identified geometric test fixture intercepted only by the test. The fixture is never added to the portfolio.
