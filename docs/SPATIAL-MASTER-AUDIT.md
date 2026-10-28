# Master brief: preserved baseline and implementation scope

Baseline: `589593bc0ea4eb8e1a45972c7340d7d9cfff55bd`, PR #14.
Feature branch: `feat/spatial-archives-hidden-relief`. No merge or production deployment.

The project uses Vite and ordinary JavaScript, DOM templates and History API
routing. It does not use React, React Three Fiber or an animation library.
`app.js` owns route teardown; `main.js` lazily imports Three.js for the visible
homepage. `gallery.js` already provides a keyboard-accessible dialog and real
image flights in `artwork-transitions.js`. These are extended rather than
replaced. `scroll-choreography.js`, the existing physics, chrome geometry,
document ink, one-second hold, released `333`, cursor and audio remain shared.

## Specific causes and changes

- Hero coverage: document ink rejected **every canvas** as an interactive
  element. The hero's transparent, full-size canvas therefore intercepted blank
  clicks above and around the actual mesh. Share its existing raycast result
  with document ink; permit misses, retain mesh paint/drag priority. No new
  click-blocking surface or renderer is needed.
- Navigation: the former categories were tattoos, jewellery and paintings.
  Add tattoos/flashes and more/analog photography/digital artworks; preserve
  legacy paintings URLs and projects. All real content remains centralized.
- Archives: published artwork data is empty. Add shared spatial archive and
  detail behavior, retaining truthful empty states rather than invented art.
- Digital reveal: add a scroll-driven, reversible organic mask and a named
  missing-original slot. Do not repurpose a material texture as digital artwork.
- Final h4: the existing exact monogram mask only faded/scaled. Extend its
  alpha-derived relief with scroll-controlled depth and directional light.
- Living Decay: source residual continued blending toward clean source while
  all motion decayed to zero. Preserve bounded damaged sampling coordinates
  and image history so partial recovery retains actual structural damage.
- World transitions: retain browser-owned actual-page captures and duration;
  increase displaced source sampling and temporal-looking frame echoes.

## Asset and reference audit

At the initial audit, the original green-and-black digital artwork, portfolio
photographs and FBX/GLB/USDZ mannequin were absent from the repository and
attached files. The artist subsequently supplied the original JPEG in a ZIP;
it is now preserved and integrated, with responsive WebP variants. The model
and other portfolio photographs remain unavailable. Available tattoo reflection, brand SVGs and Living Decay material are
not substitutes. The mannequin's UVs and Procreate compatibility cannot be
validated without the model. Optional viewer and editing workflow must say so.

The three niccolofanton.dev references returned HTTP 403 through this
environment's network proxy. Implementation follows the supplied descriptions;
no claim of direct visual comparison or reference source reuse is made.

## Design freezes and verification

Keep Other Side source assets, palette, white/bleach balance and brightness
unchanged. Do not modify established sound design. The two worlds share
archive/detail state and scroll position. Preserve lazy hero loading and no
Three.js initialization on interior routes unless a visitor explicitly opens
an available mannequin. Verify actual input, rendered pixels, keyboard,
320/390px layouts, reduced motion, teardown and production build. Document
missing assets separately from completed mechanics.
