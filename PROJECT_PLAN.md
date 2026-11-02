# V3.1.1 — active continuation plan

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
| F13 | TODO | Branding/routes share unified hover/focus, no special opacity/pills/background or layout shift. |
| F14 | TODO | Floating headers white-base difference/exclusion against actual page/ink/WebGL, correct isolation and readable active/hover/cursor; measured palette pixels/performance/screenshots. Chrome/Firefox/Safari availability must be reported honestly. |
| F15 | TODO | Hold4 enters only and has zero effect in4. Exactly three quick3 presses in~2s return; double3 does not. Hint exactly `press three times 3 to reverse`; mobile3tap equivalent and1400ms transition unchanged. |
| F16a | TODO | Make Home01/WORKS heading a real clickable route with unified hover. |
| F16b | TODO — clarified | User confirmed tattoos / jewellery / more become real category routes with large headers, direct-load/back navigation and unified hover. Preserve Home01/WORKS,02/ABOUT,03/CONTACT; Contact remains Home-only. Intent is resolved. |

There is no F12. TODO means not started; PARTIAL means code/verification underway; DONE requires actual current checks. REVIEW NEEDED is intent uncertainty, not a missing V3.1 feature.

## Execution order

F5 is the first unfinished task: implement one measured horizontal gap throughout Works branding → tattoos → jewellery → more. Branding-to-first and category-to-category gaps must match at1440/390/320px, without wrapping or changing the V3.1 baseline. Root owns the active serial navigation browser checks, Node tests and the separate F5 commit. After F5 continue F6,F7,F8,F10,F11,F13,F14,F15,F16, one fix per commit; preserve verified work and do not launch.

**One fix = one commit**, with checkpoint updates and real outputs. After each fix run affected existing browser suites **serially before builds**, at1440/390/320 × full/reduced, both333/4 where relevant. No browser parallelism or asset preparation/build while browser checks run. Preserve unaffected assertions; update only superseded contracts. Capture F1/F2/F9/F10/F14 screenshots and measure actual F4/F6/F14 frame/long-task/compositing costs. Report failures with their actual causes/evidence. Do not rerun the historical full100s SMASH observation for an unrelated CSS change.

## F9 configuration contract

Actual single source: `src/carouselSettings.js`, exported `carouselSettings` with JSDoc per field. Both prerender markup and runtime enhancement consume the same `carouselStyleProperties()` dimensions. Changing these values is sufficient after rebuild; no component edits needed. F9 verification status: **DONE**; see the actual outputs in PROJECT_PROGRESS.md.

| Field | Actual default | Meaning |
| --- | --- | --- |
| `cardWidth` |`300`| Resting card width in px; narrow screens cap it at the available page width. |
| `cardHeight` |`420`| Maximum resting photograph height; its original ratio is preserved. |
| `cardViewportInset` |`24`| Resting card clearance from either edge of a narrow viewport, in pixels. |
| `spacing` |`100`| Horizontal space between adjacent card slots, in pixels. |
| `inertia` |`0.05`| Fraction of velocity lost per 60Hz frame; larger values stop sooner. |
| `wheelSensitivity` |`8.0`| Wheel impulse strength, shared with the drag/touch momentum integrator. |
| `wrap` |`true`| Recycle the real cards seamlessly; no duplicate artwork or auto-scroll. |
| `hoverStraighten` |`true`| Lift the hovered card slightly, retaining the site's own scale/glow. |
| `neighborDisplacement` |`true`| Move immediate neighbours aside with transforms while a card is hovered. |
| `scrollCapture` |`'area'`| 'area' translates wheel only over the image strip; 'none' leaves it native. |
| `autoDrift` |`false`| Reserved for compatibility: ambient drift is deliberately unsupported. |
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

`autoDrift` and `pointerLabel` are explicitly reserved/unsupported compatibility fields: leave them false; enabling them does not introduce ambient motion or pointer labels. Shared hover scale/glow retain the site's existing unified settings. There is no idle animation loop, no Three.js/WebGL on Works, and the same inline expansion module is prepared for F10 reuse. All eight confirmed photographs use existing optimized assets/alt/lazy loading and preserve original bytes/appearance. Reduced motion uses instant state changes with no inertia.

## Preserved scope

Keep working chrome hero/physics, accepted memory-mosh, approved SMASH and1400ms transition. INDEX stays separate from NAAVI; Contact exclusively Home03/CONTACT. Cold Work/About must never download or initialize Three.js. Preserve uncommitted user/agent work and finish existing components.

Preserve all eight original JPEGs `public/images/tattoos/tattoo-01.jpg`…`tattoo-08.jpg` and approved MP3 byte-for-byte. Photo provenance: `docs/assets/tattoo-originals-v31.json`. MP3 SHA-256 `307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b`. The user has now explicitly confirmed all eight photographs remain in the carousel, resolving the continuation text’s old reference to five. No photo-count question remains open.

Do not modify H4 MOSH LAB, add dependencies, change main or `api/inquiry.js`, force-push, merge, close, deploy, launch, connect domains or enable analytics. Deferred WORLD/mannequin/Flowfield/Easter Eggs stay parked. Real moshlab URL, actual mail configuration/delivery and unpublished Loose Thread artwork are external inputs; do not invent substitutes. Actual Safari is unavailable on Linux; WebKit is not Safari. Record concrete installed-browser capabilities before claiming cross-browser success.


## Confirmed continuation answers — 2026-10-31

The user confirmed all **eight** supplied photographs remain in the carousel. Home stays **01 / WORKS, 02 / ABOUT, 03 / CONTACT**. The tattoos / jewellery / more rubric links must open their own real category pages; Contact remains exclusively on Home. F16 intent is resolved; this is TODO, not an unresolved review blocker. F1 was committed as `f57f759`. F9 was subsequently verified and committed as `36f574d`; the current first unfinished task is F5.

## Verified F4 performance limits

Current recorded evidence: `docs/validation/v3.1.1/F4/results.json` has six profiles at 1440/390/320px × full/reduced motion, each in 333/4; zero failures/console errors. All **12 Contact measurement windows recorded 0 LongTasks**. The full-motion 1440px Other Side window nevertheless recorded **RAF p95 566.5ms / max 616.7ms**; its observed entrance script maximum was **6.3ms** (forced style/layout 6.0ms). Full-motion 390px Normal recorded **RAF p95 216.7ms / max 316.6ms**. Entrance attribution was unavailable in 5/12 windows; zero observed attribution in other windows does not mean zero callback cost.

These are headlessChromium/SwiftShader software-renderer measurements, limited by the cloud hardware/rendering environment; they do **not** prove universally smooth motion or identify the entrance as the sole cause of slow frames. F4 verifies native uncancelled input, reversible poses and unchanged document height, not a guaranteed device frame rate. Preserve this measured limitation and continue F5; do not repeat verified F4 solely to obtain prettier numbers. F4 browser suite6/6 passed; recorded Node 363/363 passed (`node.txt`, 3167.274028ms); the shell-level 3.374s includes command overhead.

## F10 viewport decision — confirmed 2026-11-02

The user explicitly approved an additional responsive height cap in short browser windows. Keep the nominal60% original-width base, but reserve a visibly larger full-image view that fits the viewport. Report actual capped dimensions; do not claim a physical660px resting image in an844px-high window.
