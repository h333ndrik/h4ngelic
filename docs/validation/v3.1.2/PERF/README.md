# Performance evidence

## Reproduction

The old report claimed an exact 36–64 ms FCP. Independent samples varied, so the
claim was not a stable budget. The production preview was warmed and then sampled
five times per route and width.

## Fix

The boot animation uses only transform/opacity and `will-change` only while
booting. The hero entrance is a 700 ms transform/opacity keyframe with CLS 0.
Slash measurement is rAF-throttled and font-ready-only. Interior routes remain
free of the Home hero module, typeface and tattoo texture. The hero modulepreload
points at the single emitted `main-*.js` chunk.

## Proof

Warmed 5× FCP medians in the final run: `/work/tattoos` 104/48/44 ms and
`/contact` 108/96/44 ms at 1440/390/320. Individual samples ranged 40–120 ms, so
the report now treats the earlier 56–76 ms observation as a sample range rather
than a fixed constant; the automated headless guard is 200 ms. No forbidden
requests were observed. Build size changed from 34,232 KB to 32,556 KB (`du -k`);
18 routes + 404, one main chunk and matching modulepreload were verified.
