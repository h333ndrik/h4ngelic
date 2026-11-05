# F28 — shared slash column

## Reproduction

Works links, About copy, Contact intro and the Contact form used independent
insets. The form still carried `--inquiry-form-offset`; the other blocks used a
small clamp. Their left edges therefore did not share one typographic column.

## Fix

`01 / creative` is the canonical target. The app measures its rendered `/` glyph
with a text Range, subtracts the element's current scroll translation, and
writes one `--slash-inset` token. Measurement is rAF-throttled on resize and
runs once after `document.fonts.ready`. Works, About copy, MORE ABOUT, Contact
intro and form consume that token. The retired inquiry offset is removed.

## Proof

Production offsets from the canonical glyph at 1440/390/320 are `-0.016, 0, 0,
0, 0` px or smaller; every value is inside the ±2 px contract. The 320 px page
has no horizontal page overflow. Static-title regression coverage remains green.
Raw values and screenshots are in this directory.
