# Master-brief performance audit

**Historical PR-9 measurements.** These actual results describe that earlier integrated build. PR #10 subsequently deferred its alternate mode; the current [Control vs. Corruption update](CONTROL-CORRUPTION.md) activates a revised version and includes fresh measurements. Do not reuse the numbers below as measurements of the current update. Original measurements and limits remain intact; shared preview filenames now show the current build, while original images remain in Git history.

Measured 23 October 2026. This is a fresh comparison with the existing microinteraction build (`0a65d3b`), **not** the earlier original/tagline baseline in [PERFORMANCE.md](PERFORMANCE.md).

## Loading measurements

The baseline was copied from its built output before edits and served independently on port 4182 with Vite preview. The final optimized build was served with the strict compressed-document preview server on port 4202. Both use gzip; transfer figures include their response headers. The final build uses production optimization with the safe SEO `preview/noindex` setting. Canonical production indexing is tested separately and does not deploy anything.

Lighthouse 13.5.0, Chromium 154, mobile 412 × 823 CSS pixels, DPR 1.75, simulated Slow 4G / 4× CPU, headless SwiftShader software WebGL. Fresh browser per cold navigation, serial runs, no concurrent browser benchmarks. Exact flags, versions, settings, timestamps, benchmark calibration and warnings are in the linked JSON files. All eight runs completed without runtime errors or warnings.

Three homepage runs per build; each metric uses its own median. Work has one observation per build, which is insufficient for a statistical comparison. Scores and small timing differences should not be treated as demonstrated improvements.

| Build / route | Runs | Performance / 100 | FCP | LCP | Startup TBT | CLS | Total transfer | JS transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline home | 3 | 70 | 1,366 ms | 1,969 ms | 2,357 ms | 0.00246 | 327,869 B | 158,965 B | 8 |
| final home | 3 | 71 | 1,507 ms | 2,105 ms | 2,180 ms | 0.00239 | 342,642 B | 170,560 B | 8 |
| baseline work | 1 | 100 | 906 ms | 906 ms | 0 ms | 0.00000 | 14,881 B | 7,035 B | 4 |
| final work | 1 | 100 | 1,053 ms | 1,065 ms | 0 ms | 0.00000 | 29,357 B | 18,248 B | 4 |

Final homepage samples:

| Run | Performance | FCP | LCP | TBT |
| --- | ---: | ---: | ---: | ---: |
| 1 | 71 | 1062 ms | 1088 ms | 3423 ms |
| 2 | 70 | 1507 ms | 2108 ms | 2180 ms |
| 3 | 71 | 1552 ms | 2105 ms | 1989 ms |

The expanded navigation, reversible choreography, image masks, ink/footer, SEO and alternate presentation add initial UI code: total transfer rises by 14,773 bytes on Home and 14,476 bytes on Work. The measured score stays effectively unchanged (70 → 71 and 100 → 100); this is feature-cost accounting, not a claim of a meaningful speedup. Final script names are `index-D6l5QRY1.js` and `main-Cp_QjTJ6.js`.

Work requests only its document, stylesheet, UI script and favicon. Direct Work/About create no WebGL context and request no hero chunk, font or reflection texture. The 13,202-byte The Other Side texture is absent from initial Normal-mode requests and loads only upon first activation. Three.js remains a separate homepage-only lazy chunk (~153 KB gzip); Vite's >500 KB uncompressed chunk warning remains visible. No extra animation library was added.

## Runtime bottleneck and correction

The first integration used a multi-pass SVG filter over the full animated canvas plus procedural SVG grain. A desktop software-GPU sample had a 350 ms median animation-frame interval in The Other Side versus 116.6 ms in Normal. Isolating effects also exposed multi-second stalls from procedural compositing and costly curve sampling. These diagnostics motivated actual implementation changes rather than hiding the observations:

- Rasterize the editable grain/chemical SVG once into a small 450 × 550 WebP; alpha-composite that cached image.
- Process only the wordmark's fragments inside its existing material shader using four direct tonal anchors and three interpolation steps, avoiding full-viewport filters and indexed curve arrays. Normal skips this branch entirely.
- Keep full nine-point solarization/channel separation on real static images, and the lite image pipeline for constrained/touch profiles.

The final runtime observation below used the real built homepage, DPR 1, no CPU/network throttling, and explicitly fixed memory/core hints (8 GB / 8 cores) to exercise full and touch profiles. It observes approximately three seconds **after** each mode settles, in Normal → The Other Side → Normal order. The desktop viewport is 1440 × 1000; touch is 390 × 844. Actual WebGL clear calls and main-thread long tasks are counted. The sampler adds one RAF callback per frame in every mode; it is measurement overhead, not production code.

| Profile | Mode | Window | WebGL clears | RAF interval median | RAF interval p95 | Long tasks >50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1440px-desktop-full | normal | 3111 ms | 23 | 133.2 ms | 250.0 ms | 0 |
| 1440px-desktop-full | the other side | 3153 ms | 17 | 166.7 ms | 350.0 ms | 0 |
| 1440px-desktop-full | normal (restored) | 3088 ms | 21 | 149.9 ms | 283.3 ms | 0 |
| 390px-touch-lite | normal | 3028 ms | 68 | 49.9 ms | 66.7 ms | 0 |
| 390px-touch-lite | the other side | 3010 ms | 68 | 49.9 ms | 83.3 ms | 0 |
| 390px-touch-lite | normal (restored) | 3029 ms | 76 | 33.4 ms | 66.7 ms | 0 |

Desktop filter-transition state completed in 810 ms entering and 696 ms leaving (configured 650 ms, frame scheduling adds delay). Touch/lite finishes its JS filter-state switch immediately (~1.8 ms entering); CSS interface color fades are separate. No settled The Other Side animation loop exists. Browser checks verify actual photo and wordmark-foreground pixel changes, repeated toggles and exact Normal pixel restoration.

These are single, ordered software-GPU observations, not physical-device FPS, guaranteed smoothness or a statistically controlled benchmark. The desktop and mobile observations still show rendering overhead in The Other Side. Startup TBT remains high with SwiftShader. Zero long tasks during the short settled observation does not establish input latency or INP. A real mobile GPU and Safari/touch check remain useful before production visual sign-off; the empty archive does not model a future image-heavy portfolio.

## Reproduce

```sh
npm run build
npm run preview -- --port 4173
node scripts/measure-performance.mjs --base-url http://127.0.0.1:4173 --label local --home-runs 3 --work-runs 1
H4_BASE_URL=http://127.0.0.1:4173 npm run measure:xray
```

Rebuild the decorative texture with `npm run assets:xray` after editing `scripts/assets/xray-distress.svg`. It is committed and need not be regenerated during normal content builds.

Compact actual measurements: [baseline](performance/master-baseline-summary.json), [final loading](performance/master-final-summary.json), [first integration runtime](performance/xray-runtime-before.json), [final runtime](performance/xray-runtime.json). Complete Lighthouse audits are generated in ignored `artifacts/performance/`.
