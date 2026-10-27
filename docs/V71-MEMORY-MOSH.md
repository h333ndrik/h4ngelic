# V7.1 / persistent memory-mosh

This report covers **P0 only** on `feat/v71-memory-mosh`, memory implementation
`3b0c330af259e85001766db3d2ef95442de1bd89` and final cleanup `3e5ec5d`, compared with the V6 checkpoint
`959bf20de9481b156494dba5975bea41c0de1e70`. It does not close the separate V6
review or authorize other V7 priorities. No merge or production deployment is
part of this work.

## The cause and the change

The old ambient renderer retained displacement scars but still reconstructed
pixels from a separate clean `material` canvas on every frame. Its parallax
crop also sampled that original composition. Recovering local image regions,
live hover/click SVG filters, document ink and the distress overlay could run
alongside the ambient field. Persistent coordinates therefore did not mean
persistent damaged pixels.

The released `createImageMemoryField` / `paintImageMemory` kernel now drives one
background memory. The local Living Decay asset is sampled to seed a fresh
activation; six strong, seeded displacement passes produce its already-damaged
starting frame. Temporary source pixel data is then discarded. Ordinary frames
sample previous output, with clean-source reconstruction disabled. Idle flow,
pointer movement, clicks, hover, scroll, section motion and navigation mutate
that same history. Navigation and resizing do not reseed it.

There are two reused raster buffers: the visible background and its offscreen
history. Pointer input is coalesced to one pending record, scroll to one pending
record, and discrete impulses to at most eight records. One scheduler drains
them; raw pointer handlers do not render or measure layout. Resize uses an
aspect-preserving center-cover copy through these existing buffers. Reduced
motion displays a prepared damaged frame statically, and hidden documents stop
the paint scheduler. A fresh activation may use a new seed.

The background runs at 35% viewport resolution on desktop and 40% on mobile,
capped at 720×480 / 320×480 independently of DPR. Initial idle/active cadence
caps are 12/20 and 8/16 frames per second; timing adaptation can reduce them.
These are scheduling limits, not measured physical display rates. Internal
nearest-neighbor sampling preserves compressed edges rather than repeatedly
interpolating them. Existing palette, exposure and bleach controls are retained;
history-only sampling removes the clean reconstruction path. The shared kernel
still supports its existing localized color-channel treatment; this is not a
claim that every subsequent frame is a color-invariant pixel permutation.

| Responsibility | Current implementation |
| --- | --- |
| Two-buffer history, bounded queue, transition seed/freeze, resize and cadence | `src/ambient-film.js`, `src/data/ambientFilmSettings.js` |
| Shared displacement and optional clean reconstruction | `src/image-memory.js` |
| Numeric pointer/click/scroll delegation; no local raster regions or second paint loop | `src/corruption.js` |
| Gesture-driven loading, prepared/released ownership and failure handling | `src/corruption-lifecycle.js`, `src/xray.js` |
| Existing native page capture and normal navigation | `src/mode-snapshot.js`, `src/mosh-transitions.js` |
| One opaque background, no competing distress layer | `src/corruption.css` |
| Normal ink retained; Other Side document ink removed | `src/easter-eggs.js` |
| Route/interaction wiring; local SVG hover/click sampling no longer attached | `src/app.js` |

The chrome hero geometry/material/physics, typography, routing, real artwork,
cursor variants, hover scale/white glow, sound controls and existing audio are
preserved. No new engine, production dependency, invented artwork or additional
full-screen memory layer was introduced. The seed material is the existing
`living-decay-material.webp` / mobile asset; it is background material, not a new
portfolio project.

Final regression checks also exposed an existing contact-form scroll transform
escaping the mobile page bounds. The same section clipping already used for
About now contains Contact. Failed Canvas2D initialization releases both buffers
and removes its empty container before subscribing listeners; a repeated-failure
injection test covers this cleanup. These changes leave the measured painting
kernel and cadence unchanged.

## What the transition handoff actually guarantees

Entry prepares and freezes the damaged background **before** native destination
capture. Ambient and native mode transition receive the same variant. Activation
claims that frozen frame without repainting it; native cleanup releases it to
the existing idle scheduler. Interrupted/late preparations are guarded by request
generation and token ownership. Failed preparation retains Normal Mode with a
retry message. Ordinary internal navigation never awaits material preparation.

