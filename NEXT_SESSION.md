# Exact V3 continuation checkpoint

Updated 2026-10-28. Read AGENTS.md, PROJECT_PLAN.md and PROJECT_PROGRESS.md first, then actual Git status/log. Do not restart or repeat verified work.

- **Branch:** `feat/smart-continuation-v3`, base `3249099`.
- **Verified UI source:** `d0bcb15f5b46dbd1806f731e60a1e61b78109fe2`, committed. Tested HTML/ZIP and delivery evidence are currently uncommitted changes from this session, not unrelated user edits. Preserve them.
- **Last verified milestone:** 348/348 Node; form6, main4, carousel3, sound8, Works motion4, Digital gallery3, snapshot pixels/mobile/reduced, memory4, hero desktop/mobile/reduced/fallback; production build/export and11 routes+404; exact offline1440/390/320 and native390 touch; matching ZIP and unchanged original JPEG. No runtime errors/external requests in offline reports.
- **First unfinished unblocked task:** commit delivery artifacts/docs, push branch, open review PR against `feat/master-foundation`/PR #18; verify remote HTML blob/size and PR state. Then update this checkpoint with actual delivery commit/PR. Do not claim that push/PR already happened.
- **No remaining unblocked implementation after delivery:** new work needs genuine photos, mail configuration, exact approved private MP3, unpublished Loose Thread artwork or a concrete new request. WORLD/mannequin/Flowfield/additional Easter Eggs remain deferred. Do not add speculative features to fill time.
- **Preview:** `docs/previews/h4ngelic-preview.html`,7,768,382bytes, SHA256`caef41859ebbf53f438753fd3b03d69eaaed91217b0944eccade7a7603b8d96d`. ZIP5,275,407bytes/SHA256`6efa829894b23c67ced1cdfccf7d44315296e42d6031efade633f77f87e29830`, exact matching HTML member. Opening instructions adjacent.
- **Durable evidence:** `docs/validation/smart-continuation-v3/README.md`,35 recorded files and SHA256manifest; PROJECT_PROGRESS.md gives current matrix/results. Full user brief in `docs/SMART-CONTINUATION-V3.md`; prior foundation checkpoint in history.
- **Performance REVIEW NEEDED:** single simulated-mobile SwiftShader LH Home67/FCP1710/LCP2462/TBT3667/CLS0; Work99/1318/1886/26/0. Temporary CSS-copy probe68 did not justify a source change. Native animation configured1400ms differs from gesture/capture latency; current measured numbers are in integration/snapshot JSON. Review real hardware/paired retained traces before modifying accepted hero.
- **Blockers:** five genuine Tattoo photos (Flash/Analog also absent), Resend key+verifiedsender+hosted service, exact`h4ngelic_v8_full_sound_remaster_v11.mp3` (ignored`private/audio/`, dev loopback only, never commit/export), genuine unpublished Loose Thread asset.
- **Working code conventions:** separate top-right INDEX and bottom NAAVI; only Home 03 / CONTACT form; sharedcontactURL; native carousel1.1× in place; existing digital modal retained; no CSS scroll snap; cold interiors no Three.
- **No launch:** no merge, deployment, domain, analytics/public visitor count or copyrighted audio publication. H4 MOSH LAB unchanged. No automatic background execution.

Reproduce only when relevant changes or unresolved failures justify it. Browser checks must run serially, and asset builds must wait until browsers finish. Existing local servers: dev55173 and production55383 may still run; inspect actual processes before reuse. The temporary no-blend experiment server55384 was stopped.

```sh
npm test
npm run dev -- --port 55173 --strictPort
H4_BASE_URL=http://127.0.0.1:55173 node tests/smart-v3-browser.mjs
npm run preview:export
npm run preview -- --port 55383
H4_PREVIEW_URL=http://127.0.0.1:55383 node tests/seo-browser.mjs
npm run test:standalone
npm run preview:package
```
