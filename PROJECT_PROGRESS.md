# V3 progress — verified state

Updated 2026-10-28. Current branch: `feat/smart-continuation-v3`, based on `3249099`. Read the [active plan](PROJECT_PLAN.md) and [complete V3 brief](docs/SMART-CONTINUATION-V3.md) alongside this evidence. Source changes are currently uncommitted; inspect actual Git status before continuing.

Historical foundation results remain in [the archived checkpoint](docs/history/foundation-checkpoint-2026-10-27/PROJECT_PROGRESS.md) and [MASTER-FOUNDATION.md](docs/MASTER-FOUNDATION.md). They do not prove new V3 behaviour. In particular, the previous exported HTML is not a tested V3 export.

## Current verification matrix

“Pending” means no current successful browser result has been recorded for that scope. Node checks do not establish desktop/mobile visual acceptance. The full suite now passes **348/348 Node tests**; browser work continues serially.

| ID | Status / actual verification | Relevant tests or evidence | Desktop | Mobile / tablet |
| --- | --- | --- | --- | --- |
| V3-01 | DONE: actual Git, code, assets, recent commits and all checkpoint files inspected; full brief preserved. | Audit from clean `3249099` base; current Git status/history | Not applicable | Not applicable |
| V3-02 | DONE: shared Contact helper, Home-only form, legacy context redirect and real history traversal verified. | Routes/content/SEO tests; `smart-v3.json` | 1440px PASS | 800/390/320px PASS |
| V3-03 | DONE: INDEX keyboard/outside/Escape/destination closure and separate NAAVI route/Contact tracking verified. | 36 focused Node checks; four integration profiles | 1440px PASS | 800/390/320px PASS |
| V3-04 | DONE: one floating brand/INDEX/NAAVI, bounds, touch areas and mobile blend fallback verified in both realities. Manual settled-menu inspection confirms readability over white headings/Other Side material. | `smart-v3.json`; integration/manual PNG captures | 1440px PASS | 800/390/320px PASS |
| V3-05 | DONE: Hero controls/layout and unchanged physics/rendering pass desktop, mobile, reduced motion and disabled-WebGL fallback. | `tests/browser.mjs`; integration4; 348 Node | PASS | PASS |
| V3-06 | DONE: Works headings scrub continuously/reversibly with stable layout and direct-focus visibility. | `artifacts/v3-work-motion/results.json`; four profiles | 1440px PASS | 768/390/320px PASS; 390px both modes |
| V3-07 | DONE for controller; real photos BLOCKED: native input and inline enlargement/restoration pass, preserving exact context. Initial focus-probe failure resolved without weakening real click/tap assertions. | `artifacts/native-carousel/results.json`; `/tmp/h4-v3-drift-final.log` | 1000px PASS | 390/320px PASS |
| V3-08 | DONE for retained About content/layout and Contact route; motion regression remains shared V3-06/10 scope. | Content/About Node tests; main integration | 1440px route PASS | 800/390/320px route PASS |
| V3-09 | DONE for available form behaviour: exact copy, simple fields, grid alignment, uploads, draft/context retention and entrance verified. Actual mail remains blocked. | 24 focused Node tests; loopback HTTP checks; six-profile `inquiry.json` | 1440px animated/reduced PASS | 390/320px animated/reduced PASS |
| V3-10 | DONE for approved current effects: bounded continuous Works motion, native inline gallery, restrained cursor/hover and final footer integration pass. | Works4/carousel3/gallery3/main4, Node contracts | PASS | PASS |
| V3-11 | DONE: real pixel displacement/no zoom/exact restoration and persistent memory regression pass. Configured1400ms; measured timing limits below. | snapshot JSON; memory4; Node40 | PASS | PASS at390/320 and reduced |
| V3-12 | DONE for available controller/UI: dedicated eight-profile sound suite verifies popup, keyboard/touch, persistence and no autoplay. Missing approved track is separate. | `artifacts/v3-sound-controls/results.json`; main integration; Node audio tests | 1440px animated/reduced PASS | 810/390/320px animated/reduced PASS |
| V3-13 | PARTIAL preparation; exact soundtrack BLOCKED. Disabled footer control and private local pipeline exist. | 18 focused audio/private HTTP tests, including actual temporary Vite loopback and bypass denials | Real approved-track playback blocked | Real approved-track playback blocked |
| V3-14 | DONE for existing approved cues: procedural mode sounds retained, controller/synthesis and UI tests pass; no new music or substitute soundtrack. | Audio Node tests and eight sound profiles | PASS for tested scope | PASS for tested scope |
| V3-15 | DONE: expanded final integration verifies every greeting fits, shared footer baseline and no NAAVI collision; accessible count description restored. | 8 focused Node; main4; manual320 PNG | PASS | PASS |
| V3-16 | PARTIAL: all current UI/hero/memory desktop/mobile checks pass; production/offline and current performance measurement remain. | form6/main4/carousel3/sound8/Works4/gallery3/snapshot/memory4/hero | Current UI PASS | Current UI PASS |
| V3-17 | PARTIAL: existing Easter Eggs retained; unpublished Loose Thread asset and SMASH file absent. | Node mode/ink/visit tests; current browser regression pending | Regression pending; missing assets blocked | Same |
| V3-18 | DONE for documented deferral; no deferred feature is claimed implemented. | Plan/full brief; final diff review still required | Not applicable | Not applicable |
| V3-19 | DONE for recorded no-launch constraint; no launch/merge performed. | Actual feature-branch workflow | Not applicable | Not applicable |
| V3-20 | PARTIAL: independent edits followed existing component boundaries; browser checks serialized. | Integration queue and changed-file review | Verification in progress | Verification in progress |
| V3-21 | DONE: existing controllers reused; read-only final review found one footer accessibility issue, now fixed/tested. No added dependencies or competing framework. | Diff review and focused footer tests | PASS | PASS |
| V3-22 | PARTIAL: Node/current browser suites pass; build, actual production routes, exact offline artifact and Lighthouse remain. | Recorded evidence below | Browser PASS; delivery pending | Browser PASS; delivery pending |
| V3-23 | PARTIAL: full brief, requirement tracker, preserved history and current checkpoint maintained. | Four root documents | Not applicable | Not applicable |
| V3-24 | DONE: continuation contract is durable; future work starts with actual Git/code reconciliation. | `AGENTS.md`, `NEXT_SESSION.md` | Not applicable | Not applicable |
| V3-25 | PARTIAL: approved unblocked work continues; completion not yet claimed. | Current checkpoint | Pending final checks | Pending final checks |

