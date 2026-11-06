# World sound verification evidence

Checked 2026-11-04 on `v3.2-world-sound` from base `11e78a1`.

- `derivative-decode.json`: Chromium `decodeAudioData` evidence for all 12
  generated WAV/FLAC/M4A files. Every file decoded to the master frame count
  (loops 1,365,677; transitions 61,740), loop boundaries remained non-zero and
  within ordinary sample movement, with no audio-path long tasks and no errors.
- `results.json` and six profile screenshots: `tests/world-sound-browser.mjs`
  passed all 1440/390/320 × full/reduced profiles and missing-file degradation
  against the four committed M4A files.
- `mobile-interactions-current.json`: current branch fails the preserved
  no-cold-WebGL-on-About assertion at line 180.
- `mobile-interactions-base.json`: untouched base `11e78a1` fails identically.
  Stack diagnosis attributes the context to `mannequin-preview-loader.js` /
  `mannequin-preview.js`, not world sound. This is an OBSERVATION outside the
  audio scope.
- `npm test`: 385 passed, 0 failed outside the sandbox.
- Production build copied exactly the four M4A files with unchanged hashes.
