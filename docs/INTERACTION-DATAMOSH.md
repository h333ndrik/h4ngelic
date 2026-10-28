# Living Decay — implementation and verification

Review branch: `feat/interaction-datamosh`, based on rollback commit `7e5fdc3` from [PR #12](https://github.com/h333ndrik/h4ngelic/pull/12). Existing reports retain their original measurements. [Design, content editing and calibration](LIVING-DECAY.md) describe the final architecture; [End Reveal](END-REVEAL.md) documents the exact h4 silhouette.

## Pixel paths and input

Native View Transitions capture the actual old/new rendered page, including typography, imagery and open dialogs, for mode and internal route transitions. SVG `SourceGraphic` displacement adds macroblocks, horizontal smearing, channel separation and irregular phased recovery. Application JavaScript never receives those page bitmaps. Native snapshot deformation is not recursive frame feedback or encoded-video keyframe manipulation.

Hover and click use the same source-pixel graph on a safe inner label/image, with the actionable parent left live. They do **not** call the native View Transition API: its preparation phase was observed swallowing an immediate real click even with the root excluded. The final live-filter path passes immediate hover→click and repeated-click checks with exactly one trusted action per click. Filters, original inline priorities, sampling maps and finite animation frames are restored or released afterward.

Canvas adds actual source/history advection on the material and artwork surfaces. Opaque history starts with source pixels, feeds subsequent damage, and reconstructs a rotating fraction of cells from current source. It does not rasterize arbitrary live DOM. The temporal-image principle is inspired by Supermosh; this implementation is independently written. No GPL Supermosh code, FFmpeg pipeline or new runtime dependency was added.

| Trigger | Configured effect duration | Pixel path |
| --- | ---: | --- |
| Focus | 240ms | Gentle material impulse |
| Hover | 340ms | Live inner visual + material |
| Click | 420ms | Live inner visual + stronger material rupture |
| Section entry | 380ms | Directional material impulse |
| Internal navigation | 600ms | Actual old/new page snapshots |
| Hold `4` / released `333` | 720–920ms | Strongest page breakup/reconstruction |

Durations are configured animation lengths, not guarantees of total browser completion time. The one-second `4` hold precedes the transition. Reverse uses a distinct reconstruction curve. Existing mode/audio choreography and hero physics remain intact.

Discrete events are delegated and rate-limited; accepted geometry is cached. A physical hover-entry latch prevents repeated stationary-hover captures. Actual scroll, text, section and projected-logo movement share bounded motion samples at no more than 12Hz. The material renderer retains at most two damage regions. A default 35px pointer radius is adjustable from 25–45px; output pixels are clipped to the active influence shapes, including stretched history blocks.

Normal, hidden documents and reduced motion suppress added interaction corruption. Blur, route changes, disposal and canceled input clear pending work. Modified/right/middle clicks retain normal behavior. Editable fields, disabled/inert controls and protected instructions are excluded. Touch has deliberate tap/hold behavior without synthetic magnetic hover. Keyboard focus and native activation remain usable.

## Verified browser evidence

- **190 Node tests pass**, including routing/content, physics, temporal history, native ownership, motion paths, calibration bounds, manual/automatic seeds, cadence and stale observer cleanup.
- **Normal:** desktop 1440px, 390px and 320px; 30 viewport captures and 300 edge samples confirm the uninterrupted fixed neutral gradient through Home, Work, About, scrolling and `4`/`333` restoration. No runtime errors.
- **End reveal:** desktop, 390px, 320px and reduced motion confirm the exact original h4 fill path, no early watermark, scroll progression, foreground instruction, hidden pause and route scope. No extra renderer.
- **Living Decay:** 1000px, 390px, 320px and a 320px development-panel profile pass. The new asset stays gesture-lazy, Work/About create no WebGL context, seeds persist through internal navigation, new automatic activations differ, and hidden/reduced/Normal stop active rendering.
- **Interactions:** desktop, 390px touch, 320px touch, reduced motion and isolated real-pixel proof all pass. Tests include stationary hover settling, real leave/reentry, rapid trusted clicks, native route ownership and cancellation.

| Actual image observation | Recorded result |
| --- | ---: |
| Bright Work glyph pixels moved in local proof | 916 |
| Outside pixels changed beyond a 1px raster-edge fringe | 0 of 44,892; byte-identical |
| Final local image after cleanup | Exactly equal to original |
| Application JS readbacks in isolated label proof | 0 |
| Default idle pixels changed over 1.8s, 1000px | 17,852 |
| Default idle pixels changed over 1.8s, 390px / 320px | 1,332 / 1,713 |
| Damaged pointer pixels at radius 25 / 45 | 1,202 / 4,232 |
| Damaged pixels outside either requested pointer radius | 0 |
| Initial image mismatch after restoring seed/settings/time | 0 |

The local SVG edge can change one adjacent antialiased device pixel by one channel level. The outside-byte assertion therefore includes an explicit one-pixel raster fringe. This does not relax the requirement that actual bright glyph information moves or that the final full image restores exactly. The compact readback recorded 895.0MiB maximum browser/test process-tree RSS, under its 2GiB abort guard; this is neither application heap nor GPU-memory usage or a phone estimate.

The development panel has 18 live sliders, seed and regeneration; tests exercise automatic fresh regeneration, repeated manual seed 321, current-seed display, 35→25→45 radius, ten disabled channels, keyboard collapse/close and 320px bounds. Manual seed 0 also has a Node regression. Unrelated calibration changes do not force ambient paints: five changes in 50ms produce zero extra frames; material changes are coalesced into the existing cadence. Production emits no calibration panel module, CSS or text.

Reproduction:

```sh
npm test
H4_BASE_URL=http://127.0.0.1:5173 npm run test:normal-theme
H4_BASE_URL=http://127.0.0.1:5173 npm run test:end-reveal
H4_BASE_URL=http://127.0.0.1:5173 npm run test:living-decay
H4_BASE_URL=http://127.0.0.1:5173 npm run test:interaction-mosh
H4_BASE_URL=http://127.0.0.1:5173 npm run test:regression
npm run build
```

## Final build, offline delivery and measurements

Production build passes and prerenders six routes plus 404 in preview/noindex mode. The approximately 599kB minified hero chunk retains Vite's existing size warning; it stays homepage-only and lazy. No hero redesign or new dependency was introduced.

The 15 existing integration browser suites pass. After adding mobile Phase 1, the focused mobile suite (390px, 320px, reduced motion and desktop), existing Easter/ink suite and existing public mode-control suite were also rerun successfully. [Mobile implementation and the explicit Phase 2 stop point](MOBILE-INTERACTIONS.md) explain the added controls. The native modal image proof also passes: 11,372 bright artwork pixels moved; restored output differed by at most one channel level on 83 of 171,600 channels (mean absolute difference 0.000484), with no remaining image filter. This software-renderer rounding is reported separately from the exactly restored local-label proof.

The exact exported HTML passes 1440px, 390px and 320px offline checks with every HTTP request blocked and zero runtime errors. A separate non-reduced-motion 390px run starts directly on Work, verifies native keyboard and mobile four-/three-tap entry/return, releases every sampling map and creates zero WebGL contexts. This managed browser blocks `file://` navigation, so the harness executes the exact exported bytes via `setContent` with all networking rejected; direct `file://` navigation was not tested here.

| Lighthouse mobile observation | Home, median of 3 | Work, 1 run |
| --- | ---: | ---: |
| Performance score | 68 (individual 71, 68, 68) | 100 |
| First Contentful Paint | 1.505s | 1.057s |
| Largest Contentful Paint | 2.406s | 1.360s |
| Total Blocking Time | 2.994s | 0ms |
| Cumulative Layout Shift | 0.002925 | 0 |
| Transferred JavaScript | 194,843 bytes | 41,752 bytes |
| Requests | 10 | 5 |

These are fresh Lighthouse 13.5 measurements against the final built server, using mobile simulated throttling and Chromium SwiftShader. They are loading observations, not physical-phone FPS or a matched causal before/after comparison. Home still has substantial startup blocking in this lab; its preserved Three.js hero is not represented as lightweight or a perfect score. Work has no hero download/initialization. Background image synthesis is a one-time seed/configuration cost; deliberate regeneration tests observed approximately 235ms desktop / 54ms mobile preparation, distinct from the capped 6/3Hz idle draw cadence. No claim of real-device performance is inferred from that emulation.

[Recorded validation summary](validation/living-decay-final.json) preserves the actual measurements and delivery checksum. Raw screenshots and full Lighthouse traces remain in the workspace's ignored `artifacts/` directory. Run `node scripts/measure-performance.mjs --base-url http://127.0.0.1:4173 --label local --home-runs 3 --work-runs 1` against a freshly started built preview to reproduce the measurement setup.

Delivery: [self-contained HTML](previews/h4ngelic-preview.html), 5,454,634 bytes; [ZIP](previews/portfolio-preview.zip), 3,769,778 bytes. HTML SHA-256: `687e002333e96a51ef9858272b86a8da9d4dd2f799ceba74c87705fb6b2c4f94`. The ZIP contains that exact checked HTML, instructions and the unchanged existing sound samples. The regular website retains lazy homepage-only Three.js; the offline file deliberately combines its bundles to work without a server.

The repository is private, so GitHub file links require an authenticated browser. Public preview tunnel endpoints were blocked by this environment; no working public preview URL is claimed. No repository visibility change, production deployment or merge was performed. Phase 2 remains unimplemented pending explicit approval after review.
