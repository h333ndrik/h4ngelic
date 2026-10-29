# V3.1 progress — final build and artifact verification

Updated 2026-10-29. Branch: `feat/smart-continuation-v3` / PR #20. Starting verified V3 HEAD: `96820e5`. The branch was clean before this pass. Asset commit `f1841e4` now contains the eight originals and approved SMASH file; remaining V3.1 UI/test/documentation changes are still uncommitted. Preserve all partial edits. The broad Node suite now passes 357/357 and the navigation and footer browser suites each pass four profiles in both realities. The final broad Node rerun now passes 357/357 after the footer-focus, outline and carousel corrections. All approved functional-browser suites pass. No completed V3.1 UI commit, production build or new preview verification is claimed yet; source commit and production/artifact validation are next.

The [full brief](docs/V3.1-REFINEMENT.md) plus the user’s **eight-photo correction** define the active scope. The former V3 evidence is historical where V3.1 changes behaviour; it must not be presented as new verification. [PROJECT_PLAN.md](PROJECT_PLAN.md) tracks the complete requirements.

## Per-item status

“Implemented” below means the relevant source is present, not that browser acceptance is complete. Navigation and footer-related items now have current desktop/mobile browser evidence; other device checks remain pending until their own result is recorded.

| Item | Actual state / remaining work | Files | Tests recorded so far | Desktop | Mobile |
| --- | --- | --- | --- | --- | --- |
| 1 | DONE — Numbered INDEX destinations, native menu interaction and route/NAAVI consistency pass four profiles in both realities. | `index.html`, `global-navigation*`, `naavi-content.js` | 357/357 broad Node; navigation4, both modes; empty failures/runtime errors. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 2 | DONE — Shared 300ms glow/scale and target coverage pass in all six UI profiles, both realities, including reduced motion and actual photo interactions. No earlier MP3 request is introduced. | `ui-tokens.css`, `uiEffectSettings.js`, `interactions.js/.css`, component styles | UI6, both modes; empty failures/console/page-error lists and no early MP3 request. `artifacts/v31/ui/results.json`. | 1440 normal + reduced, both modes PASS | 390/320 normal + reduced, both modes PASS |
| 3 | DONE — All six cursor viewport sizes are reduced by 5%; NAAVI uses the primary h4 hover variant. Four browser profiles pass in both realities. | `public/assets/h4ngelic-cursor*.svg`, `cursor.css` | 357/357 broad Node; navigation4, both modes; empty failures/runtime errors. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 4 | DONE — Digits and separator share scoped contrast; form/small UI exclusions and footer docking pass. Hidden headings/children/ancestors release contrast immediately without hot geometry reads. | `global-navigation.js/.css`, `global-navigation-state.js`, footer styles | 357/357 broad Node; navigation4, both modes; empty failures/runtime errors. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 5 | DONE — Panel/input surface parity, white border, shared radius, focus and viewport bounds pass four profiles in both realities. | `global-navigation.css`, `ui-tokens.css`, `inquiry.css` | 357/357 broad Node; navigation4, both modes; empty failures/runtime errors. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 6 | DONE — Contact title and form share one calm bounded right-entry pose with exact reverse scroll and immediate reduced-motion presentation. All six motion profiles pass in both realities. | `scroll-choreography*`, `motionSettings.js`, `inquiry-entrance.js` | Motion6, both modes; empty failures/console/page-error lists; exact reverse and stable height. `artifacts/v31-motion/results.json`. | 1440 normal + reduced, both modes PASS | 390/320 normal + reduced, both modes PASS |
| 7a | DONE — Works parent headings use bounded simultaneous right-entry without rotation or overshoot; the numbered heading rise remains. All six motion profiles pass in both realities. | `scroll-choreography*`, `motionSettings.js` | Motion6, both modes; empty failures/console/page-error lists; exact reverse and stable height. `artifacts/v31-motion/results.json`. | 1440 normal + reduced, both modes PASS | 390/320 normal + reduced, both modes PASS |
| 7b | DONE — The measured category strip stays beside the floating brand and clear of INDEX, with reachable local scrolling and no page overflow at tested widths. | `global-navigation*`, `archive-structure.css`, `pages.js` | 357/357 broad Node; navigation4, both modes; empty failures/runtime errors. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 7c | DONE — Every archive subcategory shares its parent progress and pose, so labels never arrive later. All six motion profiles pass in both realities. | `scroll-choreography*`, `motionSettings.js` | Motion6, both modes; empty failures/console/page-error lists; exact reverse and stable height. `artifacts/v31-motion/results.json`. | 1440 normal + reduced, both modes PASS | 390/320 normal + reduced, both modes PASS |
| 7d | DONE — SMASH and Instagram now have matching typography, colour and arrows in four footer profiles and both realities. Playback remains separately tracked under item 16. | `footer.js`, `easter-eggs.css`, sound controller | Footer4, both modes; empty console/page-error lists; no page overflow. Evidence: `artifacts/v31-footer/results.json`. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 8 | DONE — Numbered page, category-link and sub-rubric sizes match shared reference tokens; responsive navigation/sticky geometry checks pass. | `ui-tokens.css`, `archive-structure.css`, navigation styles | 357/357 broad Node; navigation4, both modes; empty failures/runtime errors. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 9 | DONE — The old wide fly/stagger/rotation/echo runtime is retired; calm simultaneous Home Works/Contact motion and exact reversal pass, with stable compatibility exports. All six motion profiles pass in both realities. | `motionSettings.js`, `scroll-choreography.js/.css`, motion tests | Motion6, both modes; empty failures/console/page-error lists; exact reverse and stable height. `artifacts/v31-motion/results.json`. | 1440 normal + reduced, both modes PASS | 390/320 normal + reduced, both modes PASS |
| 10 | DONE — The form has one lighter field surface, exact max musterperson placeholder, labels above fields and stable dimensions on focus. All six UI profiles pass in both realities. | `inquiry-content.js`, `inquiry.css`, `ui-tokens.css` | UI6, both modes; empty failures/console/page-error lists and no early MP3 request. `artifacts/v31/ui/results.json`. | 1440 normal + reduced, both modes PASS | 390/320 normal + reduced, both modes PASS |
| 11 | PARTIAL — Archive/detail sizes and constrained responsive previews are implemented; component owner reported six focused Node passes. Actual transfer measurements remain. | `pages.js`, `image-assets.js`, `archive-structure.css`, Digital asset tests | Digital focused checks and 357/357 broad Node pass; actual transferred bytes pending. | Pending | Pending |
| 12 | DONE — The hidden right-cluster VISIT counter uses matching hint typography, reveals on hover/focus/tap without reflow, preserves its count across route changes and has no phrase stages. Four footer profiles pass in both realities. | `footer.js`, `easter-eggs.js/.css`, `easterSettings.js` | Footer4, both modes; empty console/page-error lists; no page overflow. Evidence: `artifacts/v31-footer/results.json`. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 13 | DONE — The accessible h4 moshlab arrow placeholder sits beside branding, remains reachable in narrow local scrollports and does not navigate or jump. Four footer profiles pass in both realities; the real URL remains TODO. | `footer.js`, `easter-eggs.js/.css`, interactions | Footer4, both modes; empty console/page-error lists; no page overflow. Evidence: `artifacts/v31-footer/results.json`. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 14a | DONE — Hero buttons and connected header/popup/range surfaces have no border or outline; genuine keyboard focus retains its underline. All six UI profiles pass in both realities. | `style.css`, `sound-controls.css`, interaction styles | UI6, both modes; empty failures/console/page-error lists and no early MP3 request. `artifacts/v31/ui/results.json`. | 1440 normal + reduced, both modes PASS | 390/320 normal + reduced, both modes PASS |
| 14b | DONE — Both hero bottom-bar halves fade together, become inert while hidden, restore on reverse and leave document height/pinning unchanged; reduced motion is instant. All six motion profiles pass in both realities. | `scroll-choreography.js/.css`, `homepage.css`, `motionSettings.js` | Motion6, both modes; empty failures/console/page-error lists; exact reverse and stable height. `artifacts/v31-motion/results.json`. | 1440 normal + reduced, both modes PASS | 390/320 normal + reduced, both modes PASS |
| 15 | DONE — All eight originals are committed unchanged in f1841e4 with Git blob SHA-256 values matching the supplied ZIP. The complete four-profile real-photo carousel and retained fixture stress/input suite now pass; all eight photographs are wired with original dimensions and neutral metadata. | `public/images/tattoos/`, `artworks.js`, `horizontal-drift.js`, `docs/assets/tattoo-originals-v31.json`, `CONTENT.md` | Eight committed JPEG hashes verified; 20 focused asset checks; carousel4 real photos in both modes plus retained fixture stress/input suite. `artifacts/v31/native-carousel/results.json`. | 1440 normal, both modes PASS | 390/320 normal +320 reduced, both modes PASS |
| 16 | DONE — The exact committed approved MP3 passes real playback at 1440/390/320: one deferred fetch/decode, cached restart, 1.8s attack, final 5s tail, approximately 1s manual stop, duck/restore, global mute/volume and route/reality continuity. Full unshortened natural end is observed at 1440px. | `public/audio/`, `mode-audio.js`, `modeAudioSettings.js`, `sound-controls*`, export/package scripts | Committed MP3 SHA verified; SMASH3 actual native playback/cache/fades/mode/route/global-state PASS, including one complete natural end. `artifacts/v31-smash/results.json`. | 1440 normal, both modes + full natural end PASS | 390/320 normal, both modes PASS; sound-controls reduced-motion coverage also passes. |
| 17 | DONE — Named UI surfaces use the shared 4px radius; all real photographs, Digital images and page/hero canvases keep square edges. All six UI profiles pass in both realities. | `ui-tokens.css`, form/navigation/controls/viewer/footer styles | UI6, both modes; empty failures/console/page-error lists and no early MP3 request. `artifacts/v31/ui/results.json`. | 1440 normal + reduced, both modes PASS | 390/320 normal + reduced, both modes PASS |

