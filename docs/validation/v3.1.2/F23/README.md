# F23 — Contact form offset and compact intro gap

Before: intro-to-form spacing was `clamp(34px, 6vw, 75px)` and the form started
on the same left edge as the intro.

After: the intro gap is `clamp(14px, 2vw, 28px)` and the form uses
`margin-left: var(--inquiry-form-offset, clamp(60px, 24vw, 640px))`. The intro
stays on the page inset; at ≤600px the custom property resets to `0px`, the form
stays single-column and input heights remain at least 44px. No horizontal
overflow is introduced and `scroll-margin-bottom: 88px` remains unchanged.

Evidence:

- `before-1440.png`, `before-390.png`, `before-320.png`.
- `after-1440.png`, `after-390.png`, `after-320.png`, `results.json`.
- `browser.txt`: inquiry suite 6/6 across full/reduced motion.
- `ui-browser.txt`: UI suite 6/6.
- `inquiry-results.json`: exact form/draft/upload/submit measurements at all
  six profiles.

Changed assertions: the inquiry suite now measures intro-to-form offset,
resolved form margin, custom-property reset, one-column mobile grid, 44px
targets, unchanged scroll margin and page overflow. It also uses the configured
`CHROMIUM_PATH` instead of a hardcoded Linux path.
