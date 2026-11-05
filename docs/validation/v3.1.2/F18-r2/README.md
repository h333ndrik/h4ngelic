# F18-r2 — cursor contract

## Reproduction

The pre-fix baseline enumerated `/`, `/work/tattoos` and `/#contact` at
1440/390/320, including footer links, NAAVI and VISIT. No local offender was
reproduced, but the user-visible footer switch on the Vercel preview could not be
replayed because that deployment redirects to Vercel SSO. The remaining risk was
state-scoped CSS overriding a mode cursor.

## Fix

The existing one-image/one-hotspot cursor variable remains the only visual
cursor. `html.h4-custom-cursor` is set by the app, and a final high-specificity
rule in `cursor.css` binds every interactive element to
`var(--h4-native-cursor)`. The cursor is never hidden; image and hotspot stay
constant in rest, hover and active states.

## Proof

`tests/helpers/cursor-contract.mjs` enumerates every painted element and checks
the exact SVG filename plus the `9 2` hotspot. `tests/hero-boot-browser.mjs`
checks `/`, `/work/tattoos` and `/contact` at 1440/390/320, including footer
moshlab, VISIT, SMASH, Instagram and NAAVI at rest, hover and active. All
offender arrays are empty. Raw baseline and final data are in this directory.