The browser owns the temporary full-page capture, including typography and
images. JavaScript does **not** read or copy View Transition pseudo-element
pixels. The permanent background is the shared canvas that the destination
captures; the native transition resolves to that same frozen background. The
proof below compares actual canvas bytes at preparation, the native update
callback boundary and release. It does not claim to have read back the browser's
full-page pseudo-element bitmap or persisted the page's semantic text as pixels.

## Completed visual and resource proof

[The browser report](validation/v71/memory-browser-results.json) records actual
1000px, 390px, 320px and 390px reduced-motion runs with zero runtime errors.

| Width / mode | Prepared = destination = released | Damaged pixels before handoff | Pixels changing during later idle |
| --- | --- | --- | --- |
| 1000px | Exact byte equality at all three boundaries | 102,029 / 103,250 | 53,323 |
| 390px | Exact byte equality at all three boundaries | 51,853 / 52,728 | 21,634 |
| 320px | Exact byte equality at all three boundaries | 43,156 / 43,264 | 29,637 |
| 390px reduced | Prepared = released; native capture intentionally skipped | 52,727 / 52,728 | Static frame; no scheduled painting |

The changed-pixel comparison uses the initial seeded material before entry crop,
codec treatment and displacement passes. It measures their combined pixel change,
not an isolated contribution from one pass or a subjective visual-quality score.

Each run retains two live effect bitmaps, zero local image regions, zero local
snapshot filters and zero interior-route WebGL contexts. Other Side has no ink
marks, no CSS background image, no separate distress layer and an opaque memory
field. The test first verifies Normal Mode ink, then verifies it is removed on
entry. It exercises pointer/click/wheel input, internal navigation, resize,
`333` return and a new activation. Seed and source-initialization count remain
unchanged through navigation and resize; the count changes from one to two only
on fresh activation, which also changes seed. Clean reconstruction stays zero.

## Before/after measurements

The [baseline](validation/v71/before-measurements.json) and
[after run](validation/v71/after-final-measurements.json) use headless Chromium
154.0.8037.57, ANGLE SwiftShader and DPR 1. Both drive the same counts of ordinary
Work scrolling, native pointer movement, ten clicks, additional wheel input and
approximately 15 seconds idle. Neither cold interior route creates WebGL.

| Lab metric | 1000px before → after | 390px before → after |
| --- | --- | --- |
| Reported paint p95 | 17.6 → 1.6ms | 8.2 → 1.0ms |
| Native event timestamp → handler dispatch p95 | 4343.7 → 191.3ms | 1214.8 → 33.5ms |
| Work load-to-network-idle wall time | 1359 → 960ms | 885 → 862ms |
| Entry wall time, including the one-second hold/preparation/capture | 9006 → 3472ms | 4323 → 3260ms |
| Scripted interaction phase wall time | 39,899 → 4664ms | 8522 → 1860ms |
| Largest observed long task | 465 → 223ms | 113 → 100ms |

These are **single lab runs with different generated seeds**, not field p75
Core Web Vitals, INP, LCP, physical-phone FPS or a guarantee of equivalent gains
on another device. The dispatch probe excludes presentation latency and includes
headless input/compositor scheduling. Paint samples use a rolling maximum of 180
records: baseline desktop/mobile had 89/136 records, after had 180/163, so their
window ages differ and the after desktop window excludes its initial preparation.
Initial preparation remains separate (439 → 168.8ms desktop; 98.9 → 56.2ms mobile).
The unchanged configured mode choreography is 950ms; it is not the complete
first-entry wall time measured above. Timing variability requires repeated and
physical-device measurements before making broader performance claims.

## Completed two-minute resource check

The separate [390px extended run](validation/v71/extended-final-measurements.json)
recorded **120.141 seconds idle after scripted interaction**, with 965 additional
memory frames. Across eight 15-second samples, the world kept the same seed and
one source initialization, one visible memory canvas, two raster buffers, zero
local regions and zero clean reconstructions. Its discrete queue stayed within
the eight-record cap, and retained paint timings within the 180-record cap.
No interior WebGL context or runtime error was observed.

