# V3.2 verification — final production build

Verified application build: `data-build="4b9ce9a3fae4"` (`4b9ce9a`, the last application/test commit before this documentation commit). Preview: `http://127.0.0.1:55200`. Production build: **23 routes + 404**.

## Result

- Node suite: **374/374 PASS**, 0 failed, 0 skipped.
- Production V3.2 structure: PASS — four-entry INDEX (`00–03`), 8 Flash placeholders, 8 Jewellery placeholders, mode-only SMASH, dual Impressum, 12 legacy 301s, 23 routes, tool detail routes, shared gap token and `NN/ NN` viewer counter.
- V3.2 micro-interactions: PASS — equal heading metrics, shared arrow, fixed clickable bar at five scroll fractions, 300ms caret toggle and permanent VISIT ghost at 1440/390/320.
- Cursor: PASS — blanket hit maps covered **4,458 / 1,138 / 928** points at 1440/390/320 plus **2,221** xray points. Zero foreign cursors; the logo overlay remained aligned at every blanket point. Kernel: 20/20 zero-pixel jumps, 108% hotspot press, leave/blur/visibility hiding and immediate reposition.
- Performance: PASS — `/creative/onskin` and `/contact` at 1440/390/320 measured FCP **132/100/52/60/64/84ms**; one `main-*.js` preload chunk; 23 routes.
- SEO: PASS — 23 direct semantic routes, canonical/OG metadata, 301 matrix, strict 404, sitemap and robots checks.
- Standalone: PASS at 1440/390/320 plus the native exact-bytes run; zero HTTP requests and zero runtime errors. Regenerated artifact SHA-256: `927cd717434d0ba20400e52acda99ca810a11977934ff3563f13f05cb7ece72e`.
- Additional browser coverage in this V3.2 pass: v31 motion 6/6 profiles; master motion/integration plus four responsive widths; master layout 6/6 widths; master NAAVI 6/6; master accessibility; navigation scenarios; portfolio 6/6; tools 3/3; footer 6/6; SMASH 3/3; mode audio; hover containment 4/4; color-memory 3/3; standalone native.

## Reconciled contracts

The user-approved V3.2 behavior superseded several older assertions:

- `/creative` is a canonical 200 archive; direct category links use `/creative/onskin`, `/creative/tools`, etc.
- INDEX has four entries; NAAVI Home reports `00/ 03` and Creative `01/ 04` through `04/ 04`.
- The tools group heading is static (F26); the 301 matrix covers every retired `/work/*` path.
- SMASH exists only in The Other Side footer DOM; normal mode renders no hidden control.
- VISIT is a permanent `.35` ghost in the left footer cluster; it is not a hover-reveal.
- Archive carousels expand in place and never open a modal; viewer/carousel counters use zero-padded `NN/ NN`.
- Editorial motion is the current calm, unpinned sampler. `content-visibility:auto` intrinsic slots are primed once before motion-height assertions.
- Color-memory diagnostics follow the unit-tested contract: native scroll travel is recorded 1:1 and no clean source crop moves beneath retained history.

## Evidence

- `docs/validation/CURSOR-KERN/`
- `docs/validation/NAAVI/`
- `docs/validation/R2B-HEADINGS/`
- `docs/validation/R3B-URLS/`
- `docs/validation/R4-HINTS/`
- `docs/validation/R5-VISIT/`
- `docs/validation/R7-BAR/`
- `docs/validation/R9-CARET/`
- `docs/validation/FLASH-JEWELLERY-PLACEHOLDER/`
- `docs/validation/SMASH-OTHERSIDE/`
- `docs/validation/IMPRESSUM-DUAL/`
- `docs/validation/TOOL-PAGES/`
- Refreshed production hit map: `artifacts/v312/r4-hit/results.json` (local artifact, ignored by git).

## Limitations

- The Vercel preview remains SSO-blocked for this environment and no deployment was performed. Production verification is against the locally built preview and emitted `dist`; the build SHA is visible on the page.
- This run did not merge or force-push. `main` and `mail-01-diagnostics` were not touched.
- A literal run of every historical browser suite was not repeated after the final docs-only commit. The named suites above were run against the final application commit or the identical immediately preceding source state; suites that require dev-only probes (`master`, `color-memory`) were run against Vite dev.

## Merge gate

- Verdict: **READY for merge review**, subject to the user's explicit `go`.
- Rollback: `git revert -m 1 <merge-sha>` and promote the previous READY Vercel deployment.
