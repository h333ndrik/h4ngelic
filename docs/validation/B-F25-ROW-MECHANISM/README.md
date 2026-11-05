# B-F25 — Row-Typologie A/B/C

Measured on production build **`c4710034ec5d`** (the five B-F25 commits on
`v3.1.1-fixes`). The before-inventory was taken on `ee35d06725c5`, the build the
run started from; both files live next to this README.

## 1. Inventory (before)

Measured with `measure-rows.mjs` against the untouched build
(`inventory-before.json`). "Gap" is the computed `column-gap`; the visible
distance is what the eye sees between one arrow and the next word.

| Row | Page(s) | Type | Positions | Links | Container | align-items | Gap mechanism | Slot | Scrollport | 44px targets | Marking |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `frontpage-strip` | `/` | A distributed | 4 | 4 | flex | baseline | `--rubric-gap` 19.44px | no | yes (`overflow-x:auto`) | label + 4px reading edge | none |
| `cross-links` | `/creative/{tattoos,jewellery,tools,more}` | A distributed | 3 | 3 | flex | baseline | `--rubric-gap` 19.44px | no | no | 44px min-height | none |
| `archive-filters` | `/creative*`, tool pages | B chips | 4 | 4 | flex, fixed header | baseline | `--rubric-gap` 19.44px | no | yes (scrollend) | yes | `aria-current` + text underline |
| `footer-left` | every page | C cluster | 3 | 1 | flex | center (grid cell) | `gap` clamp(12,2vw,30) = 28.8px | no | yes (scrollend) | yes | none |
| `footer-details` | every page | C cluster | 3 | 2 | flex | center (grid cell) | same 28.8px | no | yes (scrollend) | yes | none |
| `hero-nav` | `/` | C cluster (not migrated) | 3 | 3 | flex | center | `gap` 26px | no | no | 44px min-height | none |

`hero-nav` is assigned to Type C but deliberately keeps its own geometry: its
position belongs to the hero bar contract (F22/R7) and this run must not touch
the hero. It carries no `data-row`, so it is outside the manifest on purpose.

## 2. Coupling proof (before)

Setting `--row-gap: 60px` on the old build moved the frontpage row (19.44 →
60px) **and** the filter row, because both consumed the same token. The same
token also fed `.artwork-viewer-navigation` and `.tool-gallery`:

```
rg -n "rubric-gap" src   # before
src/ui-tokens.css:8      --rubric-gap: clamp(10px, 1.35vw, 22px);
src/rubric-row.css:14,43,48   .rubric-row column-gap / row-gap
src/homepage.css:31      .category-strip gap
src/archive-structure.css:132,166  .work-filters gap
src/archive-structure.css:212      .tool-gallery gap
src/gallery.css:60       .artwork-viewer-navigation gap
```

After B-F25 the token is gone without an alias; each consumer owns a value:

| Old consumer | New token |
| --- | --- |
| `.category-strip`, `.rubric-cross-links` | `--row-gap-min` (19px) |
| `.work-filters` | `--chips-gap` (clamp(10px, 1.35vw, 22px)) |
| footer clusters | `--cluster-gap` (clamp(12px, 2vw, 30px)) |
| `.artwork-viewer-navigation` | `--viewer-nav-gap` (same value as before) |
| `.tool-gallery` | `--tool-gallery-gap` (same value as before) |

`tests/tokens-audit.mjs` now fails if a Type B or C selector reads a Type A
token (and vice versa); `tests/row-geometry-contract.mjs` proves the same at
runtime by editing one token and measuring the other rows.

## 3. After — visible gaps per type

`inventory-after.json`, measured on the B-F25 build.

| Row | 1440 | 1920 | 2560 | 390 | 320 |
| --- | --- | --- | --- | --- | --- |
| `frontpage-strip` | 91.15 / 91.14 / 91.16 | 199.85 / 199.86 / 199.85 | 403.04 / 403.05 / 403.05 | 137.75 · 173.20 | 88.60 · 118.08 |
| `cross-links` | 91.12 / 91.14 / 91.12 | 199.82 / 199.83 / 199.82 | 403.03 / 403.01 / 403.03 | 137.19 · 172.64 | 87.95 · 117.40 |
| `archive-filters` | 19.43 / 19.43 / 19.44 | 22 / 22 / 22 | 22 / 22 / 22 | 10 / 10 / 10 | 10 / 10 / 10 |
| `footer-left` | 28.8 / 28.8 | 30 / 30 | 30 / 30 | 12 / 12 | 12 / 12 |
| `footer-details` | 28.79 / 28.8 | 30 / 30 | 30 / 30 | 12 / 12 | 12 / 12 |

