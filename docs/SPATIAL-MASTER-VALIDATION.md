# Spatial archives and persistent material

Feature branch: `feat/spatial-archives-hidden-relief`, based on PR #14 at
`589593b`. The original hero geometry, chrome, extrusion, physics, infinity
motion, cursor assets and sound settings are retained. No merge or production
deployment is part of this update.

## Result and editable content

The homepage keeps its three horizontal editorial columns: **tattoos /
jewellery / more**, with the agreed child links. Existing paintings URLs and
projects remain supported. Tattoos, Flashes and Analog Photography share one
Horizontal Drift implementation; Jewellery retains its existing presentation.
The existing image viewer handles spatial enlargement, additional images,
Escape, focus and return to the same archive position.

The actual green-and-black JPEG supplied in the ZIP is now the first Digital
Artwork. It is preserved byte for byte, with automatically generated 320, 640,
960 and 1440px WebP files. Its 1440×1920 composition and signature remain intact.
No title, creation year or description has been invented. The local sticky
reveal follows ordinary downward scroll and reverses with upward scroll;
the finished state displays the original responsive image directly.
[Original provenance and editing](DIGITAL-ARTWORK-ASSET.md).

The exact h4 SVG becomes a scroll-controlled charcoal relief in the final
section. Depth, directional lighting and edge separation change together;
local pointer movement gently changes the light. It remains absent earlier
on the page, and the existing instruction stays above it. The established
one-second `4` and released `333` gestures remain unchanged.

The full transparent hero canvas now distinguishes a genuine mesh hit from
exposed background. Empty top/side/bottom clicks use the existing document
ink, while mesh hits retain surface paint/drag priority. Functional controls
and links remain excluded. No invisible click-blocking layer was introduced.

Living Decay's source assets, palette, brightness and bleach/white controls
are unchanged. The actual cleanup cause was residual reconstruction toward
undamaged source coordinates. Bounded signed sampling scars now preserve
structural damage as movement relaxes; the existing idle flow continues
moving previous output. Navigation and viewport changes retain the same
world. Stronger native actual-page captures retain the 950ms choreography
and use weighted displaced echoes rather than additive white flashes.
[Implementation and limits](PERSISTENT-MEMORY-MASTER.md).

| Area | Main files |
| --- | --- |
| Categories, routes, shared rendering | `siteContent.js`, `artworks.js`, `routes.js`, `pages.js`, `archive-structure.css` |
| Conditional feature loading and cleanup | `app.js` |
| Shared spatial archive | `horizontal-drift-content.js`, `horizontal-drift.js`, `horizontal-drift.css` |
| Enlargement and return | existing `gallery.js`, `artwork-transitions.js` and their styles |
| Digital artwork and reveal | `data/digitalArtworkSettings.js`, `digital-ink-content.js`, `digital-ink-field.js`, `digital-ink.js`, `digital-ink.css` |
| Hero background hit testing | `hero-background-ink.js`, `easter-eggs.js`, minimal `main.js` integration |
| Luminous rubric selection | `rubric-activation.js`, `interactions.js`/`.css`, `interaction-mosh.js` |
| Exact h4 relief | `footer.js`, `end-reveal.js`/`.css`, `data/endRevealSettings.js` |
| Persistent history and stronger captures | `image-memory.js`, `ambient-film.js`, `mode-snapshot.js`/`.css` |
| Original artwork offline | `preview-assets.js`, `image-assets.js`, `content-utils.js`, `scripts/export-preview.mjs` |
| Optional model viewer | `flash-mannequin-content.js`, `flash-mannequin.js`, `flash-mannequin.css` |

Paths in this table are under `src/` unless otherwise specified. Content
changes require data files and image assets, not changes to rendering code.
[German editing guide](CONTENT.md).

## Assets still required

The mannequin FBX/GLB/USDZ and real tattoo, flash, jewellery and analog-photo
portfolio collections have not been supplied. Their archives remain truthful
empty states. The optional Flash viewer only appears after a real project
has a validated GLB with separately named body and tattoo materials. It loads
Three.js only after the explicit 3D choice and preserves tattoo materials.
No human model, UV repair or Procreate round trip has been fabricated.
[Exact Blender/Procreate/export steps](MANNEQUIN-WORKFLOW.md).

## Verification record

The production build and automated checks are run against the feature branch.
Browser evidence distinguishes the actual supplied original and real homepage
from clearly labelled test-only gallery/model fixtures. No test fixture is
published as portfolio content. Measured current results and final artifact
hashes are recorded here when validation finishes.

## Preview and reproduction

```sh
npm ci
npm run dev -- --port 5173
```

Open `http://localhost:5173` on that same computer. Useful routes are
`/work/tattoos`, `/work/flashes`, `/work/jewellery`, `/work/more`,
`/work/analog-photography`, `/work/digital-artworks` and `/about`.
Contact returns to `/#contact`.

```sh
npm test
npm run build
npm run test:hero-background
npm run test:drift
npm run test:digital-ink
npm run test:persistent-memory
npm run test:mannequin
H4_BASE_URL=http://127.0.0.1:5173 npm run test:regression
npm run preview:export
```

The browser checks use installed Chromium; set `CHROMIUM_PATH` and
`H4_BASE_URL` if needed. The production preview uses
`npm run preview -- --port 4173` after building.

The [single HTML](previews/h4ngelic-preview.html) and [ZIP](previews/portfolio-preview.zip)
are downloadable artifacts. In the private GitHub repository, select
**Download raw file**, then open the saved HTML in Chrome or Firefox. A GitHub
source-file page is not a hosted interactive website. Public preview hosting
is unavailable in this environment.

The standalone export includes the actual portfolio image bytes and hash
routes. The served website keeps clean URLs and lazy runtime chunks. Offline
GLB embedding remains a future step when a genuine model is supplied.
