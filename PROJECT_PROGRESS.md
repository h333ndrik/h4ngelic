# Current checkpoint — WORLD SOUND v2 (90 s loops) — 2026-11-04

Status: **IMPLEMENTED / CHROMIUM VERIFIED / NOT PUSHED**. One new commit on top
of `27315c6` on local branch `v3.2-world-sound`; no history rewrite, no push, no
merge, no deploy. V3.1-owned modules, layout, mannequin and `api/inquiry.js`
were not touched.

## Delivered in this pass

- `scripts/renderWorldLoops.mjs` renders all four deliverables from one
  deterministic synthesis graph: two 90 s loops (3,969,000 frames) and two
  1.4 s transitions (61,740 frames), with one documented seed per file.
- Loops are periodic by construction (all oscillator/LFO frequencies on the
  1/90 Hz grid, envelopes as loop-phase functions, two-pass filtered noise bed)
  and rendered with a 4 s pre-roll that warms echo and reverb before the exact
  trim. The earlier equal-power wrap blend was removed; it added a measurable
  level bump for coherent drones.
- Build arc 0-15 s intro → layers 15-60 s → fullest 50-75 s → intro texture at
  90 s. Measured first-2 s vs last-2 s difference: +0.43 dB (333), −0.48 dB (4).
- Four anchors (43.6535 / 87.3071 / 103.8262 / 1046.5023 Hz) are continuous in
  both loops; three probes per loop record their spectral presence.
- Replaced the four committed M4A assets in a normal commit. Payload
  2,087,514 → **5,771,564 bytes** (+176.5%), which is the requested threefold
  loop duration at the same 256 kbps; v1 WAV masters were 17,129,180 bytes.
- Encoder changed to macOS AudioToolbox (`afconvert`) plus a bit-exact ffmpeg
  remux, with ffmpeg as the fallback. This removed an ffmpeg-native AAC start
  artifact (a 0.042 offset over the first 512 samples) at the loop point.
- `worldSoundSettings.js`: loop frame target 3,969,000, new `seconds` contract
  (90 / 1.4). Fallback chain M4A → FLAC → WAV and every runtime behaviour
  unchanged.
- `worldSound.js` device-rate fix: asset acceptance now scales the expected
  frame count to the context rate instead of demanding a 44.1 kHz context. On a
  48 kHz output device the previous code rejected all loops and left the site
  silent; that path is now tested at 44.1 and 48 kHz.

## Verification (actual)

- `npm test` outside sandbox: **393 passed, 0 failed** (385 baseline + 8 new).
- Format decode: **4/4 files**, exact frames, zero audio-path long tasks.
- World sound: **6/6 profiles** + missing-file degradation.
- Mode audio: PASS. Sound controls: **8/8**. SMASH: PASS at 1440/390/320.
- Production build: PASS, 18 routes + 404, exactly four M4A with matching hashes.
- Determinism: 4/4 WAV and M4A pairs byte-identical on re-render.

Evidence: `docs/validation/world-sound/v2/` plus
[WORLD-SOUND.md](docs/WORLD-SOUND.md) for hashes, seams, LUFS and the listening
checklist.

## Open

- **BLOCKED:** real iPhone Safari silent switch/route/interruption behaviour.
- **BLOCKED at the visual boundary:** a second user gesture during a visual mode
  transition is still rejected by the unchanged visual controller.
- **OPEN for the user:** subjective listening review of the new loops.
- **OBSERVATION:** pre-existing no-cold-WebGL-on-About failure in
  `tests/mobile-interactions-browser.mjs`, present on base `11e78a1` too.
- Deployed package has no FLAC/WAV fallback files.
- PR #22 still points at `27315c6`; this commit is local until the user asks for
  a push.

# Current checkpoint — WORLD SOUND COMPLETION — 2026-11-04

Status: **AUDIO COMPLETE / CHROMIUM VERIFIED / PARTIAL DEVICE COVERAGE**.
Work remains isolated on `v3.2-world-sound` from base `11e78a1`. The original
dirty checkout, V3.1-owned modules, `main` and `api/inquiry.js` were not changed.
No merge, push or deployment occurred.

## Merge integration — 2026-11-04

PR #20 is merged into `origin/main` at `9123a00`. The sound branch's merge base
is that commit, so `git rebase origin/main` was a clean no-op with no conflicts.
Post-rebase serial verification passed: Node **385/385**; 12/12 format decodes
with zero audio-path long tasks; world sound **6/6**; sound controls **8/8**;
SMASH at 1440/390/320; mode interaction and V3.1 UI **6/6** each. Production
build passed with exactly the four M4A files and unchanged hashes. Evidence:
`docs/validation/world-sound/merge-pass/`.

