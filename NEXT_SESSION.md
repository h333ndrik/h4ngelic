# Current checkpoint — WORLD SOUND COMPLETION

Updated 2026-11-04. Local branch `v3.2-world-sound`, based on `11e78a1`; never
pushed. The previous local commit was rewritten to remove the WAV masters from
branch history. Do not modify `main`, V3.1-owned modules or `api/inquiry.js`.

## Status

- Four committed runtime files only: two M4A loops and two M4A transitions.
  Local WAV masters and generated FLAC derivatives are not in Git.
- Payload: 17,129,180 → 2,087,514 bytes; 87.81% smaller.
- Exact browser-decoded frames: loops 1,365,677; transitions 61,740 in every
  generated format. M4A passed the seam law, so it is primary.
- Ordered fallback: M4A → FLAC → WAV. Decode acceptance checks 44.1 kHz, stereo
  and exact master frame count before use.
- `npm test`: **385/385**. Format browser test: **12/12** with no audio-path
  long tasks. World sound: **6/6** profiles plus degraded path. Mode audio,
  sound controls **8/8**, and SMASH at 1440/390/320 all pass. Build passes.
- Full design, hashes, payload comparison, decode evidence and user listening
  checklist: [WORLD-SOUND.md](docs/WORLD-SOUND.md).

## Merge path

1. PR #20 is merged at `origin/main` `9123a00` (confirmed 2026-11-04).
2. `git rebase origin/main` is complete: clean no-op, no conflicts.
3. Post-rebase serial tests and production build are green; evidence is in
   `docs/validation/world-sound/merge-pass/`.
