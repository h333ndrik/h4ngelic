# Befund-Registry — V3.2

Verification baseline: `70a01a5` (`origin/v3.1.1-fixes`), production build
`70a01a5fa93e`. Batch 1 commits: `735ea49`, `ba5f3a3`, `f12423a`, `53df27c`,
`e3028c8`; Batch 2 commits: `93372c6`, `3bb8aa5`, `fedcc8d`, `a2f973b`;
Batch 2.5 commits: `4c7ef3f` (B-F17), `d165b34` (B-F18); Batch 3 commits:
`51437eb` (B-F7), `3f3eeb8` (B-F6), `bd15724` (B-F4/F12), `b3cc401` (test reconciliation);
Batch 4 commits: `2d52ca3` (B-F8), `70a01a5` (B-F15/B-F16, B-F14 verified).
A registry entry is evidence, not a promise: `fixed` means the implementation exists and its named automated proof passes at this baseline.
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
| B-F1 | Custom cursor | Cursor friert beim Fenster-Verlassen ein; r2/r3/r4 (Overlay, Fade, Blanket) haben das Symptom behandelt. Ursache war die Bildgröße: alle Cursor-SVGs lagen über 32 CSS px (23,26 × 34,88), Firefox verwirft sie still. 05.11. Entscheid: zurück zum nativen Cursor, Abdeckung bleibt Vertrag. | fixed | `c7fca56` | `docs/validation/CURSOR-NATIVE/README.md`, `phase0.json` (Größen, Capability, Lücken), `hit/hit-results.json` | `tests/cursor-hit-test.mjs` (4459/1139/929 Punkte, 0 Fremd-Cursor, inkl. `:active`); `tests/cursor-native-browser.mjs` (kein Overlay, Press 1,08×, Hotspot `8 2`, No-JS-Cursor); `tests/v312-r3-production-cursor.mjs` (dist-CSS nur Token-Consumer, kein `cursor: none`). Status `fixed`, `verified-by-user` erst nach User-Bestätigung. |
| B-F2 | Hero bottom bar | `creative/about/contact` plus controls sollen nicht mehr fixed sein, sondern normal im Hero-Flow mitscrollen; R7-Vertrag entfällt (B-007/B-008 damit überholt). | fixed | `f12423a` | `docs/validation/GATEPREP/BATCH-1/gallery/results.json`; `after-bar-top-*.png` / `after-bar-scrolled-*.png`; vorher `phase0/bar-scrolled-*.png` | `tests/v32-micro-browser.mjs`, `tests/v31-motion-browser.mjs`; batch-1 suite: `position: absolute`, `insideHero: true`, `navTop 832 → 652` bei 180 px Scroll. |
| B-F3 | Hero logo physics | Mobile Touch-Fling schleudert das Logo edge-on. | fixed | `53df27c`, `eba3d6f` | `docs/validation/GATEPREP/BATCH-1/gallery/fling-physics.json`; `docs/validation/CURSOR-NATIVE/README.md` | `tests/physics.test.js`: Desktop-Profil rotiert über 39,6° (lebhaft, alte Werte), Touch bleibt bei 39,60°; `tests/gateprep-batch1-physics.mjs`: 179,99° → 39,60°, Ruhe nach 3,408 s; Profilwahl über `matchMedia('(any-pointer: fine)')`, nicht über Viewport-Breite. |
| B-F4 | Creative rubric row | `jewellery`/`tools` kleben; `--rubric-gap` greift live nicht. | fixed | `bd15724` | `docs/validation/GATEPREP/BATCH-3/gallery/rubric-gap.json`; `rubric-before-1440.png` / `rubric-after-*.png` | `tests/rubric-gap-browser.mjs`: Spalten-Gap = Token ±2, Label-Überlappung 0 (vorher −6,2 px, Label 335,8 px in 310,2-px-Spalte); Fit 62,373 px @1440. |
| B-F5 | Slash alignment/type | Slash-Abstand zwischen Headings inkonsistent; Größen unvollständig. | fixed | `3bb8aa5` | `docs/validation/GATEPREP/BATCH-2/gallery/results.json`; `heading-{home,about,creative}-*.png` | `tests/typography-contract.mjs`: Slash-Spalte 88.31 px (1440) / 32.7 px (390/320) auf `/`, `/about`, `/creative`, gleiche Größe/Leading/Tracking. |
| B-F6 | NAAVI total/format | `03 / 03` soll `04/ 04` werden; Other Side bleibt viertes Kapitel, nur der INDEX-Eintrag wurde entfernt. | fixed | `3f3eeb8` | `docs/validation/NAAVI/results.json`; `naavi-final-secret-1440.png` | `tests/naavi-format-browser.mjs`: 00/ 04 … 04/ 04 am End-Reveal, INDEX unverändert 00–03; `tests/global-navigation.test.js`. |
| B-F7 | Creative tattoo route | `/creative/onskin` soll `/creative/tattoos` heißen und `on skin` zu `tattoos` werden; 301 inklusive Deep-Links. | fixed | `51437eb` | `docs/validation/GATEPREP/BATCH-3/gallery/retired-slug.json`; `retired-slug-work-1440.png` | `tests/retired-slug-browser.mjs`: 6 Redirects (inkl. `/creative/onskin/tattoo-01`, `?category=onskin`, `/work/onskin`), Labels `tattoos`, 0 `onskin` in 144 dist-HTML, 1 Redirect-Map im JS; `tests/seo.test.js`. |
| B-F8 | VISIT counter | `visit 0000` soll permanent im Ghost-Stil wie der HOLD-4-Hinweis erscheinen, ohne Link oder Hover. | fixed | `2d52ca3` | `docs/validation/GATEPREP/BATCH-4/gallery/batch4.json`; `footer-visit-{1440,390,320}.png` | `tests/gateprep-batch4-browser.mjs`: `<span>` statt Button, `pointer-events: none`, Farbe #f0efeb, Opazität .35, Tracking .84px, keine Phrase, Hover ändert nichts; `tests/v7-visitor-tiers-browser.mjs`, `tests/footer-v31-browser.mjs`, `tests/standalone-browser.mjs` grün. |
| B-F9 | Inquiry submit | `SEND MESSAGE` soll `send message` heißen. | fixed | `93372c6` | `docs/validation/GATEPREP/BATCH-2/gallery/lowercase.json`; `lowercase-form-*.png` | `tests/lowercase-sweep.mjs` @1440/390/320; `tests/inquiry.test.js`; `tests/master-inquiry-browser.mjs`. |
| B-F10 | Inquiry labels | Labels sollen `your name`, `how to reach you`, `what's on your mind?` lauten. | fixed | `93372c6` | `docs/validation/GATEPREP/BATCH-2/gallery/lowercase.json`; `lowercase-form-*.png` | `tests/lowercase-sweep.mjs` (exakte Strings, kein CSS-Re-Casing); `tests/master-inquiry-browser.mjs`. |
| B-F11 | About link | `MORE ABOUT` soll `more about` heißen. | fixed | `93372c6` | `docs/validation/GATEPREP/BATCH-2/gallery/lowercase.json`; `lowercase-about-*.png` | `tests/lowercase-sweep.mjs`: exakt `more about`, `text-transform: none`. |
| B-F12 | Cross-link rows | Unterrubrik-Cross-Links sollen bündig und mit gleichen Abständen stehen. | fixed | `bd15724` | `docs/validation/GATEPREP/BATCH-3/gallery/cross-links-{1440,390,320}.png`; `rubric-gap.json` | `tests/rubric-gap-browser.mjs`: Reihe startet auf der Inhaltsspalte (±2 px), V25-Spalten bleiben fix, Labels bleiben in ihrer Spalte (Fit 15,05 px @390); `tests/v25-cross-links-browser.mjs` 6/6. |
| B-F13 | Artwork viewer arrows | Pfeile haben falschen Abstand/Seite oder überschneiden sich. | fixed | `fedcc8d` | `docs/validation/GATEPREP/BATCH-2/gallery/viewer-*.png`; `results.json` | `tests/typography-contract.mjs` (flankierend, kein Overlap, Scrim); `tests/gateprep-batch2-browser.mjs` @1440/390/320. |
| B-F14 | Tool detail heading | `/creative/tools/m4shlab` rendert möglicherweise fälschlich `3d model`. | fixed (kein Befund) | — | `docs/validation/GATEPREP/BATCH-4/gallery/tool-top-m4shlab-1440.png` | Phase 0 + `tests/gateprep-batch4-browser.mjs`: H1 ist der Tool-Titel, kein `3d model` auf beiden Werkzeugseiten (direkt und per SPA-Navigation), auch nicht im prerenderten HTML. |
| B-F15 | Tool detail navigation | Tool-Seiten brauchen die obere Unterrubriken-Leiste wie `/creative/onskin`; Breadcrumb `home / tools` entfernen. | fixed | `70a01a5` | `docs/validation/GATEPREP/BATCH-4/gallery/tool-top-*.png`; `batch4.json` | `tests/gateprep-batch4-browser.mjs`: 4 Filter-Links, `tools` aktiv, Zeile auf der Header-Geometrie (y 21/16), 0 Breadcrumbs; `tests/v32-structure-browser.mjs`. |
| B-F16 | Tool detail footer line | Weißen Trennstrich und Fakten-Punkte-Zeile unten entfernen. | fixed | `70a01a5` | `docs/validation/GATEPREP/BATCH-4/gallery/tool-bottom-{1440,390,320}.png` | `tests/gateprep-batch4-browser.mjs`: 0 `.tool-facts`, 0 weiße `border-top` im Tool-Detail, Seite endet mit der Installations-Anleitung. |
| B-F17 | Kopfzeile, Begrüßung | Begrüßung ist auf der Preview nicht sichtbar geworden. | fixed | `4c7ef3f` | `docs/validation/GATEPREP/BATCH-2.5/gallery/greeting.json`; `greeting-{hover,focus}-1440.png`; `greeting-touch-*.png` | `tests/greeting-browser.mjs`: Ruhe unsichtbar / Hover 35 % / Focus 52 % @1440, Touch 35 % @390/320, kein Overlap. Ursache waren `hidden` + globales `[hidden]{display:none}`. |
| B-F18 | Rubrik-Links (tattoos/jewellery/tools/more) | Klickfläche der Unterrubriken-Links ist zu groß. | fixed | `d165b34` | `docs/validation/GATEPREP/BATCH-2.5/gallery/hit-areas.json`; `hit-before-*.png` (Zelle) / `hit-after-*.png` (Label) | `tests/rubric-hit-area-browser.mjs`: Text/Pfeil klickbar, 20 px rechts vom Pfeil inert, ≥44 px hoch, Zelle 310/154/119 px vs. Label 276/95/71 px. |

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
