# B-F48 — Analog-Photography-Fotos eingespeist (`/creative/more`)

Quelle: Desktop-Ordner `website/website pics analog` (8 Dateien, Angaben ohne absoluten Pfad).
Ziel: Rubrik `more`, Sektion `analog photography`. Der Name ist unverändert:
`src/data/siteContent.js` führt `{ id: 'analog-photography', label: 'analog photography' }`,
und die gerenderte Sektion trägt denselben Heading (siehe `results.json`).
Originale bleiben unangetastet; im Repo liegen nur die komprimierten Fassungen.

## 1 — Quelle

| Datei | Format | Maße | Bytes | KB |
| --- | --- | --- | --- | --- |
| IMG_0810.jpg | JPEG | 1392 × 2088 | 1 735 077 | 1 694 |
| IMG_2793.JPG | JPEG | 2088 × 1392 | 1 118 007 | 1 092 |
| IMG_3010.jpg | JPEG | 1392 × 2088 | 1 376 840 | 1 345 |
| IMG_3402.jpg | JPEG | 1392 × 2088 | 1 739 433 | 1 699 |
| IMG_3494.jpg | JPEG | 1170 × 1445 | 2 674 867 | 2 612 |
| IMG_3495.jpg | JPEG | 1170 × 1444 | 1 352 136 | 1 320 |
| IMG_4118.jpg | JPEG | 1392 × 2088 | 1 059 683 | 1 035 |
| IMG_7434.jpg | JPEG | 1228 × 1726 | 879 266 | 859 |

Summe: **8 Dateien, 11 935 309 Bytes = 11,4 MB**. 7 hoch, 1 quer.

## 2 — Duplikate

- `shasum -a 256` über die 8 Quelldateien: **8 verschiedene Hashes**, keine
  byte-identischen Doppel.
- Vergleich mit allen 35 bereits im Repo liegenden Bildern (ohne
  `public/images/optimized/`): **0 Treffer**.
- Heuristik „gleiche Maße ±5 % Größe": keine Quelle teilt ihre Maße mit einer
  Repo-Datei (`1170 × 1445`/`1170 × 1444` liegen neben `1170 × 1470`,
  `1170 × 1674`, `1170 × 1734`, `1179 × 1541` — keine Identität) ⇒ **0 Kandidaten**.
- Nichts doppelt eingespeist.

## 3 — Kompression (sips, Originale unverändert)

Erster Versuch `-Z 1600 -s formatOptions 80`: **375–955 KB pro Datei**, alle über
dem 300-KB-Limit. Deshalb Breite auf 905 px (Portrait) bzw. 1280 px (Querformat),
Qualität 55; nur `analog-05` (sehr detailreich) zusätzlich auf 50, weil q55
301 KB ergab.

| Zieldatei | Maße | Bytes | KB | Quelle |
| --- | --- | --- | --- | --- |
| analog-01.jpg | 905 × 1357 | 258 238 | 252 | IMG_0810.jpg |
| analog-02.jpg | 1280 × 853 | 260 950 | 254 | IMG_2793.JPG |
| analog-03.jpg | 905 × 1357 | 168 305 | 164 | IMG_3010.jpg |
| analog-04.jpg | 905 × 1357 | 231 638 | 226 | IMG_3402.jpg |
| analog-05.jpg | 905 × 1117 | 266 357 | 260 | IMG_3494.jpg |
| analog-06.jpg | 905 × 1117 | 131 355 | 128 | IMG_3495.jpg |
| analog-07.jpg | 905 × 1357 | 132 005 | 128 | IMG_4118.jpg |
| analog-08.jpg | 905 × 1272 | 202 695 | 197 | IMG_7434.jpg |

Summe: **1 651 543 Bytes = 1,6 MB** (Vorher 11,4 MB). Jede Datei < 300 KB,
alle im Korridor 85–262 KB. Keine „komprimierte" Datei ist größer als das
Original. Sichtprüfung in 100 % an allen acht Dateien: keine Blöcke, keine
Artefakte (Ordner `public/images/analog-photography/`).

## 4 — Anordnung: gemessen, dann entschieden

Nachbar in derselben Rubrik: **digital artworks** (`src/data/siteContent.js:19-21`,
`presentation: 'existing'`) → eigener Grid-Block mit **Inline-Expand-Karte**
(`src/pages.js:161-169`, `src/archive-structure.css:92-117`). Bei 1440 misst
diese Karte 401 × 534, bei 390 exakt **300 × 420**.

Zwei Varianten wurden gegeneinander gemessen (1440, Sektion `analog photography`):

| Variante | Kartenschlitz | Sichtbarer Bildanteil | Bemerkung |
| --- | --- | --- | --- |
| Drift-Karte mit `cover` (Standard) | 300 × 420 für alle | Portrait 93,4 %, **Querformat 47,5 %** | das Querformat wäre fast halb beschnitten |
| Grid wie digital artworks | 668 px breit, Zeilenhöhe 1061 px | 100 % | Querformat-Zelle bleibt ~556 px leer, Sektion wächst auf 4486 px |
| **gewählt:** Drift-Karte mit `contain` | 300 × 420 für alle | **100 %** | gleiche Karte, gleiche Kartenhöhe, kein Beschnitt |