## Confirmed input recovery

### Tattoo photographs — eight originals available

The initial inline-chat images were not usable as original-byte files, so item 15 was initially blocked. That blocker is now resolved by `sediment://file_00000000c8dc81f49374162adacce007`, **New Folder With Items 2.zip**. The user explicitly requested all eight JPEGs rather than the first five.

All eight files are now present at `public/images/tattoos/tattoo-01.jpg` through `tattoo-08.jpg`. The manifest [tattoo-originals-v31.json](docs/assets/tattoo-originals-v31.json) records ZIP entry order, destination paths, byte counts, SHA-256 values, dimensions and orientation. ZIP SHA-256: `35046b97d44446a7d67bc60564780e5e84b5e91eebb77b7513be558c37c47782`. macOS resource-fork metadata is excluded. Do not re-encode/crop the originals or substitute resized chat images.

Item 15 is **DONE**: eight On Skin entries are implemented and all originals are committed in `f1841e4`. Root verified each committed JPEG’s SHA-256 against its original ZIP bytes. The focused asset/metadata checks pass (20 checks), including unique neutral fallback headings/SEO for untitled work, and the complete four-profile real-photo/input suite now passes. Do not redo asset recovery or integrity work.

### Approved SMASH file available

Exact supplied file: `public/audio/h4ngelic_v8_full_sound_remaster_v11.mp3`.

