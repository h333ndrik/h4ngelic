# F18 — constant native cursor

Before: target hover used `h4ngelic-cursor-hover.svg` at hotspot `10 2`, and
pressed used the separate pressed asset. After: one base image per mode at
hotspot `9 2` for body, links, hover, active, INDEX, NAAVI and open INDEX links.

Evidence:

- `before-1440.png` and `before` values in `../before-baseline.json`.
- `after-1440-motion.png`, `after-1440-reduced.png` and `results.json`.
- `icon-browser-results.json`: four icon/cursor profiles, including both
  modes, reduced motion, and touch 390/320.

Tests updated: `ref09-icons-browser.mjs` now asserts the constant cursor and
one base preload; `v31-navigation-browser.mjs` and `hover-browser.mjs` no longer
expect a hover asset. Browser suites passed serially before build. Native
operating-system cursor pixels are not captured by browser screenshots.