## Completed implementation and evidence

### Contact form

Changed `src/inquiry-content.js`, `src/inquiry.css`, `src/inquiry.js` and the focused inquiry tests. The form now uses the exact V3 message placeholder and **SEND MESSAGE**, removes the former privacy sentence and divider lines, uses one lighter field surface, and aligns with the Home About description. `refreshContext(url)` changes only artwork context and preserves entered text and attachments. Existing validation, uploads and 700ms entrance remain.

Verification:

- 24 focused Node tests passed.
- The loopback HTTP/provider mock returned the expected 202/403/502/415/429/503 states. This checks handling, not real email delivery.
- `H4_BASE_URL=http://127.0.0.1:55173 node tests/master-inquiry-browser.mjs` passed six profiles: 1440, 390 and 320px, each with normal and reduced motion. Evidence: `artifacts/smart-continuation-v3/inquiry.json`, checked at `2026-10-28T16:23:12.348Z`.

### Footer and local visitor logic

Changed `src/footer.js`, `src/easter-eggs.js/.css`, `src/data/easterSettings.js` and `tests/easter-eggs.test.js`. The counter is lowercase; the seven exact personalized stages include ranges 6–9 and 10+. Footer SMASH markup is disabled while the private file is unavailable. Eight focused Node tests and the first four main integration profiles passed. Subsequent manual 320px PNG review found an inherited `align-items: flex-end` override that staggered the footer links; root removed it and anchored long greetings to the mobile footer row. The expanded main suite now checks all seven phrase bounds and link baselines. Its rerun is active; do not mark the new footer styling verified until that result arrives.

### Navigation, motion, transition and audio preparation

Existing router, native-details INDEX, gallery, cached scroll pipeline, captured-page transition and mode-audio controller were extended. No replacement hero or competing animation framework was introduced. Focused Node results reported by the component owners: navigation 36/36; About/scroll/carousel/content 21/21; snapshot/material/memory 40/40; audio/private local HTTP 18/18. The broad Node run confirms **348/348 passing** after integration.

