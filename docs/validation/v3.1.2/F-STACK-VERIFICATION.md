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

## 9. V3.1.2-r2 addendum — reproduction → fix → proof

### F29 hero boot guard

- **Reproduction:** Slow 3G left the boot state without feedback for over six seconds; a blocked `main-*.js` produced no failure copy or persistent fallback class. The Vercel preview remained behind SSO.
- **Fix:** `data-hero-loading` now drives `booting → ready | slow | failed`; the critical poster breathes with transform/opacity, announces slow boot after 6 s, and becomes the permanent static wordmark on import failure.
- **Proof:** Production preview at 1440/390/320 measured poster opacity 0.800 at boot, 0 when ready, 0.904 with slow text after 6.3 s, and 1 with `is-boot-failed` plus hidden canvas on failure; the failed state survives leaving and returning Home. Evidence: `F29/`.

### F18-r2 cursor

- **Reproduction:** The local baseline had zero cursor offenders on `/`, `/work/tattoos` and `/#contact`, but the Vercel-reported footer switch could not be replayed behind SSO; state-scoped rules remained an unguarded override path.
- **Fix:** The app marks `html.h4-custom-cursor`, and the final CSS rule binds every interactive element to the same mode cursor image and `9 2` hotspot; the cursor is never set to `none`.
- **Proof:** Exact image/hotspot enumeration found zero offenders at three widths and three routes, including footer moshlab, VISIT, SMASH, Instagram and NAAVI at rest, hover and active. Evidence: `F18-r2/`.

### F21-r2 greeting

- **Reproduction:** The returning-visitor line painted permanently at fine-pointer rest; the old footer test explicitly expected that state.
- **Fix:** Fixed-position opacity/visibility now rests hidden and reveals on the top header band, `.site-chrome` hover or focus-within over 200 ms; `(hover: none)` keeps the touch fallback permanently visible without layout shift.
- **Proof:** Fine-pointer runs measured opacity 0/hidden at rest and 1/visible on hover and focus; touch runs at 390/320 measured 1/visible. Footer, visitor-tier and mobile suites pass. Evidence: `F21-r2/`.

### F19 wheel contract

- **Reproduction:** The listener was scoped to `.drift-viewport`, but there was no direct assertion separating carousel response from page scrolling.
- **Fix:** No product change was needed; the existing 8.0-sensitivity, carousel-only wheel handler was retained.
- **Proof:** Wheel over the carousel changed only `data-drift-position` with unchanged `scrollY`; outside input scrolled the page 0 → 520 at all widths. Evidence: `WHEEL-CONTRACT/`.

### F28 slash column

- **Reproduction:** Works, About and Contact used three different insets, and the Contact form retained `--inquiry-form-offset`.
- **Fix:** One `--slash-inset` is measured from the `01 / creative` slash glyph with a text Range, corrected for scroll translation, rAF-throttled on resize and refreshed once after fonts load; all subordinate blocks consume it and the old offset token is removed.
- **Proof:** All block offsets are ≤0.016 px from the canonical slash at 1440/390/320, with no page overflow at 320. Evidence: `F28/`.

### Performance and prevention

- **Reproduction:** The earlier fixed FCP claim was not reproducible as a constant; interior routes needed a fresh multi-sample guard.
- **Fix:** Boot animation work is transform/opacity-only, slash measurement is bounded, and `tests/v312-r2-performance-browser.mjs` guards cold payloads plus 3× warmed FCP.
- **Proof:** Five warmed samples per route gave `/work/tattoos` 108/60/56 ms and `/contact` 116/88/88 ms at 1440/390/320; no hero module/font/texture request occurred on interiors. Build is 32,540 KB (`du -k`), 18 routes + 404, one main chunk with matching modulepreload. Evidence: `PERF/` and `PREVENTION/`.

### Verification totals

- Node: **373/373 PASS**, 0 fail, 0 skipped.
- New browser prevention suite: **3/3 profiles PASS** on dev and **3/3 PASS** on the production preview.
- Affected/core suites: footer 6/6, About 6/6, inquiry 6/6, visitor tiers 6/6, mobile 4/4, static titles 6/6, navigation 6/6, portfolio 6/6, UI 6/6, drift 6/6, poster 6/6, motion 6/6, cross-links 6/6, F20 6/6, SEO PASS, performance 6/6 route-width combinations.

## 10. V3.1.2-r3 addendum — deployed visibility, cursor, entrance

### Build marker

- **Reproduction:** The Vercel preview is SSO-blocked and a loaded document had no externally or visually readable build SHA.
- **Fix:** A Vite pre-plugin stamps `data-build` and `<meta name="h4-build">` from `git rev-parse --short=12 HEAD`; app startup logs `[h4ngelic] build <sha>` only outside `VERCEL_ENV=production`.
- **Proof:** Verification build `cf7141342e18` is present as both attributes on all tested routes, the preview log was observed, and the Node guard verifies production suppresses the log. Evidence: `BUILD-MARKER/`.

### F18-r3 cursor final

- **Reproduction:** The emitted r2 CSS contained the cursor rule, but it preceded later component CSS and its strict path required the runtime class; the footer/NAAVI switch remained user-visible.
- **Fix:** Inline head JavaScript activates the class before hydration, the defense works with or without that class and includes `[data-cursor-target]`, and a post-build Vite plugin appends the defense as the final emitted CSS rule.
- **Proof:** With every JS bundle blocked, the production page still had zero cursor offenders with and without the class and exact image/hotspot on footer/NAAVI rest, hover, focus and active states. Full production runs also covered VISIT, SMASH, INDEX and form fields. Evidence: `F18-r3/`.

### F29-b hero entrance

