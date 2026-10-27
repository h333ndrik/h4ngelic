# Verified project progress

Updated 2026-10-27. Branch: `feat/master-foundation`; base: `6c17a94`.
Verified UI source: `57e2e794da7d1ee181616d5f2a45d783eaaf5a95`.
The current report is [MASTER-FOUNDATION.md](docs/MASTER-FOUNDATION.md).

## DONE

| Phase | Implemented and verified | Evidence |
| --- | --- | --- |
| A | Actual repository/brief audit; complete requirement ledger and continuation documents. Clean base preserved. | Git history, PROJECT_PLAN.md, AGENTS.md |
| B | One shared bottom-centre NAAVI: Home 00–04/04, Work 01–03/03, About 01/01; final h4 stop; proper Home route; focus clearance and reduced motion. No header INDEX or Berlin label. | Six Node tests; six browser profiles at 1440/390/320 px, plus three post-fix focus profiles; naavi.json and naavi-focus.json |
| C | WORKS hierarchy, subordinate headings, digital before analog, empty 3d model; no category separators/arrows/duplicate mini navigation. | Content tests; layout checks at 1440/1000/801/800/390/320 px |
| D | Single approved flowing About paragraph, small inset/title/link, bounded 36/28 px motion. Dedicated About content retained. | About checks at 1440/390/320 px with normal/reduced motion |
| E | Required free-text HOW TO REACH YOU; safe email-only reply_to; once-only 700 ms entrance; errors retain text and uploads. | 23 focused Node tests, real loopback HTTP/provider mock, six form browser profiles |
| F | Native carousels and proportional FLIP; photo/outside/Escape close; exact scroll/focus return; honest empty archives. | Gallery 1440/390/320 px; native carousel 1000/390/320 px |
| G | Ordinary glow reduced 80%, restrained scales and 300 ms timing, contained labels, native h4 cursor and preference-change cancellation. | 22 focused Node tests; hover containment 1614/1440/390/320 px; desktop/touch cursor and focused accessibility checks |
| H | VISIT beside copyright on all footers, one shared visit memory, no route increment or footer divider. | Content tests and six layout profiles, plus offline checks |
| I | Accepted Other Side memory and hero preserved; no H4 MOSH LAB edits. | Four memory profiles: byte equality, two buffers, retained seed across routes/resize, fresh activation only; zero cold-interior WebGL/errors |
| J | Production build/export, real HTTP routes/no-JS, exact offline HTML, packaging and actual Lighthouse measurements. | 337/337 Node tests; five serial integration suites; production 12 routes + 404; offline 1440/390/320 px and native 390 px |

All evidence is in [docs/validation/master-foundation](docs/validation/master-foundation/README.md),
including timestamps, hashes and earlier failed/resumed runs. The layout JSON
contains continued 800/390/320 profiles; earlier widths passed before a software-GPU
stall, with captures retained. No combined run is invented.

A real integration issue was fixed: global scroll padding moved the lower hero
controls out of view on focus. Only form margins/focus clearance remain. The final
hero suite passes controls, pushing, dragging, release/return, mobile touch,
reduced pause and WebGL fallback. Hero/physics source itself is unchanged.

Lighthouse ran once per page under simulated mobile/SwiftShader: Home 75
(FCP 1205 ms, LCP 1615 ms, TBT 1341 ms, CLS 0.00258); Work 99
(1310 ms, 1797 ms, 12 ms, 0). These are lab observations, not field FPS.

The tested HTML is 7,752,573 bytes, SHA-256
`fc7ee432d42a310414104ab33fc1ffb8b8ef374ee2f61616b8c549ceb1762394`.
It matches the ZIP member and both offline reports. The original JPEG is embedded
unchanged; production contains no carousel fixture IDs.

## IN PROGRESS

Final delivery: commit evidence/current HTML, push the feature branch and open the
review PR. Check actual Git/PR state before assuming delivery completed.

## TODO

No remaining unblocked foundation implementation. Do not repeat verified work
without a new relevant change. Deferred features are excluded from this milestone.

## BLOCKED

- Five distinct genuine tattoo photographs for the visible V1 prototype are not
  supplied. Flash/Analog archives also lack confirmed photographs. Only the
  supplied green/black digital image is published; never substitute reference
  textures or repeated fixtures. Add real work in `src/data/artworks.js`.
- Actual mail delivery needs a Resend key, verified sender and hosted same-origin
  backend. HTTP tests use a local provider mock, not real mail. Offline HTML
  cannot submit mail. See [INQUIRY.md](docs/INQUIRY.md).

## REVIEW NEEDED

- Confirm mixed mouse/touch boundary behaviour on physical devices. Chromium CDP
  can consume a first gesture after changing axes, also on the unchanged baseline.
  The harness uses at most two real gestures and records deltas; production has
  no artificial vertical-scroll forwarding or CSS scroll snap.
- Evaluate Home's measured existing Three workload on actual hardware before
  changing the accepted hero to chase a software-rendered Lighthouse score.

## Deferred

WORLD 333/4, mannequin content/rotation/ink, About Flowfield, spatial Flashes,
further Analog/Tattoo experiments, Easter Eggs and additional sounds. Only the
empty 3d model subsection belongs to this milestone.
