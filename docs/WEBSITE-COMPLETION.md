# Website refinement: navigation, galleries and About

Review branch: `feat/website-completion`, source checkpoint `8559880`.
This update builds on the accepted memory-mosh work. The Three.js hero geometry,
physics, chrome treatment, Other Side renderer and mode audio are unchanged.

## Current behavior

- **Homepage:** INDEX is hidden visually and from keyboard/assistive navigation,
  including the prerendered page without JavaScript. The original Berlin label
  returns to the upper-right. Interior pages retain their compact INDEX.
- **Chapter navigation:** the four real homepage chapters remain. Contact now
  leads to the final h4 reveal before returning Home. The counter stays usable
  through Inquiry and clears the actual form controls instead of disappearing.
  Its hit area moves immediately rather than passing over inputs during an
  animation. Mobile Work anchors clear the sticky category navigation.
- **About:** the preview text and MORE ABOUT share the heading's left edge.
  Copy and link use the existing bounded, staggered, reversible entrance.
  Direct jumps expose content immediately; reduced motion stays static.
- **Hover:** label enlargement, magnetic movement and arrows fit the viewport
  and clipping container. Long archive headings wrap as needed. Glow remains;
  the button/link's real hit area remains stationary. Inquiry no longer adds a
  second outer zoom on top of the shared interaction.
- **Carousels:** Tattoos, Flashes and Analog Photography use native horizontal
  scroll, mouse drag, touch swipe, trackpad, Shift+wheel, keyboard and previous /
  next controls with a position count. Ordinary vertical scrolling continues
  through Work. There is no pinned vertical timeline or forced CSS scroll snap.
  Controls and keyboard center images; drag starts from the actual current
  position even on a partially visible neighboring image. The screen-reader
  status does not create hidden vertical overflow.
- **Image viewing:** the lightbox preserves vertical and horizontal context and
  restores focus. Ordinary project-image links enhance into the lightbox while
  retaining actual detail URLs without JavaScript or with modified clicks.
  Carousel offsets also survive ordinary route changes and return navigation.
- **Digital Artworks:** the genuine original is immediately visible in an
  ordinary image gallery. Its former ink canvas, mask, sticky reveal and runtime
  stylesheet/import are no longer active. Its original bytes, aspect ratio,
  responsive WebP variants and detail URL remain intact.
- **World 4 Work navigation:** a light violet scrim fades into the damaged
  material, with readable labels and a restrained acid active underline.
  The accepted background memory itself is unchanged.

## Content and delivery still require real configuration

The repository contains one genuine published digital artwork. It has no
confirmed tattoo, flash or analog portfolio photographs. Those three carousels
therefore retain their actual structure with disabled controls, **0 / 0** and
`archive in progress.`. No stock art, reference textures or repeated demo photos
are published as portfolio work. Add real projects centrally in
[`src/data/artworks.js`](../src/data/artworks.js), following [CONTENT.md](CONTENT.md).

Inquiry supports validation, multiple references/previews/removal, artwork
context and accessible statuses. Tests exercise failure/retry and mocked server
acceptance. Actual email delivery remains unconfigured and is not claimed;
[INQUIRY.md](INQUIRY.md) lists the existing server-side mail configuration.
The downloaded HTML cannot send mail and says so when submitted.

## Completed validation

- **330 / 330 Node tests pass.**
- **Seven browser suites pass:** hover containment (1614/1440/390/320px), About
  (1440/390/320px with normal and reduced motion), chapter/navigation completion,
  native carousel, inquiry/route regression, portfolio reload/back/mobile and
  persistent Other Side memory. The carousel's six-project fixture exists only
  in the browser harness; the export is checked not to contain its IDs.
- **Production build/export pass:** 12 prerendered routes plus a genuine 404,
  preview noindex policy preserved. The existing 610.36kB lazy hero chunk and
  Vite large-chunk advisory remain; no new production dependency was added.
- **Production HTTP/no-JS browser checks pass:** real routes, redirects,
  canonical metadata, robots, sitemap, Home-only INDEX visibility and directly
  visible original artwork. Cold interiors do not load the Three.js scene,
  hero font or reflection assets.
- **Exact exported HTML passes offline checks** at 1440/390/320px with reduced
  motion and a separate 390px native-transition/trusted-touch run. All recorded
  runs have zero external HTTP requests and zero runtime errors. Direct Work
  initializes zero WebGL contexts. Prepared/released memory bytes remain equal.
- The ZIP contains the exact tested HTML. The supplied original JPEG is embedded
  byte-for-byte unchanged. [Package hashes](validation/website-completion/offline-package.json)
  and the [evidence manifest](validation/website-completion/manifest.json) identify
  the files and source checkpoint.

These are headless Chromium 154 / ANGLE SwiftShader checks, not physical-phone
FPS or new field performance measurements. The managed browser blocks direct
`file://` navigation, so offline checks execute the exact exported bytes in an
isolated document with network access rejected. Earlier P0 timings remain in
[their separate report](V71-MEMORY-MOSH.md).

Review captures: [About desktop](validation/website-completion/about-desktop.webp),
[About mobile](validation/website-completion/about-mobile.webp),
[Work Normal](validation/website-completion/work-normal.webp),
[Work Other Side](validation/website-completion/work-other-side.webp).
The latter is 850×780px after the 1000px profile's resize check.

## Preview and reproduction

[HTML](previews/h4ngelic-preview.html) · [ZIP](previews/portfolio-preview.zip) ·
[German opening instructions](previews/README-WEBSITE-UPDATE.txt).
On GitHub select **Download raw file**, then open the saved HTML in a browser.
Unzip first when using the ZIP. No merge or production deployment is included.

```sh
npm test
npm run dev -- --port 55173 --strictPort
H4_BASE_URL=http://127.0.0.1:55173 node scripts/check-website-completion.mjs
npm run preview:export
npm run preview -- --port 55383
H4_PREVIEW_URL=http://127.0.0.1:55383 node tests/seo-browser.mjs
npm run test:standalone
```

Run browser suites serially and finish them before rebuilding; image preparation
can otherwise trigger development reloads during a test. The regression report
retains earlier failures and resumed runs, rather than relabelling them as passes.