- Bytes: **3,210,973**.
- SHA-256: `307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b`.
- Duration: **100.310204 seconds**, from read-only ffprobe inspection.
- The user explicitly approved committing and embedding this exact version; the previous private-only rule is superseded.
- The file is committed in `f1841e4`; root verified its Git blob SHA-256 against the upload. All nine supplied binary originals (eight JPEGs plus MP3) match their sources.

The central controller now contains first-use fetch/decode caching, a 1.8s attack, final five-second tail and one-second manual stop, with sound-design priority and global mute/volume. The actual three-width SMASH browser suite now verifies these behaviours, including the complete native natural end at 1440px. Export/package code is prepared to embed and verify the supplied MP3 once for the offline preview. The served website must still defer network fetch until first use; offline embedding inherently includes the bytes in the downloaded file while decoding remains deferred.

## Existing implementation and test queue

The current source includes numbered INDEX entries, reduced cursor SVG viewports, cached NAAVI contrast/baseline logic, shared surface/type/hover/radius tokens, calm reversible motion, the revised footer/counter, smaller Digital previews and the central soundtrack controller. These are refinements of existing systems, not replacement components.

The final broad `npm test` passes **357/357** after all runtime corrections (`/tmp/h4-v31-node-final.log`, 3416.202864ms; zero failures/skips). The earlier passing run was recorded in `/tmp/h4-v31-node.log`. The initial broad attempt passed 347/352: stale V3 contracts and duplicated untitled metadata were corrected, and the final passing run is recorded rather than treating the failed attempt as success. Component-focused checks listed above are now supported by the broad pass. Prepared harnesses include `footer-v31-browser.mjs`, `v31-motion-browser.mjs`, `v31-digital-payload-browser.mjs` and `smash-v31-browser.mjs`; inspect their actual contracts before execution.

