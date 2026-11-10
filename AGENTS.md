# Active continuation — V3.1.2

The active brief is `docs/V3.1.2-CONTINUATION.md`; actual state is reconciled in
`docs/V3.1.2-STATUS.md`. V8 is DONE. Continue V9 onward in order, one fix per
commit, and push every commit to `origin/v3.1.1-fixes`. Do not rebuild verified
F1-F17 work. V3-V6 and V22 lack recovered requirements and are a documented
specification blocker, not guessed scope. Do not merge or deploy.

# Current review checkpoint — V3.1.1

All approved source fixes F1–F11,F13,F15–F17 are complete and verified. F14 implementation passes Chromium pixel/navigation tests, but its documented cross-browser/model/legacy-recovery checks remain BLOCKED. Build, SEO, short-window and exact-byte offline/packaging checks pass. See [review report](docs/V3.1.1-REVIEW.md). Do not restart completed work. Next: review this feature branch and resolve the documented F14 validation limits; no merge/deploy. Older next-step paragraphs below are historical checkpoints.

# WORKFLOW-KONVENTIONEN (V3.1.2-RELEASE-ZYKLUS)

These conventions apply to every future fix, feature and review. They supplement
the existing rules above and below; they do not remove the serial browser
requirement, the no-merge-without-explicit-approval rule, cold-route rules or any
other safety constraint. If a rule appears to conflict, the stricter rule wins
until the user resolves it explicitly.

### 1. TEST-BUDGETS / SCHNELLMODUS

Mini-fixes use **Fast Mode**: run the complete `npm test` plus only the directly
affected browser suites and any new or changed test file. Each Fast Mode commit
and report must say:

```text
TESTMODE: fast — full battery pending at merge gate
```

Fast Mode never replaces the merge gate. If scope is uncertain, use Full Mode.

### 2. MERGE-GATE

Before every merge to `main`, run the complete serial browser battery at 1440,
390 and 320 px in both full and reduced motion, plus the build and the SEO,
route and performance guards. The battery runs serially, not in parallel. A
merge still requires the user's explicit `merge` or `go`; without it, the
standing no-merge rule remains in force.

The merge battery also runs `tests/typography-contract.mjs`,
`tests/link-glyph-contract.mjs` and `tests/tokens-audit.mjs` against the
production preview. Each has a 60-second runtime budget and a token-audit finding
blocks the gate until it is fixed or explicitly accepted by the user.

### 3. KLASSIFIZIERUNG

- **FAST:** CSS, copy, a single component, or test-only adjustments.
- **VOLL:** interaction, physics, Three.js, build-pipeline, router or mode logic.
- **Uncertain:** classify as VOLL.

The classification belongs in the commit or report together with the test mode.

### 4. PHASE 0 — REPRODUKTION VOR FIXING

Reproduce every bug before changing code. Use a scenario matrix covering
network-throttled, normal, blocked-asset and empty-cache conditions on both the
dev server and the production build. Capture screenshots or a trace that shows
the failing state. No fix without a documented reproduction; if a condition
cannot be exercised, mark it **NICHT PRÜFBAR** and explain why.

### 5. HIT-TEST STATT SELECTOR-AUDIT

Cursor and pointer bugs are verified with `tests/cursor-hit-test.mjs`: a 24 px
raster over the viewport, `elementsFromPoint` at each sample, and the assertion
that the topmost element whose `pointer-events` is not `none` always has the
logo cursor. Run it against the production build, not only dev. Selector-list
audits are supporting evidence, never the acceptance proof.

### 6. BLANKET-REGELN STATT EINZELFÄLLE

Kill failure classes structurally instead of patching examples. A blanket rule
must be emitted late enough to win, and every allowlist must be explicit and
documented. The cursor contract is the reference: the final
`html.h4-custom-cursor * { cursor: none !important; }` covers the class, while
`[data-cursor="xray"]` is the only named exception. **Fix the class, not the
case.**

### 7. BUILD-MARKER

Begin every verification by confirming `document.documentElement.dataset.build`
or `<meta name="h4-build">`. Vercel previews are SSO-blocked, so production
verification uses a locally served production preview plus `dist` inspection and
`grep`. Record the exact SHA; do not describe a different build as verified.

### 8. PRÄVENTIONSTEST PRO FIX

Every fixed bug receives a suite or assertion that proves exactly that failure
class. Reuse the established guards where they fit, such as
`tests/cursor-hit-test.mjs`, `tests/hero-boot-browser.mjs`, the greeting contract
and the hero-entrance contract. A screenshot alone is not a prevention test.

