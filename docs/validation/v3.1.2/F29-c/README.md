# F29-c — premium hero entrance

## Reproduction

The previous ready transition used one 700ms ease-out fade with only 8px of
travel and `.985` scale. On the dark stage it read as a subtle brightness change,
not as the wordmark physically arriving.

## Fix

- Poster crossfade: opacity `1 → 0` over **900ms**.
- Canvas opacity: `0 → 1` over **450ms**.
- Canvas transform: `translateY(14px)` and `scale(.96)` to the identity pose over
  **1100ms** with `cubic-bezier(.16, 1, .3, 1)` (expo-out).
- `is-entering` remains set for the 1100ms transform window and only marks
  compositor `will-change`; no animation keyframes remain.
- No `filter: blur` is used. The wordmark's reflection is already part of the
  rendered canvas, so the whole figure arrives without a second GPU layer.
- Reduced motion disables both transitions; failed boot skips the entrance and
  keeps the poster; slow boot continues breathing until ready.

## Timeline trace

Production build `data-build="78e3fc92f003"` measured:

- start: opacity `0`, `matrix(.96,0,0,.96,0,14)`, transition
  `opacity 450ms, transform 1100ms`;
- mid-frame: partially painted wordmark with a non-identity transform;
- opacity endpoint: **675ms**;
- transform endpoint: **1016ms**;
- entrance marker: **1150ms** wall clock, inside 1100ms ±10%;
- end: opacity `1`, identity matrix, poster opacity `0`, CLS **0**.

The production performance run measured Home FCP/LCP **116ms / 116ms**, below
the 200ms guard. F20 passed all six width/reduced-motion profiles; interior FCP
medians remained 48–140ms.

Raw samples: `results.json` and `perf/results.json`. Screenshots show the
mid-entrance state, final state, reduced-motion poster and skipped failure path.
