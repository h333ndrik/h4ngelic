# Batch 2.5 — Begrüßung sichtbar, Hit-Areas begrenzt

Build-Marker: `data-build="d165b340b00e"` — gebaut aus `4c7ef3f` (B-F17) und
`d165b34` (B-F18). Beide Messungen und alle Screenshots stammen aus genau diesem
Build (`greeting.json.build` / `hit-areas.json.build`).

## B-F17 — Begrüßung war strukturell unsichtbar

**Phase 0 (gemessen, 1440 px, frische Origin ohne Storage):**

| Größe | vorher |
| --- | --- |
| `element.hidden` | `true` |
| `display` | `none` (globales `[hidden] { display: none !important }`) |
| `opacity` | `0` |
| Bounding-Box | 0 × 0 |

Damit konnte weder `:hover` noch `:focus-within` noch `@media (hover:none)`
greifen: der Knoten war nie im Layout. Ursache: `index.html` trug `hidden`, und
`updateVisitorCopy()` in `src/easter-eggs.js` setzte `element.hidden =
!returningVisitor`. Auf einer frischen Preview-Domain ist `returningVisitor`
immer `false`. (Auf 390/320 blieb der Fehler unbemerkt, weil dort zusätzlich die
Touch-Regel die Deckkraft erzwingt — der Test-Speicher aber einen
Wiederkehrer simulierte.)

**Fix:** `hidden` entfernt, Default-Text `nice to meet you.`; das Skript ändert
nur noch den Text, nie mehr die Sichtbarkeit.

**Nachher (gemessen):**

| Viewport | Ruhe | Hover | Focus | Box |
| --- | --- | --- | --- | --- |
| 1440 (Maus) | `opacity 0`, `visibility hidden` | `0.35`, `visible`, `rgb(240,239,235)` | `0.52` | `[115, 21, 1259, 44]` |
| 390 (Touch) | `0.35`, `visible` (dauerhaft) | — | `0.52` | `[84, 16, 252, 44]` |
| 320 (Touch) | `0.35`, `visible` (dauerhaft) | — | `0.52` | `[81, 16, 185, 44]` |

Kein Overlap: Begrüßung beginnt rechts vom Branding (`line.left ≥ brand.right`)
und endet links von INDEX (`line.right ≤ index.left`), Zeilenhöhe 44 px.

Screenshots: `greeting-{hover,focus}-1440.png`, `greeting-touch-{390,320}.png`.

## B-F18 — Rubrik-Zellen waren die Klickfläche

**Phase 0 (gemessen):** die vier Klickziele sind Grid-Zellen, nicht Labels.

| Viewport | Zelle | Label (Text + Pfeil) |
| --- | --- | --- |
| 1440 | 310 × 257 px | 276 px |
| 390 | 154 px breit | 95 px |
| 320 | 119 px breit | 71 px |

Ein Klick 20 px rechts vom Pfeil traf `SPAN` **innerhalb** des Links und
navigierte.

**Fix:** `.category-link { pointer-events: none }`; nur
`.interaction-visual` (Label + Pfeil) ist pointer-aktiv. Die Trefferfläche wird
per `::before` auf `max(44px, 100%)` Höhe erweitert und um 4 px an der Lese-Kante
gepolstert — bewusst **ohne** Überhang nach rechts: ein `right: -4px` blähte
`scrollWidth` um 4 px auf und drückte den 2.5%-Hover-Fit still auf 1.0.

Der Hover-Fit (`src/interactions.js`) rechnet die Restbreite jetzt ab der
Textkante plus Nachlauf-Padding: bei `transform-origin: 0 50%` ist das
Nachlauf-Padding echter freier Raum. Vorher füllte das Label seine Content-Box
(276.0 px Label vs. 275.4 px Platz) und die 2.5 % wurden auf 1 geklemmt.

**Nachher (alle drei Viewports):**

| Prüfung | Ergebnis |
| --- | --- |
| Text klickbar | ja |
| Pfeil-Glyph klickbar | ja |
| 4 px links vom Text | ja |
| 20 px rechts vom Pfeil | **nein** (kein `closest('.category-link')`) |
| Zell-Padding oben/außen | nein |
| Höhe der Trefferfläche | ≥ 44 px (20 px über/unter der Mitte klickbar) |
| Echter Klick 20 px rechts vom Pfeil | keine Navigation (bleibt `/`) |
| Echter Klick auf das Label | `/creative/more` |
| Hover-Scale | 1.025 (102.5 %), Glow unverändert |

Screenshots: `hit-before-*.png` (rot = alte Zellfläche),
`hit-after-*.png` (cyan = neue Label-Fläche).

## Test-Reconciliationen (kein Verhalten geändert)

- `tests/hover-browser.mjs`: zielt jetzt auf `.interaction-visual` (die Zelle ist
  absichtlich nicht mehr pointer-aktiv) und liest den Pfeilabstand aus dem
  Token `--ui-arrow-gap` statt aus den 2024er Zahlen 7…18 px; die frühere
  Erwartung war seit `d4246aa` (Token `clamp(10px, .28em, 22px)`) veraltet.
- `tests/microinteractions-browser.mjs`: die Rubrik-Prüfung kennt jetzt vier
  Links (statt drei) und das ausgelieferte 2×2-Raster unter 600 px; die
  Tab-Reichweite wird aus der Linkanzahl abgeleitet.
- `tests/link-glyph-contract.mjs`: `pointer-events: none` am Link ist erlaubt,
  solange das sichtbare Label per `elementFromPoint` den Link trifft.
- `tests/v7-visitor-tiers-browser.mjs`: First-Visit ist auf Desktop unsichtbar,
  auf Touch als Ghost sichtbar (F21-Vertrag).

## Suiten (dieser Batch)

| Suite | Ergebnis |
| --- | --- |
| `npm test` | 373/373 pass |
| `tests/greeting-browser.mjs` | 3/3 (1440, 390, 320), 3 Läufe hintereinander grün |
| `tests/rubric-hit-area-browser.mjs` | 3/3 |
| `tests/hero-boot-browser.mjs` | 3/3 (Build-Marker, Entrance, Cursor, Greeting, Slash) |
| `tests/hover-browser.mjs` | 2/2 (Desktop, Touch) |
| `tests/microinteractions-browser.mjs` | 2/2 (Desktop, Mobile; Dev-Server wegen `__H4_TEST__`) |
| `tests/link-glyph-contract.mjs` | 71 Link-Checks |
| `tests/typography-contract.mjs` | 3 Viewports + dist-grep |
| `tests/tokens-audit.mjs` | 0 duplicate Literale |

TESTMODE: fast — volle serielle Battery erst am Merge-Gate.

## So prüfst du es (3 Zeilen)

1. Frische Preview/Incognito öffnen, mit der Maus über die Kopfzeile fahren
   (nicht über den Text): „nice to meet you." erscheint als Geist, Tab zeigt es
   heller.
2. Auf dem Handy ist dieselbe Zeile dauerhaft sichtbar (35 %).
3. Im Rubrik-Block 20 px rechts vom Pfeil klicken: nichts passiert; auf das Wort
   klicken: Archiv öffnet.

## Kommandos

```sh
node scripts/serve-preview.mjs --port 55232
H4_BASE_URL=http://127.0.0.1:55232 node tests/greeting-browser.mjs
H4_BASE_URL=http://127.0.0.1:55232 node tests/rubric-hit-area-browser.mjs
H4_BASE_URL=http://127.0.0.1:55232 node tests/hover-browser.mjs
npm test
```