Preserved Digital baseline: `/tmp/h4-v31-before-digital-dist`. Keep it until actual before/after route transfer measurements are complete. Do not run asset preparation/builds during active browser checks; they may reload the development page.


### Navigation milestone — current browser evidence

`H4_BASE_URL=http://127.0.0.1:55173 node tests/v31-navigation-browser.mjs` passes four profiles: 1440, 390 and 320px with normal motion, plus 320px reduced motion. Each profile checks both 333 and 4. Evidence: `artifacts/v31-navigation/results.json` and `/tmp/h4-v31-navigation-final.log`; the failure list and all runtime-error lists are empty.

Verified items **1, 3, 4, 5, 7b and 8**: INDEX numbering/menu interaction, exact cursor sizing/NAAVI form, panel/input surface parity, matching typography, compact brand/category row, footer baseline and scoped contrast. The contrast tests prove that opacity changes on a heading, its child or an ancestor immediately release blending when invisible, and that the scroll path reuses cached geometry rather than measuring it again. Inquiry content has priority over nearby display type. These results do not mark the separate footer, motion or shared-UI suites complete.

PR #20 is currently **DRAFT** while V3.1 verification is in progress; it will be marked ready only after the remaining approved checks pass. No merge or deployment occurred.

### Footer milestone — current browser evidence

`H4_BASE_URL=http://127.0.0.1:55173 node tests/footer-v31-browser.mjs` passes four profiles: 1440/390/320px normal motion and 320px reduced motion, each in both 333 and 4. Evidence: `artifacts/v31-footer/results.json` and `/tmp/h4-v31-footer.log`. Console-error and page-error lists are empty; the document width equals its viewport in every profile.

Verified items **7d, 12 and 13**: SMASH/Instagram type and arrow parity, VISIT count formatting and phrase removal, identical hint typography, hover/focus/tap discovery without reflow, route persistence and the honest moshlab placeholder. Footer groups remain separate from centred NAAVI and have the same row baseline.

Two initial failures were investigated rather than recorded as success. The route assertion read a newly mounted default counter before asynchronous carousel enhancement and `h4:pagechange`; the harness now waits for route completion. Separately, native browser focus left a partially visible mobile link clipped. `src/easter-eggs.js` now exposes the full focused target by scrolling only its footer cluster. The passing rerun verifies the actual fix; there is no page-level horizontal scroll or vertical jump.

The first motion attempt also exposed a harness conversion bug: `Number('0.000px')` produced `NaN` when comparing the reverse pose. The harness now parses the CSS length correctly. The corrected full six-profile rerun now passes; the actual result is recorded below. The subsequent final 357/357 Node run covers these source corrections.

### Motion milestone — six profiles in both realities

