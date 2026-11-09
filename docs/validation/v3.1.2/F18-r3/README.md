# F18-r3 — production cursor hardening

## Reproduction

The r2 stylesheet did contain the custom-cursor rule, but it was emitted near the
start of the bundle and the component path depended on the runtime class. The
user still observed a cursor switch over footer links and NAAVI.

## Fix

Inline head JavaScript sets `html.h4-custom-cursor` before hydration. The source
rule now applies with or without the class, includes `[data-cursor-target]`, and
covers hover/active/focus. A Vite post-build plugin appends the same defense as
the absolute final rule in the emitted CSS. The app bundle also imports cursor CSS
last in the source order.

## Proof

The no-JS production audit blocked every JavaScript bundle. It still measured the
marker, inline class, zero offenders with and without the class, and the exact
cursor image/hotspot on footer moshlab, Instagram and NAAVI in rest, hover,
focus and active states. The emitted CSS ends with the defense rule. Full
production checks also cover VISIT, SMASH, INDEX links and all form fields.
Raw data: `results.json`.
