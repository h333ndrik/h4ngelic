# V3.1 recorded verification

Runtime source: `daeaff83ec0b8a6b48873c3d77d63e3a2d706ead`. Original supplied assets: `f1841e4`. All checks ran serially in Chromium 154 / ANGLE SwiftShader; device widths are browser emulation, not physical-device measurements. These files record actual results, not planned checks.

| Check | Actual coverage | Evidence |
| --- | --- | --- |
| `npm test` | 357 passed, zero failures/skips, 3416.202864ms | [Node log](node-tests.txt) |
| Navigation | 1440/390/320 normal +320 reduced, both realities; INDEX/cursor/NAAVI/typography/cold Work | [Navigation](navigation.json) |
| Footer | Same four profiles, both realities; count persistence/discovery, local scrollports, keyboard, baseline and link parity | [Footer](footer.json) |
| Calm motion | 1440/390/320 × normal/reduced, both realities; synchronized poses, exact reversal, hero bar fade/inert | [Motion](motion.json) |
| Shared UI | Same six profiles, both realities; hover/form/radius/borderless controls, real-photo 1.1 enlargement | [UI](ui.json) |
| On Skin | Four profiles, all eight genuine photos in both realities; native mouse/touch/keyboard and retained multi-image stress fixture | [Carousel](carousel.json) |
| Gallery | 1440/390/320; geometry, decoding races, modal keyboard/touch, error path and cleanup | [Gallery log](gallery.txt) |
| Inquiry | Six normal/reduced profiles; validation, uploads/drafts/context, controlled failure/acceptance | [Inquiry](inquiry.json) |
| Sound controls | 1440/810/390/320 × normal/reduced; no autoplay/early MP3 fetch, range/Escape, persisted preferences | [Sound controls](sound-controls.json) |
| Actual SMASH | 1440/390/320; exact served bytes, one fetch/decode and cached restart, live fades, mute/volume, routes, 333↔4 | [SMASH](smash.json) |
| Build/export | 19 prerendered routes +404, preview/noindex; downloadable export | [Build log](build.txt) |
| Digital payload | Six fresh before/after production comparisons with CDP and Resource Timing | [Payload](digital-payload.json) |
| Production routes | 19 semantic static routes and 17 live route records; redirects/404/metadata/no-JS/cold interiors | [SEO](seo.json) |
| Exact offline export | Three reduced profiles at 1440/390/320 and native 390 normal motion touch/memory checks, HTTP blocked | [Controls](offline-controls.json), [Native](offline-native.json) |
| Package integrity | Both offline reports match HTML hash/size; ZIP contains the same HTML; original Digital/JPEG/MP3 bytes retained | [Package](offline-package.json) |

Ordinary-page checks report zero unexpected console/page errors and zero horizontal page overflow. Inquiry deliberately returns a mocked 503 once per profile; those expected network diagnostics are recorded separately. The successful 202 response is also mocked: this does **not** verify real mail delivery. Gallery error-path fixtures likewise do not represent published broken images.

The actual MP3 container duration is 100.310204s; Chromium decodes 100.270s after encoder padding. One full natural end was observed without seeking or shortening (100.836s wall time including scheduling). The final five-second gain envelope, site-sound restoration and a subsequent cue passed. Standalone 390 additionally starts/stops/restarts the exact embedded track with one decode; its bytes are necessarily included in the downloaded HTML, while runtime decoding still waits for the trusted gesture. Served pages fetch the MP3 only on first SMASH use.

Digital preview widths halve. Image body bytes change 236494→127562 at 1440px,127562→40410 at 390px, and40410→40410 at 320px because the baseline already selected the smallest 320 variant. **Do not claim all route bytes decreased.** The newly populated eight-photo Work archive transfers more total bytes at some widths; the full before/after values are retained in the payload report and project progress table.

Initial failures were resolved and then rerun: mobile footer native focus exposed only part of a target; fractional carousel end positions left the final arrow enabled; explicit resting outline resets were required for the requested surfaces. Harness corrections separate real route completion from an early `data-page` update, parse CSS pixel values correctly, compare matching pointer states, use real keyboard focus, account for native input/textarea placeholder line-height differences, and set up actual clipped-photo gestures without automation scrolling. The payload test explicitly permits the measured 320 minimum-variant plateau. Final reports above contain the successful complete runs.

Build output retains Vite's large-chunk warnings for the existing Three.js and intentionally single-script offline export; these are warnings, not build errors. Cold served Work/About still load no Three.js scene/font/reflection resources. No new dependencies, API adapter changes, hero geometry/physics changes, merges or deployments were performed.

The downloadable HTML is 24,484,734 bytes, SHA-256 `6c11473dd0360a15c5e459ae8ee95deeffa3c34c01cad0ffe790bd5d734ce001`. ZIP is 17,305,532 bytes, SHA-256 `61da29cabd658cb4fee3eb158e0b98dbc81bee65fb8f363ccef7c9abf5932770`.