`H4_BASE_URL=http://127.0.0.1:55173 node tests/v31-motion-browser.mjs` passes all six profiles: 1440/390/320px, each with normal and reduced motion, and each checking 333 and 4. Evidence: `artifacts/v31-motion/results.json` and `/tmp/h4-v31-motion.log`; all six error lists and the failure list are empty.

Verified items **6, 7a, 7c, 9 and 14b**: Contact title/form exact shared pose and reverse, calm simultaneous Home Works content, matching parent/subheading archive timing, absence of retired echo/one-shot markup, and both hero-bar halves fading/inert/restoring without height changes. A section-container focus cannot lock the reverse scrub, while real field focus reveals the form immediately. Reduced motion presents content at rest and switches the hero-bar state instantly.

A further attempted run hit `ERR_CONNECTION_REFUSED` after the previous context's dev server expired. Root restarted the same development server before the complete passing six-profile run. This connection failure was an environment lifecycle issue, not a successful motion test.

The first shared-UI attempt at 1440px found a computed resting input outline of 3px from the browser default. `src/inquiry.css` now explicitly resets the base outline to zero; the field retains its existing subtle focus treatment. The current UI milestone below records the complete passing rerun after the explicit resets. These visual outline resets do not change accepted motion geometry, so the completed motion suite need not be repeated.

### Shared UI milestone — six profiles in both realities

`H4_BASE_URL=http://127.0.0.1:55173 node tests/v31-ui-browser.mjs` passes all six profiles: 1440/390/320px, each with normal and reduced motion, each in 333 and 4. Evidence: `artifacts/v31/ui/results.json` and `/tmp/h4-v31-ui.log`. The failure list and all console/page-error lists are empty; no early MP3 requests occurred.

Verified items **2, 10, 14a and 17**: shared hover/timing and target coverage, form placeholder/single surface/labels/stable focus, borderless hero and sound surfaces with genuine keyboard underlines, and shared UI corner radius with square images/canvases. Actual eight-photo enlargement is 1.1 in place, opens no modal, retains the slot/order/scroll position and restores. The separate full carousel input/stress suite has since passed, as recorded below.

The initial computed browser outline issue is now explicitly reset in `src/inquiry.css`, hero buttons in `src/style.css`, and connected header/popup/input surfaces in `src/sound-controls.css`; existing keyboard underlines remain. Two harness comparisons were corrected without further source changes: range focus is tested by an actual Tab gesture, and photo restoration compares the same pointer-away baseline rather than a hovered image with a resting one. The passing rerun checks the resulting behaviour rather than inferring it from code.

Export packaging now also guards all eight original photograph hashes and once-only embedding, in addition to the approved soundtrack guard. Package execution itself remains pending.

### Carousel milestone — eight originals and retained stress checks

`H4_BASE_URL=http://127.0.0.1:55173 node tests/horizontal-drift-browser.mjs` passes four profiles: 1440/390/320px normal motion and 320px reduced motion. Evidence: `artifacts/v31/native-carousel/results.json`; its results array contains four successful records with empty error lists.

Item **15 is DONE** with the earlier committed-byte proof. Every profile checks all eight genuine photographs in 333 and 4: ZIP order, original dimensions and full-source URLs, lazy loading, contained original proportions, square corners, final-photo controls/count, keyboard/native input, exact in-place 1.1 enlargement and restored context without a modal. The retained six-photo multi-image fixture stress suite also passes all four profiles, covering horizontal/Shift-wheel, vertical release, partial mouse drag or native touch pan, exact inline restoration and teardown.

The real-photo test exposed and verified one runtime correction: `src/horizontal-drift.js` disables arrows against actual first/last centred targets rather than the rounded maximum, so fractional photo widths cannot leave the final arrow enabled without an advance. Harness setup also now uses optimized viewer URLs, a genuinely partial neighbouring photo and visible pointer coordinates for activation; this avoids Playwright locator auto-scrolling changing the context under test. No remaining carousel failure is claimed.

### Gallery, inquiry and sound-control regression milestones

