# Retired: `hero-background-browser.mjs`

**Contract removed, not one stale assertion.** The suite opens with
`reducedMotion: 'reduce'` and waits for `#stage.is-ready` before sampling pixels
of the exposed WebGL background. Since the poster contract that state does not
exist: reduced motion renders `is-poster-static` with no WebGL and no
`__H4_TEST__`. On top of that it measures `.category-sublinks`, which the markup
no longer contains.

- Contract removed in: `003086f` (F29: keep the hero poster visible through
  boot, slow and failure) and `9e652aa` (hero: no 2d flash on boot); the
  `.category-sublinks` markup went away with the R1 rubric rows.
- Live coverage today:
  - poster and boot order: `tests/hero-poster-browser.mjs`,
    `tests/hero-boot-browser.mjs`
  - background ink: `tests/hero-background-ink.test.js` (unit),
    `tests/digital-ink-browser.mjs` (document ink end to end)
  - rubric rows: `tests/row-geometry-contract.mjs`
- Retired: 05.11.2026 (V3.2 final gate), user decision "pensionieren, nicht
  aktualisieren".
