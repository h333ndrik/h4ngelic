# F22 — hero bar moves out instead of fading

Before: both hero-bar halves shared an opacity ramp toward zero.

After: both keep opacity `1` and use the same percentage
`translate3d(0, var(--hero-bar-shift), 0)` from `0%` to `-100%` of their own
height. The existing hidden/inert state begins only after the full shift.
Reverse scrolling restores the bar; reduced motion switches directly between
the two endpoint poses. No layout space is removed.

Evidence:

- `before-1440.png` and the before record.
- `after-1440-motion.png`, `after-1440-reduced.png` and `results.json`.
- `browser.txt`: motion suite 6/6 across full/reduced motion.
- `motion-results.json`: full per-profile measurements.

Changed assertions: scroll-motion now checks monotonic `shift` instead of
opacity; V3.1 motion verifies constant opacity, percentage-matched translation,
full-height displacement, hidden/inert and instant reduced-motion endpoints.
The superseded V3.1 motion test also had to navigate to Work through its real
hero-nav link and inspect current rubric headings, because INDEX is now 00–03.
