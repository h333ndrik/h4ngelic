# F24 — Other Side transition timing

The Other Side transition is now **900 ms in both directions at 30 FPS**, down from
1400 ms at 20 FPS. Displacement (180 px), smear (220 px), channel offset (9 px),
colour strength (.86), grid (18 × 12), `recoveryMs: 2350` and the reduced-motion path
are unchanged.

## One duration source

- `src/data/corruptionSettings.js` owns `transition.minimumDurationMs` and
  `maximumDurationMs` at 900 and `framesPerSecond` at 30.
- `src/main.js beginModeTransition` falls back to
  `corruptionSettings.transition.minimumDurationMs` instead of a local 1400.
- `src/data/livingDecaySettings.js` takes `modeTransitionMs` from that same setting.
- `src/xray.js` continues to pass the living setting into `snapshot.run`.
- `src/mode-snapshot.js` defaults and the `src/mode-snapshot.css` variable fallback
  are both 900 ms.

## Assertions changed

- `tests/mode-snapshot.test.js`: default mode duration 1400 → 900; the seeded phase
  boundary samples now advance 162/198 ms (18%/22% of 900) instead of 252/308.
- `tests/mode-snapshot-browser.mjs`: default/realtime/mobile duration 1400 → 900.
  UV maps are decoded before the wall-clock window, the native animation duration is
  asserted at 900 ±150 ms, and total capture/cleanup stays bounded below 2500 ms.
- `tests/smart-v3-browser.mjs`: captured event duration 1400 → 900.
- `tests/xray-browser.mjs`: event duration and log text 1400 → 900.
- `tests/living-decay-material.test.js`: default, explicit and fallback values 1400 → 900.

The pixel proof was narrowed to the typography band (120 px tall). The old 270 px clip
included the first carousel photograph, whose real skin tones were counted as
unexpected colours after F19 moved the card geometry. The restored frame allows a
maximum two-level difference per channel for ambient film dithering; the observed
maximum was 1 and no pixel differed by more than 2.

## Results

- `npm test`: **372/372 PASS**.
- `mode-snapshot-browser.mjs`: PASS. Native animation duration 900 ms; observed
  wall-clock 970 ms on desktop, 972/1162 ms at 390 and 970/1192 ms at 320.
- `xray-browser.mjs`: **6/6 PASS**; every captured event reports 900 ms.
- Reduced motion still switches instantly without a capture.

## Evidence

- `before-transition-1440.png` — supplied before state.
- `after-transition-mid-1440.png` — frozen frame at 360 ms of the 900 ms animation.
- `after-other-side-1440.png` and `after-other-side-390-reduced.png` — settled states.
- `mode-snapshot-results.json`, `xray-results.json`, `capture.json`.
- `node.txt`, `browser.txt`.

No merge, deployment, H4 MOSH LAB change or force push was performed.
