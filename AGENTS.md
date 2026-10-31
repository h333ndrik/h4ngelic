# h4ngelic continuation

Read PROJECT_PLAN.md, PROJECT_PROGRESS.md and NEXT_SESSION.md before editing; inspect actual Git/code and preserve unfinished work.

Updated 2026-10-31. Active branch **`v3.1.1-fixes`**, based on fetched main **`9123a00b21b9a7d3873fe97ba7c36fb90b74c3e5`**. PR #20 was merged by the user at 2026-10-30T11:41:11Z. This round does not reopen, edit, merge or deploy it. Merged V3.1 source and assets are present; no missing baseline prerequisite has been established.

Read the [original V3.1.1 fix round](docs/V3.1.1-FIX-ROUND.md) and the [latest continuation](docs/V3.1.1-CONTINUATION.md). The continuation overrides matching requirements, gives **F9 top priority**, and adds F16. User clarification independently confirms F5 and F10 below. Previous checkpoints remain unchanged in [V3.1 history](docs/history/v3.1-checkpoint-2026-10-29).

**One fix = one commit**, with checkpoint updates and real outputs. After each fix run affected existing browser suites **serially before builds**, at1440/390/320 × full/reduced, both333/4 where relevant. No browser parallelism or asset preparation/build while browser checks run. Preserve unaffected assertions; update only superseded contracts. Capture F1/F2/F9/F10/F14 screenshots and measure actual F4/F6/F14 frame/long-task/compositing costs. Report failures with their actual causes/evidence. Do not rerun the historical full100s SMASH observation for an unrelated CSS change.

Keep working chrome hero/physics, accepted memory-mosh, approved SMASH and1400ms transition. INDEX stays separate from NAAVI; Contact exclusively Home03/CONTACT. Cold Work/About must never download or initialize Three.js. Preserve uncommitted user/agent work and finish existing components.

Preserve all eight original JPEGs `public/images/tattoos/tattoo-01.jpg`…`tattoo-08.jpg` and approved MP3 byte-for-byte. Photo provenance: `docs/assets/tattoo-originals-v31.json`. MP3 SHA-256 `307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b`. The user has now explicitly confirmed all eight photographs remain in the carousel, resolving the continuation text’s old reference to five. No photo-count question remains open.

Do not modify H4 MOSH LAB, add dependencies, change main or `api/inquiry.js`, force-push, merge, close, deploy, launch, connect domains or enable analytics. Deferred WORLD/mannequin/Flowfield/Easter Eggs stay parked. Real moshlab URL, actual mail configuration/delivery and unpublished Loose Thread artwork are external inputs; do not invent substitutes. Actual Safari is unavailable on Linux; WebKit is not Safari. Record concrete installed-browser capabilities before claiming cross-browser success.

The latest F9 priority uses configurable input-driven horizontal momentum/wrap, no ambient loops, one shared inline expansion. F5 is one equal gap across the actual Works header row; F10 is60% of pre-V3.1 original width. F16 intent is confirmed: preserve Home01/WORKS,02/ABOUT,03/CONTACT and give tattoos / jewellery / more real category routes; F16 is TODO, not REVIEW NEEDED. Do not claim unverified work DONE.


## Confirmed continuation answers — 2026-10-31

The user confirmed all **eight** supplied photographs remain in the carousel. Home stays **01 / WORKS, 02 / ABOUT, 03 / CONTACT**. The tattoos / jewellery / more rubric links must open their own real category pages; Contact remains exclusively on Home. F16 intent is resolved; this is TODO, not an unresolved review blocker. F1 was committed as `f57f759`. F9 is the current priority under serial browser verification.

## F9 configuration contract

Actual single source: `src/carouselSettings.js`, exported `carouselSettings` with JSDoc per field. Both prerender markup and runtime enhancement consume the same `carouselStyleProperties()` dimensions. Changing these values is sufficient after rebuild; no component edits needed. F9 verification status: **DONE**; see actual outputs in PROJECT_PROGRESS.md.

| Field | Actual default | Meaning |
| --- | --- | --- |
| `cardWidth` |`300`| The ON SKIN / archive carousel's single editing surface. Pixel values are CSS pixels; changing this object is sufficient after the next rebuild. / export const carouselSettings = Object.freeze({ / Resting card width; narrow screens cap it at the available page width. |
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

## Current verified checkpoint

F9: **DONE** (2026-10-31 19:02 UTC). Carousel6 and UI6 pass in333/4; Node363/363; all8 actual photos, dynamic count, CLS0, no console errors or cold-Work Three.js.

Next: F2 is first unfinished: apply the prepared VISIT-left-cluster change, run existing footer browser6 profiles serially and npm test, save actual screenshots/results and commit F2 alone. Then continue F3/F4/F5/F6/F7/F8/F10/F11/F13/F14/F15/F16 in the user order. F9 is verified; do not rebuild or repeat it without a new relevant change. No launch.