- Existing gallery suite: **3/3 profiles PASS** at 1440/390/320px, `/tmp/h4-v31-gallery.log`. It retains proportionate transparent-viewer/FLIP transitions, keyboard/touch/Escape closing, decoding races, error-state checks, original geometry and cleanup.
- Inquiry: **6/6 profiles PASS** at 1440/390/320px × normal/reduced motion, `artifacts/v31/inquiry.json`. Labels/single surfaces/focus dimensions, free-form contact validation, real PDF fixture upload, draft/context retention, failed-response preservation and mocked success reset all pass. Failure and unexpected console/page-error lists are empty. One intentionally mocked HTTP 503 diagnostic per profile is recorded separately as expected; these controlled failures are not hidden or described as actual mail delivery. `liveEmailVerified` remains false.
- Sound controls: **8/8 profiles PASS** at 1440/810/390/320px × normal/reduced motion, `artifacts/v31-sound-controls/results.json`. Keyboard/Escape/touch popup interaction, persisted mute/volume, no startup AudioContext, no early MP3 requests and zero horizontal overflow pass; all error lists are empty.

The complete actual SMASH playback suite now passes all three widths, as recorded below. Browser-decoded duration is **100.270s**; the unchanged MP3 container duration from ffprobe remains **100.310204s** because decoder padding differs.

### SMASH milestone — exact original and complete native natural end

`H4_BASE_URL=http://127.0.0.1:55173 H4_SMASH_NATURAL_END=1 node tests/smash-v31-browser.mjs` passes **3/3 profiles**, 1440/390/320px. Evidence: `artifacts/v31-smash/results.json` and `/tmp/h4-v31-smash.log`; failures and every error list are empty, and every document width exactly matches its viewport.

Item **16 is DONE**. Every profile verifies the unchanged approved bytes, no startup fetch/AudioContext, one first-use fetch/decode with cached restart, native 1.8s attack/final five-second tail/approximately one-second manual stop, sound ducking/restoration, global mute/volume, route continuity and uninterrupted 333↔4 transitions. At 1440px the full **100.270s decoded original** runs to its natural end without seeking or shortening. Live gain falls during the final four seconds and final 0.6 seconds, reaches silence, restores the ordinary cue bus and allows the next mode cue. The ended-event observation lasts approximately 100.836 seconds including browser scheduling; it is not a shortened fixture.

All approved functional-browser work is now verified. The final `npm test` passes **357/357** at `/tmp/h4-v31-node-final.log` (3416.202864ms, no failures/skips), covering all runtime/source corrections. A source commit is next, before export, so the preview records the correct source hash. Only item 11 still needs its actual production before/after transfer measurement.

## TODO / external inputs

- Real `h4 moshlab` destination: TODO; approved accessible `#` placeholder remains.
- Real mail delivery: still unverified; do not infer provider/hosting configuration from the existing API adapter.
- Genuine unpublished Loose Thread content: still absent.

## Exact next checkpoint

Commit the current V3.1 source/test/generated-image/checkpoint changes on the same feature branch before exporting, so the artifact source hash is meaningful. Final `npm test` already passes 357/357 after all runtime corrections (`/tmp/h4-v31-node-final.log`, zero failures/skips). Do not repeat passing functional browser suites without a relevant new change.

Then run the production build/export; measure actual Digital before/after payloads at 1440/390/320 for archive/detail (six comparisons) using `/tmp/h4-v31-before-digital-dist`; verify all 19 production routes/404/no-JavaScript/cold-interior behaviour; verify the exact offline HTML and matching package, including the embedded original MP3 and eight JPEGs. Record actual measurements, file sizes and hashes. Only item 11 remains PARTIAL until its measured production comparison passes.

Commit the verified artifacts/evidence and final checkpoint, push the same `feat/smart-continuation-v3` branch, update PR #20 and mark it ready only after all checks pass. No merge, deployment, main, API or dependency changes. The previous V3 HTML remains the last verified preview until the new V3.1 artifact passes its own offline/package checks.
