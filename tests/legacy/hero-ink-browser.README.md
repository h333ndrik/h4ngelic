# Retired: `hero-ink-browser.mjs`

**Contract removed, not one stale assertion.** The suite opens every profile
with `reducedMotion: 'reduce'`, waits for `#stage.is-ready` and then paints the
WebGL wordmark through `window.__H4_TEST__`. Since the poster contract, the hero
under reduced motion is deliberately `is-poster-static`: no WebGL context, no
`__H4_TEST__`, no mesh. Mesh ink under reduced motion is therefore not a
behaviour that can exist any more — an update would have to assert something
else entirely.

- Contract removed in: `003086f` (F29: keep the hero poster visible through
  boot, slow and failure) and `9e652aa` (hero: no 2d flash on boot).
- Live coverage today:
  - boot, entrance and failure path: `tests/hero-boot-browser.mjs`
  - poster contract under reduced motion: `tests/hero-poster-browser.mjs`,
    `tests/v312-f20-hero-browser.mjs`
  - ink: `tests/digital-ink-browser.mjs` (document ink, 6 profiles),
    `tests/hero-background-ink.test.js` and `tests/easter-eggs.test.js`
    (unit contracts for the ink guard and imprints)
- Retired: 05.11.2026 (V3.2 final gate), user decision "pensionieren, nicht
  aktualisieren".