The private audio pipeline serves the exact filename only in local development, denies alternate private-file paths, and excludes the soundtrack from production builds and HTML exports. No approved MP3 is present, so real soundtrack listening/playback remains blocked. Controller tests do not prove the absent track was played.

## Integrated browser milestone

The main V3 harness passed all four profiles: desktop 1440px with normal motion, tablet 800px with reduced motion, phone 390px with normal motion and phone 320px with reduced motion. Evidence: `artifacts/smart-continuation-v3/smart-v3.json`, checked at `2026-10-28T16:32:53.484Z`; its failure list and every runtime-error list are empty.

Verified: native INDEX opening/keyboard/outside/Escape/destination closure, one floating brand and separate NAAVI, correct Work/About/Contact indices, cross-page Home Contact and browser history, legacy artwork-context redirect, no cold-interior Three.js or AudioContext, footer/visit semantics and geometry, compact hero controls without Reveal UI, volume popup placement/keyboard/outside/Escape, stored mute/volume without autoplay, and both 4/333 directions. Root also inspected the settled INDEX after 350ms over a white heading and the Other Side field; the menu remained readable.

The native carousel suite passed 1000/390/320px, including mouse drag, horizontal and Shift-wheel, touch swipe/pan, ordinary vertical release, proportional 1.1 in-place enlargement, neighbour bounds, second/outside/Escape restoration and exact scroll/order retention. Evidence: `artifacts/native-carousel/results.json` and `/tmp/h4-v3-drift-final.log`. Published Tattoo photos remain absent; the harness fixture is not portfolio content.

### Actual transition observations

Both captured directions report a **configured 1400ms animation duration**. This is not the total measured time from the keyboard gesture until cleanup. On software-rendered Chromium/SwiftShader, the main integration run observed:

| Profile | Enter Other Side | Return to Normal | Capture behaviour |
| --- | --- | --- | --- |
| 1440px normal motion | 9687ms | 4838ms | Native captured transition, target 1400ms |
| 390px normal motion | 3803ms | 2674ms | Native captured transition, target 1400ms |
| 800px reduced motion | 1373ms | 279ms | Animated capture bypassed |
| 320px reduced motion | 1200ms | 267ms | Animated capture bypassed |

Entry measurements include the required one-second key hold, preparation/capture and software-GPU work. Reverse measurements include the three-key gesture and cleanup. These are lab observations from the exact JSON, not field performance or proof of a 1.4-second wall-clock transition. The isolated snapshot suite below separates capture-only work from the full gesture/preparation path. Preserve this distinction and record the performance limitation honestly.

## Additional verified browser suites

- **Snapshot pixels/cleanup:** `artifacts/mode-snapshot/results.json`, measured at `2026-10-28T16:34:27.103Z`. With colour treatment disabled, 11629 bright glyph pixels moved outside the original mask, with 0 unexpected colours; the live page restored exactly. Captured styles remained `transform: none`, mobile width did not overflow, and maps/flags were cleaned up. Reduced motion bypassed capture.
- **Isolated native timing:** the captured animation target remained 1400ms. Desktop reverse completed in 1657ms; 390px entry/reverse in 1805/1967ms; 320px in 1461/1912ms. These measurements start at the isolated capture call, unlike the earlier full keyboard gesture-to-cleanup table. They are observed lab values, not a guaranteed 1.4-second total transition.
- **Sound controls:** `artifacts/v3-sound-controls/results.json` has eight passing profiles: 1440/810/390/320px, each normal/reduced motion. Popup geometry, volume/mute persistence, accessibility interactions and no autoplay/context creation passed with empty error lists. Actual approved SMASH playback remains blocked by the absent MP3.
- **Works motion:** `artifacts/v3-work-motion/results.json` reports PASS for 1440/768/390/320px, with 320px reduced and 390px checked in both realities. Motion is bounded, continuous and reversible; no layout shift, overflow or cold hero initialization was observed, and direct focus remains readable.
- **Ordinary Digital gallery:** `tests/gallery-browser.mjs` passed 1440/390/320px (`/tmp/h4-v3-gallery.log`). Proportional FLIP, transparent scrim, photo/outside/Escape closure, exact original geometry, reserved layout, controls and cleanup remain intact. This is the ordinary Digital viewer; carousel images use the separately verified inline branch.

