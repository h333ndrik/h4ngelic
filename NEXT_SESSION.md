# Exact continuation checkpoint

Updated 2026-10-27. Read AGENTS.md, PROJECT_PLAN.md and PROJECT_PROGRESS.md first.

- **Branch:** `feat/master-foundation`, based on `6c17a94`.
- **Verified UI source:** `57e2e794da7d1ee181616d5f2a45d783eaaf5a95`.
- **Last verified task:** all available implementation, 337 Node tests, five serial
  integration suites, focused UI/hero checks, production routes/build, exact
  offline HTML, single-run Lighthouse and byte-identical ZIP/original verification.
- **Delivery:** commit `706c9ee` pushed; [PR #18](https://github.com/h333ndrik/h4ngelic/pull/18) is OPEN,
  based on `feat/website-completion` / PR #17. Uploaded HTML blob/size match local.
  This final documentation checkpoint follows the artifact commit. Verify actual
  Git status/log before modifying anything; no merge or production deployment.
- **Next exact action:** review PR #18. For implementation, resume only when
  genuine photos, mail configuration or a new clear request arrive.
  There is no remaining unblocked foundation implementation.
- **External blockers:** five genuine tattoo photographs; Flash/Analog photographs;
  configured Resend key, verified sender and hosted `/api/inquiry` service. Follow
  `docs/CONTENT.md` and `docs/INQUIRY.md`; never invent photos or delivery success.
- **Files:** NAAVI in global-navigation.js/.css and naavi-content.js; static shell
  index.html/prerender.mjs; Works pages.js/archive-structure.css; About homepage.css
  and motionSettings.js; inquiry*/server/inquiry.mjs; gallery*/horizontal-drift*;
  hover uiEffectSettings.js/interactions.css; footer/easter-eggs for shared VISIT.
- **Evidence:** docs/MASTER-FOUNDATION.md and docs/validation/master-foundation.
  Tested HTML: docs/previews/h4ngelic-preview.html, 7,752,573 bytes, SHA-256
  `fc7ee432d42a310414104ab33fc1ffb8b8ef374ee2f61616b8c549ceb1762394`.
  ZIP and opening instructions are beside it. The older P0 report is historical.
- **Known review:** physical-device mixed-input boundary check; Home Lighthouse 75
  is one SwiftShader run, not field FPS. Preserve the accepted hero before any
  later hardware-based optimization. Native carousel tests permit at most two
  genuine gestures after a baseline-reproduced synthetic input issue; production
  scroll code does not forward wheel input manually.
- **Constraints:** no main merge, production deployment, H4 MOSH LAB changes,
  fabricated assets, or deferred WORLD/mannequin/Flowfield/sound implementation.

Copyable reproduction commands (do not repeat completed checks without cause):

```sh
npm test
npm run dev -- --port 55173 --strictPort
H4_BASE_URL=http://127.0.0.1:55173 npm run test:naavi
H4_BASE_URL=http://127.0.0.1:55173 npm run test:foundation
npm run preview:export
npm run preview -- --port 55383
H4_PREVIEW_URL=http://127.0.0.1:55383 node tests/seo-browser.mjs
npm run test:standalone
npm run preview:package
```

Run browser suites serially. Finish them before building: image preparation may
reload the development page. The integration runner supports `--resume` and keeps
its failure history. The standalone harness executes exact exported bytes with
network rejected because managed Chromium blocks direct file navigation.