### 9. FAIL-SAFE-NACHWEIS

Demonstrate the fallback, not only the happy path: no JavaScript keeps system
cursors, navigation and error paths survive hero boot failure, and reduced motion
uses the instant or static endpoint. Record the observed fallback state with the
same build marker as the main verification.

### 10. COMMIT-TRENNUNG

Keep implementation commits separate from test-only reconciliations. Isolate test
drift against a clean HEAD, state which commits are tests only, and document any
contract adjustment. Do not hide a behavior change inside a mass test edit.

### 11. ROLLBACK-PFAD

Before every merge, document rollback: `git revert -m 1 <merge-sha>` on `main`
and promotion of the previous READY Vercel deployment. The merge-gate chat must
contain the judgment, the commits that will land, and this rollback plan. Merging
is allowed only after the user replies explicitly `merge` or `go`; never
force-push.

### 12. EVIDENZ-KONVENTION

Store evidence per fix under `docs/validation/<SCOPE>/`: screenshots at 1440, 390
and 320 px, relevant grep or `dist` output, and measurement JSON. Add a three-line
addendum to `docs/validation/v3.1.2/F-STACK-VERIFICATION.md` in the form
**Befund → Fix → Beweis**. Never invent measurements; mark anything not actually
exercised as **NICHT PRÜFBAR**.

### 13. BEFUND-FORMAT FÜR USER-MELDUNGEN

When a user reports a problem, first establish and repeat back: (a) the
`data-build` SHA, (b) the page and element, and (c) expected versus observed
behavior with a screenshot. If any of these is missing, request it before
claiming a fix or verification.

# RETIRED SUITES

A suite whose contract was deliberately removed never stays red in the gate.
Two exits only:

1. **Retired** — move it to `tests/legacy/`, remove its npm script, and add a row
   to `tests/legacy/README.md` naming the removed contract and the commit that
   removed it, plus the suites that cover the live behaviour today.
2. **Updated** — lift it to the current contract; it must then be green.

Currently retired (GATEPREP-2, Batch 3): `scroll-browser`, `easter-browser`,
`smart-v3-browser`, `ref09-layout-browser`. Also retired (V3.2 final gate,
05.11.): `hero-ink-browser`, `hero-background-browser` — both waited for
`#stage.is-ready` under reduced motion, a state the poster contract removed —
and `artwork-transitions-browser` — it drives `<a data-artwork-link>` tiles that
no route renders since B-013/B-014.
Reasons and live coverage: `tests/legacy/README.md` (plus one README per
suite), table in `docs/validation/GATEPREP-2/GATE-REPORT.md`.

# DEFINITION OF DONE (PER FIX)

A fix is not complete because the happy path looks right. Every fix must satisfy
all five checks below. The Fast Mode and merge-gate rules remain unchanged; this
checklist adds evidence requirements, not a shortcut.

- [ ] **Phase 0 evidence:** the finding was reproduced with a trace or screenshot,
  or a regression test was shown red before implementation.
- [ ] **Central source:** the implementation changes the token, template,
  formatter or shared component that owns the behavior, not one visible instance.
- [ ] **Prevention proof:** a named suite or assertion covers the failure class and
  would fail without this fix.
- [ ] **Registry updated:** the matching row in `docs/validation/BEFUNDE.md`
  records status, fix commit and evidence path.
- [ ] **User check:** the evidence README contains two or three concrete
  “so prüfst du es” steps using the visible page or browser console.
- [ ] **Geometry is measured:** every claim about “flush”, “equal spacing” or
  “same height” needs baseline and gap measurements in the evidence folder.
  Screenshots without numbers do not count. Layout relationships (alignment,
  spacing, row rhythm) are proven with `tests/row-geometry-contract.mjs` and a
  row entry in `tests/rows.manifest.json`, not with a single changed number.

Evidence follows [GALLERY-CONVENTION.md](docs/validation/GALLERY-CONVENTION.md)
for new fixes. A fix cannot be marked `verified-by-user` until the user explicitly
confirms it.

# MERGE-QUEUE / RELEASE TRAIN

Only one undeployed release train may be active at a time. Never stack a second
train or advertise a merge order after starting a merge. The current queue is
listed here so the next run does not infer it from branch names:

Landed on `main` (2026-11-06): PR #22 V3.2 world sound; `v3.1.1-fixes`
(merge `d550824`); `mail-02-reply-to` (merge `7f733f0`: Reply-To for bare
addresses and the `Name <address>` autofill form).
Landed on `main` (2026-11-10): `b-f19-f31` (merge `adb8222`: mobile parity,
blanket cursor contract, the three gate bugs `88f4657`/`a2cfbab`/`25e3ed7`).

1. **`mail-01-diagnostics` — open, next.** Synced with `origin/main` on
   2026-11-10 (`7f96eb2`, merge, not rebase; conflicts in `server/inquiry.mjs`
   and `tests/inquiry-http.mjs` resolved by keeping both sides). `npm test`
   452/451 pass/1 skipped, `tests/inquiry-http.mjs` green, `npm run build`
   23 routes + 404. It touches no website code, so the `adb8222` browser
   battery carries over; still open before merge: the production inquiry/mail
   smoke (at most 3 real sends, 502 → evaluate `resend_rejected` /
   `resend_unreachable`), which needs a deployed preview with the Resend env.
2. **`gate-registry-sync` — open, docs/test only.** `docs/validation/BEFUNDE.md`
   rows for B-F40, G1, G2 and the first-mute-press prevention test
   (`tests/mobile-parity-browser.mjs`). No product code. Merge after
   `mail-01-diagnostics`.

The merge-gate statement must show the queue order, the exact commits entering
the train, test totals and the rollback path. Post-merge smoke: verify the core
routes and the injected `data-build`; the final train additionally verifies the
mail path. Merging and deployment still require the user's explicit `merge` or
`go`, and force-push is never allowed.

# h4ngelic continuation

## Current committed checkpoint — 2026-11-02

At resume, `v3.1.1-fixes` was clean at **`7238478`**, five commits ahead of the merged baseline. Verified commits: F1 `f57f759`, F9 `36f574d`, F2 `3d01241`, F3 `7028dbc`, F4 `7238478`. Their evidence is committed under `docs/validation/v3.1.1/`. These fixes are DONE; do not restart their verified work without a relevant new change. The dynamic-count F9 follow-up is complete: unused five-pose helper removed, totals driven by actual projects/slides, Node coverage0/1/3/5/8/9 and all eight paths/alt/srcset verified.

F5 is the first unfinished task: implement one measured horizontal gap throughout Works branding → tattoos → jewellery → more. Branding-to-first and category-to-category gaps must match at1440/390/320px, without wrapping or changing the V3.1 baseline. Root owns the active serial navigation browser checks, Node tests and the separate F5 commit. After F5 continue F6,F7,F8,F10,F11,F13,F14,F15,F16, one fix per commit; preserve verified work and do not launch.

Read PROJECT_PLAN.md, PROJECT_PROGRESS.md and NEXT_SESSION.md before editing; inspect actual Git/code and preserve unfinished work.

Updated 2026-11-02. Active branch **`v3.1.1-fixes`**, based on fetched main **`9123a00b21b9a7d3873fe97ba7c36fb90b74c3e5`**. PR #20 was merged by the user at 2026-10-30T11:41:11Z. This round does not reopen, edit, merge or deploy it. Merged V3.1 source and assets are present; no missing baseline prerequisite has been established.

Read the [original V3.1.1 fix round](docs/V3.1.1-FIX-ROUND.md) and the [latest continuation](docs/V3.1.1-CONTINUATION.md). The continuation overrides matching requirements and adds F16. Its prioritized F9 is now verified and committed; **F5 is the first unfinished task**. User clarification independently confirms F5 and F10 below. Previous checkpoints remain unchanged in [V3.1 history](docs/history/v3.1-checkpoint-2026-10-29).

**One fix = one commit**, with checkpoint updates and real outputs. After each fix run affected existing browser suites **serially before builds**, at1440/390/320 × full/reduced, both333/4 where relevant. No browser parallelism or asset preparation/build while browser checks run. Preserve unaffected assertions; update only superseded contracts. Capture F1/F2/F9/F10/F14 screenshots and measure actual F4/F6/F14 frame/long-task/compositing costs. Report failures with their actual causes/evidence. Do not rerun the historical full100s SMASH observation for an unrelated CSS change.

Keep working chrome hero/physics, accepted memory-mosh, approved SMASH and1400ms transition. INDEX stays separate from NAAVI; Contact exclusively Home03/CONTACT. Cold Work/About must never download or initialize Three.js. Preserve uncommitted user/agent work and finish existing components.

