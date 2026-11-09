# Retired: `standalone-native-browser.mjs`

**Contract removed, not one stale assertion.** The suite loads the exported
`h4ngelic-preview.html` and taps the fixed `[data-mobile-mode]` glyph with real
CDP touch events: four short taps enter the Other Side, three return, long
presses and drags are ignored, and the tap trace keeps trusted events only.

The control is hidden on every pointer since B-F32 (rev): `.mobile-mode` is
`display: none` by default and again under `(pointer: coarse)` (`2ac40ec`, user
decision after the glyph read as a permanent cursor). The suite asserts
`[data-mobile-mode]` is visible and therefore fails at that line in every
profile.

- Contract removed in: `2ac40ec` (B-F32 rev), `2709d5e` (HOLD-4 hint stays).
- Live coverage today:
  - `tests/standalone-browser.mjs` — the offline export at 1440/390/320,
    including the one-second native touch HOLD-4 entry on phones, the ignored
    reverse hold, the triple-3 return, eight photos, Home Contact and a
    zero-request runtime.
  - `tests/mode-hold.test.js` — the hold gate and its disposal rules.
  - `tests/touch-ink.test.js` — gesture filtering for real touch contacts.

**Coverage that is not replaced:** a per-tap trace of CDP touch events on the
removed control. The hold entry it replaced is covered end to end in
`standalone-browser`.
