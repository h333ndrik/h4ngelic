# CURSOR-NATIVE — native h4 cursor restored (B-F1) + hero physics profiles (B-F3)

Stand: Branch `v3.1.1-fixes`. Der verifizierte Build-SHA steht in
`production-cursor.json` (`data-build` der geladenen Seiten). Kein Merge, kein Deploy.

## Befund / Entscheid

Der JS-Overlay-Cursor war ein Ersatz für einen alten Bug: **Firefox verwirft
Cursor-Bilder, die 32 CSS-Pixel überschreiten**, und fällt still auf den
Systempfeil zurück. Der Overlay hat das umgangen, kostete aber einen Frame
Latenz, brauchte ein DOM-Element und musste „verlassen des Fensters" selbst
nachbauen (B-F1). Der User-Entscheid: zurück zum nativen Cursor, aber mit den
Garantien, die am Overlay aufgebaut wurden (Hit-Test, Token-Audit, Contract).

## Phase 0 — Messwerte (vorher)

`phase0.json` (vollständige Tabelle):

| Bild | Breite × Höhe (CSS px) | > 32? |
| --- | --- | --- |
| `h4ngelic-cursor.svg` | 23.26 × 34.88 | ja (Höhe) |
| `h4ngelic-cursor-hover.svg` | 24.65 × 36.98 | ja |
| `h4ngelic-cursor-pressed.svg` | 22.33 × 33.49 | ja |
| `h4ngelic-cursor-other-r09.svg` | 23.26 × 34.88 | ja |
| `h4ngelic-cursor-other-hover-r09.svg` | 24.65 × 36.98 | ja |
| `h4ngelic-cursor-other-pressed-r09.svg` | 22.33 × 33.49 | ja |

Capability-Probe (Playwright):

| Profil | `(hover:hover) and (pointer:fine)` | `(any-hover:hover) and (any-pointer:fine)` |
| --- | --- | --- |
| Desktop 1440 | true | true |
| Touch 390 (`hasTouch`, `isMobile`) | false | false |
| CDP-Hybrid (`Emulation.setEmulatedMedia` + `hasTouch`) | false | false — Media-Emulation ändert `any-*` **nicht**, deshalb prüft `tests/cursor-hit-test.mjs` den Hybrid-Fall über `hasTouch` + echte Maus. |

Specifity-Audit: nur `src/cursor.css` deklariert `cursor` (der Audit
`tests/tokens-audit.mjs` erzwingt das ab jetzt). `::before`/`::after` hatten
keine eigene `cursor`-Deklaration; Overrides kamen aus dem Overlay-Setup
(`[data-h4-cursor]`, `html.h4-custom-cursor`).

Altbug-Reproduktion (alte native Regeln gegen heutiges Markup):
desktop 1440 → **0 Lücken / 570 Punkte**; touch 390 → 144 Lücken, alle auf
`CANVAS` mit `auto` (erwartet: ohne fine pointer gibt es keinen h4-Cursor).

## Fix

- **Bildbudget:** `base`/`hover` (normal + other) → **19.7 × 29.6**, `pressed` →
  **21.28 × 31.97** (exakt 1.08×). Alle ≤ 32 CSS px.
- **Hotspot:** `8 2` (vorher `9 2`; 9 × 0.847 = 7.6 → 8), für alle fünf Tokens
  identisch, damit der Press-Swap nicht springt.
- **Tokens:** `--h4-cursor`, `--h4-cursor-interactive`, `--h4-cursor-pressed`,
  `--h4-cursor-xray`, `--h4-cursor-xray-pressed`; jede Deklaration ist
  `svg → png → auto|pointer`.
- **PNG-Fallback:** `h4ngelic-cursor.png`, `-pressed.png`, `-other.png`,
  `-other-pressed.png` (20×30 / 21×32), im Standalone-Export eingebettet.
- **Abdeckung:** `@media (any-hover: hover) and (any-pointer: fine)` mit
  `html, html *, html *::before, html *::after`.
- **Press:** `:active` auf `a, button, summary, [role=button], input, select,
  textarea, label, canvas` → vorab skalierte SVG. Kein Transform, keine
  Transition, kein JS.
- **Entfernt (im selben Commit):** `<div data-h4-cursor>` samt Inline-Head-Script,
  `h4-custom-cursor`-Klasse, Preload, Overlay-CSS und das Build-Plugin
  `h4ngelic-cursor-last`, das die `cursor: none !important`-Blanket-Regel in
  jedes Production-CSS geschrieben hat.

## Beweis

| Suite | Ergebnis |
| --- | --- |
| `tests/cursor-hit-test.mjs` | 4459 / 1139 / 929 Punkte (1440/390/320), Xray 2221, **0 Fremd-Cursor**; `:active`, NAAVI-Glyph, Footer, INDEX, Formular, Werkzeug-Leiste, Dialog, Canvas-Drag |
| `tests/cursor-native-browser.mjs` | 6 Assets ≤ 32 px, Press 1.08×, Hotspot `8 2`, kein Overlay, No-JS-Cursor, Touch ohne h4-Cursor |
| `tests/v312-r3-production-cursor.mjs` | dist-CSS: nur die 5 Token-Consumer, keine `cursor: none`, kein Klassen-Gate; PNG-Fallbacks 200 |
| `tests/tokens-audit.mjs` | 14 Definitionen, 12 Consumer, 0 duplizierte Literale |
| `npm test` | 376 / 376 |
| Physik | `tests/physics.test.js` 13 / 13, `tests/gateprep-batch1-physics.mjs` 179.99° → 39.60°, Pick-Delta **0.00 px** (`tests/browser.mjs`) |

## Vertragsänderungen (bewusst)

- `tests/cursor-kernel-browser.mjs` und `tests/cursor-fade-browser.mjs` sind
  **entfernt**: sie prüften Overlay-Tracking (0 px Lerp) und den 180-ms-Fade.
  Beides existiert nicht mehr — der Browser besitzt Tracking und Hide-on-Leave.
  Ersatz: `tests/cursor-native-browser.mjs` + Hit-Test.
- B-F1 „Freeze beim Fenster-Verlassen" ist damit strukturell gelöst: es gibt
  kein Element mehr, das einfrieren könnte.
- `tests/hero-poster.test.js` prüft statt Overlay-Markup jetzt die nativen
  Tokens; `tests/mode-icon-assets.test.js` pinnt das neue Bildbudget.

## So prüfst du es

1. Preview laden, Konsole: `getComputedStyle(document.body).cursor` →
   `url("…/h4ngelic-cursor.svg") 8 2, url("…/h4ngelic-cursor.png") 8 2, auto`.
2. Über NAAVI / Footer / VISIT fahren: überall dasselbe Logo, beim Klick die
   leicht größere Variante; Fenster verlassen → Cursor verschwindet (native).
3. `document.querySelector('[data-h4-cursor]')` → `null`; `document.documentElement.className`
   enthält kein `h4-custom-cursor`.
