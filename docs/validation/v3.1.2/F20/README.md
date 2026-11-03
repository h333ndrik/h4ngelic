# F20 — defer tattoo texture, keep the poster critical

Before: `initialize()` awaited the tattoo texture before the chrome could render
its first frame, and no hero module/font/texture preloads were declared.

After: the static poster paints from critical CSS; the chrome compiles and
renders frame 1 without artwork, then starts the texture load asynchronously.
The poster remains until `is-ready` and reduced motion still never imports
WebGL. A Home-only inert template activates modulepreload, font preload and
responsive high-priority texture preloads; it is never activated on Work/About.
A high-priority poster preload keeps first contentful paint below 100ms in the
production preview. The poster link is removed from prerendered interior routes.

Evidence:

- `before-1440.png` and the before record in
  `../F18/before-measurements.json`.
- `hero-1440-motion.png`, `hero-390-motion.png`,
  `hero-320-motion.png`, plus the reduced variants.
- `browser.txt`: six F20 profiles against the production preview. FCP medians:
  60/64ms desktop, 64/40ms 390, 48/64ms 320 (full/reduced).
- `poster-browser.txt`: existing poster suite 6/6.
- `v28-browser.txt`: existing V28 hero/CLS suite 6/6.
- `results.json`: preload URLs, request timing, first-frame artwork state and CLS.

Changed assertions: the new F20 suite checks the async first frame, Home-only
preloads, exact texture request count, poster FCP under 100ms on the production
preview, CLS 0 and the cold-Work no-hero-assets boundary.
