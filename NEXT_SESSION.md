# V3.1 — verified local delivery checkpoint

Updated 2026-10-29. Read AGENTS.md, PROJECT_PLAN.md and PROJECT_PROGRESS.md, then inspect actual Git status/log. Preserve current artifact/evidence/documentation changes. Do not restart or repeat verified work.

## Current state

- Branch: `feat/smart-continuation-v3`, PR #20. Asset commit **f1841e4** preserves all eight supplied JPEG originals and the approved MP3. Source commit **daeaff8** contains the completed V3.1 refinement; its full hash is `daeaff83ec0b8a6b48873c3d77d63e3a2d706ead`.
- **All 17 approved items are DONE.** The user’s explicit eight-photo correction governs item 15. Actual code, committed original hashes and desktop/mobile browser evidence have been reconciled.
- All local QA passes: final Node 357/357; navigation4; footer4; motion6; shared UI6; carousel4; existing gallery3; inquiry6; sound controls8; actual SMASH3; production Digital6; SEO19 static/17 live records; both exact standalone suites and package integrity.
- Production build/export passes for 19 routes plus 404 in preview/noindex mode with zero indexable routes. No launch or deployment occurred.
- **PR #20 is still DRAFT at this checkpoint.** Root is about to commit/push the final locally verified artifacts and evidence, verify remote bytes and mark the PR ready. Do not claim those actions already happened until actual Git/PR state proves it.

## Exact next action

1. Commit the current verified HTML/ZIP, evidence and final checkpoint on the existing feature branch.
2. Push the same branch, verify remote artifact/source/evidence bytes and record the actual delivery commit.
3. Update PR #20, mark it ready after remote verification, and provide the user with the tested HTML/ZIP and PR links for review.
4. Stop implementation unless new user input requires it. Real h4 moshlab URL, actual mail delivery and genuine unpublished Loose Thread artwork remain external inputs; no invented URL/content or mail-success claim.

Do not merge, deploy, launch, change main or `api/inquiry.js`, add dependencies, force-push or modify H4 MOSH LAB. Preserve the accepted hero/physics/memory-mosh, separate INDEX/NAAVI and Home-only Contact.

## Exact verified preview

Source revision: `daeaff83ec0b8a6b48873c3d77d63e3a2d706ead`.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| [HTML](docs/previews/h4ngelic-preview.html) |24,484,734|`6c11473dd0360a15c5e459ae8ee95deeffa3c34c01cad0ffe790bd5d734ce001`|
| [ZIP](docs/previews/portfolio-preview.zip) |17,305,532|`61da29cabd658cb4fee3eb158e0b98dbc81bee65fb8f363ccef7c9abf5932770`|

The ZIP contains the exact tested HTML. [Package evidence](docs/validation/v3.1-refinement/offline-package.json) confirms the eight original JPEGs, approved MP3 and original Digital image remain unchanged and fixture content is excluded. The controls and native standalone reports match the exact HTML hash/size and record zero HTTP/console/page errors/overflow. Offline 390px actual SMASH starts only after trusted tap and uses its decoded cache on restart.

## Evidence and measured limits

All current reports/logs are preserved under [docs/validation/v3.1-refinement](docs/validation/v3.1-refinement). PROJECT_PROGRESS.md contains per-item files, suite counts, failure corrections and actual transfer measurements. Final Node 357/357 passes after all source corrections. All named screen sizes 1440/390/320, reduced motion and 333/4 behaviours are covered by the recorded suites; extra sound-control 810px coverage also passes.

Digital display widths halve. Image body bytes fall 46.06% at 1440px and 68.32% at 390px; 320px remains 40,410B because the old build already used the minimum 320w file. Full Work route totals can increase now that eight real photos are present. Do not claim general whole-route savings. SMASH’s exact original container duration is 100.310204s, browser-decoded 100.270s; the complete native natural end was observed without seeking or shortening.

The served website defers MP3 fetch/decode until first trusted use, then caches it. Offline embedding necessarily includes the original bytes in the downloaded HTML; runtime decoding/playback remains gesture-driven. Real mail is unverified: controlled 503 and 202 test responses prove UI behaviour only.

Do not rerun passing suites without a relevant runtime change. For a later local preview, use `npm run dev` or serve the production dist with `npm run preview`; the current fresh production server used 55385, baseline 55384, while old 55383 is stale/cached and unused. Tests run serially; no build/image preparation during browser checks.