No V3.1-owned code changed. The known mobile cold-WebGL failure remains an
OBSERVATION on base and branch. `v3.2-world-sound` was pushed and
[PR #22](https://github.com/h333ndrik/h4ngelic/pull/22) opened against `main`.
No merge or deployment occurred.

## Delivered

- Generated FLAC and 256 kbps AAC/M4A derivatives from the four local WAV
  masters. Browser `decodeAudioData` proved exact master frame counts for all
  three formats: loops 1,365,677 frames and transitions 61,740 frames.
- Selected four M4A runtime files, the exact 2-loop + 2-transition manifest.
  Payload fell from **17,129,180** to **2,087,514 bytes**, a **87.81%** saving.
- Rewrote the unpushed branch commit so the WAV masters are absent from branch
  history. Masters remain local-only; master and derivative SHA-256 values are
  recorded in [WORLD-SOUND.md](docs/WORLD-SOUND.md).
- Added ordered runtime candidates **M4A → FLAC → WAV** in
  `src/audio/worldSoundSettings.js`. The engine validates sample rate, channel
  count and exact frame count before accepting a candidate, automatically trying
  the next format after fetch/decode/padding failure, then failing silent.
- Added browser coverage for all 12 generated formats and no-double-fetch,
  one-active-loop, full 1.4 s one-shot, crossfade alignment, arbitrary-phase
  entry and asset-manifest contracts.
- Added the required listening checklist for seam, visual tear, WORLD 4 density,
  iOS silent switch, SMASH ducking and reload persistence.

## Verification

- `npm test`: **385 passed, 0 failed**.
- `world-audio-formats-browser`: **12/12 format files PASS**, exact decoded
  sample lengths, continuous non-zero loop boundaries, zero audio-path long
  tasks.
- `world-sound-browser`: **6/6 width/motion profiles PASS**, both modes, plus
  missing-file degradation.
- `mode-audio-browser`: PASS.
- `sound-controls-browser`: **8/8 profiles PASS**.
- `smash-v31-browser`: PASS at 1440/390/320.
- `npm run build`: PASS; exactly four M4A files copied byte-for-byte.

## OBSERVATION / limits

- **OBSERVATION, not audio:** the preserved mobile test still fails its
  no-cold-WebGL-on-About assertion on both this branch and base `11e78a1`; the
  lazy mannequin preview creates the context. No V3.1/mannequin code was touched.
- Real iOS Safari and hardware listening remain **BLOCKED**.
- The visual controller still rejects a second gesture during an active visual
  transition. Audio retargeting is directly tested but that user path is blocked.
- Only primary M4A candidates are deployed. FLAC/WAV fallback URLs work if those
  alternate files are added later; with the current four-file package, complete
  primary failure degrades to silence.
- The standalone preview does not embed the 2.1 MB world set.

## Deferred

Hero first-touch cue, color-mapped ink impacts and THE OTHER SIDE ambience remain
TODO. Do not implement them in this pass.

Exact next checkpoint: user review and merge of PR #22. After explicit merge
authorization, Vercel deploys `main` automatically; the automation must not merge
it independently.

# Current review checkpoint — V3.1.1

All approved source fixes F1–F11,F13,F15–F17 are complete and verified. F14 implementation passes Chromium pixel/navigation tests, but its documented cross-browser/model/legacy-recovery checks remain BLOCKED. Build, SEO, short-window and exact-byte offline/packaging checks pass. See [review report](docs/V3.1.1-REVIEW.md). Do not restart completed work. Next: review this feature branch and resolve the documented F14 validation limits; no merge/deploy. Older next-step paragraphs below are historical checkpoints.

# V3.1.1 progress — V3.1.2 continuation

## V15 — PARTIAL — 2026-11-03

All mobile adaptations pass at 390x844 and 320x844 in Chromium touch
emulation, full and reduced motion: centered one-line visitor memory,
tap-revealed footer portal, no footer overlap, 00–03 INDEX, compact touch
cursor off, mobile carousel drift/swipe/expansion, digital artwork fit,
lowercase rubrics and fixed cross-links. Hero poster and reduced-motion
crossfade pass all six profiles. Carousel drift remains at 0 LongTasks with
p95 16.70–16.80ms in the headless renderer.

REAL IPHONE SAFARI: BLOCKED. No physical iPhone is attached and this host has
no iOS simulator or Playwright WebKit runtime. Chromium touch emulation is not
Safari and does not prove real-device FPS/INP. This remains the one unresolved
V15 acceptance check; no substitute evidence is claimed.

Evidence: `docs/validation/v3.1.2/V15/` (screenshots, JSON and real logs).


## V7 — DONE — 2026-11-03

The seven visitor tiers are restored through one exported
`visitorMessage(count)` table. The recognition line above the hero and the
floating footer phrase use that same source. The footer phrase reveals on
hover, keyboard focus or tap, floats above the counter without reflow and
keeps the numeric VISIT counter. On mobile the recognition line is centered
one line below the header row.

Actual serial checks before builds:

- New `npm run test:visitor-tiers`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced. Nine count samples map to the exact seven phrases, hero and
  footer match, the portal has no reflow or overflow, and first visit stays
  hidden.
- `node tests/footer-v31-browser.mjs`: 6/6 PASS.
- `npm test`: 372/372 PASS.
- Evidence: `docs/validation/v3.1.2/V7/`.


## V2 — DONE — 2026-11-03

All six normal/other cursor SVGs now use the approved compact viewport:
23.26 x 34.88px base, 24.65136 x 36.97704px hover and 22.32576 x
33.48864px pressed. Supplied path bytes are unchanged. The native cursor
covers the complete page on fine pointers, keeps a pointer fallback in reduced
motion, and is absent on touch devices.

Actual serial checks before builds:

- `node --test tests/mode-icon-assets.test.js`: 4/4 PASS.
- `node tests/ref09-icons-browser.mjs`: desktop, reduced, touch-390 and
  touch-320 PASS, plus the browser SVG decode comparison.
- Evidence: `docs/validation/v3.1.2/V2/`.


## V17 — DONE — 2026-11-03

The page now defers easter-egg and ink initialization until after first paint
and idle; the runtime wordmark font is already subset to its ten real glyphs.
During the unchanged 1400ms mode transition the hero renders at pixel ratio 1
with 30 physics substeps per second, then restores adaptive quality. The
target shader is prepared while `4` is held. Below-fold editorial/archive
sections use `content-visibility: auto`, conservative hover-prefetch rules
cover `/about` and `/work/*`, the inquiry keeps a 2s local draft and clears it
after success, and the first two carousel photos warm during idle at low
priority.

Changed files: `index.html`, `src/app.js`, `src/main.js`, `src/physics.js`,
`src/style.css`, `src/inquiry.js`, `src/horizontal-drift.js`,
`scripts/audit-fonts.mjs`, `scripts/measure-v17.mjs`,
`tests/v17-performance-browser.mjs`, route-suite assertions and package
scripts.

Actual serial checks before builds:

- New `npm run test:performance-v17`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced. Verified idle start after FCP, speculation rules, content
  visibility, shader prewarm, 1x/30Hz transition quality, draft restore and
  clear, and idle carousel warmup.
- `node tests/portfolio-browser.mjs`: 6/6 PASS.
- `node tests/v31-navigation-browser.mjs`: 6/6 PASS.
- `npm run test:drift`: 6/6 PASS.
- `node tests/v31-ui-browser.mjs`: 6/6 PASS.
- `npm test`: 372/372 PASS.
- Real before/after medians (3 runs each, headless Chromium/SwiftShader) are
  recorded in `before.json` and `after.json`; 1440px FCP 192.0 -> 176.0ms,
  LCP 204.0 -> 176.0ms, 390px LCP unchanged 52.0ms, 320px LCP 48.0 -> 44.0ms.
  Long-task totals remained within synthetic-run noise.
- Font audit: 414,568-byte source TTF, 3,414-byte served JSON, 10 glyphs and
  zero unused runtime glyphs. No subset action needed.
- Evidence: `docs/validation/v3.1.2/V17/`.


## V26 — DONE — 2026-11-03

The form now advertises and enforces the honest limit: up to 5 files and
4 MB total. The client rejects oversized files and request payloads before
upload. The server caps the raw request body at exactly 4 MB and independently
checks each file and the total file bytes. Original attachment bytes remain
untouched.

Actual serial checks before builds:

- New `npm run test:mail-limits`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced. The hint reads `up to 5 files, 4 MB total`; a file at the
  configured limit is accepted; one byte over shows a clear 4 MB error before
  any network request.
- `node tests/inquiry-http.mjs`: loopback HTTP integration PASS, including
  accepted bytes and existing 403/415/429/502/503 behavior.
- `npm test`: 372/372 PASS. Boundary unit tests accept the exact configured
  payload and reject a 4 MB + 1 byte request.
- Evidence: `docs/validation/v3.1.2/V26/`.


## V30 — DONE — 2026-11-03

Metallic 333/4 mode-switch cues are disabled through
`modeAudioSettings.modeSoundsEnabled: false`. The synthesis and playback path
remain in the controller and can be re-enabled by changing that field. Mode
changes no longer allocate Web Audio. SMASH playback, deferred fetch/cache,
global mute and volume remain unchanged.

Actual serial checks before builds:

- `node tests/mode-audio-browser.mjs`: PASS for silent mode transitions, zero
  Web Audio allocation, persistent mute state and both visual realities.
- `node tests/smash-v31-browser.mjs` (desktop, full natural end): PASS for the
  exact approved MP3, deferred fetch, attack/tail/stop, global mute/volume,
  route and mode continuity.
- `npm test`: 372/372 PASS, 0 failures, including the re-enable-path unit test.
- Evidence: `docs/validation/v3.1.2/V30/`.


## V28 — DONE — 2026-11-03

The `mixed media` hero tagline is gone from source, rendered knowledge and
tests. The area below the logo is empty; the full stage keeps its previous
geometry and the V8 poster/reduced-motion path is unchanged.

Actual serial checks before builds:

- New `npm run test:hero-tagline`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced, with no tagline element or visible copy, a full-stage hero,
  no horizontal overflow and measured CLS 0.0000.
- Existing `npm run test:hero-poster`: 6/6 profiles PASS.
- `npm test`: 371/371 PASS, 0 failures.
- Evidence: `docs/validation/v3.1.2/V28/`.


## V19 — DONE — 2026-11-03

The INDEX panel now has a soft dark two-layer depth halo while keeping its F1
form-color surface, 4px radius, zero border and zero outline. Contact form
fields remain flat. Readability is unchanged.

Actual serial checks before builds:

- New `npm run test:index-glow`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced. Verified the dark shadow layers, unchanged surface/radius,
  contrast >= 4.5:1, flat form boxes, pixel falloff without a hard band over a
  bright surface, and screenshots over a bright photograph.
- `node tests/v31-navigation-browser.mjs`: 6/6 profiles PASS with the updated
  depth-halo contract.
- `npm test`: 371/371 PASS, 0 failures.
- Evidence: `docs/validation/v3.1.2/V19/`.


## V18 — DONE — 2026-11-03

The Other Side hint now reads exactly `press 3 times 3 to reverse` in text and
accessible labels. Reverse behavior is unchanged: three released 3 presses
inside the fixed two-second window, never two, and holding 4 on the Other Side
remains inert.

Actual serial checks before builds:

- `node tests/xray-browser.mjs`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced motion, including the exact hint text, ignored reverse 4,
  double-press rejection, triple-3 return, touch triple-tap and both 1400ms
  transitions.
- `npm test`: 371/371 PASS, 0 failures.
- Evidence: `docs/validation/v3.1.2/V18/`.


## V25 — DONE — 2026-11-03

Each rubric page now ends with one fixed three-column cross-link row. Tattoos
is always left, jewellery middle and more right; the current page's column
stays empty. The two remaining destinations are real links with the shared
arrow, magnetic label hover, keyboard focus and reduced-motion rest state. The
row scales down without wrapping at 320px.

Changed files: `src/pages.js`, `src/archive-structure.css`,
`src/rubric-activation.js`, `tests/v25-cross-links-browser.mjs`,
`package.json` and this checkpoint set.

Actual serial checks before builds:

- New `npm run test:cross-links`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced. Verified equal line height, fixed relative columns, empty
  current slot, exact labels/hrefs, no overflow or wrapping, logical Tab order,
  desktop unified hover and reduced-motion rest states.
- `npm test`: 371/371 PASS, 0 failures.
- Evidence: `docs/validation/v3.1.2/V25/`.


## V23 — DONE — 2026-11-03

Only real links receive the typographic hover now. `01 / creative`,
`02 / ABOUT` and `03 / CONTACT` are static headings with no anchor, tab stop,
scale or glow; the shared heading-hover CSS is scoped to headings that
actually contain a link, and heading hover measurement binds only to those.
Rubrik links, branding, footer links, NAAVI, carousel cards and artwork keep
their existing unified hover.

Actual serial checks before builds:

- New `npm run test:static-titles`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced. Each title remains pixel- and style-identical after a 400ms
  hover; no title contains a link or tab stop; the desktop rubric link still
  receives its unified transform.
- `npm test`: 371/371 PASS, 0 failures.
- Evidence: `docs/validation/v3.1.2/V23/`.


## V21 + V24 + V27 — DONE — 2026-11-03

The homepage section is now the static `01 / creative` title, with no route
link or typographic hover. The rubric links beneath it remain the direct
entries. `/work` is no longer a destination: it and `/work/index.html`
permanently redirect to `/work/tattoos`, while `?category=` bookmarks map to
their canonical category paths. Artwork detail URLs remain
`/work/{category}/{id}` and the prerender/sitemap route set no longer contains
an orphan `/work` page.

INDEX now reads `00 / home`, static `01 / creative`, `02 / about`,
`03 / contact`; the creative entry is not focusable. NAAVI uses `creative`
and `creative / tattoos`. The status doc labels V21/V24/V27 as DONE.

Actual serial checks before builds:

- `node tests/portfolio-browser.mjs`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced motion, both realities. Confirmed the static title, direct
  rubrik destinations, `/work` redirect, canonical query redirects, reload and
  back navigation, and no Three.js on cold category routes.
- `node tests/v31-navigation-browser.mjs`: 6/6 profiles PASS, including the
  four INDEX entries, exact targets, non-focusable creative title, tab order,
  panel geometry and reduced motion.
- `npm test`: 371/371 PASS, 0 failures.
- Evidence: `docs/validation/v3.1.2/V21/`.


## V20 — DONE — 2026-11-03

The About page now reads exactly `03/ about`, retaining the lower-case route
label and the existing page-heading treatment. There is no layout, copy or
navigation change.

Actual serial checks before builds: new `npm run test:about-heading` passed
6/6 profiles at 1440/390/320px, full/reduced, with the exact text, lower-case
rendering, no overflow and no first-paint transform. `npm test` passed 371/371.
Evidence: `docs/validation/v3.1.2/V20/`.

## V12–V14 — DONE — 2026-11-03

The tattoos, jewellery and more routes now share the corrected structure:
lower-case `tattoos`, `jewellery` and `more` page titles; no self-link group
header; and real child categories promoted directly beneath the title at the
same size as the frontpage tattoo link with the shared arrow treatment.
Tattoos promotes `flashes`; more promotes `digital artworks` and
`analog photography`; jewellery has no invented child category. Visible rubric
category labels carry `data-motion-static`, so they have no entrance pose at
first paint. Later page content keeps the existing reversible scroll motion.

Changed files: `src/pages.js`, `src/archive-structure.css`, content, portfolio,
SEO and standalone contracts, plus checkpoint evidence.

Actual serial checks before builds:

- `node tests/portfolio-browser.mjs`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced, in both realities. Confirmed lower-case headings, no
  `.work-group-heading` on rubric pages, promoted links/arrows, full
  category-link font parity, static first-paint transforms, real routes,
  canonicals, reload/back and cold interiors without Three.js. Evidence:
  `docs/validation/v3.1.2/V12/`.
- `npm test`: 370/370 PASS, 0 failures. Evidence: `V12/node.txt`.

## V11 + V16 — DONE — 2026-11-03

Pointer and touch activation no longer paints a focus outline, translucent
selection box or underline flash on header, INDEX, rubric, footer, carousel or
artwork controls. The root rule uses `:focus:not(:focus-visible)` and suppresses
the Safari/Chromium tap highlight. Programmatic pointer focus inside inline
artwork uses a temporary marker that is cleared by the next keyboard event.
Keyboard `:focus-visible` and Skip Link focus remain visible.

Changed files: `src/style.css`, `src/interactions.css`,
`src/artwork-transitions.css`, `src/horizontal-drift.css`,
`src/inline-artwork-expand.js`, `tests/pointer-focus-browser.mjs` and
`package.json`.

Actual serial checks before builds:

- New `npm run test:pointer-focus`: 6/6 profiles PASS at 1440/390/320px,
  full/reduced. It clicks/taps every sampled header, category, footer, INDEX,
  carousel and artwork control and compares outline, box-shadow and
  text-decoration before/after; it separately proves keyboard focus remains
  visible. Evidence: `docs/validation/v3.1.2/V11/`.
- Existing `npm run test:drift`: 6/6 profiles PASS after the inline-focus
  change.
- `npm test`: 369/369 PASS, 0 failures.

## V10 — DONE — 2026-11-03

INDEX now contains only the stable 00–03 destinations. The 04 “the other
side” entry and its INDEX route mapping were removed; 00–03 were not
renumbered. The actual footer h4 reveal remains available through its existing
end-of-page experience and NAAVI, not a duplicate INDEX shortcut.

Changed files: `index.html`, `src/global-navigation.js`, navigation/SEO/
standalone assertions and checkpoint evidence. `npm test` passed 369/369.
`tests/v31-navigation-browser.mjs` passed all six 1440/390/320px full/reduced
profiles, including four destinations, exact targets, keyboard tab order,
visible focus, panel contrast and no overflow. Evidence:
`docs/validation/v3.1.2/V10/`.

## V9 — DONE — 2026-11-03

The existing eight-photo archive now drifts automatically left-to-right and
wraps through the real cards without clones. CSS perspective at a 900px camera
distance gives inward edge rotation and scaling with no Three.js or WebGL on
Works pages. Hover and keyboard focus pause drift; drag and touch take over with
finite momentum, then drift resumes. Vertical wheel and touch input remain
native. Reduced motion keeps a static row with instant interaction states.

Changed files: `src/carouselSettings.js`, `src/horizontal-drift.js`,
`src/horizontal-drift.css`, `src/horizontal-drift-content.js`,
`tests/horizontal-drift-browser.mjs`, `tests/horizontal-drift-performance.mjs`,
`tests/v31-ui-browser.mjs`, `package.json` and this checkpoint set.

Actual serial checks before builds:

- `npm run test:drift`: 6/6 profiles PASS at 1440/390/320px, full/reduced,
  each in 333/4. Included drift, hover pause, drag takeover/resume, native
  vertical escape, seamless wrap, depth, expansion, keyboard, reduced motion,
  eight genuine images and no Three.js requests. Evidence:
  `docs/validation/v3.1.2/V9/carousel/` and `browser.txt`.
- `node tests/v31-ui-browser.mjs`: 6/6 profiles PASS. Shared interaction,
  form, photo enlargement, borderless controls and radius contracts remain
  intact. Evidence: `docs/validation/v3.1.2/V9/ui/` and `ui.txt`.
- `npm test`: 369/369 PASS, 0 failures. Evidence: `node.txt`.
- `npm run test:drift-performance`: 121 observed RAF intervals per profile
  over about two seconds after image decode and warm-up. 1440px p95 16.80ms,
  390px p95 16.70ms, 320px p95 16.70ms; zero LongTasks. This is headless
  Chromium with SwiftShader, not physical-device FPS or INP. Evidence:
  `performance.json` and `performance.txt`.

No build, merge or deployment was performed.

## V8 — DONE — 2026-11-02

Hero poster is now first-paint critical markup, not a post-JavaScript fallback.
`index.html` carries layout-critical CSS and the empty poster element; Vite
injects `src/data/heroPosterSettings.js`. The normal path crossfades after the
first rendered frame. Reduced motion keeps the poster and does not import or
request the Three.js scene, fonts or textures.

Changed files: `index.html`, `src/data/heroPosterSettings.js`, `src/app.js`,
`src/style.css`, `vite.config.js`, `package.json`, `tests/hero-poster.test.js`,
`tests/hero-poster-browser.mjs`, `tests/browser.mjs`.

Actual checks: `npm test` 369/369 PASS; `npm run test:hero-poster` 6/6 profiles
PASS with zero measured CLS; existing hero suite passes desktop, mobile,
reduced-poster and WebGL-failure paths. Evidence: `docs/validation/v3.1.2/V8/`
plus `docs/V3.1.2-STATUS.md`. No build, merge or deployment performed.

# V3.1.1 progress — F17 done

## Current committed checkpoint — 2026-11-02

At resume, `v3.1.1-fixes` was clean at **`7238478`**, five commits ahead of the merged baseline. Verified commits: F1 `f57f759`, F9 `36f574d`, F2 `3d01241`, F3 `7028dbc`, F4 `7238478`. Their evidence is committed under `docs/validation/v3.1.1/`. These fixes are DONE; do not restart their verified work without a relevant new change. The dynamic-count F9 follow-up is complete: unused five-pose helper removed, totals driven by actual projects/slides, Node coverage0/1/3/5/8/9 and all eight paths/alt/srcset verified.

F5 is the first unfinished task: implement one measured horizontal gap throughout Works branding → tattoos → jewellery → more. Branding-to-first and category-to-category gaps must match at1440/390/320px, without wrapping or changing the V3.1 baseline. Root owns the active serial navigation browser checks, Node tests and the separate F5 commit. After F5 continue F6,F7,F8,F10,F11,F13,F14,F15,F16, one fix per commit; preserve verified work and do not launch.

Updated 2026-11-02. Active branch **`v3.1.1-fixes`**, based on fetched main **`9123a00b21b9a7d3873fe97ba7c36fb90b74c3e5`**. PR #20 was merged by the user at 2026-10-30T11:41:11Z. This round does not reopen, edit, merge or deploy it. Merged V3.1 source and assets are present; no missing baseline prerequisite has been established.

Read the [original V3.1.1 fix round](docs/V3.1.1-FIX-ROUND.md) and the [latest continuation](docs/V3.1.1-CONTINUATION.md). The continuation overrides matching requirements and adds F16. Its prioritized F9 is now verified and committed; **F5 is the first unfinished task**. User clarification independently confirms F5 and F10 below. Previous checkpoints remain unchanged in [V3.1 history](docs/history/v3.1-checkpoint-2026-10-29).

| Fix | Status | Verified state / exact next requirement |
| --- | --- | --- |
| F1 | DONE | Borderless INDEX surface/focus retained. Navigation6 + UI6 in333/4 and Node357/357 passed. Commit `f57f759`; evidence `docs/validation/v3.1.1/F1`. |
| F2 | DONE | VISIT follows moshlab with shared secret reveal; footer browser6 and Node pass. Commit `3d01241`; evidence `docs/validation/v3.1.1/F2`. |
| F3 | DONE | Top TATTOOS/ON SKIN static from first paint; motion browser6 and Node pass. Commit `7028dbc`; evidence `docs/validation/v3.1.1/F3`. |
| F4 | DONE | Contact shares About section clock; browser6 and Node363/363 pass. Commit `7238478`;12windows0LongTasks, but RAFp95 up to566.5ms; see measured limitations below. |
| F5 | DONE | Use one gap throughout the Works floating row; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F5. |
| F6 | DONE | Replace Work pinning with the MORE ABOUT scrub path; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F6. |
| F7 | DONE | TATTOOS size/arrow parity verified at all3 widths; navigation6 and Node363/363 pass; static arrival preserved. |
| F8 | DONE | Cover every interactive area with the native h4 cursor; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F8. |
| F9 | DONE | Committed `36f574d`: carousel6 + UI6 in333/4, Node363/363, CLS0/noerrors/no cold-WorkThree. Eight real photos; dynamic count0/1/3/5/8/9 follow-up complete; all8alt/srcset verified. |
| F10 | DONE | Reuse inline viewing for the resized Digital artwork; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F10. |
| F11 | DONE | Round photographs with the shared radius token; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F11. |
| F13 | DONE | Unify route-link and branding hover feedback; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F13. |
| F14 | BLOCKED | Chromium pixel/navigation6 and Node363 pass; Safari/Firefox/real-mannequin unavailable, legacy corruption recovery test times out. |
| F15 | DONE | Make4 entry-only and require triple3 for return; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F15. |
| F16a | DONE | Make Works and category destinations real routes; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F16. |
| F16b | DONE | Make Works and category destinations real routes; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F16. |
| F17 | DONE | Restore returning-visitor recognition above the hero; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F17. |

There is no F12. TODO means not started; PARTIAL means code/verification underway; DONE requires actual current checks. REVIEW NEEDED is intent uncertainty, not a missing V3.1 feature.

## F1 — actual verification

Runtime: `src/global-navigation.css`, `.global-index-links` now `border:0; outline:0; box-shadow:none`, retaining `var(--surface-input)`, `var(--radius-soft)` and individual focus rules. No photo/mode/hero/audio runtime changed under F1. Harness: `tests/v31-navigation-browser.mjs` six profiles, actual panel contrast/screenshots and reduced native cursor expectation; `tests/v31-ui-browser.mjs` borderless panel expectation, evidence path and enlargement diagnostics.

- Navigation: `H4_BASE_URL=http://127.0.0.1:55173 H4_NAV_ARTIFACTS=artifacts/v311/F1/navigation node tests/v31-navigation-browser.mjs` — **6/6 PASS**, each profile333/4. `artifacts/v311/F1/navigation/results.json`: six reports, zero failures, all error lists empty. `/tmp/h4-v311-F1-navigation.log`. Panel `rgb(48,48,51)`,4px radius,0px border/outline, no filter/shadow. Actual inactive contrast7.447169:1, active13.155752:1. Focus/navigation/geometry/no overflow pass. Twelve `index-{1440,390,320}-{false,true}-{normal,xray}.png` panel screenshots.
- Broad UI fresh-server repeat: `H4_BASE_URL=http://127.0.0.1:55173 H4_UI_ARTIFACTS=artifacts/v311/F1/ui node tests/v31-ui-browser.mjs` — **6/6 PASS**, each profile333/4. `artifacts/v311/F1/ui/results.json`: six reports, zero failures, all errors/audio-request lists empty. `/tmp/h4-v311-F1-ui.log` records six PASS lines. This verifies baseline shared interaction/form/enlargement/hero/radius contracts, not future F9 changes.
- `npm test` — **357/357 PASS**, fail0/skipped0,3493.473929ms, `/tmp/h4-v311-F1-node.log`.
- Prior incomplete UI attempts remain failure history: first ratio1 vs1.1, retry mode timeout with13ERR_CONNECTION_REFUSED. Root found the dev server dead, restarted it and the full six-profile repeat passed. Do not label F9/F15 feature prerequisites BLOCKED or unresolved from those stale attempts. Preserve incomplete evidence separately from final passing output.

F1 was committed as `f57f759`; no V3.1.1 build/export is claimed by this documentation update. Root owns serial runs, commits and final artifacts.

## V9 carousel configuration contract (F9 baseline retained)

Actual single source: `src/carouselSettings.js`, exported `carouselSettings` with JSDoc per field. Both prerender markup and runtime enhancement consume the same `carouselStyleProperties()` dimensions. Changing these values is sufficient after rebuild; no component edits needed. V9 status: **DONE**; see `docs/validation/v3.1.2/V9/`.

| Field | Actual default | Meaning |
| --- | --- | --- |
| `cardWidth` |`300`| Resting card width in px; narrow screens cap it at the available page width. |
| `cardHeight` |`420`| Maximum resting photograph height; its original ratio is preserved. |
| `cardViewportInset` |`24`| Resting card clearance from either edge of a narrow viewport, in pixels. |
| `spacing` |`100`| Horizontal space between adjacent card slots, in pixels. |
| `inertia` |`0.05`| Fraction of velocity lost per 60Hz frame; larger values stop sooner. |
| `wheelSensitivity` |`8.0`| Legacy wheel impulse value; vertical wheel capture is off. |
| `wrap` |`true`| Recycle real cards seamlessly through the ambient loop; no duplicate artwork. |
| `hoverStraighten` |`true`| Lift the hovered card slightly, retaining the site's own scale/glow. |
| `neighborDisplacement` |`true`| Move immediate neighbours aside with transforms while a card is hovered. |
| `scrollCapture` |`'none'`| Legacy horizontal-wheel mode; the shipped value leaves vertical input native. |
| `autoDrift` |`true`| Enable the approved carousel-only ambient time loop. |
| `autoScroll` |`0.3`| Rightward drift distance in CSS pixels per 60 Hz frame, about 18px/s. |
| `hoverPause` |`true`| Pause ambient drift while a fine pointer or keyboard focus is inside the carousel. |
| `perspectiveZoom` |`45`| Perspective field-of-view value for the CSS depth composition. |
| `cameraDistance` |`900`| Camera distance in pixels applied as the CSS perspective plane. |
| `depthScale` |`true`| Enable edge scaling and inward rotation without WebGL. |
| `edgeRotation` |`12`| Maximum inward card rotation at the viewport edge, in degrees. |
| `edgeScaleFloor` |`0.92`| Minimum edge-card scale at the viewport boundary. |
| `pointerLabel` |`false`| Reserved for compatibility: the native h4 cursor is the sole affordance. |
| `expandWithinLayout` |`true`| Enable the common in-page image expansion; never opens a modal. |
| `expansionScale` |`1.65`| Largest reserved viewing height relative to the resting card height. |
| `restingFrameFraction` |`0.7`| Resting photo may occupy at most this fraction of its reserved frame. |
| `viewportInlineInset` |`12`| Horizontal clearance between an expanded photograph and the viewport. |
| `viewportBlockInset` |`76`| Top/bottom viewport clearance for floating navigation during expansion. |
| `hoverLift` |`6`| The hovered card's optional vertical lift, in pixels. |
| `neighborShift` |`12`| Immediate neighbours' optional horizontal displacement, in pixels. |
| `dragThreshold` |`8`| Pointer movement required before a click becomes a horizontal drag. |
| `wheelLinePixels` |`16`| Wheel line delta normalization, in pixels. |
| `maximumWheelDelta` |`120`| Per-event wheel limit avoids unusually large device impulses. |
| `maximumVelocity` |`100`| Maximum shared velocity, in pixels per 60Hz frame. |
| `velocityCutoff` |`0.12`| Stop scheduling animation when velocity falls below this threshold. |
| `dragClickGuardMs` |`350`| Suppress the synthetic click immediately following a completed drag. |
| `announcementDelayMs` |`140`| Delay before politely announcing the selected artwork to screen readers. |

`autoDrift` is the only approved time loop and runs only while the carousel is near the viewport. Shared hover scale/glow and neighbour displacement remain active. Works pages still load no Three.js/WebGL. All eight confirmed photographs use existing optimized assets, alt text and lazy loading; original bytes are untouched. Reduced motion is static with instant state changes.

## Changed checkpoint files

Original brief `docs/V3.1.1-FIX-ROUND.md` and latest `docs/V3.1.1-CONTINUATION.md` are preserved verbatim. Previous root files remain unchanged under `docs/history/v3.1-checkpoint-2026-10-29/`. These root checkpoints reconcile current code, actual passing F1 outputs and latest user clarifications; delegated documentation work does not run browsers/builds or commit.

**One fix = one commit**, with checkpoint updates and real outputs. After each fix run affected existing browser suites **serially before builds**, at1440/390/320 × full/reduced, both333/4 where relevant. No browser parallelism or asset preparation/build while browser checks run. Preserve unaffected assertions; update only superseded contracts. Capture F1/F2/F9/F10/F14 screenshots and measure actual F4/F6/F14 frame/long-task/compositing costs. Report failures with their actual causes/evidence. Do not rerun the historical full100s SMASH observation for an unrelated CSS change.

## Last verified downloadable preview

Checked-in `docs/previews/h4ngelic-preview.html` and `portfolio-preview.zip` are merged **V3.1**, not current V3.1.1. HTML24,484,734bytes, SHA-256 `6c11473dd0360a15c5e459ae8ee95deeffa3c34c01cad0ffe790bd5d734ce001`; ZIP17,305,532bytes, SHA-256 `61da29cabd658cb4fee3eb158e0b98dbc81bee65fb8f363ccef7c9abf5932770`. Export after serial browser work, then verify exact new bytes before review delivery.

## Boundaries

Keep working chrome hero/physics, accepted memory-mosh, approved SMASH and1400ms transition. INDEX stays separate from NAAVI; Contact exclusively Home03/CONTACT. Cold Work/About must never download or initialize Three.js. Preserve uncommitted user/agent work and finish existing components.

Preserve all eight original JPEGs `public/images/tattoos/tattoo-01.jpg`…`tattoo-08.jpg` and approved MP3 byte-for-byte. Photo provenance: `docs/assets/tattoo-originals-v31.json`. MP3 SHA-256 `307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b`. The user has now explicitly confirmed all eight photographs remain in the carousel, resolving the continuation text’s old reference to five. No photo-count question remains open.

Do not modify H4 MOSH LAB, add dependencies, change main or `api/inquiry.js`, force-push, merge, close, deploy, launch, connect domains or enable analytics. Deferred WORLD/mannequin/Flowfield and other Easter Eggs stay parked; F17 returning-visitor recognition is now explicitly approved. Real moshlab URL, actual mail configuration/delivery and unpublished Loose Thread artwork are external inputs; do not invent substitutes. Actual Safari is unavailable on Linux; WebKit is not Safari. Record concrete installed-browser capabilities before claiming cross-browser success.

## Exact next checkpoint

Run production build and current preview/offline verification; preserve F14 validation blockers; no launch. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## Confirmed continuation answers — 2026-10-31

The user confirmed all **eight** supplied photographs remain in the carousel. Home stays **01 / WORKS, 02 / ABOUT, 03 / CONTACT**. The tattoos / jewellery / more rubric links must open their own real category pages; Contact remains exclusively on Home. F16 intent is resolved; this is TODO, not an unresolved review blocker. F1 was committed as `f57f759`. F9 was subsequently verified and committed as `36f574d`; the current first unfinished task is F5.

## Historical record — F9 — DONE — 2026-10-31 19:02 UTC

The horizontal carousel and dynamic photo count are complete.

Changed files: `src/carouselSettings.js`, `src/horizontal-drift-content.js`, `src/horizontal-drift.js`, `src/horizontal-drift.css`, `src/gallery.js`, shared `src/inline-artwork-expand.js/.css`, existing carousel/UI/Node tests and `docs/CAROUSEL-EDITING.md`. All26 tuning fields are documented in the checkpoint tables. The retired unused five-pose helper is removed; totals, recycling, indices and counters derive from the actual published projects/mounted slides. Node tests exercise0/1/3/5/8/9 entries. All8 original paths/alt/srcset/proportions remain verified.

Actual serial verification before builds:

- Existing `tests/horizontal-drift-browser.mjs`:1440/390/320 × full/reduced, each333/4; six successful profiles across the recorded desktop/mobile runs. Wheel/drag/touch share finite momentum; real touch transfer, wrapping, second/outside/Escape collapse, keyboard focus, viewport fit, native vertical escape and cold-Work no-Three/no-MP3 checks pass. **CLS0 in every profile; all console/page error lists empty.**24 required normal/expanded screenshots and complete JSON in `docs/validation/v3.1.1/F9/`.
- Existing `tests/v31-ui-browser.mjs`:6/6 PASS, both modes. `/tmp/h4-v311-F9-ui.log`, persisted `ui.txt/ui.json`. A prior first attempt hit an expired dev server before navigation; a fresh detached local server produced this full pass.
- `npm test`:363/363 PASS,0 fail/skipped,3514.249524ms; persisted `node.txt`.

Corrections verified during F9: rounded inner-wrapper clipping no longer suppresses the common hover; implicit touch-capture transfer does not end an active swipe; finite velocity settles at exactly0. CSS completion checks compare settled poses rather than assuming a sleep represents a rendered frame. Existing site-wide full/lite Other Side media treatment remains intact. Original JPEG/MP3 bytes and hero/memory-mosh remain untouched. No build/export/merge/deploy occurred.

Historical next step recorded then (superseded by the current checkpoint above): F2 is first unfinished: apply the prepared VISIT-left-cluster change, run existing footer browser6 profiles serially and npm test, save actual screenshots/results and commit F2 alone. Then continue F3/F4/F5/F6/F7/F8/F10/F11/F13/F14/F15/F16 in the user order. F9 is verified; do not rebuild or repeat it without a new relevant change. No launch.

## Historical record — F2 — DONE — 2026-10-31 19:04 UTC

Move VISIT after moshlab with shared secret reveal.

Changed files: `src/footer.js`, `src/easter-eggs.css`, `src/easter-eggs.js`, `tests/footer-v31-browser.mjs`, `tests/easter-eggs.test.js`, `tests/standalone-browser.mjs`.

Actual serial verification, before builds:

- `node tests/footer-v31-browser.mjs`: exit 0, 80.233s. Actual output: `docs/validation/v3.1.1/F2/browser.txt`.
- `npm test`: exit 0, 3.306s. Actual output: `docs/validation/v3.1.1/F2/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F2`. No merge/deploy/build performed for this fix.

Historical next step recorded then (superseded by the current checkpoint above): F3: static first-paint TATTOOS and ON SKIN headings. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## Historical record — F3 — DONE — 2026-10-31 19:06 UTC

Keep top tattoo labels static from first paint.

Changed files: `src/pages.js`, `src/scroll-choreography.js`, `tests/v31-motion-browser.mjs`.

Actual serial verification, before builds:

- `node tests/v31-motion-browser.mjs`: exit 0, 127.836s. Actual output: `docs/validation/v3.1.1/F3/browser.txt`.
- `npm test`: exit 0, 3.306s. Actual output: `docs/validation/v3.1.1/F3/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F3`. No merge/deploy/build performed for this fix.

Historical next step recorded then (superseded by the current checkpoint above): F4: audit Contact native scrub and measure actual scroll costs. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## Historical record — F4 — DONE — 2026-10-31 19:09 UTC

Share the About section clock with Contact.

Changed files: `src/scroll-choreography.js`, `src/data/motionSettings.js`, `tests/v31-motion-browser.mjs`, `tests/helpers/v311-motion-performance.mjs`.

Actual serial verification, before builds:

- `node tests/v31-motion-browser.mjs`: exit 0, 163.965s. Actual output: `docs/validation/v3.1.1/F4/browser.txt`.
- `npm test`: exit 0, 3.374s. Actual output: `docs/validation/v3.1.1/F4/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F4`. No merge/deploy/build performed for this fix.

Historical next step recorded then (superseded by the current checkpoint above): F5: equal measured gaps throughout the floating Works row. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## Verified F4 performance limits

Current recorded evidence: `docs/validation/v3.1.1/F4/results.json` has six profiles at 1440/390/320px × full/reduced motion, each in 333/4; zero failures/console errors. All **12 Contact measurement windows recorded 0 LongTasks**. The full-motion 1440px Other Side window nevertheless recorded **RAF p95 566.5ms / max 616.7ms**; its observed entrance script maximum was **6.3ms** (forced style/layout 6.0ms). Full-motion 390px Normal recorded **RAF p95 216.7ms / max 316.6ms**. Entrance attribution was unavailable in 5/12 windows; zero observed attribution in other windows does not mean zero callback cost.

These are headlessChromium/SwiftShader software-renderer measurements, limited by the cloud hardware/rendering environment; they do **not** prove universally smooth motion or identify the entrance as the sole cause of slow frames. F4 verifies native uncancelled input, reversible poses and unchanged document height, not a guaranteed device frame rate. Preserve this measured limitation and continue F5; do not repeat verified F4 solely to obtain prettier numbers. F4 browser suite6/6 passed; recorded Node 363/363 passed (`node.txt`, 3167.274028ms); the shell-level 3.374s includes command overhead.

## F5 — DONE — 2026-11-02 16:10 UTC

Use one gap throughout the Works floating row.

Changed files: `src/ui-tokens.css`, `src/global-navigation.js`, `src/archive-structure.css`, `tests/v31-navigation-browser.mjs`.

Actual serial verification, before builds:

- `node tests/v31-navigation-browser.mjs`: exit 0, 70.128s. Actual output: `docs/validation/v3.1.1/F5/browser.txt`.
- `npm test`: exit 0, 3.616s. Actual output: `docs/validation/v3.1.1/F5/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F5`. No merge/deploy/build performed for this fix.

Exact next checkpoint: F6: replace the Home strip entrance with the exact MORE ABOUT path. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F10 viewport decision — confirmed 2026-11-02

The user explicitly approved an additional responsive height cap in short browser windows. Keep the nominal60% original-width base, but reserve a visibly larger full-image view that fits the viewport. Report actual capped dimensions; do not claim a physical660px resting image in an844px-high window.

## F6 — DONE — 2026-11-02 16:16 UTC

Replace Work pinning with the MORE ABOUT scrub path.

Changed files: `src/scroll-choreography.js`, `src/scroll-choreography.css`, `src/data/motionSettings.js`, `tests/v31-motion-browser.mjs`, `tests/scroll-motion.test.js`.

Actual serial verification, before builds:

- `node tests/v31-motion-browser.mjs`: exit 0, 311.963s. Actual output: `docs/validation/v3.1.1/F6/browser.txt`.
- `npm test`: exit 0, 3.776s. Actual output: `docs/validation/v3.1.1/F6/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F6`. No merge/deploy/build performed for this fix.

Exact next checkpoint: F7: match the TATTOOS heading to Home size and arrow. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F7 — PARTIAL — 2026-11-02 16:21 UTC

Match the tattoo heading size and arrow: verification incomplete.

Actual failing command: `npm test`, exit 1. Output: `docs/validation/v3.1.1/F7/node.txt`. Source changes remain uncommitted. Inspect the actual failure before repeating checks.

Exact next checkpoint: Resume F7: inspect docs/validation/v3.1.1/F7/node.txt, correct the failing contract or implementation, then rerun the affected serial check. Do not reapply the patch or claim completion.

## F6 measured performance limits

The36 native-scroll measurement windows cover Work/About/Contact in both modes and all6 profiles. The largest observed entrance script duration in attributable long animation frames was5.7ms;20windows did not expose usable source attribution. One whole-page118ms Long Task occurred in390px/full-motion Normal About, with browser attribution `unknown`/`window`; it cannot honestly be assigned to or excluded from the entrance solely from that entry. Preserve the complete JSON. Functional reversal/native-input checks pass, but these cloud/SwiftShader measurements do not establish universally hitch-free hardware rendering.

## F7 — DONE — 2026-11-02 16:24 UTC

TATTOOS now shares the Home category typography token and the common arrow. F3 static markers remain. Changed files: `src/ui-tokens.css`, `src/style.css`, `src/archive-structure.css`, `src/pages.js`, existing navigation/content tests.

Existing navigation browser suite:6/6 PASS,1440/390/320 × full/reduced,333/4, zero console errors/overflow. Actual font parity and arrow count are stored in `docs/validation/v3.1.1/F7/results.json`; browser output in `browser.txt`. `npm test`:363/363 PASS, zero failures. A superseded text-only HTML parser initially omitted the new arrow-bearing TATTOOS link; the parser now compares actual text content while the browser separately verifies exactly one arrow. Failed attempts remain recorded. No browser rerun was needed for a test-parser-only correction.

F6 performance limitations were added to PROJECT_PROGRESS.md from its actual36 measurement windows; no universal smoothness claim is made. No build/deploy/merge.

Exact next checkpoint: F8: apply the native h4 cursor coverage fix, verify all interactive surfaces with existing navigation suite6 and npm test, record actual results and commit separately. Then continue F10/F11/F13/F14/F15/F16; no launch.

## F7 checkpoint correction

The first F7 Node run retained a superseded prohibition on heading arrows. The approved Tattoo arrow and text parsing are now asserted explicitly; final `npm test` is363/363 PASS. The earlier DONE checkpoint was premature and has been corrected in the unpublished F7 commit. All failed Node attempts remain in `docs/validation/v3.1.1/F7/`; its previously successful navigation6 run is unchanged. F8 source is only staged later after its own serial checks.

## F8 — DONE — 2026-11-02 16:27 UTC

Cover every interactive area with the native h4 cursor.

Changed files: `src/cursor.css`, `tests/v31-navigation-browser.mjs`.

Actual serial verification, before builds:

- `node tests/v31-navigation-browser.mjs`: exit 0, 86.937s. Actual output: `docs/validation/v3.1.1/F8/browser.txt`.
- `npm test`: exit 0, 6.254s. Actual output: `docs/validation/v3.1.1/F8/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F8`. No merge/deploy/build performed for this fix.

Exact next checkpoint: F10: Digital width base60% and shared inline expansion. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F10 — PARTIAL — 2026-11-02 16:31 UTC

Reuse inline viewing for the resized Digital artwork: verification incomplete.

Actual failing command: `node tests/v31-ui-browser.mjs`, exit 1. Output: `docs/validation/v3.1.1/F10/ui.txt`. Source changes remain uncommitted. Inspect the actual failure before repeating checks.

Exact next checkpoint: Resume F10: inspect docs/validation/v3.1.1/F10/ui.txt, correct the failing contract or implementation, then rerun the affected serial check. Do not reapply the patch or claim completion.

## F10 — PARTIAL — 2026-11-02 16:32 UTC

Reuse inline viewing for the resized Digital artwork: verification incomplete.

Actual failing command: `node tests/v31-ui-browser.mjs`, exit 1. Output: `docs/validation/v3.1.1/F10/ui.txt`. Source changes remain uncommitted. Inspect the actual failure before repeating checks.

Exact next checkpoint: Resume F10: inspect docs/validation/v3.1.1/F10/ui.txt, correct the failing contract or implementation, then rerun the affected serial check. Do not reapply the patch or claim completion.

## F10 — PARTIAL — 2026-11-02 16:36 UTC

Reuse inline viewing for the resized Digital artwork: verification incomplete.

Actual failing command: `node tests/v31-ui-browser.mjs`, exit 1. Output: `docs/validation/v3.1.1/F10/ui.txt`. Source changes remain uncommitted. Inspect the actual failure before repeating checks.

Exact next checkpoint: Resume F10: inspect docs/validation/v3.1.1/F10/ui.txt, correct the failing contract or implementation, then rerun the affected serial check. Do not reapply the patch or claim completion.

## F10 — DONE — 2026-11-02 16:41 UTC

Reuse inline viewing for the resized Digital artwork.

Changed files: `src/pages.js`, `src/archive-structure.css`, `tests/v31-ui-browser.mjs`, `tests/digital-ink-browser.mjs`, `tests/v31-digital-payload-browser.mjs`, `tests/v31-digital-assets.test.js`.

Actual serial verification, before builds:

- `node tests/digital-ink-browser.mjs`: exit 0, 132.874s. Actual output: `docs/validation/v3.1.1/F10/browser.txt`.
- `node tests/v31-ui-browser.mjs`: exit 0, 179.838s. Actual output: `docs/validation/v3.1.1/F10/ui.txt`.
- `npm test`: exit 0, 3.676s. Actual output: `docs/validation/v3.1.1/F10/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F10`. No merge/deploy/build performed for this fix.

Exact next checkpoint: F11: finish shared4px photo corners while retaining effect exclusions. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F11 — DONE — 2026-11-02 16:42 UTC

Round photographs with the shared radius token.

Changed files: `src/gallery.css`, `tests/gallery-browser.mjs`, `src/artwork-transitions.css`.

Actual serial verification, before builds:

- `node tests/gallery-browser.mjs`: exit 0, 21.994s. Actual output: `docs/validation/v3.1.1/F11/browser.txt`.
- `npm test`: exit 0, 3.357s. Actual output: `docs/validation/v3.1.1/F11/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F11`. No merge/deploy/build performed for this fix.

Exact next checkpoint: F13: align route-link and branding hover feedback. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F13 — DONE — 2026-11-02 16:46 UTC

Unify route-link and branding hover feedback.

Changed files: `src/style.css`, `tests/v31-ui-browser.mjs`.

Actual serial verification, before builds:

- `node tests/v31-ui-browser.mjs`: exit 0, 182.584s. Actual output: `docs/validation/v3.1.1/F13/browser.txt`.
- `npm test`: exit 0, 3.651s. Actual output: `docs/validation/v3.1.1/F13/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F13`. No merge/deploy/build performed for this fix.

Exact next checkpoint: F14: floating header blend, actual palette and compositing checks. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F14 — PARTIAL — 2026-11-02 16:47 UTC

Invert floating headers against actual page content: verification incomplete.

Actual failing command: `node tests/v31-navigation-browser.mjs`, exit 1. Output: `docs/validation/v3.1.1/F14/browser.txt`. Source changes remain uncommitted. Inspect the actual failure before repeating checks.

Exact next checkpoint: Resume F14: inspect docs/validation/v3.1.1/F14/browser.txt, correct the failing contract or implementation, then rerun the affected serial check. Do not reapply the patch or claim completion.

## F14 — PARTIAL — 2026-11-02 16:58 UTC

Invert floating headers against actual page content: verification incomplete.

Actual failing command: `node tests/corruption-browser.mjs`, exit 1. Output: `docs/validation/v3.1.1/F14/corruption.txt`. Source changes remain uncommitted. Inspect the actual failure before repeating checks.

Exact next checkpoint: Resume F14: inspect docs/validation/v3.1.1/F14/corruption.txt, correct the failing contract or implementation, then rerun the affected serial check. Do not reapply the patch or claim completion.

## F14 — PARTIAL — 2026-11-02 17:05 UTC

Invert floating headers against actual page content: verification incomplete.

Actual failing command: `node tests/corruption-browser.mjs`, exit 1. Output: `docs/validation/v3.1.1/F14/corruption.txt`. Source changes remain uncommitted. Inspect the actual failure before repeating checks.

Exact next checkpoint: Resume F14: inspect docs/validation/v3.1.1/F14/corruption.txt, correct the failing contract or implementation, then rerun the affected serial check. Do not reapply the patch or claim completion.

## F14 — BLOCKED — 2026-11-02 17:11 UTC

Floating header inversion is implemented. Changed index.html, header-contrast.js/.css, global-navigation.js, ink/mobile placement, corruption/xray layering and existing navigation/corruption tests. Actual navigation/pixel/compositing suite6/6 passes at1440/390/320 full/reduced,333/4; no errors/overflow. Actual palette RGB samples and synthetic WebGL ABBA timings are in results.json; screenshots included. npm test363/363 PASS.

BLOCKED verification: actual Safari cannot run on Linux; Firefox is not installed. Actual mannequin remains unconfigured, so WebGL measurements are explicitly synthetic. The additional legacy corruption suite does NOT pass: recovered() expects the running/queued state to disappear, but its7000ms wait times out with the accepted persistent-memory renderer. Failed logs retained; no change to accepted mosh was made merely to satisfy this expectation. Do not report this suite as passing.

Exact next checkpoint: F15: apply entry-only4/triple3 proposal, verify sixprofiles serially and npmtest. F14 implementation/pixels are verified in Chromium, but cross-browser/real-mannequin and the legacy corruption recovery contract remain explicitly blocked. Continue F16 realroutes and new F17 returning-visitor line, then build/export; no launch.

## F17 approved history finding

`git log -S "you know your way around"` identifies introduction in4feb4bf and removal in daeaff8. The exact sentence was one entry in the old seven-stage visitor-message array, rendered in the footer. V3.1 retired that phrase system when introducing the numeric-only VISIT counter; this removed the sentence. The newly approved placement is above the hero logo, with a fixed single returning-visitor sentence, not revival of the seven-stage system.

## F15 — DONE — 2026-11-02 17:17 UTC

Make4 entry-only and require triple3 for return.

Changed files: `src/xray.js`, `src/mode-hold.js`, `tests/mode-hold.test.js`, `tests/xray-shortcut.test.js`, `tests/xray-browser.mjs`, `README.md`, `docs/CONTENT.md`, `docs/previews/README-WEBSITE-UPDATE.txt`, `tests/standalone-browser.mjs`, `tests/ref09-foundation-browser.mjs`, `tests/end-reveal-browser.mjs`, `tests/v6-browser.mjs`.

Actual serial verification, before builds:

- `node tests/xray-browser.mjs`: exit 0, not separately timeds. Actual output: `docs/validation/v3.1.1/F15/browser.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F15`. No merge/deploy/build performed for this fix.

Exact next checkpoint: F16: clickable Works heading and real category pages. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F16a — DONE — 2026-11-02 17:21 UTC

Make Works and category destinations real routes.

Changed files: `README.md`, `docs/CONTENT.md`, `docs/previews/README-WEBSITE-UPDATE.txt`, `src/app.js`, `src/connected-work.js`, `src/global-navigation.js`, `src/homepage.css`, `src/naavi-content.js`, `src/navigation.js`, `src/pages.js`, `src/routes.js`, `src/seo.js`, `tests/content.test.js`, `tests/helpers/v311-header-contrast.mjs`, `tests/navigation-prerender.test.js`, `tests/portfolio-browser.mjs`, `tests/routes.test.js`, `tests/seo-browser.mjs`, `tests/seo.test.js`, `tests/standalone-browser.mjs`.

Actual serial verification, before builds:

- `node tests/portfolio-browser.mjs`: exit 0, 181.363s. Actual output: `docs/validation/v3.1.1/F16/browser.txt`.
- `npm test`: exit 0, 3.435s. Actual output: `docs/validation/v3.1.1/F16/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F16`. No merge/deploy/build performed for this fix.

Exact next checkpoint: F17: restore returning-visitor recognition above the hero. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F16b — DONE — 2026-11-02 17:21 UTC

Make Works and category destinations real routes.

Changed files: `README.md`, `docs/CONTENT.md`, `docs/previews/README-WEBSITE-UPDATE.txt`, `src/app.js`, `src/connected-work.js`, `src/global-navigation.js`, `src/homepage.css`, `src/naavi-content.js`, `src/navigation.js`, `src/pages.js`, `src/routes.js`, `src/seo.js`, `tests/content.test.js`, `tests/helpers/v311-header-contrast.mjs`, `tests/navigation-prerender.test.js`, `tests/portfolio-browser.mjs`, `tests/routes.test.js`, `tests/seo-browser.mjs`, `tests/seo.test.js`, `tests/standalone-browser.mjs`.

Actual serial verification, before builds:

- `node tests/portfolio-browser.mjs`: exit 0, 181.363s. Actual output: `docs/validation/v3.1.1/F16/browser.txt`.
- `npm test`: exit 0, 3.435s. Actual output: `docs/validation/v3.1.1/F16/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F16`. No merge/deploy/build performed for this fix.

Exact next checkpoint: F17: restore returning-visitor recognition above the hero. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F17 — PARTIAL — 2026-11-02 17:21 UTC

Restore returning-visitor recognition above the hero: verification incomplete.

Actual failing command: `node tests/footer-v31-browser.mjs`, exit 1. Output: `docs/validation/v3.1.1/F17/browser.txt`. Source changes remain uncommitted. Inspect the actual failure before repeating checks.

Exact next checkpoint: Resume F17: inspect docs/validation/v3.1.1/F17/browser.txt, correct the failing contract or implementation, then rerun the affected serial check. Do not reapply the patch or claim completion.

## F17 — DONE — 2026-11-02 17:24 UTC

Restore returning-visitor recognition above the hero.

Changed files: `index.html`, `src/easter-eggs.js`, `src/easter-eggs.css`, `tests/footer-v31-browser.mjs`.

Actual serial verification, before builds:

- `node tests/footer-v31-browser.mjs`: exit 0, 133.653s. Actual output: `docs/validation/v3.1.1/F17/browser.txt`.
- `npm test`: exit 0, 3.518s. Actual output: `docs/validation/v3.1.1/F17/node.txt`.

Browser JSON and relevant screenshots: `docs/validation/v3.1.1/F17`. No merge/deploy/build performed for this fix.

Exact next checkpoint: Run production build and current preview/offline verification; preserve F14 validation blockers; no launch. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## WORLD SOUND v3 — DONE — 2026-11-05

Real-source 90 s loops and matched transitions. New commit on
`v3.2-world-sound` (no history rewrite); not pushed, merged or deployed.
Audio scope only; no V3.1 module, layout, mannequin or `api/inquiry.js` change.

Changed files: `.gitignore`, `docs/WORLD-SOUND.md`, `docs/validation/world-sound/measurements/`,
`docs/validation/world-sound/v3-build.json`, `docs/validation/world-sound/v3/`,
`public/assets/audio/{loop-333,loop-4,x-333-4,x-4-333}.m4a`,
`scripts/buildWorldSound.mjs`, `src/audio/worldSound.js`,
`src/audio/worldSoundSettings.js`, `src/mode-audio.js`,
`tests/{mode-audio-browser.mjs,mode-audio.test.js,world-audio-formats-browser.mjs,world-sound-browser.mjs,world-sound.test.js,world-sound-v3.test.js}`,
plus deletion of `tests/world-sound-v2.test.js`.

Actual serial verification:

- `npm test`: exit 0, **400 passed, 0 failed** (9.75 s). Output: `docs/validation/world-sound/v3/node-tests.txt`.
- `tests/world-audio-formats-browser.mjs`: PASS, 4/4 files at 3,969,000 / 39,690 frames, no audio-path long tasks.
- `tests/world-sound-browser.mjs`: PASS, 6/6 profiles at 1440/390/320 × full/reduced plus missing-file degradation.
- `tests/mode-audio-browser.mjs`: PASS.
- `tests/sound-controls-browser.mjs`: PASS, 8/8 profiles.
- `tests/smash-v31-browser.mjs`: PASS at 1440/390/320.
- `npm run build`: PASS; exactly four M4A in `dist`, hashes match (`docs/validation/world-sound/v3/build.txt`).
- `node scripts/buildWorldSound.mjs --validate`: `pass: true`.

Delivered: 5,680,943 B total. LUFS −18.0/−18.0/−18.0/−18.1; true peaks
−3.4/−6.3/−10.6/−9.3 dBFS. Transition files are 39,690 frames, read from the
900 ms visual config. Keys measure A minor (333) and F major (4), not F minor;
no pitch shift was guessed.

Exact next checkpoint: user listens to the four files in context. Then, only on
explicit request, push `v3.2-world-sound`, update PR #22, and merge after review.
No push/merge/deploy in this pass.

## WORLD SOUND PHASE 4 — GUIDED LISTENING CORE — 2026-11-05

Superseded by the completed Phase 4 entry below; the missing 4.3 b/c text was
supplied in the next pass. This entry records the 4.1–4.3a milestone. No play
button and no autoplay were added; SOUND remains the hard control.

Changed files: `src/audio/guided-listening.js` (new), `src/mode-audio.js`,
`src/audio/worldSound.js`, `src/xray.js`, `src/sound-controls.js`,
`src/sound-controls.css`, `tests/guided-listening-browser.mjs` (new),
`tests/world-sound.test.js`, `tests/mode-audio.test.js`,
`tests/mode-audio-browser.mjs`, `tests/world-sound-browser.mjs`,
`tests/memory-handoff.test.js`, `package.json`, `docs/WORLD-SOUND.md`.

Implemented contract:

- One lazy `AudioContext`; unlock on pointerdown/touchend/click/keydown, each
  `{ once, passive }`; synchronous `resume()`; one-sample silent prime.
- Unlock fetches and decodes nothing. A stored mute always wins; muted triggers
  unlock only.
- Stage 1 wordmark pointerdown fades the active loop over 1.8 s.
- Stage 2 desktop pointermove > 200 px after unlock, throttled 100 ms.
- Stage 3 first scroll that takes the hero out of view, throttled 120 ms.
- Stages fire once per session; activation reuses an existing loop voice.
- Failed visibility resume switches the SOUND control to “tap to resume”.
- One-time iOS hint: “hearing nothing? check the silent switch.” for ~6 s.

Actual verification:

- `npm test`: **402 passed, 0 failed**. Output:
  `docs/validation/world-sound/v3/phase4b/node-tests.txt`.
- `tests/guided-listening-browser.mjs`: **6/6 scenarios pass**. Output:
  `docs/validation/world-sound/v3/phase4b/guided-listening-browser.txt`.
- `world-audio-formats-browser`, `world-sound-browser`, `mode-audio-browser`,
  `sound-controls-browser`: pass.
- `smash-v31-browser`: the first combined serial run had one transient 390 px
  failure (“manual stop starts a real short fade”); the isolated rerun passed
  3/3. Recorded as a test timing flake, not reproduced.

Exact next checkpoint: user supplies the remainder of Phase 4 after “hearing
nothing”. Then implement 4.3 b/c and later items on this branch; no push, merge
or deploy.

## WORLD SOUND PHASE 4 — DONE — 2026-11-05

Completed 4.3 b/c/d, the 4.4 performance budgets and the 4.5 test set. The
Phase 4 brief is now complete from 4.1 through 4.5. Audio scope only; SOUND
remains the single hard control, with no play button and no autoplay.

Changed files: `src/mode-audio.js`, `src/sound-controls.js`,
`src/sound-controls.css`, `src/audio/guided-listening.js`,
`src/audio/worldSound.js`, `tests/audio-performance-browser.mjs` (new),
`tests/guided-listening-browser.mjs`, `tests/sound-controls-browser.mjs`,
`tests/mode-audio.test.js`, `tests/smash-v31-browser.mjs`, `package.json`,
`docs/WORLD-SOUND.md`, `NEXT_SESSION.md`.

Delivered:

- Three analyser-driven bars beside SOUND (`fftSize=32`, ≤30 reads/s),
  `aria-hidden`, fixed 16×10 px slot, 3 bars only.
- rAF and analyser disconnect synchronously on mute/suspend/hide; reduced motion
  shows a static active state with no rAF.
- SOUND text and accessible name are states: “sound on” / “sound off”.
- “tap to resume” only after a failed resume, keyboard reachable, cleared on
  success, no automatic retry spam while it stays failed.
- iOS hint shown once, persisted dismissal, no live region.
- Fade intent is created before async decode; the full 1.8 s fade starts on
  resolve with one source and no gap.
- Stage 3 now uses `IntersectionObserver`; no per-scroll layout reads.

Actual verification:

- `npm test`: **402 passed, 0 failed** (9.0 s).
- `tests/guided-listening-browser.mjs`: **8/8 scenarios**.
- `tests/audio-performance-browser.mjs`: PASS. Handler total 0.1 ms, startup
  0.1 ms, context construction 105.2–174.5 ms (platform, reported separately),
  analyser 16–20 reads/s, zero audio-only long tasks, zero indicator layout
  shifts, in-flight decode exactly one start.
- `sound-controls-browser`, `world-sound-browser`, `mode-audio-browser`,
  `world-audio-formats-browser`: pass.

Decoded PCM with one world resident is exactly **31,752,000 B**. Two full
333→4→333 round-trips measured heap deltas of **−21,206 B** (latest), **+74,834 B** and
**+144,786 B** (earlier runs) after forced GC, under the 2 MB budget. The outgoing loop buffer is
released after its fade; the next switch reloads it. No idle prefetch is issued.

Exact next checkpoint: user listening review of the four sounds in context.
Push/PR #22 stays untouched until explicitly requested.

## PHASE 4 VERIFICATION QUERIES — DONE — 2026-11-05

Resolved the five verification queries without adding new features.

1. Stage 2 removal: deleted the `pointermove` listener from
   `src/audio/guided-listening.js`. Grep across `src/audio`, `src/mode-audio.js`,
   `src/xray.js` and `src/sound-controls.js` returns no pointermove/mousemove
   listener. There is no dwell, idle or time-on-page audio trigger. The remaining
   entries are stage A (wordmark `pointerdown`) and stage B (`#selected-work`).
2. Stage B condition: `#selected-work` (the WORKS section), observed by
   `IntersectionObserver` with `threshold: [.25]` in
   `src/audio/guided-listening.js`. Fires once. The old hero-out condition
   (hero fully out of the viewport) is gone, together with its scroll fallback.
   The observer re-attaches on `h4:pagechange`, because `#selected-work` is
   re-created by `content.innerHTML = renderRoutePage(...)` on every route
   change; without the re-arm stage B died after home → work → home. Confirmed
   by a negative control: with the old single-shot observer the new browser
   scenario fails, with the re-arm it passes.
3. Heap: added outgoing-loop buffer eviction in
   `src/audio/worldSound.js`. After the crossfade stops an inactive loop, its
   `AudioBuffer` is dropped and the next switch re-fetches/re-decodes it.
   Measured with CDP `HeapProfiler.collectGarbage` +
   `performance.memory.usedJSHeapSize` before and after two full 333→4→333
   round-trips: **+48,214 B** in the final evidence run (earlier runs −21,206 B,
   +74,834 B and +144,786 B), all far inside the 2 MB budget. After the round-trips only the active loop is
   resident (`bufferDuration: 90`), the inactive loop is `idle` with
   `bufferDuration: 0`.
4. Accessibility: stable `aria-label="sound"` plus `aria-pressed` (`true` = on,
   `false` = off); visible text remains `sound on` / `sound off`. Resume state
   keeps the specific name `tap to resume sound`. Tests updated in
   `sound-controls-browser.mjs`, `guided-listening-browser.mjs`,
   `mode-audio-browser.mjs`, `audio-performance-browser.mjs`.
5. Docs: `docs/WORLD-SOUND.md` now states that 121–209 ms is localhost-only and
   that a real mobile cold visit adds the ~2.8 MB loop download, making ~3 s to
   first sound the realistic case. It also states that both baseline `a64f808`
   and the new timing runs used stage A (wordmark pointerdown), not SOUND ON.

Changed files: `src/audio/guided-listening.js`, `src/audio/worldSound.js`,
`src/mode-audio.js`, `src/sound-controls.js`, `index.html`,
`tests/world-sound.test.js`, `tests/guided-listening-browser.mjs`,
`tests/audio-performance-browser.mjs`, `tests/sound-controls-browser.mjs`,
`tests/mode-audio-browser.mjs`, `docs/WORLD-SOUND.md`, `NEXT_SESSION.md`.

Actual verification after the changes:

- `npm test`: **402 passed, 0 failed** (`phase4c/node-tests.txt`).
- `guided-listening-browser`: **9/9 scenarios**, including pointermove-inert,
  WORKS-25%-visible, touch WORKS visibility and the home → work → home re-arm.
- `audio-performance-browser`: PASS; handler 0.2 ms, startup 0.2 ms, context
  122.3 ms, round-trip heap delta +48,214 B, analyser 16 reads/s, 0 audio-only
  long tasks, 0 console errors.
- `world-audio-formats-browser`, `world-sound-browser` (6/6 profiles),
  `mode-audio-browser`, `sound-controls-browser` (8/8 profiles),
  `smash-v31-browser` (1440/390/320): pass.
- Production build: exactly four M4A with unchanged hashes
  (`phase4c/build.txt`). `public/images/optimized/*` was restored after the
  build and is not part of the commit.

### OBSERVATION (pre-existing, non-audio, not fixed here)

- `tests/smash-v31-browser.mjs` polls a 1.8 s gain attack with a 5 s
  `waitForFunction`. In the first back-to-back batch run it timed out at that
  poll; a standalone run and the second full serial batch both passed at
  1440/390/320. The assertion is load-sensitive, not a product defect. The file
  belongs to the V3.1 feature set and was left unchanged.

Exact next checkpoint: user listening review. No push, merge or deploy.

## RELEASE — PR #22 MERGED — 2026-11-05

Audio release step, no code changes in this pass (documentation only).

**Pre-flight.** Branch `v3.2-world-sound`, no staged files, no stashes.
Exactly four committed audio files (`loop-333.m4a`, `loop-4.m4a`,
`x-333-4.m4a`, `x-4-333.m4a`); the media diff against `main` contains only
those four. `masters/` is ignored (`.gitignore:159`). `npm test`: **402 passed,
0 failed**. The only untracked entry is `node_modules` (not ignored by
`.gitignore`; left untouched).

**Scope finding (flagged, not changed).** `origin/main` is an ancestor of the
branch, so the merge cannot drop main's work. The PR nevertheless carries 78
pre-audio commits (the whole V3.2 line), which is why `git diff --stat
origin/main...HEAD` shows 1601 files / +359,939 / −2,207 — about 1400 of them
are `docs/validation` evidence files. The audio pass itself (`origin/v3.2-world-sound..HEAD`,
5 commits) is confined to `src/audio/*`, `src/mode-audio.js`,
`src/sound-controls.*`, `src/xray.js`, `index.html`, `package.json`, scripts,
tests, docs and the four M4A. No V3.1 feature logic was edited during this pass.

**Return-switch re-decode (new measurement).** Because `releaseLoopBuffer()`
drops the outgoing PCM, every switch back re-fetches and decodes. Reference
desktop, headless Chromium 1440 px, warm HTTP cache, three round-trips:
`4 → 333` reaches audible in **126.6 / 142.2 / 168.4 ms** (decode 94–119 ms,
fetch 3–7 ms); `333 → 4` in 96–112 ms. Against the 900 ms transition window the
re-decode uses ~0.13–0.17 s. Slower devices can exceed the window, which would
produce an audible gap; idle prefetch stays off deliberately (memory over
latency — a second loop would pin another 31,752,000 B). Recorded in
`docs/WORLD-SOUND.md`; raw data `docs/validation/world-sound/v3/phase5/re-decode-warm-cache.json`.

**Push.** `17ae6e4` → `origin/v3.2-world-sound` (plain push, fast-forward from
`27315c6`). PR #22 head moved to `17ae6e4`; `f654e49` is its parent and is
contained. Mergeability at merge time: `MERGEABLE` / `CLEAN`, both status
checks `SUCCESS`.

**Merge.** `gh pr merge 22 --merge` — merge commit
`b5634bc5be4073c678672dd69f64810849cc157d` at 2026-11-05T19:31:46Z, parents
`9123a00` (main) and `17ae6e4`. No squash, no rebase, branch kept.

**Deployment.** Vercel status `success` on `b5634bc`
(`https://vercel.com/h333ndrik/h4ngelic/Gjp2nvfSU3aKBXD4bQK4sEqsmnyh`);
production reports build marker `b5634bc5be40`.

**Production asset verification** (`https://www.h4ngelic.com`; the apex 308s to
`www`): all four files `200`, `content-type: audio/mp4`, exact lengths
2,847,109 / 2,774,228 / 30,015 / 29,591 and SHA-256 identical to the committed
files. `cache-control: public, max-age=0, must-revalidate` — a finding, because
the files are not content-hashed, so they do not receive an immutable policy.

**Indexing.** Unchanged and still closed: `<meta name="robots" content="noindex, follow">`
and `robots.txt` `Disallow: /`.

**Rollback.** `git revert -m 1 b5634bc` and push; or promote the `9123a00`
deployment back to production in Vercel (previous deployments are retained).

**Next step.** User listening pass on production plus a real iPhone test
(silent switch, wordmark tap, activity bars, tap-to-resume after a call).
`v3.2-mannequin-female` stays out of scope and must be rebased onto the new
`main` before its next push.

## POST-MERGE — CONTENT-HASHED AUDIO URLS + IMMUTABLE CACHE — 2026-11-05

Audio scope only, new commit on `v3.2-world-sound` (not merged, not deployed).

**Approach (b), build step.** The four files are published as
`<name>.<sha256-first-12>.<ext>` and `src/audio/worldSoundManifest.js` is
generated from them. (a) was rejected because `import.meta.glob`/`?url` are
Vite-only: `worldSoundSettings.js` is imported directly by `node --test`, so the
settings module must stay plain ESM. Option (b) keeps one copy per file, keeps
the scripts able to read real paths, and leaves no stable name in `public/`.
`scripts/hash-world-audio.mjs` verifies each hash against its file, rejects
stable names and stray files, and runs in `predev` and `prebuild`
(`npm run sounds:hash`).

**Cache.** No immutable policy existed to inherit: on the live deployment both
`/assets/main-BVhm8sXt.js` (hashed) and `/assets/audio/loop-333.m4a` (stable)
returned `cache-control: public, max-age=0, must-revalidate`. `vercel.json` now
sets `public, max-age=31536000, immutable` for `/assets/audio/(.*)` only. The
rule is safe exactly because those names are content-hashed. It takes effect on
the next deployment; this pass does not deploy.

**Unchanged bytes.** All four SHA-256 values are identical to the ones recorded
before the rename: `d28de005…`, `ab235d05…`, `5ee49fed…`, `477df723…`. Frame
counts (3,969,000 / 39,690), LUFS (−18.0 / −18.1) and true peaks are untouched;
nothing was re-encoded.

**Old URLs.** `/assets/audio/<stable>.m4a` no longer exists. Production answers
a missing file under that path with `404` + `text/html` (checked with a probe
path), so an old client gets a 404, not a stale audio file.

**.gitignore.** `node_modules/` added, plus a bare `node_modules` line because
this worktree links `node_modules` to another checkout: git treats the symlink
as a file, so the trailing-slash rule alone does not match. Verified with
`git check-ignore -v node_modules` → `.gitignore:163:node_modules`. The literal
`git check-ignore -v node_modules/` form fails with "beyond a symbolic link",
which is a git limitation on symlinked paths, not a missing rule.

**Finding: stray duplicates.** The working tree contained byte-identical
`<name> 2.m4a` copies in `public/assets/audio/` (and ` 2` copies of many other
files). Those four were untracked duplicates of the committed audio and would
have been emitted into `dist/`; they were moved to `/tmp/h4ngelic-stray-audio/`
unchanged. The other ` 2` files are outside the build output and were left alone.

**Verification.** `npm test` 402/402. Browser suites: world-audio-formats,
world-sound (6/6 profiles), guided-listening (9/9), audio-performance,
mode-audio, sound-controls (8/8) — evidence in
`docs/validation/world-sound/v3/phase6/`. Build: exactly four files in
`dist/assets/audio/`, hashes matching the committed ones, no stable-name copies.
Payload: audio unchanged (2,847,109 B first loop); main bundle 216,273 B raw /
69,142 B gzip vs 216,289 / 69,073 on `fdd42f5`.
