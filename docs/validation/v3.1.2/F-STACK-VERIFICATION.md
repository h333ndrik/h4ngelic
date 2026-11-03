# V3.1.2 F-stack — independent verification

Checked **2026-11-03** on branch `v3.1.1-fixes` at
`0311a1f610648f35b7b1357fcf9f15cbd99bc730`. This was a verification-only
audit: no product fix, refactor, merge, deploy or force push. The only commit
written for this audit is this report plus `docs/validation/v3.1.2/F-STACK/`.

## 1. Repository state

- Branch: `v3.1.1-fixes`
- HEAD before the audit commit: `0311a1f610648f35b7b1357fcf9f15cbd99bc730`
- Tracked worktree: clean before evidence generation.
- `mail-01-diagnostics` is separate at `fb57c57` and changes only mail/inquiry
  files plus its own `MAIL-01` evidence. Its changed-file set has **zero overlap**
  with `6ae7468..v3.1.1-fixes`. No F commit was pulled into that branch.
- Raw output: `docs/validation/v3.1.2/F-STACK/repo-state.txt`.

## 2. Tests and build

| Check | Actual result |
| --- | --- |
| `npm test` | **373 / 373 PASS**, 0 fail, 0 cancelled, 0 skipped |
| Baseline | 372; net **+1** |
| New test | `on skin labels the Tattoo archive without changing its identity or Home copy` |
| Replaced tests | `rubric pages render plain child category headings and keep cross-links` replaces the old promoted-link test; `900ms target` replaces the old 1.4-second test |
| `npm run test:inquiry-http` | PASS: 202 accepted, 403 cross-origin, 415 spoofed attachment, 429 rate limit, 502 provider failure, 503 unconfigured |
| `npm run build` | PASS; **18 prerendered routes + 404** |
| `npm run preview:export` | PASS; self-contained preview exported |

Raw logs: `node-tests.txt`, `inquiry-http.txt`, `build.txt`.

Production-preview HTTP checks (`routes.txt`):

| Route | Status |
| --- | --- |
| `/` | 200 |
| `/work` | 301 → `/work/tattoos` |
| `/work/tattoos` | 200 |
| `/work/more` | 200 |
| `/work/jewellery` | 200 |
| `/about` | 200 |
| `/contact` | 301 → `/#contact` |
| unknown path | 404 |

No 5xx response was observed.

## 3. Fix-by-fix check

| Fix | Claim | Verified by | Result |
| --- | --- | --- | --- |
| F18 | One constant cursor image per mode, hotspot `9 2`, no hover/pressed variants | `src/cursor.css` + `ref09-icons-browser` desktop/reduced/touch + SVG decode | ✅ |
| F19 | 300 × 420 covered cards, flat row, viewport-only wheel, touch swipe, clean wrap | `carouselSettings.js`, drift JS/CSS + carousel 6/6, drift-performance 3/3 | ✅ |
| F20 | Poster stays critical, texture waits for frame 1, anchors stay cold, real modulepreload | F20 6/6 + direct `/#contact` probe + dist inspection + SEO live audit | ✅ |
| F21 | Recognition line fixed at header top inside the branding↔INDEX gap | CSS + visitor-tier 6/6, navigation/footer 6/6, mobile 4/4 | ✅ |
| F22 | Hero bar translates, never fades; hidden/inert only at full exit | `sampleHeroBar`, `--hero-bar-shift`, motion 6/6 | ✅ |
| F23 | Intro gap, configurable right offset, mobile reset, no overflow, 44px targets | `inquiry.css` + inquiry 6/6; measured overflow `0` at 1440/390/320 | ✅ |
| F24 | 900/900 ms, 30 FPS, unchanged material/recovery, 900 ±150 assertion | Settings + mode-snapshot PASS + xray 6/6 | ✅ |
| F25 | `3d model` is a real category heading like `flashes`, one section | Renderer probe + F25 evidence + portfolio 6/6 | ✅ |
| F26 | More heading hidden visually, no `view work`, child headings plain text | Renderer probe for all three rubric pages + portfolio/navigation/motion 6/6 each | ✅ |
| F27 | `on skin` title/filter/cross-link, URLs and Home labels unchanged | Renderer probe + portfolio/cross-links/navigation 6/6 + mobile 4/4 | ✅ |

Source evidence for all rows is in `fix-checks.txt`. Every `docs/validation/v3.1.2/F18`–`F27`
folder contains its README, screenshots and browser/JSON outputs.

Notable measured facts:

- F19: `depthScale: false`, no tilt in the resting row; `wheelSensitivity: 8.0`;
  wheel listener is on `.drift-viewport` only; cover at rest, contain when expanded.
- F21: `top: max(21px, env(safe-area-inset-top))`; pointer events remain `none`.
- F22: `sampleHeroBar` returns `shift` and `hidden`; CSS uses
  `translate3d(0, var(--hero-bar-shift, 0%), 0)` with `opacity: 1`.
- F23: intro `clamp(14px, 2vw, 28px)`; form
  `var(--inquiry-form-offset, clamp(60px, 24vw, 640px))`; at ≤600px both offset
  and rendered form margin are `0px`; measured overflow 0 at 320.
- F24: transition 900/900 ms, 30 FPS, displacement 180, smear 220, channel 9,
  colour .86, `recoveryMs: 2350`; reduced motion still bypasses the capture.
