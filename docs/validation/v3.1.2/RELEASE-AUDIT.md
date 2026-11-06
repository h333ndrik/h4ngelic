# V3.1.2 release audit

Audited **2026-11-03** on `v3.1.1-fixes` at
`65b0e9303b4a35d0dceed7b8f2fcd1b474d73281` (build `65b0e9303b4a`).
No merge or deploy was performed.

## Phase A — F18-r4 completed

The restored stash introduced the blanket normal-mode pointer
`html.h4-custom-cursor * { cursor:none!important }`, with
`[data-cursor="xray"]` as the only allowlist. The canonical pair is the final
emitted CSS. Production contains exactly three cursor declarations: root
fallback, xray allowlist and blanket `none`.

The production hit map covered whole viewports and mandatory NAAVI, slash,
footer, VISIT, open INDEX, form and canvas-drag regions. Normal points were
4,459 / 1,139 / 929 at 1440 / 390 / 320 with zero foreign cursors; xray had
2,221 points using the Other Side cursor. All JavaScript disabled leaves the
class absent and body/brand/NAAVI/footer on system cursors. Detail:
`F18-r4/README.md`, `F18-r4/results.json`, `F18-r4/production.json`.

F21-r4/F29-c and F18-r4 shared `tests/hero-boot-browser.mjs`; Git auto-merged
the test without conflict markers and the merged file passed. No runtime change
fell outside cursor, form/heading test drift or the required CSS emission order.

## Phase B — verification

### Counts

- Node: **374 / 374 PASS**, 0 fail, 0 skipped.
- Six-profile release suites: **18 suites × 6 profiles = 108 PASS**.
- The three routes/profiles checked by production F20 remained at FCP medians
  **60/64/64/64/64/52 ms** with CLS 0.
- Exact standalone export: **3/3 widths PASS**, zero external HTTP requests.
- Production cursor/no-JS proof: PASS with exactly three cursor declarations.
- Carousel performance: p95 **16.70–16.80 ms**, zero LongTasks at all widths.

The complete suite inventory and observed metrics are in
`RELEASE-AUDIT/suite-results.md`. Raw Node output is
`RELEASE-AUDIT/node-tests.txt`; build assertions are
`RELEASE-AUDIT/build.txt`.

### Build and routes

- Build marker on `<html>` and meta: `65b0e9303b4a`.
- Exactly one `dist/assets/main-*.js`; hero modulepreload points to that emitted
  chunk.
- 18 semantic manifest routes, all HTTP 200 in the strict preview, plus
  `404.html`.
- SEO/no-JS: 18 direct route documents, redirects, canonical metadata, sitemap,
  robots and strict 404 pass; cold Work/About/Home Contact load no 3D scene,
  font or texture.

### Fix table

| Item | Code evidence | Verification | Result |
| --- | --- | --- | --- |
| F18 | `src/cursor.css`, `vite.config.js`, `src/xray.js`, NAAVI pointer-event CSS | Production hit map, no-JS, xray, no source cursor writes | ✅ |
| F19 | `src/carouselSettings.js`: 300×420, flat row, area-scoped wheel | Carousel 6/6, p95 16.70–16.80 ms | ✅ |
| F20 | `src/app.js`: `startsOnHero`, lazy preload; Vite preload rewrite | F20 production 6/6; one main chunk; interior cold checks | ✅ |
| F21 | `--h4-ghost-*` tokens and header alignment | Greeting production PASS; F21-r2 behavior retained | ✅ |
| F22 | `scroll-choreography.js` and `--hero-bar-shift` | V31 motion 6/6 | ✅ |
| F23 | `src/inquiry.css`, responsive one-column form | Inquiry 6/6; V26 limits 6/6 | ✅ |
| F24 | `src/mode-snapshot.js`: 900–900 ms, 30 FPS | Mode-snapshot and modal pixel proofs PASS | ✅ |
| F25 | `src/pages.js`: plain `3d model` heading | Portfolio 6/6, static titles 6/6 | ✅ |
| F26 | More heading is accessible-only; child headings are unlinked | Portfolio/V31 navigation/motion 6/6 | ✅ |
| F27 | `siteContent.js`: Tattoo `archiveLabel: 'on skin'` | Portfolio/cross-links/navigation/mobile PASS | ✅ |
| F28 | `src/app.js`: measured `--slash-inset`; shared consumer CSS | V31 UI/footer/motion and 320 px checks PASS | ✅ |
| F29-a | `src/app.js`: booting/slow/failed poster states | Hero boot 3/3; standalone fallback PASS | ✅ |
| F29-b | `src/style.css`: visible breath and entrance | Hero boot and entrance PASS | ✅ |
| F29-c | 450 ms opacity + 1100 ms expo transform + 900 ms poster fade | Production entrance PASS; transform 1,100/1,131 ms measured; CLS 0 | ✅ |

## Discrepancies

The active V3.1.2 release harness is green. Several older scripts are not current
harnesses and must not be quoted as green: `artwork-transitions-browser.mjs`
assumes the retired detail-page click path, `corruption-browser.mjs` relies on a
pre-redirect Work URL, `scroll-browser.mjs` asserts retired copy and typography,
`persistent-memory-browser.mjs` has a machine-sensitive exact numeric baseline,
and `smart-v3-browser.mjs` retains the already documented Home Contact conflict.
They are listed in `RELEASE-AUDIT/suite-results.md`.

No active-release browser, Node, build, route or performance failure remains.

## Judgment

**MERGE-REIF for the active V3.1.2 release harness.** The stronger claim that
every historical browser script in `tests/` passes is **not** supported until
the legacy scripts above are rewritten.

## Merge gate

`origin/main` is unchanged at `9123a00b21b9a7d3873fe97ba7c36fb90b74c3e5`.
`origin/v3.1.1-fixes` is `c77cffa2731f256f37d5ea71e684fbf703cd59ee`.
`origin/mail-01-diagnostics` is `fb57c57f819eb50b9bc03f741016e85fd47a8c61`.
The complete `main..HEAD` commit list is `RELEASE-AUDIT/repo-state.txt`.

Rollback after a merge: on `main`, create a revert commit with
`git revert -m 1 <merge-sha>` and push normally (never force-push). In Vercel,
select the previous READY production deployment and promote it to Production.
The mail branch is independent and can be omitted without affecting this merge.
