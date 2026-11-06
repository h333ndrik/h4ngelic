# Retired: `artwork-transitions-browser.mjs`

**Contract removed, not one stale assertion.** The suite intercepts
`src/data/artworks.js` with a two-image fixture, expects two archive tiles
`<a data-artwork-link>` and drives the first one through a
`document.startViewTransition` navigation into the artwork detail route.

That tile no longer exists anywhere. Measured on the current build:

| Route | `[data-artwork-link]` | `[data-artwork-open]` |
| --- | --- | --- |
| `/creative` | 0 | 9 |
| `/creative/tattoos` | 0 | 8 |
| `/creative/more` | 0 | 1 |
| `/creative/digital-artworks` | 0 | 1 |
| `/creative/analog-photography` | 0 | 0 |
| `/creative/jewellery` | 0 | 0 |
| `/creative/flashes` | 0 | 0 |
| `/creative/tattoo-01` | 0 | 1 |
| `/creative/tools` | 0 | 0 |

Since B-013/B-014 the flash and jewellery archives are looping placeholder
carousels, the populated archives are horizontal drifts whose tiles are
`<button data-artwork-open>` opening the in-page viewer, and the inline-expand
contract replaced the tile-to-detail link. Route navigation itself still uses
view transitions (`src/navigation.js`), but not from an artwork tile.

- Contract removed in: B-013/B-014 (placeholder carousels), the drift archive
  and the inline viewer.
- Live coverage today:
  - archive opener, viewer, keyboard path, FLIP, cleanup:
    `tests/gallery-browser.mjs` (1440/390/320 × both motion preferences)
  - inline expand contract: `tests/inline-artwork-expand.test.js`
  - archive rendering and routes: `tests/portfolio-browser.mjs`,
    `tests/v32-structure-browser.mjs`, `tests/seo-browser.mjs`
  - route-level view transitions: `tests/navigation-browser.mjs`,
    `tests/interaction-mosh-browser.mjs`
- Retired: 05.11.2026 (V3.2 final gate, B-F27). Nobody should re-add it under
  this name: a suite has to test the contract that exists today.