Umgesetzt in `src/horizontal-drift.css`: eine Regel, die für die Sektion
`analog-photography` den bestehenden Token `--inline-artwork-fit` auf `contain`
setzt (derselbe Token, den die Karte beim Aufklappen ohnehin nutzt). Kein neuer
Wert, keine zweite Implementierung, keine neue Größenkonstante. Die
Grid-Variante wurde verworfen, weil sie bei gemischtem Seitenverhältnis große
Leerzellen erzeugt.

## 4a — Nachtrag: spätes Seitenwachstum behoben

Mit echten Inhalten wuchs `/creative` nach dem ersten Scrollen um **268 px**:
die gemeinsame `content-visibility: auto` / `contain-intrinsic-size: auto 720px`
Reservierung der `more`-Sektionen schätzte zu klein (digital artworks +219 px,
analog photography +49 px). `v31-navigation-browser` fiel darüber („Footer and
fixed NAAVI share one baseline"), reproduzierbar, nicht flaky: derselbe Test
läuft auf dem Stand ohne die Fotos grün, weil die Seite dort netto um 77 px
schrumpfte.

Behoben in `src/archive-structure.css`: die beiden Sektionen der Rubrik `more`
rendern direkt (`content-visibility: visible`, `contain-intrinsic-size: none`),
die Bilder bleiben `loading="lazy"`. Messung danach: Dokumenthöhe 7056 px vor
und nach dem Scrollen **unverändert** (`changed: []`), `v31-navigation-browser`
PASS auf 1440/390/320 × reduced.

## 4b — Scope der beiden Regeln (Vorher/Nachher gemessen)

Beide Regeln sind auf die Analog-Sektion bzw. die `more`-Rubrik begrenzt:

- `src/horizontal-drift.css:28` — Selektor beginnt mit
  `.archive-category[data-archive-category='analog-photography']`, also nur die
  Karten dieser einen Sektion. Flashes und Tattoos sind nicht adressiert.
- `src/archive-structure.css:123` —
  `.work-page .work-group[data-work-group='more'] :is(.archive-category, .project-grid)`;
  nur die beiden Sektionen der Rubrik `more`.

Gegenprobe mit einem Build **ohne** beide Regeln (danach wieder eingespielt):

| Messung | ohne Regeln | mit Regeln |
| --- | --- | --- |
| Flashes-Karte 1440/390 | 300 × 420 (+ Meta 465), `cover`, sichtbar 0,99, Abstand 100 px | identisch |
| Tattoo-Karte 1440/390 | 300 × 420, `cover`, sichtbar 0,896–0,98, Abstand 100 px | identisch |
| Flashes-Screenshot 1440 | `artifacts/analog-scope/flashes-1440-before.png` | **0 von 2 408 460 Bytes unterschiedlich** (`after.png`) |
| Analog-Karte | `cover`, Querformat 47,5 % sichtbar | `contain`, 100 % sichtbar |
| `/creative` Dokumenthöhe nach Scroll | **+268 px** (digital +219, analog +49) | **0 px** |

`/creative/tattoos` und `/creative/more` wachsen in beiden Builds nicht
(0 px). Auf `/creative` liegen die `more`-Sektionen unterhalb des Viewports,
deshalb tritt dort die Reservierungs-Differenz auf.

## 5 — Verifikation (Build mit den Änderungen, 46 Routen)

- `npm run build`: **46 Routen + 404** (38 + 8 Detailseiten `analog-01` … `analog-08`).
- `npm test`: **448 Tests / 447 pass / 1 skipped / 0 fail**.
- `seo-browser`: PASS mit **46 semantic direct routes**.
- `v32-structure-browser`: PASS (Platzhalter flashes 0/`01/ 15`, jewellery 8/`01/ 08`).
- `portfolio-browser`: PASS 1440/390 (reduced true/false); `more` zählt jetzt 1 + 8 Bilder aus der Datenquelle.
- `v31-navigation-browser`: PASS 1440/390/320 × reduced (Footer-/NAAVI-Baseline, siehe 4a).
- `cursor-hit-test`, `footer-zone-contract` (3/3), `footer-v31`, `row-geometry-contract` (5 Viewports),
  `mobile-parity-browser`: PASS.
- Sektion `analog photography` (`results.json`): 8 Karten, `01/ 08`, **0 Platzhalter**,
  kein `archive-empty`, `contain` auf allen Bildern, Kartenhöhe **467 px** (≥768)
  bzw. **465 px** (≤390) für jede Karte gleich, NAAVI **02/ 02** (Sektionsmodus).
- Kein horizontaler Überlauf bei **1440/390/320/768/1024** (`scrollWidth − innerWidth = 0`).
- `prefers-reduced-motion: reduce`: gleiche Werte, Bilder sichtbar, keine Bewegung.
- digital artworks unverändert: 1 Bild, Inline-Frame, 390 = 300 × 420.
- Netzwerkleiste: `analog-02-…-640.webp` = **60 780 Bytes (60,7 KB)** statt
  260 950 Bytes JPEG; die 320er Varianten liegen zwischen 5,7 und 26 KB.

## So prüfst du es

1. `/creative/more` öffnen, zu „analog photography" scrollen: acht Karten laufen
   von selbst, der Zähler zeigt `01/ 08`, keine Platzhalterkarten.
2. Die NAAVI unten zeigt `02/ 02`; ein Klick springt zwischen digital artworks
   und analog photography.
3. Ein Foto anklicken: es vergrößert sich an Ort und Stelle (kein Dialog), und im
   Netzwerk-Tab lädt das Bild als WebP unter 60 KB.
