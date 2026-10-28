# Exact V3 continuation checkpoint

Updated 2026-10-28. Read AGENTS.md, PROJECT_PLAN.md and PROJECT_PROGRESS.md before editing.

- **Branch:** `feat/smart-continuation-v3`, based on `3249099`. Source/test/documentation edits are uncommitted at this checkpoint. Inspect actual Git status and log; do not discard or duplicate partial work.
- **Active specification:** [SMART-CONTINUATION-V3.md](docs/SMART-CONTINUATION-V3.md). INDEX is separate from NAAVI; Contact belongs only on Home; carousel clicks enlarge in place. Earlier foundation choices in archived documents are historical where V3 explicitly changes them.
- **Latest verified milestone:** `npm test` passes **348/348**. Contact form passes six profiles at 1440/390/320px, animated/reduced. Main V3 integration passes four profiles at 1440/800/390/320px, verifying INDEX/NAAVI, Home Contact/history/legacy context, floating UI, footer/visit, audio popup/persistence/no autoplay and both realities. Native carousel passes 1000/390/320px. Dedicated sound 8, Works motion 4, isolated snapshot desktop/390/320 and ordinary Digital gallery 3 also pass; real photos and the approved MP3 remain absent.
- **Resolved failure:** the initial carousel horizontal-context failure came from native focus scrolling in the test’s keyboard probe. Real click/tap checkpoints were unchanged; the probe uses `focus({ preventScroll: true })` and the final three-profile suite passes. Preserve this distinction; do not add product scroll compensation.
- **First incomplete unblocked task:** production build/export, actual HTTP route checks, exact-byte standalone HTML/ZIP and current Lighthouse measurement. All changed UI browser suites, expanded footer/main integration, persistent memory4 and hero desktop/mobile/reduced/fallback now PASS. Read-only review's accessible visit-count description is fixed. Observe actual current commit/build results before repeating verified browser work.
- **Then continue:** fix confirmed failures, update evidence, build/export, check production routes and exact standalone HTML, package matching bytes and prepare a review PR. Do not stop after a single completed item. No V3 export has yet been verified or published at this checkpoint.
- **Transition timing limitation:** native captured animation is configured 1400ms in both directions, but the main software-rendered integration run measured gesture-to-cleanup 9687/4838ms at 1440px and 3803/2674ms at 390px (entry/exit). Entry includes the one-second hold plus preparation/capture/GPU work. Do not claim 1.4-second wall-clock completion. Reduced-motion capture is bypassed. The isolated snapshot suite completed in 1657ms desktop reverse, 1805/1967ms at 390px and 1461/1912ms at 320px entry/reverse, with no zoom and exact live restoration. Those isolated capture timings differ from full gesture/preparation timing. Full numbers are in snapshot/main JSON reports and PROJECT_PROGRESS.md.
- **Relevant code:** router/pages/app/navigation; `global-navigation.js/.css` and `naavi-content.js`; `inquiry*`; existing gallery/horizontal-drift controller; scroll choreography/motion settings; mode-snapshot/settings; mode-audio/sound-controls/xray; footer/easter settings. Use existing components instead of creating parallel systems.
- **Current evidence:** form/main JSON and PNGs in `artifacts/smart-continuation-v3`; native-carousel results; `artifacts/mode-snapshot/results.json`; `artifacts/v3-sound-controls/results.json`; `artifacts/v3-work-motion/results.json`; `/tmp/h4-v3-gallery.log`; Node and carousel final logs. The initial main integration had no runtime errors/failures; its expanded post-footer-fix rerun also passed. Snapshot proof moved 11629 real glyph pixels outside their old mask with 0 unexpected colours and exact restoration.
- **External blockers:** five genuine Tattoo photographs, confirmed Flash/Analog photos, real mail configuration, exact approved SMASH MP3, unpublished Loose Thread artwork. Continue independent approved tasks; do not invent substitutes or delivery success.
- **No launch:** no main merge, deployment, domain connection, analytics/public visitor count or copyrighted soundtrack publication. H4 MOSH LAB is untouched; WORLD, mannequin, Flowfield and optional extra Easter Eggs stay deferred. Preserve accepted hero, persistent memory-mosh and original JPEG bytes.
- **Existing last tested HTML:** the previous foundation export on `feat/master-foundation`, `docs/previews/h4ngelic-preview.html`, is 7,752,573 bytes with SHA-256 `fc7ee432d42a310414104ab33fc1ffb8b8ef374ee2f61616b8c549ceb1762394`. PR #18 is the historical foundation review. This is not a V3 export; replace only after current exact-byte offline checks pass.

Reproduction commands, selecting only relevant remaining checks:

```sh
npm test
npm run dev -- --port 55173 --strictPort
H4_BASE_URL=http://127.0.0.1:55173 npm run test:drift
H4_BASE_URL=http://127.0.0.1:55173 node tests/work-motion-v3-browser.mjs
H4_BASE_URL=http://127.0.0.1:55173 node tests/smart-v3-browser.mjs
H4_BASE_URL=http://127.0.0.1:55173 node tests/sound-controls-browser.mjs
H4_BASE_URL=http://127.0.0.1:55173 npm run test:mode-snapshot
npm run preview:export
npm run preview -- --port 55383
H4_PREVIEW_URL=http://127.0.0.1:55383 node tests/seo-browser.mjs
npm run test:standalone
npm run preview:package
```

Run browser suites **serially**. Do not run an asset/build step or change Vite configuration during an active browser suite: both can reload the page. Keep actual failed results and document fixes. Update the checkpoint after each meaningful verified milestone. Do not claim automatic background execution or a commit/push that has not happened.
