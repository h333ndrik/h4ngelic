# Befund-Registry — V3.2

Verification baseline: `945b551` (`origin/v3.1.1-fixes`), production build
`945b5515b0a0`. A registry entry is evidence, not a promise: `fixed` means the
implementation exists and its named automated proof passes at this baseline.
`verified-by-user` is used only after the user explicitly confirms the result.

## Registry rules

1. Every new user finding receives the next `B-NNN` ID immediately.
2. Findings and follow-up prompts reference that ID.
3. A status change requires a test, grep result, screenshot or other stated
   evidence. No status is advanced on recollection alone.
4. User wording is preserved in shortened form. Technical detail belongs in the
   evidence column, not in the quoted finding.

## Findings B-001…B-020

| ID | Ort/Element | Befund (User-Wortlaut kurz) | Status | Fix-Commit | Evidence | Verifiziert-durch |
| --- | --- | --- | --- | --- | --- | --- |
| B-001 | Custom cursor | Cursor must follow 1:1, without visible lerp. | fixed | `9dfda4f` | `docs/validation/CURSOR-KERN/A1-tracking.json` | `tests/cursor-kernel-browser.mjs`: 20/20 zero-pixel jumps. |
| B-002 | Custom cursor pressed state | Press scale is 108% around the anchored hotspot. | fixed | `9dfda4f` | `docs/validation/CURSOR-KERN/pressed-1440.png` | `tests/cursor-kernel-browser.mjs`: scale 1.08 and 9px/2px origin. |
| B-003 | Custom cursor leave state | Overlay hides when the pointer leaves and re-enters without a ghost. | fixed | `9dfda4f` | `docs/validation/CURSOR-KERN/A1-tracking.json` | `tests/cursor-kernel-browser.mjs`: leave, blur and visibility hide paths. |
| B-004 | NAAVI | Counter format must be `NN/ NN`, dynamic per chapter. | fixed | `1e78966` | `docs/validation/NAAVI/results.json`; `docs/validation/STRUCT/contracts/typography.json` | `tests/naavi-format-browser.mjs`; typography contract at 1440/390/320. |
| B-005 | Section headings | Section headings need one size and shared baseline. | fixed | `1e78966` | `docs/validation/R2B-HEADINGS/results.json`; `typography.json` | `tests/v32-micro-browser.mjs`; typography contract. |
| B-006 | About `get in touch` | Arrow must belong to the shared link language. | fixed | `3f952eb` | `docs/validation/R7-BAR/results.json`; `links.json` | `tests/v32-micro-browser.mjs`; link-glyph contract: `/#contact`, one `.arrow`. |
| B-007 | Hero bar | Creative bar must remain clickable at every scroll position. | fixed | `993d574` | `docs/validation/R7-BAR/results.json` | `tests/v32-micro-browser.mjs`: five scroll fractions. |
| B-008 | Hero bar label | Label reads `creative`. | fixed | `993d574` | `docs/validation/R7-BAR/results.json` | `tests/v32-micro-browser.mjs`: `creative → /creative`. |
| B-009 | Sound caret | Caret mirrors with a reverse swing. | fixed | `d4246aa` | `docs/validation/R9-CARET/results.json` | `tests/v32-micro-browser.mjs`: 180° open and upright reverse. |
| B-010 | VISIT counter | Ghost counter is permanent and keeps its original position. | fixed | `d4246aa` | `docs/validation/R5-VISIT/results.json`; `visit-*.png` | `tests/v32-micro-browser.mjs`: 35% opacity, .84px tracking, after MOSH LAB. |
| B-011 | INDEX | INDEX must not retain `other side`. | fixed | `993d574` | `tests/v32-structure-browser.mjs` | INDEX audit: `00/ home` through `03/ contact`, four entries only. |
| B-012 | Reverse hint | Text is `press 3 three times to reverse.` and hints are lowercase. | fixed | `d4246aa` | `docs/validation/R4-HINTS/results.json` | `tests/v32-structure-browser.mjs`: exact normal/Other Side hint copy. |
| B-013 | Flash archive | Empty archive must show a looping placeholder carousel. | fixed | `4ada015` | `docs/validation/FLASH-JEWELLERY-PLACEHOLDER/flashes-*.png` | `tests/v32-structure-browser.mjs`: eight cards, wrap true, `01/ 08`. |
| B-014 | Jewellery archive | Same placeholder carousel contract as Flash. | fixed | `4ada015` | `docs/validation/FLASH-JEWELLERY-PLACEHOLDER/jewellery-*.png` | `tests/v32-structure-browser.mjs`: eight cards, wrap true, `01/ 08`. |
| B-015 | SMASH | SMASH appears only in Other Side. | fixed | `d4246aa` | `docs/validation/SMASH-OTHERSIDE/` | `tests/v32-structure-browser.mjs`: normal 0 controls, Other Side exactly 1. |
| B-016 | Footer Impressum | Impressum belongs in both footers; legal scaffold still contains placeholders. | **open** | `d4246aa` (dual links only) | `docs/validation/IMPRESSUM-DUAL/results.json`; `src/pages.js` | Dual links pass, but `/impressum` still exposes `[VOLLNAME]`, address, email and VAT placeholders. |
| B-017 | Tool detail pages | m4shlab/thr4ce need screenshots and a PWA guide. | fixed | `3f952eb` | `docs/validation/TOOL-PAGES/` | `tests/v32-structure-browser.mjs`: three loaded screenshots, install guide, facts and external CTA per tool. |
| B-018 | Creative URLs | `/creative/*` routes and the complete 301 matrix replace `/work/*`. | fixed | `3f952eb` | `docs/validation/R3B-URLS/results.json` | `tests/v32-structure-browser.mjs`: 12 redirect cases and 23 prerendered routes. |
| B-019 | `--rubric-gap` | Shared spacing must prevent rubrics from sticking together. | fixed | `1e78966` | `docs/validation/R2B-HEADINGS/results.json`; `tokens.json` | Structure contract at 1440/390/320 plus scoped token audit. |
| B-020 | Artwork viewer | Arrows flank the counter; counter uses `NN/ NN`, including `07/ 08`. | fixed | `4ada015` | `docs/validation/R3B-URLS/ARTWORK-NAVI.json`; `typography.json` | Typography contract: disjoint flanking columns and `07/ 08`. |

## Not fixed

- **B-016 remains open.** The dual-footer link requirement is fixed, but the
  public legal page intentionally still contains unresolved placeholders. It
  must not be marked complete until real legal details are supplied.
- The token audit additionally reports three non-registry hardcodes:
  `.footer-smash { text-transform: lowercase; }` and the two
  `.secret-message.is-discovered { opacity: .35; }` rules in
  `src/easter-eggs.css`. They duplicate `--h4-ghost-transform` and
  `--h4-ghost-opacity`; this STRUCT run documents them instead of changing
  product behavior.

No entry is marked `verified-by-user` without a fresh explicit user
confirmation.
