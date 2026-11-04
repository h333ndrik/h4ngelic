# Befund-Registry — V3.2

Verification baseline: `831737c` (`origin/v3.1.1-fixes`), production build
`831737ce85e6`. Batch 1 commits: `735ea49`, `ba5f3a3`, `f12423a`, `53df27c`,
`e3028c8`. A registry entry is evidence, not a promise: `fixed` means the
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

## Findings B-F1…B-F16 — seeded 2026-11-04

These are new user-reported findings from the 2026-11-04 review. They are
deliberately seeded as `open`; no implementation or verification evidence exists
at seed time. Every row references the user's chat/preview report and the
screenshot supplied there.

| ID | Ort/Element | Befund (User-Wortlaut kurz) | Status | Fix-Commit | Evidence | Verifiziert-durch |
| --- | --- | --- | --- | --- | --- | --- |
| B-F1 | Custom cursor overlay | Cursor friert beim Fenster-Verlassen ein; hide-on-leave ist unwirksam. r2 (05.11.): Übergang schaltet hart statt weich zu faden. | fixed | `ba5f3a3`, `b506f01` (r2) | `docs/validation/GATEPREP/BATCH-1/phase0/results.json` (vorher); `docs/validation/CURSOR-VISIBLE/fade-trace.json`; `fade-{visible,out-mid,in-mid}-1440.png` | `tests/cursor-kernel-browser.mjs` (pointerout/idle/leave/blur/visibility, Reveal-Fade an neuer Position); `tests/cursor-fade-browser.mjs` (8 Mid-Frames, 183 ms je Richtung, Hard Cut 0); `tests/cursor-hit-test.mjs` (4458/1138/928 Punkte, 0 Fremd-Cursor). |
| B-F2 | Hero bottom bar | `creative/about/contact` plus controls sollen nicht mehr fixed sein, sondern normal im Hero-Flow mitscrollen; R7-Vertrag entfällt (B-007/B-008 damit überholt). | fixed | `f12423a` | `docs/validation/GATEPREP/BATCH-1/gallery/results.json`; `after-bar-top-*.png` / `after-bar-scrolled-*.png`; vorher `phase0/bar-scrolled-*.png` | `tests/v32-micro-browser.mjs`, `tests/v31-motion-browser.mjs`; batch-1 suite: `position: absolute`, `insideHero: true`, `navTop 832 → 652` bei 180 px Scroll. |
| B-F3 | Hero logo physics | Mobile Touch-Fling schleudert das Logo edge-on. | fixed | `53df27c` | `docs/validation/GATEPREP/BATCH-1/gallery/fling-physics.json`; `after-fling-*-{350,650,1000}.png`; vorher `phase0/fling-*-650.png` | `tests/physics.test.js`; `tests/gateprep-batch1-physics.mjs`: 179,99° → 39,60°, Ruhe nach 3,408 s, Geschwindigkeiten ≤ Token. |
| B-F4 | Creative rubric row | `jewellery`/`tools` kleben; `--rubric-gap` greift live nicht. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F5 | Slash alignment/type | Slash-Abstand zwischen Headings inkonsistent; Größen unvollständig. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F6 | NAAVI total/format | `03 / 03` soll `04/ 04` werden; Other Side bleibt viertes Kapitel, nur der INDEX-Eintrag wurde entfernt. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F7 | Creative tattoo route | `/creative/onskin` soll `/creative/tattoos` heißen und `on skin` zu `tattoos` werden; 301 inklusive Deep-Links. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F8 | VISIT counter | `visit 0000` soll permanent im Ghost-Stil wie der HOLD-4-Hinweis erscheinen, ohne Link oder Hover. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F9 | Inquiry submit | `SEND MESSAGE` soll `send message` heißen. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F10 | Inquiry labels | Labels sollen `your name`, `how to reach you`, `what's on your mind?` lauten. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F11 | About link | `MORE ABOUT` soll `more about` heißen. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F12 | Cross-link rows | Unterrubrik-Cross-Links sollen bündig und mit gleichen Abständen stehen. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F13 | Artwork viewer arrows | Pfeile haben falschen Abstand/Seite oder überschneiden sich. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F14 | Tool detail heading | `/creative/tools/m4shlab` rendert möglicherweise fälschlich `3d model`. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F15 | Tool detail navigation | Tool-Seiten brauchen die obere Unterrubriken-Leiste wie `/creative/onskin`; Breadcrumb `home / tools` entfernen. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |
| B-F16 | Tool detail footer line | Weißen Trennstrich und Fakten-Punkte-Zeile unten entfernen. | open | — | User-Screenshot, Chat/Preview 2026-11-04 | — |

**B-016 remains open:** the dual Impressum links exist, but `VOLLNAME`, address,
email and USt./§19 data are still user-supplied launch prerequisites.

## Not fixed

- **B-016 remains open.** The dual-footer link requirement is fixed, but the
  public legal page intentionally still contains unresolved placeholders. It
  must not be marked complete until real legal details are supplied.
- Token cleanup is no longer open: `735ea49` removed the three hardcodes in
  `src/easter-eggs.css`; `tests/tokens-audit.mjs` reports `passed: true` with
  0 duplicated literals and the visual snapshot shows 0 changed channels.

No entry is marked `verified-by-user` without a fresh explicit user
confirmation.