- F26 renderer probe:
  - `/work/tattoos`: `on skin`, `flashes` and `3d model` both plain text, 0 links,
    0 arrows.
  - `/work/more`: hidden `page-heading sr-only` h1 `more`; both children plain
    text, 0 links, 0 arrows; `view work` count 0.
  - `/work/jewellery`: no child category headings; `view work` count 0.
- F27: both `categories` and `workGroups` Tattoo entries carry
  `archiveLabel: 'on skin'`; title, filter and cross-links resolve through
  `archiveLabel ?? label`; URLs remain `/work/tattoos`.

## 4. F20 commit verification

### (a) Direct `/#contact`

Probe against the production preview (390 × 844, normal motion):

- Before scrolling: **zero** requests for `main-*.js`, `wordmark.typeface` or
  `tattoo-texture`; hash `#contact`, scrollY 1996.
- After scrolling to the hero: main chunk, font and texture requested; stage
  reached `is-ready`, canvas `block`, poster `0`.
- Zero page errors.

Raw data: `step9-contact.json`.

### (b) `dist/index.html` preload target

- HTML preload: `/assets/main-DoRPqGkE.js`
- Emitted app-bundle dynamic reference: the same `main-DoRPqGkE.js`
- Only one `dist/assets/main-*.js` exists.
- Its MD5 differs from raw `src/main.js`, proving it is the compiled chunk, not
  a copied source file.

Raw output: `step9-dist.txt`.

### (c) Node total and new tests

`npm test` is **373/373**. The net addition is the F27 content test named in
Section 2; the other two Node test names are replacements, not extra tests.

## 5. Standalone reduced-motion judgment

`tests/standalone-browser.mjs:108` deliberately creates every context with
`reducedMotion: 'reduce'`. Under that contract, F8 requires the static poster and
no WebGL. This is a **documented contract change, not a regression**.

Both directions were measured on the exact exported HTML with networking
blocked (`step10-standalone.json`):

| Context | Stage | Canvas | Poster | WebGL contexts | External HTTP |
| --- | --- | --- | --- | --- | --- |
| reduced motion | `is-poster-static` | `display:none` | 1 | 0 | 0 |
| no-preference | `is-ready` | visible `block` | 0 | 1 | 0 |

The normal-motion standalone export therefore still boots WebGL. The test
change reflects the existing F8 reduced-motion contract (and the historical
statement that reduced motion starts the logo paused), not a broken WebGL path.
The offline/standalone contract in `AGENTS.md` remains satisfied: exact exported
bytes run at 1440/390/320 with no HTTP requests or runtime errors.

## 6. Scope-drift check for the three integration commits

| Commit | Files | Finding |
| --- | --- | --- |
| `e2f44dd` F20 Home anchor | `src/app.js`, F20 evidence | Only preload gating inside `prepareHero` and the intersection handler; comments explain the behavior. ✅ |
| `17679b1` F20 preload chunk | `vite.config.js`, F20 evidence | Only build-time rewrite of the hero modulepreload href and removal of the duplicate raw asset. ✅ |
| `aaf8d7c` F8/F26 standalone tests | two test files only | Reduced-motion poster assertions, direct hash routes because F26 removed heading links, and `CHROMIUM_PATH` support. No product code. ✅ |

No uncommented behavior change outside hero-preload, preload-href or standalone
tests was found. The removed `README 2.md`/`README 3.md` and duplicate F27 images
were untracked housekeeping copies; they were never in Git history.

Raw diff inventory: `step11-scope.txt`.

## 7. Final-report claims vs independent measurements

| Claim | Independent result | Status |
| --- | --- | --- |
| npm 373/373; 18 routes + 404 | Matches | ✅ |
| F20 6/6; Cold Work/About/Home Contact cold | Matches | ✅ |
| FCP median 36–64 ms | Current independent run: 60/60/76/56/72/64 ms, all under the 100 ms test bound | ⚠️ historical number, not exactly reproducible |
| mode-snapshot wall-clock 970 ms desktop / 970–1192 ms mobile | Current run: 1148 ms desktop; 977/1241 and 999/1364 ms mobile; native animation always 900 ms | ⚠️ environment variance; still inside the 2500 ms bound |
| Drift p95 16.70 ms, 3/3 widths, zero LongTasks | Matches | ✅ |
| All listed six-profile suites green | Matches at current source state | ✅ |
| smart-v3 is not claimed green | Confirmed: exits 1 at its pre-existing Home Contact scroll assertion | ✅ disclosed |
| F14 and real iPhone remain blocked | No device/iOS runtime present | ✅ unchanged blocker |

FCP and mode wall-clock are measurements, not fixed acceptance values; the
reported numbers came from an earlier run on the same source. They should be
read as observed samples, not guaranteed constants.

## 8. Judgment

**MERGE-REIF MIT EINSPRÜCHEN.**

All F18–F27 code criteria, the F20 integration extras, the build, production
routes, standalone reduced-motion contract and the six-profile suites pass.
The reservations are the disclosed F14 cross-browser/mannequin gap, real iPhone
Safari, the legacy smart-v3 suite that conflicts with later Home/Contact
behavior, and the non-reproducible exact FCP/wall-clock samples in the narrative
report. No merge or deployment was performed.