Compressed review captures: [desktop after resize](validation/v71/memory-work-desktop.webp)
(850×780px, from the 1000px profile's resize check) and
[390px after the two-minute session](validation/v71/memory-work-mobile-2min.webp).
These are visual examples; byte-equality assertions use raw canvas data.

This run reported paint p95 1.0ms and timestamp-to-handler p95 87.6ms; its largest
observed long task was 238ms. Sampled JavaScript heap varied between 7,440,296 and
8,930,818 bytes; the final probe was 7,837,879 bytes. These are Chrome's sampled
JavaScript heap values, not total process/GPU memory or a proof of indefinite
leak-free operation. One two-minute software-rendered session establishes the
recorded bounded resources, not long-term physical-device performance.

## Final validation and preview

- **316/316 Node tests pass**, including repeated unavailable-Canvas cleanup.
- **Seven existing browser suites pass**: cancelled mode holds, audio controls,
  desktop/touch hover, keyboard/touch/reduced-motion modes, actual 3D ink raster
  and disposal, hero physics/WebGL fallback, and V6 navigation/forms at
  1440/390/320px. [The regression report](validation/v71/regressions.json) retains
  resumption and earlier failures. Test repairs select the actual nested label,
  preserve the existing responsive 15px hint, and await completed async route
  cleanup/scroll instead of assuming the early route attribute ends rendering.
- **Production build and export pass**: 12 prerendered routes plus a real 404;
  preview policy remains zero indexable routes. The corruption chunk is 24.87kB
  (10.13kB gzip); the existing lazy Three.js hero remains 610.36kB (158.03kB gzip).
  Vite still reports the existing large-chunk advisory. The offline export
  deliberately combines the homepage-only chunk into its standalone script.
- **Exact exported HTML passes offline checks** at 1440/390/320px with reduced
  motion and at 390px with native captured transitions and trusted touch events.
  All runs have zero external HTTP requests and zero runtime errors. The native
  interior Work run creates zero WebGL contexts and verifies two fresh memory
  entries, exact prepared/released pixels, four captured mode changes and all
  seven trusted mobile taps. This managed browser blocks direct `file://`
  navigation, so tests execute the exact exported bytes in an isolated document
  with network rejected; no physical-phone claim is made.

The [downloadable HTML](previews/h4ngelic-preview.html) is **7,754,218 bytes**;
[ZIP](previews/portfolio-preview.zip) contains the same tested HTML and German
opening instructions. On GitHub choose **Download raw file**, then open the saved
HTML in a browser; unzip the ZIP first if used. These are downloadable previews,
not a public production deployment. The offline inquiry form cannot send mail.

[Package integrity](validation/v71/offline-package.json) records HTML SHA-256
`5ed35ce1dddefc2ab24e084d18fc2a04ef0d318c7d6da1937d3de504cf0ddae8` and verifies
ZIP-member equality plus byte-identical embedding of the supplied JPEG original.
The [offline report](validation/v71/standalone-results.json),
[native report](validation/v71/standalone-native-results.json),
[Node summary](validation/v71/node-tests.txt), and
[production/export log](validation/v71/production-export.txt) provide the final
checks. The existing system FFmpeg was exposed through a workspace-only
Playwright cache for the existing video test; no application dependency changed.

```sh
npm test
npm run dev -- --port 55173 --strictPort
H4_BASE_URL=http://127.0.0.1:55173 node tests/memory-mosh-browser.mjs
H4_BASE_URL=http://127.0.0.1:55173 node scripts/check-memory-regressions.mjs
H4_BASE_URL=http://127.0.0.1:55173 node scripts/measure-memory-mosh.mjs after-final
H4_BASE_URL=http://127.0.0.1:55173 H4_MEMORY_WIDTHS=390 H4_MEMORY_IDLE_MS=120000 node scripts/measure-memory-mosh.mjs extended-final
npm run preview:export
npm run test:standalone
```

Run browsers serially, provision Playwright's FFmpeg for the recording test, and
avoid benchmarking during a build or another browser workload.
[The evidence manifest](validation/v71/evidence-manifest.json) records hashes,
source paths and checkpoints. Timings were measured on the memory implementation
commit; subsequent cleanup and Contact clipping do not alter its painting kernel.
Stop after P0 for artist review. Other V7 features and the separate V6 review
remain outside this change.
