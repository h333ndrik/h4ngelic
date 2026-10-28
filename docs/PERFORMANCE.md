# Performance measurements

These are laboratory measurements of the actual production builds, taken on 23 October 2026. They are not real-phone measurements or field Core Web Vitals. The portfolio archive is currently empty; these results do not measure a future image-heavy archive.

## Reproduce

```sh
npm run build
npm run preview -- --port 4173
node scripts/measure-performance.mjs --base-url http://127.0.0.1:4173 --label after --home-runs 3 --work-runs 1
```

The script runs Lighthouse serially in a fresh Chromium process for each cold navigation. It writes complete Lighthouse JSON reports plus a compact summary to ignored `artifacts/performance/`. `CHROMIUM_PATH` can override the default `/usr/bin/chromium`.

Measurement setup:

- Lighthouse 13.5.0; Chromium 154.0.0.0, Linux headless.
- Mobile emulation: 412 × 823 CSS pixels, device scale factor 1.75.
- Lighthouse simulated Slow 4G: RTT 150 ms, throughput 1638.4 Kbit/s, CPU slowdown multiplier 4. The simulated network settings also specify 562.5 ms request latency, 1474.56 Kbit/s download and 675 Kbit/s upload for the underlying throttling profile.
- `throttlingMethod: simulate`, performance category only, maximum load/FCP wait 20 seconds, normal 1-second CPU/network quiet thresholds. No reduced-motion override.
- Chromium uses SwiftShader software WebGL (`--use-angle=swiftshader --enable-unsafe-swiftshader`), with no concurrent browser benchmarks. Software GPU compilation and rendering substantially limit how representative homepage CPU/animation measurements are of physical devices.
- Three homepage runs per build; the table uses metric-by-metric medians. One Work run per build is a single observation, not a statistically stable median. Small differences should not be treated as proof of improvement.
- JS transfer includes response headers; uncompressed JS and all request URLs are retained in the JSON summary. TBT is a startup lab metric, not INP or a drag-interaction latency measurement.

## Baseline

The immutable baseline is commit `b0cc913` (the existing hero-tagline PR), built before this refinement and served separately on port 4180. The baseline already lazy-loads Three.js on the homepage and does not request the 3D scene on `/work`.

| Route | Runs | Performance / 100 | FCP | LCP | TBT | CLS | JS transferred | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` mobile | 3, median | 50 | 3,459 ms | 3,909 ms | 8,101 ms | 0.00246 | 155,683 B | 8 |
| `/work` mobile | 1 | 88 | 3,011 ms | 3,161 ms | 0 ms | 0 | 4,366 B | 5 |

Individual homepage baseline runs:

| Run | Performance | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 50 | 3,463 ms | 3,913 ms | 7,448 ms | 0.00246 |
| 2 | 50 | 3,458 ms | 3,908 ms | 8,101 ms | 0.00246 |
| 3 | 50 | 3,459 ms | 3,909 ms | 8,558 ms | 0.00246 |

The baseline transferred 985,428 B in total on `/` and 426,365 B on `/work`. Both pages requested the 414,568-byte Liberation Sans TTF (414,888 B including transfer overhead), even though Work does not use the hero. The homepage also transferred the 405,830-byte reflection WebP (406,152 B with overhead). The longest homepage startup tasks are associated with WebGL initialization and the hero module under software rendering.

## Final build

The final production build was served separately on port 4174 and measured using exactly the same script, emulation and run counts. Final measured script assets were `index-DNEn320O.js` and `main-CxlPvnaw.js`. All eight baseline/final runs completed without Lighthouse warnings or runtime errors.

| Route | Runs | Performance / 100 | FCP | LCP | TBT | CLS | JS transferred | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` mobile | 3, median | 71 | 1,359 ms | 1,959 ms | 2,133 ms | 0.00246 | 158,965 B | 8 |
| `/work` mobile | 1 | 100 | 914 ms | 914 ms | 0 ms | 0 | 7,035 B | 4 |

Individual final homepage runs:

| Run | Performance | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 71 | 1,357 ms | 1,959 ms | 2,133 ms | 0.00246 |
| 2 | 71 | 1,359 ms | 1,960 ms | 2,030 ms | 0.00246 |
| 3 | 71 | 1,383 ms | 1,959 ms | 2,183 ms | 0.00246 |

### Paired comparison

| Metric | Homepage baseline → final | Work baseline → final |
| --- | ---: | ---: |
| Lighthouse performance | 50 → 71 | 88 → 100 |
| LCP | 3,909 → 1,959 ms | 3,161 → 914 ms |
| Startup TBT | 8,101 → 2,133 ms | 0 → 0 ms |
| CLS | 0.00246 → 0.00246 | 0 → 0 |
| Total transferred | 985,428 → 327,869 B (−66.7%) | 426,365 → 14,881 B (−96.5%) |
| Transferred JavaScript | 155,683 → 158,965 B (+3,282 B) | 4,366 → 7,035 B (+2,669 B) |

The final homepage request trace contains the 3,383-byte static SVG fallback (1,662 B transferred) instead of the 414,568-byte TTF, and the 157,480-byte mobile reflection WebP (157,802 B transferred) instead of the 405,830-byte original optimized reflection texture. The full font and original reflection asset remain available as source assets; they are not downloaded by this measured mobile visit.

The final Work trace contains only document, stylesheet, small UI script and favicon requests. It requests neither the hero module, reflection texture, fallback wordmark image nor TTF. The microinteractions and gallery support add a small amount of JavaScript; the total payload reduction comes from removing unnecessary font/hero assets and appropriately sizing the mobile reflection image, not from reducing every resource.

The homepage still has substantial startup TBT in this software-rendered, simulated 4× CPU test. These numbers do **not** establish a physical-device frame rate, input latency or an INP value. Lighthouse benchmark calibration also varied between runs (baseline homepage 2,371–2,482.5; final 2,415.5–2,687.5). The large transfer-size reductions are directly verified by request records; the exact CPU-timing gains should be treated as lab observations, with real mobile GPU profiling still useful before further visual-quality changes.

Compact results, exact settings, individual samples, warnings and script request URLs are committed in [baseline-summary.json](performance/baseline-summary.json) and [after-summary.json](performance/after-summary.json). Full Lighthouse audit JSON is generated under `artifacts/performance/` when rerunning the command above.
