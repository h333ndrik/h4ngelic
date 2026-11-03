# F21 — recognition line in the fixed header gap

Before: the returning-visitor sentence was absolutely positioned at 28% of the
hero, and mobile moved it to `top:74px` below the header.

After: it is fixed at `max(21px, env(safe-area-inset-top))`, horizontally
centered in the measured branding-to-INDEX gap. The line is constrained to that
gap, never overlaps either control, keeps pointer events off and uses light
header text with the existing dark shadow. Seven visitor phrases and the
first-visit hidden state are unchanged.

Evidence:

- `before-1440.png`, `before-390.png`, `before-320.png`.
- `after-1440.png`, `after-390.png`, `after-320.png`, `results.json`.
- `browser.txt`: V7 visitor tiers 6/6 across full/reduced motion.
- `footer-browser.txt`: footer suite 6/6.
- `navigation-browser.txt`: navigation suite 6/6.

Changed assertion: V7 no longer expects `top:74px` on mobile; it verifies the
fixed `21px` top, exact gap centering, subpixel-safe non-overlap and one line at
1440/390/320.
