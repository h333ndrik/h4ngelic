# Current master-foundation validation evidence

Final source checkpoint: `57e2e794da7d1ee181616d5f2a45d783eaaf5a95`,
branch `feat/master-foundation`. Files are copied byte-for-byte from the named
reports/logs; their original timestamps and failure history are retained.
`manifest.json` records SHA-256 hashes (the manifest itself is not self-hashed).

The reports were gathered while implementing this milestone; their own
`checkedAt`/run timestamps identify individual checks. `regressions.json`
retains the initial carousel harness failure and its successful resumed run.
The layout summary contains the resumed 800/390/320px profiles; the earlier
1440/1000/801px checks passed before a software-GPU stall. Per-width layout
files are preserved separately, not rewritten to imply a single six-profile run.

Browser checks use headless Chromium 154, including ANGLE SwiftShader for
WebGL. They are not physical-phone or field measurements. Lighthouse 13.5.0
ran once for Home and once for Work with simulated mobile network/CPU
throttling; the raw reports and summary preserve the actual results. A
single-run summary labelled "medians" by the existing script is still one
measurement per page and does not imply repeated sampling.

Standalone checks execute the exact exported HTML bytes in an isolated
document with HTTP requests rejected: the managed browser blocks direct
file:// navigation. `package-verification.json` independently verifies that
tracked HTML, the exported HTML, the ZIP HTML member and both offline reports
all refer to identical bytes. The embedded original JPEG is unchanged.

The native-carousel wheel/touch harness permits at most two actual gestures after
an initial Chromium touch-packet issue was also reproduced on the unmodified
baseline. No production shortcut was changed to accommodate the harness.
Physical-device verification of that gesture remains REVIEW NEEDED.

No confirmed Tattoo, Flashes or Analog portfolio photographs exist yet; test
fixtures are not published. Real email delivery remains unconfigured; provider
acceptance in integration tests uses an injected local mock, not real mail.

Fresh JPG captures show the actual production Home, About preview and connected Work
at1440/390px, using only genuine published content.