Frontpage at 1440: left inset **88.31px** (unchanged), visible gaps **91.15px**
(was 19.44px), right margin **88.31px** (was 207.33px). 1920/2560 grow the same
way; 390/320 break into two pairs, each starting on `--row-inset`.

## 4. Cross-page x positions (1440)

Measured relative to `row.left + paddingLeft`, after the scroll choreography
settled (`--kinetic-x = 0`).

| Label | Frontpage | `/creative/tattoos` | Δ |
| --- | --- | --- | --- |
| tattoos | 88.30 | 88.33 (slot) | 0.03 |
| jewellery | 419.03 | 419.03 | 0.00 |
| tools | 801.61 | 801.61 | 0.00 |
| more | 1080.38 | 1080.34 | 0.04 |

The slot is a `<span aria-hidden="true">` with no href, `tabindex` default −1,
`visibility: hidden`, `pointer-events: none`; a click on its centre neither
navigates nor hits a link. The visible words are the other three routes.

## 5. Chips — baseline and height

| | Before | After |
| --- | --- | --- |
| `h4ngelic` text box (1440) | 32 → 53 | 32 → 53 |
| chip text box (1440) | 20 → 41 | 32 → 53 |
| baseline delta | **12.00px** | **0.00px** |
| chip height (all four) | 44px | 44px |
| active chip height | 44px | 44px (underline via `text-decoration`, 1px / 6px offset) |
| `column-gap` | 19.44px | 19.44px (`--chips-gap`) |

At 390/320 the delta is 0.5px because the wordmark (14.82px) and the chips
(13px) use different sizes; both are centred in a 44px box.

## 6. Adjusting the rows

| Want | Change |
| --- | --- |
| larger minimum distance between frontpage labels | raise `--row-gap-min` |
| wider row, therefore larger gaps | lower `--row-inset` |
| smaller row inset | `--row-inset` (defaults to the measured `--slash-inset`) |
| current rubric collapses instead of keeping its word width | `data-slot-mode="collapse"` on the row (also `--row-slot-mode`) |
| tighter filter chips | lower `--chips-gap` |
| different footer rhythm | `--cluster-gap` |

## 7. Verification

Runtime of the whole contract: **≈54 s** (five viewports, five rows, coupling
negatives and the font-fallback pass), inside the 60 s Fast-Mode budget.

```bash
npm run build
node scripts/serve-preview.mjs --port 55232 &
H4_BASE_URL=http://127.0.0.1:55232 node tests/row-geometry-contract.mjs
H4_BASE_URL=http://127.0.0.1:55232 node tests/v25-cross-links-browser.mjs
H4_BASE_URL=http://127.0.0.1:55232 node tests/rubric-gap-browser.mjs
node tests/tokens-audit.mjs
npm test
```

User check (2–3 lines): open `/` at 1440 and 2560 — the four words now fill the
row with equal, much larger gaps, the first word still starts on the slash
column. Open `/creative/tattoos` and `/creative/jewellery` — the visible words
sit exactly where they sit on the frontpage, one word is missing (the current
rubric) and it is not clickable. Open `/creative` — the filter chips sit on the
`h4ngelic` baseline and the active rubric is underlined without moving.

## 8. Deviations and honest limits

- **Type B scrolls by design.** `scrollWidth > clientWidth` at 320px
  (177 vs 165) is the intended scrollport with 44px targets, not a page
  overflow; the contract asserts page width == viewport and treats the row as
  a scrollport.
- **Cross-link type size grew.** To make the x positions match the frontpage,
  the cross-links use the frontpage type scale (`--type-category-link` with
  `--row-type-fit`) instead of the old `clamp(16px, 3.6vw, 56px)`.
- **Removed rule.** `.rubric-cross-links a .arrow { font-size: .72em }` shrank
  the arrow twice (33.69px vs the frontpage's 46.78px) and made the words
  drift by up to 18px; the shared arrow size is now the only source.
- **`hero-nav` not migrated** (see section 1).
- `tests/scroll-browser.mjs` asserts six `.motion-echo` nodes that no longer
  exist in `src/` since `daeaff8` (`git grep motion-echo HEAD -- src` is
  empty). That suite is red independently of B-F25 and was left untouched.