- **Reproduction:** The ready moment only faded the canvas; on the dark poster the arrival was not perceptible, and the old breath was only `.8↔1` with ±0.4% scale.
- **Fix:** Ready adds a 760 ms `is-entering` window with a 700 ms transform/opacity entrance (`opacity 0→1`, `y 8→0`, `scale .985→1`); breathing is now `.55↔1` and `scale .988↔1.012`; reduced motion and failure stay instant/static.
- **Proof:** Production starts at opacity 0/scale `.985`/y 8px, reaches opacity 1 and `matrix(1,0,0,1,0,0)` with a partially visible mid-frame and CLS 0; breathing sampled `.550–1.000` and `.988–1.012`. FCP medians remained 44–108 ms under the 200 ms guard. Evidence: `F29-b/` and `PERF/`.

## 11. V3.1.2-r4 addendum — blanket cursor

- **Reproduction:** NAAVI/footer still exposed a native pointer because selector-list audits missed the element actually under the pointer, including generated wrappers and cursor writes in component code; production build `4a05f1a60f2a` was required for proof.
- **Fix:** The final emitted CSS now applies `html.h4-custom-cursor * { cursor:none!important }`, with xray as the sole allowlisted mode cursor; NAAVI decoration defers to its anchor, and no `style.cursor` writes remain in `src/`.
- **Proof:** The production 24 px hit map passed 4,459/1,139/929 normal points at 1440/390/320 and 2,221 xray points with zero foreign cursors, including NAAVI slash, footer, VISIT, open INDEX, five form controls and canvas drag; no-JS keeps system cursors and the emitted CSS has exactly the root fallback, xray allowlist and blanket declaration. Evidence: `F18-r4/`.

### Verification totals

- Node: **374/374 PASS**, 0 fail, 0 skipped.
- r3 prevention suite: **3/3** dev and **3/3** production profiles.
- Production cursor no-JS audit: PASS; F20 6/6; performance 6/6 route-width combinations plus entrance/CLS guard; footer 6/6; About 6/6; navigation 6/6; SEO PASS; core WebGL suite PASS against Dev.

## 11. V3.1.2-r3 addendum — F21-r3 greeting ghost treatment

### Reproduction

The r2 greeting still looked like bright interface copy: `#e8e8e4` at opacity
`1`, `.28px` tracking, sentence case and a dark text shadow. It did not share the
muted, uppercase, widely tracked look of `HOLD 4 TO SEE THE OTHER SIDE.`

### Fix

- One ghost token block now owns the contract consumed by the greeting:
  `#f0efeb`, `.35` rest/hover opacity, `.84px` tracking and uppercase. The HOLD-4
  hint rule itself remains untouched; its computed values are the reference, while
  the greeting keeps its header-specific `14px` size (`11px` touch, `9px` at
  `≤360px`).
- Reveal remains opacity-only over 200 ms. Touch is permanently visible at `.35`;
  reduced motion is instant. The focus-within step is `.52`, which measures
  `4.71:1` against `#242424` and clears WCAG AA normal-text contrast. The hover
  ghost remains `.35` (`2.91:1`), exactly matching the hint.
- The longest phrase was checked at 320 px. Its text stays inside the
  branding-to-INDEX slot with no wrap and no horizontal overflow.

### Proof

Production build `data-build="31832b86dfe0"` computed the greeting and HOLD-4
hint identically for hover color, opacity and tracking; focus, touch and reduced
motion matched their separate contracts. Greeting box dimensions were unchanged
across hidden, hover and focus states and the reveal recorded CLS 0. Evidence:
`F21-r3/`.

### Verification totals

- Node: **374/374 PASS**, 0 fail, 0 skipped.
- Production greeting contract: PASS (desktop, 320 px, touch, reduced motion).
- Development regressions: hero boot 3/3, footer 6/6, visitor tiers 6/6, mobile 4/4.

## 12. V3.1.2-r4 addendum — greeting alignment and premium entrance

### F21-r4 — greeting lowercase and shared header row

- **Befund:** The uppercase greeting sat on its `19.6px` text box at the top edge, roughly 12px above the optical centre of the `44px` branding and INDEX controls.
- **Fix:** Ghost type is now lowercase; the greeting shares the same `44px`, top-aligned row (`21px` desktop, `16px` mobile) with flex centring. Color, tracking, hover/focus opacity, touch and reduced-motion behaviour are unchanged.
- **Beweis:** Build `78e3fc92f003`: 1440px centres `43/43/43px` with deltas `-0.80/-0.30px`; 320px centres `38px`, gaps `23.06/23.08px`, no wrap or overflow, CLS 0. Evidence: `F21-r4/`.

### F29-c — smooth expo-out hero arrival

- **Befund:** The old 700ms fade moved only 8px from `.985` scale and was visually indistinguishable from a brightness change on the dark poster.
- **Fix:** Poster opacity now crossfades over 900ms; canvas opacity runs 450ms while the `translateY(14px) + scale(.96)` transform runs 1100ms with expo-out. The marker holds for the transform window, uses no blur filter, and reduced/failure paths remain instant/static.
- **Beweis:** Build `78e3fc92f003`: opacity completed at 675ms, transform at 1016ms, marker 1150ms, identity end state, CLS 0; Home FCP/LCP 116/116ms. F20 6/6; interior FCP 48–140ms. Evidence: `F29-c/`.

### Verification totals

- Node: **374/374 PASS**, 0 fail, 0 skipped.
- Production greeting and entrance contracts: PASS.
- F20 six-profile suite: **6/6**; footer **6/6**; visitor tiers **6/6**; mobile **4/4**; hero boot **3/3**; performance route-width pairs **6/6**.
