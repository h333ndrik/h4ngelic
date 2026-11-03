# F19 — wheel contract

## Reproduction

The existing listener was already scoped to `.drift-viewport`, but the acceptance
criterion had no direct browser proof for both sides of the contract.

## Fix

No product change was required. The existing handler keeps `wheelSensitivity`
8.0, prevents the default only over the enhanced strip, and leaves page scrolling
native elsewhere.

## Proof

At 1440/390/320, wheel input over the tattoo carousel changed only
`data-drift-position` (for example 3188 → 262 at 390 px) while `scrollY` stayed
unchanged. Moving outside the carousel and wheeling 520 px scrolled the page from
0 to 520 at every width. Raw values: `results.json`.
