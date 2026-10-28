# Exact V3 continuation checkpoint

Updated 2026-10-28. Read AGENTS.md, PROJECT_PLAN.md and PROJECT_PROGRESS.md first; inspect actual Git status/log and remote state. Do not restart or repeat verified work.

- **Branch:** `feat/smart-continuation-v3`. UI source `d0bcb15`; tested artifact/evidence delivery `b2960e2`; feature sync with current main `ef5dd29`. This documentation checkpoint follows those commits. Inspect actual state before editing.
- **Review:** [PR #20](https://github.com/h333ndrik/h4ngelic/pull/20) OPEN, not draft, based on main. Remote HTML and ZIP blobs/sizes match exact tested local files. See `delivery-verification.json`. No V3 merge or deployment was performed by this task.
- **Main reconciliation:** main independently merged foundation PR #19, then added `api/inquiry.js` in `5c46828`. The wrapper is preserved unchanged in the feature branch; syntax/import and real local HTTP 405 method rejection pass. Frontend/export inputs are unchanged from tested UI source. Real provider delivery remains unverified; do not assume hosting/credentials are configured.
- **Last verified milestone:** 348/348 Node; form6, main4, carousel3, sound8, Works motion4, Digital gallery3, native snapshot pixels/mobile/reduced, memory4, hero desktop/mobile/reduced/fallback; production build and11 routes+404; exact offline1440/390/320 and native390 touch; matching ZIP/original JPEG. No runtime errors/external requests in offline reports.
- **First unfinished unblocked task:** none in the approved available V3 implementation. Review PR #20. Resume implementation only when genuine assets/configuration or a concrete new request resolves a blocker. Do not fabricate content, repeat already passing suites or implement deferred ideas.
- **Preview:** `docs/previews/h4ngelic-preview.html`,7,768,382bytes, SHA256`caef41859ebbf53f438753fd3b03d69eaaed91217b0944eccade7a7603b8d96d`; ZIP5,275,407bytes/SHA256`6efa829894b23c67ced1cdfccf7d44315296e42d6031efade633f77f87e29830`, matching HTML member. GitHub code view does not execute it: use Download raw file and open locally. Instructions adjacent.
- **Evidence:** `docs/validation/smart-continuation-v3/README.md` and hashed manifest; current complete matrix in PROJECT_PROGRESS.md. Full brief `docs/SMART-CONTINUATION-V3.md`; previous foundation documents in history.
- **REVIEW NEEDED:** physical-device mixed input; Home hardware performance/paired retained traces. Current single simulated-mobile LH Home 67/FCP1710/LCP2462/TBT3667/CLS0; Work 99/1318/1886/26/0. Temporary CSS copy scored 68 without establishing a cause or changing source. 1400ms animation target is distinct from measured gesture/capture latency; see JSON reports. Do not speculatively rewrite the accepted hero.
- **BLOCKED:** five genuine Tattoo photos (Flash/Analog also absent); configured/verified real mail delivery; exact`h4ngelic_v8_full_sound_remaster_v11.mp3` (ignored private/audio, local dev loopback only, never commit/export); genuine unpublished Loose Thread artwork.
- **Conventions:** top-right INDEX + menu and separate bottom NAAVI; Contact only Home 03 / CONTACT through shared helper; carousel enlarges 1.1× in place with native scrolling/no CSS snap; Digital viewer retained; cold interiors no Three.
- **No launch:** no main merge, deployment, domain, analytics/public visitor count or copyrighted soundtrack publication by this task. H4 MOSH LAB untouched; WORLD/mannequin/Flowfield/extra Easter Eggs deferred. No automatic background execution.

Reproduce tests only when a new relevant change or unresolved failure justifies it. Browsers run serially; builds wait until browsers finish. Local dev55173 and production55383 servers may still exist; inspect actual processes. Temporary experiment55384 was stopped.

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