Preserve all eight original JPEGs `public/images/tattoos/tattoo-01.jpg`…`tattoo-08.jpg` and approved MP3 byte-for-byte. Photo provenance: `docs/assets/tattoo-originals-v31.json`. MP3 SHA-256 `307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b`. The user has now explicitly confirmed all eight photographs remain in the carousel, resolving the continuation text’s old reference to five. No photo-count question remains open.

Do not modify H4 MOSH LAB, add dependencies, change main or `api/inquiry.js`, force-push, merge, close, deploy, launch, connect domains or enable analytics. Deferred WORLD/mannequin/Flowfield and other Easter Eggs stay parked; F17 returning-visitor recognition is now explicitly approved. Real moshlab URL, actual mail configuration/delivery and unpublished Loose Thread artwork are external inputs; do not invent substitutes. Actual Safari is unavailable on Linux; WebKit is not Safari. Record concrete installed-browser capabilities before claiming cross-browser success.

Completed F9 uses configurable input-driven horizontal momentum/wrap, no ambient loops and one shared inline expansion. F5 is one equal gap across the actual Works header row; F10 is60% of pre-V3.1 original width. F16 intent is confirmed: preserve Home01/WORKS,02/ABOUT,03/CONTACT and give tattoos / jewellery / more real category routes; F16 is TODO, not REVIEW NEEDED. Do not claim unverified work DONE.


## Confirmed continuation answers — 2026-10-31

The user confirmed all **eight** supplied photographs remain in the carousel. Home stays **01 / WORKS, 02 / ABOUT, 03 / CONTACT**. The tattoos / jewellery / more rubric links must open their own real category pages; Contact remains exclusively on Home. F16 intent is resolved; this is TODO, not an unresolved review blocker. F1 was committed as `f57f759`. F9 was subsequently verified and committed as `36f574d`; the current first unfinished task is F5.

## F9 configuration contract

Actual single source: `src/carouselSettings.js`, exported `carouselSettings` with JSDoc per field. Both prerender markup and runtime enhancement consume the same `carouselStyleProperties()` dimensions. Changing these values is sufficient after rebuild; no component edits needed. F9 verification status: **DONE**; see actual outputs in PROJECT_PROGRESS.md.

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

## Verified F4 performance limits

Current recorded evidence: `docs/validation/v3.1.1/F4/results.json` has six profiles at 1440/390/320px × full/reduced motion, each in 333/4; zero failures/console errors. All **12 Contact measurement windows recorded 0 LongTasks**. The full-motion 1440px Other Side window nevertheless recorded **RAF p95 566.5ms / max 616.7ms**; its observed entrance script maximum was **6.3ms** (forced style/layout 6.0ms). Full-motion 390px Normal recorded **RAF p95 216.7ms / max 316.6ms**. Entrance attribution was unavailable in 5/12 windows; zero observed attribution in other windows does not mean zero callback cost.

These are headlessChromium/SwiftShader software-renderer measurements, limited by the cloud hardware/rendering environment; they do **not** prove universally smooth motion or identify the entrance as the sole cause of slow frames. F4 verifies native uncancelled input, reversible poses and unchanged document height, not a guaranteed device frame rate. Preserve this measured limitation and continue F5; do not repeat verified F4 solely to obtain prettier numbers. F4 browser suite6/6 passed; recorded Node 363/363 passed (`node.txt`, 3167.274028ms); the shell-level 3.374s includes command overhead.

## Current verified checkpoint

F17: **DONE** (2026-11-02 17:24 UTC). Restore returning-visitor recognition above the hero; affected browser suite and npm test pass. Actual output: docs/validation/v3.1.1/F17.

Next: Run production build and current preview/offline verification; preserve F14 validation blockers; no launch. Continue all remaining approved fixes on this branch, with serial browser checks and one commit per fix; no launch.

## F10 viewport decision — confirmed 2026-11-02

The user explicitly approved an additional responsive height cap in short browser windows. Keep the nominal60% original-width base, but reserve a visibly larger full-image view that fits the viewport. Report actual capped dimensions; do not claim a physical660px resting image in an844px-high window.

## F17 approved history finding

`git log -S "you know your way around"` identifies introduction in4feb4bf and removal in daeaff8. The exact sentence was one entry in the old seven-stage visitor-message array, rendered in the footer. V3.1 retired that phrase system when introducing the numeric-only VISIT counter; this removed the sentence. The newly approved placement is above the hero logo, with a fixed single returning-visitor sentence, not revival of the seven-stage system.
