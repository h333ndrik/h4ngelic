# F19 — fixed carousel cards, flat depth and viewport wheel

Before: resting images used `contain` inside an oversized reserved frame; cards
were approximately 300px wide but 700–737px tall, and every card had
perspective scale/rotation. Vertical wheel over the strip scrolled the page.

After: every resting card frame is exactly 300×420 with a centred `cover`
image. The expanded state remains `contain`. Perspective, depth scale and card
rotation are removed; lift and neighbour shift remain. Wheel input is captured
only on the enhanced `.drift-viewport` and converted through the shared
horizontal momentum path. Touch remains `touch-action: pan-y pinch-zoom`, so
vertical page panning and horizontal swipe coexist.

Evidence:

- `before-1440.png`, `before-390.png`, plus the before measurements copied in
  `before-measurements.json`.
- `after-1440.png`, `after-390.png`, `after-320.png` and `results.json`.
- `browser.txt`: six carousel profiles, 1440/390/320 × full/reduced.
- `ui-browser.txt`: six UI profiles.
- `mobile-browser.txt`: four mobile touch profiles.
- `performance.json`: drift RAF measurements at all three widths.

Changed assertions: resting fit is now `cover` rather than `contain`; depth
expects no perspective/rotation/scale; wheel inside the viewport now drives
the carousel while page scroll stays fixed; mobile expansion growth is measured
against the fixed 300px card rather than requiring a desktop-sized 1.2× width
inside a 320px viewport.
