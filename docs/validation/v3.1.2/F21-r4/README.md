# F21-r4 — greeting alignment and lowercase ghost typography

## Reproduction

The F21-r3 greeting rendered uppercase at the fixed top edge. Its text box was
only `19.6px` high while the branding and INDEX controls occupied a `44px` row,
so the greeting's optical centre sat about 12px above theirs. The screenshot
evidence shows the uppercase sentence before the change.

## Fix

- The ghost transform token is now `lowercase`. Source phrases are already
  lowercase, so assistive technology receives ordinary sentence text rather than
  transformed capitals.
- The fixed greeting now uses the same `44px` control row as branding and INDEX,
  with flex centring and the shared top offset (`21px` desktop, `16px` at
  `≤600px`).
- Color `#f0efeb`, hover opacity `.35`, `.84px` tracking, focus opacity `.52`,
  touch visibility, reduced-motion behaviour and the opacity-only transition are
  unchanged.

## Measured alignment

At 1440px, greeting, branding and INDEX all start at `y=21px` and occupy a
`44px` row. Optical centres are `43px`; the greeting differs by `-0.80px` from
the branding text and `-0.30px` from the INDEX sign. The left/right gaps are
`528.44px` and `528.45px` (`0.02px` difference).

At 320px, the shared top is `16px`, centres are `38px`, and the centre deltas
are `-0.30px` / `0.20px`. Gaps are `23.06px` / `23.08px`. The longest phrase
remains one line inside its header slot with no horizontal overflow.

## Proof

Production build `data-build="78e3fc92f003"` passed the greeting contract at
desktop, 320px, touch and reduced-motion profiles. The reveal remains CLS 0;
hover/focus opacity and the HOLD-4 ghost color/tracking remain intact.

Evidence: `header-1440.png`, `header-320.png`, before/after screenshots and
`results.json`.
