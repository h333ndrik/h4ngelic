# Batch 2 — Slash-Spalte, Lowercase, Viewer-Pfeile

Build-Marker: `data-build="1569731030b2"` (Arbeitsstand vor den Batch-2-Commits
`93372c6`…`a2f973b`; der Code dieser Commits ist identisch zum vermessenen Build).

## B-F5 — eine Slash-Spalte

Vorher (gemessen, 1440 px):

| Seite | font-size | line-height | letter-spacing | Slash-x relativ zur Überschrift |
| --- | --- | --- | --- | --- |
| `/` | 86.4 px | 93.312 px | −3.888 px | **88.31 px** |
| `/about` | 86.4 px | 86.4 px | −5.184 px | **85.73 px** |
| `/creative` | 86.4 px | 86.4 px | −5.184 px | **85.73 px** |

Differenz 2,58 px (32.7 vs 31.75 px auf 390/320). Fix: `--type-display-leading`
und `--type-display-tracking` als gemeinsame Quelle; numerierte Seiten-Headings
tragen `numbered-heading`. Nachher ist die Spalte auf allen drei Seiten
**88.31 px** (1440) bzw. **32.7 px** (390/320), bei identischer Größe, Leading
und Laufweite.

Screenshots: `heading-{home,about,creative}-{1440,390,320}.png`.

## B-F9 / B-F10 / B-F11 — Lowercase

| Ort | vorher | nachher |
| --- | --- | --- |
| Formular-Labels | `YOUR NAME` · `HOW TO REACH YOU` · `WHAT'S ON YOUR MIND?` | `your name` · `how to reach you` · `what's on your mind?` |
| Submit | `SEND MESSAGE` | `send message` |
| Anhang-Label | `ATTACH REFERENCES / IMAGES` | `attach references / images` |
| About-Link | `MORE ABOUT` | `more about` |

Die Strings stehen klein im Quelltext (kein `text-transform`), Screenreader
lesen die richtigen Wörter. Sweep: `tests/lowercase-sweep.mjs`, 3 Viewports.
Screenshots: `lowercase-form-*.png`, `lowercase-about-*.png`.

## B-F13 — Viewer-Pfeile ohne Überschneidung

Gemessen bei 390 px: `←` bei x 124–168, Zähler `01/ 01` bei 178–212, `→` bei
222–266 — Pfeile flankieren den Zähler, kein Overlap. Der eigentliche Befund war
der durchscheinende Seitentext („inquire about this work · back to tattoos")
hinter der transparenten Dialogfläche. Fix: Bottom-Gradient im Dialog
(`::after`, 96 px) und `z-index: 1` für Caption/Navigation.

Screenshots: `viewer-{1440,390,320}.png`, `viewer-nav-*.png`.

## Nicht Batch 2 — vorbestehender Test-Drift

Zwei Legacy-Suiten sind schon am sauberen HEAD rot und wurden deshalb hier
nicht angefasst (dokumentiert, nicht stillgelegt):

- `tests/scroll-browser.mjs`: erwartet `.motion-echo`-Echos und
  `--motion-run`-Pinning. Beide Features sind retired (`git grep motion-echo
  1569731 -- src` → leer); die aktuelle Motion-Suite ist
  `tests/v31-motion-browser.mjs` (6/6 Profile grün).
- `tests/ref09-layout-browser.mjs`: wartet auf `#stage.is-ready` im
  Reduced-Motion-Profil (dort ist `is-poster-static` der Vertrag, F29/S8) und
  erwartet die alte Footer-Identity-Struktur.

## So prüfst du es (2–3 Zeilen)

1. Home → About → Creative: die Slash-Spalte von `01/`, `02/` bleibt exakt
   stehen, Überschriften sind gleich groß.
2. Formular ansehen: alle Labels und „send message" klein; About-Link
   „more about".
3. Auf dem Handy ein Artwork öffnen: `← 01/ 01 →` liegt auf einem sauberen
   dunklen Verlauf, kein Seitentext scheint durch.

## Kommandos

```sh
H4_BASE_URL=http://127.0.0.1:55232 node tests/typography-contract.mjs
H4_BASE_URL=http://127.0.0.1:55232 node tests/lowercase-sweep.mjs
H4_BASE_URL=http://127.0.0.1:55232 node tests/gateprep-batch2-browser.mjs
npm test
```

TESTMODE: fast — volle serielle Battery erst am Merge-Gate.
