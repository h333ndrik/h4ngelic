# World sound merge-pass evidence

Checked 2026-11-04 on `v3.2-world-sound` after fetching `origin`.

- `origin/main`: `9123a00b21b9a7d3873fe97ba7c36fb90b74c3e5`, merge commit for
  PR #20. It is an ancestor of the sound branch; `git rebase origin/main`
  reported `Current branch v3.2-world-sound is up to date.` No conflict.
- `npm test`: **385 passed, 0 failed**.
- `world-audio-formats.json`: **12/12 WAV/FLAC/M4A files** decoded at exact
  master frame counts, with zero audio-path long tasks.
- `world-sound.json`: **6/6 profiles**, 1440/390/320 × full/reduced, both modes,
  plus degraded path.
- `mode-audio-browser.mjs`: PASS.
- `sound-controls.json`: **8/8 profiles**.
- `smash.json`: PASS at 1440/390/320.
- `xray.json`: **6/6 profiles**.
- `v31-ui.json`: **6/6 profiles**.
- `audio-manifest.txt`: production build passed and contains exactly the four
  committed M4A files with unchanged SHA-256 hashes.
- OBSERVATION, outside audio scope: the preserved mobile cold-WebGL test still
  fails identically on base `11e78a1`; no V3.1 or mannequin code was changed.