## Failures and remaining integration queue

Resolved failures remain part of the evidence:

- The first broad Node run during active edits passed 333/335. Failures were a stale `renderContactPage` reference and the new sound-controls import in a data-URI fixture. Both were corrected; the latest `npm test` passes 348/348 (`/tmp/h4-v3-node-final.log`).
- The first native-carousel run failed horizontal-context preservation at 1000px (initially line 252). Its final keyboard probe used native `focus()`, which scrolled the carousel to reveal the focused item. Real click/tap checkpoints retained exact context. The probe now uses `focus({ preventScroll: true })`; strict actual-interaction assertions remain. The final three-profile run passes.

Current serial check: expanded main integration rerun after the narrow-screen footer correction, including all seven phrase bounds, link baselines and settled-menu captures. Then memory/hero regressions, production build/export, production routes, exact offline HTML, current performance measurement where available and matching package verification. No V3 HTML has yet been labelled tested or published.

## BLOCKED

- **V3-ASSET:** five distinct genuine tattoo photographs are missing; Flash and Analog also lack confirmed photos. Do not publish harness fixtures, copied reflection textures or stock images.
- **V3-MAIL:** actual delivery requires a Resend key, verified sender and hosted same-origin backend. No real message delivery has been verified.
- **V3-SMASH:** exact `h4ngelic_v8_full_sound_remaster_v11.mp3` is missing. Request the exact approved file. Do not remix, substitute, commit or export copyrighted audio.
- **V3-LOOSE-THREAD:** genuine unpublished artwork has not been provided. Do not fabricate it.

## REVIEW NEEDED

- Floating bounds/mobile fallback and manual menu readability checks pass. Keep the existing fallback and avoid speculative motion/compositing changes.
- Confirm mixed input and native carousel boundary behaviour on physical devices; browser emulation is not a physical-device claim.
- Actual V3 software-rendered transition gesture-to-cleanup times exceed the configured 1400ms animation target. See the measured table above; do not claim 1.4-second total latency. Review hardware performance without speculatively replacing the accepted pipeline.
- Prior Home 75/Work 99 Lighthouse scores were a previous SwiftShader measurement, not a V3 result. Do not present them as current evidence or change the accepted hero speculatively to chase them.

### Final footer verification and accessibility review

The expanded main integration suite passed again at 1440/800/390/320px after removing the old narrow-screen `align-items: flex-end` override. It verifies all seven greeting bounds, a shared footer-link baseline, no NAAVI collision and settled INDEX screenshots. Manual inspection of the new 320px footer confirms the alignment. Current evidence: `artifacts/smart-continuation-v3/smart-v3.json` and PNGs.

Read-only final code review found one confirmed accessibility issue: the visible visit count had lost its accessible description. `footer.js` now restores `footer-visit-count` and describes both the count and memory phrase; the focused footer test checks the relationship. No additional confirmed code regressions were found.

The first memory browser attempt used the removed `.page-nav` selector and timed out before route navigation. The harness now uses the real INDEX summary and Work link; pixel equality/buffer/seed assertions remain unchanged. The rerun and hero regression are in progress. This was a stale test selector, not evidence of a broken product link.

### Shared memory and hero regression completed

`npm run test:memory-mosh` passes four profiles (1000/390/320 active, 390 reduced): exact captured-byte handoff, two retained buffers, seed/source initialization unchanged through actual INDEX navigation and resize, fresh initialization only on new activation, zero cold-interior WebGL and no runtime errors. Evidence: `artifacts/v71/memory-browser-results.json`.

`npm run test:browser` passes desktop rendering/cursor/controls/pushing/drag/release momentum/smooth return, mobile native touch scrolling and drag cancellation, reduced-motion pause and accessible no-WebGL fallback. After removing Reveal clicks, the old 300ms initial rendering probe proved too short on SwiftShader; it now observes an actual advancing frame within a bounded10-second timeout. No hero rendering/physics implementation was changed to satisfy the probe.

Current UI source is ready for build/export verification. No production deployment or main merge. Final source commit/hash and generated-artifact checks follow only after they actually happen.