4. `v3.2-world-sound` is pushed and
   [PR #22](https://github.com/h333ndrik/h4ngelic/pull/22) is open against `main`.
5. User reviews and merges; Vercel then deploys `main` automatically.

Nothing else merges with this branch. Do not merge without the user's explicit
request.

## Remaining checks / OBSERVATION

- **BLOCKED:** real iPhone Safari silent-switch, route, interruption and resume
  behavior. No iOS runtime/device is available.
- **BLOCKED at visual boundary:** a second user gesture during a visual mode
  transition is rejected by the unchanged visual controller. Audio retargeting
  itself is tested and smooth.
- **OBSERVATION:** the existing mobile no-cold-WebGL-on-About failure occurs on
  base `11e78a1` and this branch; do not fix it in the audio scope.
- Only M4A is deployed. FLAC/WAV fallback URLs are coded and tested but need
  those alternate files added to become available in production.
- Hero first-touch cue, ink impact mapping and THE OTHER SIDE ambience remain
  TODO.

Exact next checkpoint: user review and merge of PR #22. Do not merge from this
task. After the user merges and Vercel deploys, run the live listening checklist.

# V3.1.2 final review state

Updated 2026-11-03. Branch `v3.1.1-fixes`; F18–F27 are committed and pushed,
the final build prerenders 18 routes + 404, `npm test` is 373/373 and the
six-profile browser suites are green. The full fix-by-fix result, changed
assertions, real test outputs, performance numbers, screenshots and blockers
are in [the final report](docs/V3.1.2-FINAL-REPORT.md). Do not restart completed
work. Remaining blockers: real iPhone Safari (no device/iOS runtime), missing
V3–V6/V22 acceptance criteria, and F14's real cross-browser / mannequin /
legacy recovery checks. No merge or deployment.

---

# V3.1.2 — current continuation

Updated 2026-11-02. Work continues on `v3.1.1-fixes`; every commit is pushed to
`origin`. The recovered branch has F1-F17 DONE except F14's documented external
validation limits. V3.1.2 source reconciliation is in
`docs/V3.1.2-STATUS.md`; V3-V6 and V22 have no recovered acceptance criteria.

## V8 — DONE — hero poster

Critical head CSS now paints the static wordmark poster before application CSS
or WebGL. The source shell no longer hides the home hero for its first render.
The poster has no literal fallback text, crossfades to the first real WebGL
frame, and reduced motion retains the poster without importing `main.js` or
requesting scene assets. `src/data/heroPosterSettings.js` is the configuration
source; the Vite document plugin injects its values into first-paint CSS.

Verification:

- `npm test`: 369/369 PASS.
- `npm run test:hero-poster`: 6/6 profiles PASS, CLS below 0.01 in all animated
  profiles; screenshots and JSON in `docs/validation/v3.1.2/V8/`.
- Existing `tests/browser.mjs`: desktop, mobile, reduced-motion poster and WebGL
  fallback all PASS.
- No build, merge or deployment performed.

Exact next action: V21 + V24 rename the Home section to `01 / creative`, make
it static, and remove the `/work` landing route in favor of the category pages.

---

# Current review checkpoint — V3.1.1

All approved source fixes F1–F11,F13,F15–F17 are complete and verified. F14 implementation passes Chromium pixel/navigation tests, but its documented cross-browser/model/legacy-recovery checks remain BLOCKED. Build, SEO, short-window and exact-byte offline/packaging checks pass. See [review report](docs/V3.1.1-REVIEW.md). Do not restart completed work. Next: review this feature branch and resolve the documented F14 validation limits; no merge/deploy. Older next-step paragraphs below are historical checkpoints.

# V3.1.1 — exact continuation checkpoint

## Current committed checkpoint — 2026-11-02

At resume, `v3.1.1-fixes` was clean at **`7238478`**, five commits ahead of the merged baseline. Verified commits: F1 `f57f759`, F9 `36f574d`, F2 `3d01241`, F3 `7028dbc`, F4 `7238478`. Their evidence is committed under `docs/validation/v3.1.1/`. These fixes are DONE; do not restart their verified work without a relevant new change. The dynamic-count F9 follow-up is complete: unused five-pose helper removed, totals driven by actual projects/slides, Node coverage0/1/3/5/8/9 and all eight paths/alt/srcset verified.

F5 is the first unfinished task: implement one measured horizontal gap throughout Works branding → tattoos → jewellery → more. Branding-to-first and category-to-category gaps must match at1440/390/320px, without wrapping or changing the V3.1 baseline. Root owns the active serial navigation browser checks, Node tests and the separate F5 commit. After F5 continue F6,F7,F8,F10,F11,F13,F14,F15,F16, one fix per commit; preserve verified work and do not launch.

Updated 2026-11-02. Active branch **`v3.1.1-fixes`**, based on fetched main **`9123a00b21b9a7d3873fe97ba7c36fb90b74c3e5`**. PR #20 was merged by the user at 2026-10-30T11:41:11Z. This round does not reopen, edit, merge or deploy it. Merged V3.1 source and assets are present; no missing baseline prerequisite has been established.

Read the [original V3.1.1 fix round](docs/V3.1.1-FIX-ROUND.md) and the [latest continuation](docs/V3.1.1-CONTINUATION.md). The continuation overrides matching requirements and adds F16. Its prioritized F9 is now verified and committed; **F5 is the first unfinished task**. User clarification independently confirms F5 and F10 below. Previous checkpoints remain unchanged in [V3.1 history](docs/history/v3.1-checkpoint-2026-10-29).

Read all four root files and actual Git before work. F1/F9/F2/F3/F4 are committed; the clean resume HEAD was `7238478`. F5 is first unfinished. Never invent a future hash.

## First unfinished task

Run production build and current preview/offline verification; preserve F14 validation blockers; no launch. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

Latest recorded result: **F17 DONE**, 2026-11-02 17:24 UTC. Restore returning-visitor recognition above the hero; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F17.

## F1 — actual verification

Runtime: `src/global-navigation.css`, `.global-index-links` now `border:0; outline:0; box-shadow:none`, retaining `var(--surface-input)`, `var(--radius-soft)` and individual focus rules. No photo/mode/hero/audio runtime changed under F1. Harness: `tests/v31-navigation-browser.mjs` six profiles, actual panel contrast/screenshots and reduced native cursor expectation; `tests/v31-ui-browser.mjs` borderless panel expectation, evidence path and enlargement diagnostics.

- Navigation: `H4_BASE_URL=http://127.0.0.1:55173 H4_NAV_ARTIFACTS=artifacts/v311/F1/navigation node tests/v31-navigation-browser.mjs` — **6/6 PASS**, each profile333/4. `artifacts/v311/F1/navigation/results.json`: six reports, zero failures, all error lists empty. `/tmp/h4-v311-F1-navigation.log`. Panel `rgb(48,48,51)`,4px radius,0px border/outline, no filter/shadow. Actual inactive contrast7.447169:1, active13.155752:1. Focus/navigation/geometry/no overflow pass. Twelve `index-{1440,390,320}-{false,true}-{normal,xray}.png` panel screenshots.
- Broad UI fresh-server repeat: `H4_BASE_URL=http://127.0.0.1:55173 H4_UI_ARTIFACTS=artifacts/v311/F1/ui node tests/v31-ui-browser.mjs` — **6/6 PASS**, each profile333/4. `artifacts/v311/F1/ui/results.json`: six reports, zero failures, all errors/audio-request lists empty. `/tmp/h4-v311-F1-ui.log` records six PASS lines. This verifies baseline shared interaction/form/enlargement/hero/radius contracts, not future F9 changes.
- `npm test` — **357/357 PASS**, fail0/skipped0,3493.473929ms, `/tmp/h4-v311-F1-node.log`.
- Prior incomplete UI attempts remain failure history: first ratio1 vs1.1, retry mode timeout with13ERR_CONNECTION_REFUSED. Root found the dev server dead, restarted it and the full six-profile repeat passed. Do not label F9/F15 feature prerequisites BLOCKED or unresolved from those stale attempts. Preserve incomplete evidence separately from final passing output.

F1 was committed as `f57f759`; no V3.1.1 build/export is claimed by this documentation update. Root owns serial runs, commits and final artifacts.

## Remaining status

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

**One fix = one commit**, with checkpoint updates and real outputs. After each fix run affected existing browser suites **serially before builds**, at1440/390/320 × full/reduced, both333/4 where relevant. No browser parallelism or asset preparation/build while browser checks run. Preserve unaffected assertions; update only superseded contracts. Capture F1/F2/F9/F10/F14 screenshots and measure actual F4/F6/F14 frame/long-task/compositing costs. Report failures with their actual causes/evidence. Do not rerun the historical full100s SMASH observation for an unrelated CSS change.

## Scope and artifacts

Keep working chrome hero/physics, accepted memory-mosh, approved SMASH and1400ms transition. INDEX stays separate from NAAVI; Contact exclusively Home03/CONTACT. Cold Work/About must never download or initialize Three.js. Preserve uncommitted user/agent work and finish existing components.

Preserve all eight original JPEGs `public/images/tattoos/tattoo-01.jpg`…`tattoo-08.jpg` and approved MP3 byte-for-byte. Photo provenance: `docs/assets/tattoo-originals-v31.json`. MP3 SHA-256 `307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b`. The user has now explicitly confirmed all eight photographs remain in the carousel, resolving the continuation text’s old reference to five. No photo-count question remains open.

Do not modify H4 MOSH LAB, add dependencies, change main or `api/inquiry.js`, force-push, merge, close, deploy, launch, connect domains or enable analytics. Deferred WORLD/mannequin/Flowfield and other Easter Eggs stay parked; F17 returning-visitor recognition is now explicitly approved. Real moshlab URL, actual mail configuration/delivery and unpublished Loose Thread artwork are external inputs; do not invent substitutes. Actual Safari is unavailable on Linux; WebKit is not Safari. Record concrete installed-browser capabilities before claiming cross-browser success.

## Last verified downloadable preview

Checked-in `docs/previews/h4ngelic-preview.html` and `portfolio-preview.zip` are merged **V3.1**, not current V3.1.1. HTML24,484,734bytes, SHA-256 `6c11473dd0360a15c5e459ae8ee95deeffa3c34c01cad0ffe790bd5d734ce001`; ZIP17,305,532bytes, SHA-256 `61da29cabd658cb4fee3eb158e0b98dbc81bee65fb8f363ccef7c9abf5932770`. Export after serial browser work, then verify exact new bytes before review delivery.


## Confirmed continuation answers — 2026-10-31

The user confirmed all **eight** supplied photographs remain in the carousel. Home stays **01 / WORKS, 02 / ABOUT, 03 / CONTACT**. The tattoos / jewellery / more rubric links must open their own real category pages; Contact remains exclusively on Home. F16 intent is resolved; this is TODO, not an unresolved review blocker. F1 was committed as `f57f759`. F9 was subsequently verified and committed as `36f574d`; the current first unfinished task is F5.

## Verified F4 performance limits

Current recorded evidence: `docs/validation/v3.1.1/F4/results.json` has six profiles at 1440/390/320px × full/reduced motion, each in 333/4; zero failures/console errors. All **12 Contact measurement windows recorded 0 LongTasks**. The full-motion 1440px Other Side window nevertheless recorded **RAF p95 566.5ms / max 616.7ms**; its observed entrance script maximum was **6.3ms** (forced style/layout 6.0ms). Full-motion 390px Normal recorded **RAF p95 216.7ms / max 316.6ms**. Entrance attribution was unavailable in 5/12 windows; zero observed attribution in other windows does not mean zero callback cost.

These are headlessChromium/SwiftShader software-renderer measurements, limited by the cloud hardware/rendering environment; they do **not** prove universally smooth motion or identify the entrance as the sole cause of slow frames. F4 verifies native uncancelled input, reversible poses and unchanged document height, not a guaranteed device frame rate. Preserve this measured limitation and continue F5; do not repeat verified F4 solely to obtain prettier numbers. F4 browser suite6/6 passed; recorded Node 363/363 passed (`node.txt`, 3167.274028ms); the shell-level 3.374s includes command overhead.

## F10 viewport decision — confirmed 2026-11-02

The user explicitly approved an additional responsive height cap in short browser windows. Keep the nominal60% original-width base, but reserve a visibly larger full-image view that fits the viewport. Report actual capped dimensions; do not claim a physical660px resting image in an844px-high window.

## F17 approved history finding

`git log -S "you know your way around"` identifies introduction in4feb4bf and removal in daeaff8. The exact sentence was one entry in the old seven-stage visitor-message array, rendered in the footer. V3.1 retired that phrase system when introducing the numeric-only VISIT counter; this removed the sentence. The newly approved placement is above the hero logo, with a fixed single returning-visitor sentence, not revival of the seven-stage system.
