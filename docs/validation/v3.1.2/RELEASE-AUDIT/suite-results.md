# Release suite results

Checked against the active V3.1.2 harness on 2026-11-03.

## Six-profile suites

These ran at 1440/390/320 px in full and reduced motion; each line is six
successful profile runs.

| Suite | Result |
| --- | --- |
| `portfolio-browser.mjs` | 6/6 PASS |
| `v31-navigation-browser.mjs` | 6/6 PASS |
| `horizontal-drift-browser.mjs` | 6/6 PASS |
| `v31-ui-browser.mjs` | 6/6 PASS |
| `footer-v31-browser.mjs` | 6/6 PASS |
| `hero-poster-browser.mjs` | 6/6 PASS |
| `v312-f20-hero-browser.mjs` (production) | 6/6 PASS |
| `xray-browser.mjs` | 6/6 PASS |
| `v26-mail-limits-browser.mjs` | 6/6 PASS |
| `v19-index-glow-browser.mjs` | 6/6 PASS |
| `v23-static-titles-browser.mjs` | 6/6 PASS |
| `v28-hero-tagline-browser.mjs` | 6/6 PASS |
| `v7-visitor-tiers-browser.mjs` | 6/6 PASS |
| `v17-performance-browser.mjs` | 6/6 PASS |
| `v25-cross-links-browser.mjs` | 6/6 PASS |
| `v31-motion-browser.mjs` | 6/6 PASS |
| `master-inquiry-browser.mjs` | 6/6 PASS |
| `gallery-browser.mjs` | 6/6 PASS |

## Dedicated release checks

| Suite | Result |
| --- | --- |
| `cursor-hit-test.mjs` | PASS: 1440=4,459; 390=1,139; 320=929 normal points; xray=2,221; zero foreign cursors |
| `v312-r3-production-cursor.mjs` | PASS at `65b0e93cb201`: exactly 3 declarations, final blanket, no-JS system fallback |
| `hero-boot-browser.mjs` | 3/3 PASS |
| `v312-r3-greeting-browser.mjs` | PASS: color `rgb(240,239,235)`, `.84px`, hover `.35`, focus `.52`, 320 one line |
| `v312-r3-entrance-browser.mjs` | PASS: 0→.022→1; opacity done 552 ms, transform done 1,026 ms; CLS 0 |
| `seo-browser.mjs` | PASS: 18 semantic routes, redirects, strict 404, no-JS and cold interiors |
| `browser.mjs` | PASS: desktop, mobile, reduced and WebGL fallback |
| `hover-browser.mjs` | PASS desktop and touch |
| `microinteractions-browser.mjs` | PASS desktop and mobile |
| `master-accessibility-browser.mjs` | PASS |
| `v15-mobile-browser.mjs` | 4/4 PASS |
| `ref09-icons-browser.mjs` | 5/5 PASS (desktop, reduced, 390, 320, SVG decode) |
| `ref09-foundation-browser.mjs` | 3/3 PASS |
| `mode-snapshot-browser.mjs` | PASS |
| `mode-snapshot-modal-browser.mjs` | PASS; 9,699 image pixels displaced, zero unexpected chroma, exact restoration |
| `mode-audio-browser.mjs` | PASS |
| `ref09-mode-cancel-browser.mjs` | PASS |
| `wordmark-corruption-browser.mjs` | PASS |
| `standalone-browser.mjs` | 3/3 PASS, zero HTTP |
| `standalone-native-browser.mjs` | PASS; four 900 ms transitions |
| `horizontal-drift-performance.mjs` | 3/3 PASS; p95 16.70/16.70/16.80 ms, zero LongTasks |
| `v312-r2-performance-browser.mjs` | PASS; FCP 40–124 ms on six route-width checks |
| `navigation-browser.mjs` | PASS: direct/race/history/fallback after current-route reconciliation |

## Current metrics observed

- F20 production FCP medians: 60/64/64/64/64/52 ms for 1440 full/reduced,
  390 full/reduced, 320 full/reduced.
- Carousel performance p50 16.70 ms; p95 16.70–16.80 ms at all widths.
- `v17-performance-browser.mjs` passes, including its own LCP and long-task
  contracts. Its 1440 full-motion sample was 1,356 ms; reduced and mobile
  samples were 36–96 ms. This is recorded as an environment-sensitive Home
  sample, not substituted for the stricter F20 production guard.

## Legacy harness discrepancies

The following older scripts encode pre-V3.1.2 markup and were not used as release
gates: `artwork-transitions-browser.mjs` still expects the old detail-page
navigation instead of the current in-page viewer; `corruption-browser.mjs` starts
on `/work?test=1`, whose redirect drops the dev probe; `scroll-browser.mjs` still
asserts the retired `SELECTED WORKS` copy and type scale; `persistent-memory-browser.mjs`
has a machine-sensitive exact numeric baseline; and `smart-v3-browser.mjs` has
the previously disclosed Home Contact conflict. They must be updated before they
can be called current; they are not evidence against the active release harness.
