# F18-r4 — blanket cursor contract

Verified production build: `4a05f1a60f2a` on `v3.1.1-fixes`.

## Reproduction and recovery

The user still saw a native cursor over NAAVI and footer targets after r2/r3.
Those passes audited named selectors; they did not prove which element actually
owns the pointer. `stash@{0}` contained the unfinished F18-r4 work and was
restored in the isolated `f18-r4-blanket-cursor` worktree. Git auto-merged the
`tests/hero-boot-browser.mjs` change against F21-r4/F29-c and reported no
conflict. `git diff --check` and the affected JavaScript syntax checks passed.

## Fix

- `src/cursor.css` makes `html.h4-custom-cursor * { cursor: none !important; }`
  the blanket normal-mode defense.
- `[data-cursor="xray"]` is the only allowlist and restores the Other Side
  material cursor with its `9 2` hotspot.
- `src/xray.js` sets that marker only in xray mode and removes it on normal,
  init and disposal.
- Component `cursor` declarations were removed. There are now three production
  declarations only: the class-gated root fallback, the xray allowlist and the
  blanket `none` rule.
- The Vite post-build hook relocates the canonical defense to the absolute end
  of the emitted stylesheet and removes the earlier minified duplicate.
- NAAVI exposes one `pointer-events:auto` anchor. Its generated visual, digit
  window and total are decorative (`pointer-events:none`), so they cannot claim
  a separate cursor owner.

## NAAVI pointer-events audit

| Element | Pointer events | Cursor |
| --- | --- | --- |
| `a.chapter-counter.naavi` | `auto` | `none` |
| `.interaction-visual` | `none` | `none` |
| `.chapter-digit-window` (`aria-hidden`) | `none` | `none` |
| `.chapter-digit` | `none` | `none` |
| `.chapter-total` (`aria-hidden`) | `none` | `none` |

## Proof

The 24 px production hit map checked the whole viewport at the top and footer,
plus NAAVI and its literal slash, footer MOSH LAB/SMASH/Instagram, VISIT, the
open INDEX links, all five visible inquiry controls and the hero canvas during a
real `mousedown` drag.

| Profile | Normal points | Result | Xray points | Result |
| --- | ---: | --- | ---: | --- |
| 1440 × 900 | 4,459 | 4,459 × `cursor:none` | 2,221 | 2,221 × Other Side cursor |
| 390 × 844 | 1,139 | 1,139 × `cursor:none` | — | — |
| 320 × 844 | 929 | 929 × `cursor:none` | — | — |

Every point chose the topmost element whose `pointer-events` was not `none`.
There were zero foreign cursors. The five inquiry controls and the drag path all
reported `none`. Raw data: `results.json`.

The production contract test found exactly these three emitted declarations:

```text
cursor:var(--h4-native-cursor)
cursor:var(--h4-native-cursor)!important
cursor:none!important
```

The canonical defense is the final emitted CSS. Raw data: `production.json` and
`production-css.txt`.

The inline `<head>` script is present in production HTML and sets the runtime
class before hydration. With all JavaScript disabled, the class and
`data-cursor` are absent; body, brand, NAAVI and footer keep ordinary system
cursors (`auto`/`pointer`), with no H4 cursor URL. Raw data:
`production.json`, `production-html.txt` and `no-js.txt`.

## Browser console check

```js
const nav = document.querySelector('[data-naavi]');
const r = nav.getBoundingClientRect();
document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  .map(el => ({
    tag: el.tagName,
    cursor: getComputedStyle(el).cursor,
    pointerEvents: getComputedStyle(el).pointerEvents
  }));
```

Expected in normal mode: the topmost element with `pointer-events != "none"` is
the `A` anchor and has `cursor: "none"`. In the Other Side, that anchor has the
`h4ngelic-cursor-other-r09.svg` cursor with hotspot `9 2`.

## Source audit

`source-cursor-audit.txt` records zero `style.cursor` writes in `src/`. The
normal-mode cursor declarations are confined to `src/cursor.css`; drag physics
and its `grab to spin` behavior remain untouched.
