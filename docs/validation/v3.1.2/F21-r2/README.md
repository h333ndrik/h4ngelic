# F21-r2 — hover-only returning greeting

## Reproduction

The returning-visitor line was fixed to the header but painted permanently after
the first repeat visit on both fine and coarse pointers. The old footer suite
asserted that permanent visibility.

## Fix

The greeting is hidden with opacity and visibility at rest, while its fixed box
remains reserved. A real pointer position in the top 76 px, the `.site-chrome`
hover state, and keyboard focus within the brand/INDEX wrapper reveal it over
200 ms. Reduced motion is instant. `(hover: none)` keeps it permanently visible
as the touch fallback.

## Proof

Fine-pointer production runs at 1440 measured opacity 0/hidden at rest and
opacity 1/visible on header hover and brand focus. Touch contexts at 390/320
measured opacity 1/visible permanently. Page height and greeting box height stay
unchanged. Raw data is in `results.json`; the footer, visitor-tier and mobile
suites are recorded in their subdirectories.
