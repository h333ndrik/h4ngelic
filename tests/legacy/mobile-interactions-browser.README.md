# Retired: `mobile-interactions-browser.mjs`

**Contract removed, not one stale assertion.** The suite drives the fixed
`[data-mobile-mode]` h4 glyph at the bottom right: four real CDP taps enter the
Other Side, three return, a swipe or a long press must not count, and every
step is checked against ink, WebGL and world-sound side effects.

That control is gone on touch. B-F32 (rev) removed the floating glyph after the
user reported it as a permanent cursor-like mark over the page (`2ac40ec`,
`src/mobile-mode.css` hides `.mobile-mode` under `(pointer: coarse)`). With the
button `display: none` there is no touch target to tap, so the suite's whole
premise cannot execute; it times out at `controlPoint()` in every profile.

The touch entry to the Other Side is now the HOLD-4 hint, which stays visible
(`2709d5e`): one second of contact on
`[data-other-side-hint]`, keyboard `4` on fine pointers.

- Contract removed in: `2ac40ec` (B-F32 rev), `2709d5e` (HOLD-4 stays).
- Live coverage today:
  - `tests/mode-hold.test.js` — the one-second hold gate, entry-only gating,
    pending holds that cannot complete after the gate closes.
  - `tests/mode-taps.test.js` — the remaining tap-sequence logic of the
    controller (still unit-testable, even though no surface exposes it on
    touch).
  - `tests/mobile-parity-browser.mjs` — touch parity: system cursor, HOLD-4
    hint present, floating glyph `display: none`, press state, footer rows.
  - `tests/v15-mobile-browser.mjs` — touch carousel swipe/expansion, INDEX,
    footer taps at 390/320 in both motion preferences.
  - `tests/touch-ink.test.js`, `tests/easter-eggs.test.js` — ink lifecycle and
    gesture filtering at unit level.
  - `tests/smash-v31-browser.mjs`, `tests/v31-ui-browser.mjs` — mode
    transitions in both worlds.

**Coverage that is not replaced:** real multi-touch gestures through CDP,
per-touch ink-mark creation and the "a cold SPA route allocates no second
WebGL renderer" budget were only exercised here. If the floating control or a
comparable touch affordance returns, this suite should be lifted to the new
target instead of being restored as-is.
