# V3 verification evidence

Tested UI source: `d0bcb15f5b46dbd1806f731e60a1e61b78109fe2`. Tests ran serially in Chromium 154/SwiftShader on 2026-10-28. Production build and offline export are from this source commit. Documentation/evidence delivery follows in a separate commit. No deployment or main merge was performed by this task. The foundation was independently merged through PR #19; current main’s API wrapper was preserved in the feature branch.

- `node-tests.txt`: 348/348 pass; `footer-node.txt`: 8/8 after accessible count-description fix.
- `inquiry.json`:1440/390/320, normal/reduced; real uploads/draft preservation and mock-provider HTTP handling (not actual mail delivery).
- `integration.json`:1440/800/390/320, INDEX/NAAVI, Contact/history, all seven greeting bounds, footer baseline, audio state, both realities and empty runtime-error lists.
- `native-carousel.json`:1000/390/320 actual wheel/drag/touch/keyboard, in-place enlargement and unchanged context. Repeated reflection images exist only in the browser harness, never published as Tattoo work.
- `sound-controls.json`:8 profiles; `works-motion.json`:4; `digital-gallery.txt`:3 ordinary Digital viewer profiles.
- `snapshot.json`:real glyph-pixel displacement, exact restoration, no zoom, desktop/mobile/reduced cleanup and isolated timings. Three PNGs show original/displaced/restored typography.
- `memory.json`:4 profiles, exact byte handoff, two buffers and retained seeds through INDEX navigation/resize, zero interior WebGL.
- `hero-browser.txt`:desktop physics/pushing/tumbling/return, mobile touch, reduced pause and no-WebGL fallback.
- `build-export.txt` and `production-browser.txt`:11 semantic routes+404, redirects/no-JS/metadata and cold interior/Home Contact without Three.
- `standalone.json` and `standalone-native.json`:exact exported bytes run offline with HTTP rejected,1440/390/320 and native390 touch; no runtime errors. Managed browser blocks file navigation, so exact HTML was executed through the harness with its network disabled.
- `package.json`:7,768,382-byte HTML, byte-identical ZIP member, genuine original JPEG embedded unchanged, no carousel fixture content.
- `performance-summary.json` and Lighthouse reports:one simulated-mobile run each on current production output. Home 67 (FCP1710ms,LCP2462ms,TBT3667ms,CLS0), Work 99 (1318/1886/26/0). These are software-GPU lab results, not field FPS.

The optional-blending investigation changed only two declarations in a temporary copy of dist. Mobile already uses normal blending, so this was not a released styling change. Its separate report scored 68/TBT3164ms; it did not establish a cause or justify modifying the accepted hero. No source change resulted. Saved LHR aggregates cannot attribute the extra long task without retained traces. Hardware/paired-trace review remains REVIEW NEEDED.

Earlier failures were resolved without weakening product requirements: obsolete Contact/data-URI/menu test references; nativefocus scrolling in a carousel keyboard probe (real click/tap context stayed fixed); a 300ms initial software-GPU frame probe replaced by a bounded actual-frame observation. Read-only code review's accessible visit-count description was corrected. Final listed reports pass; individual earlier logs are described in PROJECT_PROGRESS.md rather than presented as current passes.

Configured native animation 1400ms is distinct from total gesture/preparation/capture/cleanup latency. Actual timings are retained in integration/snapshot JSON. Missing photos, exact private MP3, mail configuration and unpublished Loose Thread content remain external blockers.


Delivery is open for review in [PR #20](https://github.com/h333ndrik/h4ngelic/pull/20), based on main after its independent foundation merge. `delivery-verification.json` confirms uploaded HTML/ZIP blobs and sizes match local tested files. `backend-adapter.json` records syntax/import and loopback 405 checks on the unchanged user-added Vercel wrapper; no actual mail delivery or deployment was attempted. The frontend/export inputs remain identical to the tested UI source.
