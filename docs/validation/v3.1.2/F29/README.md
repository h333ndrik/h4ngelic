# F29 — hero boot guard

## Reproduction

The production preview was sampled three times normal, three times on Slow 3G,
once with `main-*.js` blocked, and once after a hard reload. Normal runs reached
`is-ready` in 82–140 ms. Slow 3G started the hero module after 2663–2697 ms and
showed only the poster with no progress text after seven seconds. A blocked
module left the stage at `stage` with no failure state. The Vercel branch preview
still returns 302 to Vercel SSO, so remote reproduction remains blocked.

## Fix

`prepareHero()` now owns `booting → ready | slow | failed`. The poster is painted
by critical HTML/CSS, breathes with transform/opacity only, announces a slow
boot after six seconds, and becomes a permanent static wordmark with explicit
status text if the module import fails. Reduced motion starts with the static
poster and no animation. The ready event is emitted at the existing first real
WebGL frame, preserving the crossfade.

## Proof

The production-preview prevention suite passed at 1440/390/320:

| State | Measured |
| --- | --- |
| booting | poster opacity 0.800–0.8005, `hero-poster-breathe` |
| ready | poster 0, canvas visible, `data-hero-loading=false` |
| slow (6 s) | `is-boot-slow`, poster opacity ≈0.904, slow status text |
| failed | `is-boot-failed`, poster opacity 1, canvas `display:none` |

The same failure state also survives navigating to About and back to Home.

Raw data: `after/results.json`. Before data and the Vercel blocker:
`before/baseline.json` and `before/vercel-blocked.txt`.
