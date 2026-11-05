# F21-r3 — greeting uses the HOLD-4 ghost treatment

## Reproduction

The r2 greeting still painted as a bright white sentence: `#e8e8e4` at opacity
`1`, `.28px` tracking, sentence case and a dark text shadow. The HOLD-4 hint is
muted, uppercase and much more widely tracked, so the two interface messages did
not look like members of the same visual system.

`before-1440.png` is the accepted F21-r2 footer evidence at the same desktop
profile. `after-1440-hover.png` and `after-1440-focus.png` are the new production
build; `after-320-hover.png` uses the longest visitor phrase.

## Fix

`src/ui-tokens.css` now owns one ghost contract used by the greeting:

| Property | HOLD-4 hint (unchanged) | Greeting |
| --- | --- | --- |
| Color | `rgb(240, 239, 235)` | same token/value |
| Rest/hover opacity | `.35` | `.35` |
| Focus opacity | `.35` | `.52` |
| Letter spacing | `.84px` | `.84px` |
| Case | uppercase copy | uppercase transform |
| Text shadow | none | none |
| Size | `21px` footer context | `14px` desktop header; `11px` touch; `9px` at `≤360px` |

The HOLD-4 rule itself was not changed. The greeting consumes the shared token
values and retains its header-specific size, which accounts for the intentional
footer/header typography difference. Only opacity and discrete visibility
transition; the 200 ms reveal never animates color, tracking or case. Touch keeps
the `.35` ghost permanently visible. Reduced motion is instant.

Keyboard focus uses opacity `.52` instead of `.35`. Against the measured
`rgb(36, 36, 36)` header background this is `4.71:1`, clearing WCAG AA for normal
text; hover remains the hint's exact `.35` (`2.91:1`). The uppercase letter-spacing
needed a narrow-size step so the longest phrase fits the branding-to-INDEX slot at
320 px without wrapping or running under INDEX.

## Proof

The contract was run against the production preview built at `data-build`
`31832b86dfe0`. Greeting and HOLD-4 hint both computed to
`rgb(240, 239, 235)`, opacity `.35` and letter spacing `.84px` in the desktop
hover state. Focus computed to `.52`; touch stayed `.35`; reduced motion measured
`0s` transition. The reveal produced no layout shifts and the greeting box stayed
unchanged.

At 320 px the longest phrase, `YOU'RE PART OF THIS PLACE NOW.`, stayed on one
`12.6px` line. Its text occupied `83.03–263.83px` inside the
`80.88–266.00px` header slot, with `scrollWidth == clientWidth == 185`.

## Verification totals

- `npm test`: **374/374 PASS**, 0 fail, 0 skipped.
- Production `v312-r3-greeting-browser.mjs`: PASS across desktop, 320 px, touch
  and reduced-motion profiles.
- Development regressions: `hero-boot-browser.mjs` **3/3**,
  `footer-v31-browser.mjs` **6/6**, `v7-visitor-tiers-browser.mjs` **6/6**,
  `v15-mobile-browser.mjs` **4/4**.

Raw computed styles, build marker, contrast values and screenshots are in this
directory.
