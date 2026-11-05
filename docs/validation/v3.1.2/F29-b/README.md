# F29-b — visible hero entrance and breathing

## Reproduction

The first WebGL frame only switched the canvas opacity. On a dark poster the
arrival was not perceptible, and the old breathing range (`.8↔1`, ±0.4%) was too
subtle for a live user.

## Fix

`h4:heroready` adds `is-entering` for 760 ms. The canvas runs a 700 ms
`hero-wordmark-arrive` animation from opacity 0, `translateY(8px)` and scale
`.985` to the final pose. The loading poster now breathes from opacity `.55` to
`1` and scale `.988` to `1.012`. Both use only transform/opacity. Reduced motion
and failure skip the entrance; reduced motion shows the final poster instantly.

## Proof

The production event starts at opacity `0`, scale `.985`, translate `8px`; the
mid-animation screenshot shows the partially revealed wordmark and the final
state is opacity `1`, `matrix(1, 0, 0, 1, 0, 0)`, with CLS `0`. Breathing
sampled `0.550–1.000` opacity and `0.988–1.012` scale. Failed and reduced-motion
paths stayed static. The FCP guard remained green (medians 44–108 ms, all below
200 ms). Screenshots and raw samples are in this directory.
