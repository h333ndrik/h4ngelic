# Batch 3 — tattoos wird kanonisch, viertes Kapitel, Rubrik-Rhythmus

Build-Marker: `data-build="b3cc401bcf72"` — gebaut aus `51437eb` (B-F7),
`3f3eeb8` (B-F6), `bd15724` (B-F4/F12) und `b3cc401` (Test-Abgleich).

## B-F7 — `/creative/onskin` → `/creative/tattoos`

**Phase 0:** `categorySlugs = { tattoos: 'onskin' }` machte `onskin` kanonisch;
`/creative/tattoos` war ein Alias. Labels standen als `on skin` in Filter,
Archiv-Überschrift und NAAVI; die Route war `/creative/onskin`.

**Fix:** zentrale Slug-Quelle ohne Ausnahme (`categorySlug(id) === id`), dafür
eine explizite `retiredCategorySlugs`-Map, die **jede** alte Adresse mit einem
301 auf ihr tattoos-Ziel schickt (auch Deep-Links, `?category=` und `/work/*`).
Labels: `siteContent.archiveLabel` und der NAAVI-Stop lesen `tattoos`.

| Quelle | Status | Ziel |
| --- | --- | --- |
| `/creative/onskin` | 301 | `/creative/tattoos` |
| `/creative/onskin/` | 301 | `/creative/tattoos` |
| `/creative/onskin/tattoo-01` | 301 | `/creative/tattoo-01` |
| `/creative?category=onskin` | 301 | `/creative/tattoos` |
| `/work/onskin` | 301 | `/creative/tattoos` |
| `/work?category=onskin` | 301 | `/creative/tattoos` |

dist-Grep (144 Dateien): **0** `onskin` in HTML, **1** Vorkommen im JS — die
Redirect-Map. Seite `/creative/tattoos`: H1 `tattoos`, aktiver Filter `tattoos`,
NAAVI `creative / tattoos`. Screenshot: `retired-slug-work-1440.png`.

## B-F6 — das andere Ufer ist das vierte Kapitel

**Phase 0:** `naaviStops('home')` hatte vier Stopps (home, creative, about,
contact) → `total = 3`, der End-Reveal tauchte nie als Kapitel auf: `01/ 03`,
am Ende `03/ 03`.

**Fix:** der End-Reveal (`[data-end-reveal]`, `#final-secret`) ist der fünfte
Stopp. Der Zähler läuft jetzt `00/ 04 … 04/ 04`; das INDEX bleibt bei seinen
vier Zielen `00/ home … 03/ contact` (B-011 unverändert).

| Ort | vorher | nachher |
| --- | --- | --- |
| Home, Hero | `00/ 03` | `00/ 04` |
| Home, contact | `03/ 03` | `03/ 04` |
| Home, End-Reveal | — (kein Kapitel) | `04/ 04`, Label `the other side` |
| INDEX | 00–03 | 00–03 (unverändert) |

Beweis: `docs/validation/NAAVI/results.json`, `naavi-final-secret-1440.png`.

## B-F4 — Rubrik-Zeile: die Zellen waren in Ordnung, die Schrift nicht

**Phase 0 (1440 px):** die Grid-Spalten hatten exakt `--rubric-gap` (19,44 px),
aber `jewellery` war **335,8 px** breit in einer **310,2 px** breiten Spalte und
lief in `tools`: Label-Abstände `[53,6; −6,2; 113,4]` — also 6,2 px Überlappung.
Der Gap war nie kaputt; der Text wuchs darüber hinaus. (390/320 px: 2×2, keine
Überlappung, weil die Schrift dort klein genug ist.)

**Fix:** `src/rubric-fit.js` misst pro Zeile die breiteste Beschriftung und
setzt `--row-type-fit` auf die größte Größe, die noch in eine Spalte passt —
inklusive der 2,5 % Hover-Reserve, damit der Hover-Fit nicht auf 1.0 klemmt.
Ohne JS bleibt der Display-Token aktiv (kein Layout-Bruch).

| Viewport | Schrift vorher | nachher | Spalten-Gap | Label-Abstände | Überlauf |
| --- | --- | --- | --- | --- | --- |
| 1440 | 74,88 px | **62,373 px** | 19,44 px | 99,6 / 49,9 / 149,5 | 0 (vorher −6,2) |
| 390 | 20,28 px | 20,28 px | 10 px | 84,9 / 101,1 | 0 |
| 320 | 18 px | 18 px | 10 px | 57,3 / 71,7 | 0 |

Screenshots: `rubric-before-1440.png` (ohne Fit, Überlappung),
`rubric-after-{1440,390,320}.png`.

## B-F12 — Cross-Link-Reihen

Die Reihen behalten die V25-Spaltenlogik (jede Rubrik sitzt auf allen Seiten an
derselben Position, die aktuelle bleibt leer). Neu ist der Fit: auch die
Cross-Link-Reihe darf nicht aus ihrer Spalte laufen (bei 390 px: 16 px → 15,05 px).

| Viewport | Spalten | Start (Inhalt) | erster Slot |
| --- | --- | --- | --- |
| 1440 | 4 | 35 px | 35 px (leerer tattoos-Slot) |
| 390 | 2 | 22 px | 22 px (leerer Slot) |
| 320 | 2 | 22 px | 22 px (leerer Slot) |

Screenshots: `cross-links-{1440,390,320}.png`.

## Suiten (dieser Batch)

| Suite | Ergebnis |
| --- | --- |
| `npm test` | 373/373 |
| `tests/retired-slug-browser.mjs` | PASS: 6 Redirects, 0 onskin in HTML |
| `tests/rubric-gap-browser.mjs` | 3/3 (1440, 390, 320) |
| `tests/naavi-format-browser.mjs` | PASS: 00/ 04 … 04/ 04 + INDEX 00–03 |
| `tests/typography-contract.mjs` | 3 Profile + dist-grep |
| `tests/label-format-browser.mjs` | PASS (NN/ Labels, 00–04 INDEX, NAAVI) |
| `tests/v25-cross-links-browser.mjs` | 6/6 Profile |
| `tests/v31-navigation-browser.mjs`, `tests/navigation-browser.mjs` | 6/6, 4/4 |
| `tests/portfolio-browser.mjs`, `tests/v15-mobile-browser.mjs` | 6/6, 6/6 |
| `tests/seo-browser.mjs` | 23 Routen, Redirects, 404, Sitemap |
| `tests/footer-v31-browser.mjs` | 6/6 |
| `tests/hero-boot-browser.mjs` | 3/3 |
| `tests/master-browser.mjs`, `tests/master-naavi-browser.mjs`, `tests/master-layout-browser.mjs` | grün (Dev-Server, `__H4_TEST__`) |
| `tests/cursor-hit-test.mjs` | 4458/1138/928 Punkte, 0 Fremd-Cursor |
| `tests/gateprep-batch1-browser.mjs`, `tests/gateprep-batch2-browser.mjs`, `tests/v31-motion-browser.mjs` | grün |

TESTMODE: fast — volle serielle Battery erst am Merge-Gate.

### Vorbestehender Drift (nicht dieser Batch)

- `tests/easter-browser.mjs` wartet auf `[data-archive-category="tattoos"]
  .archive-empty`; seit B-013 zeigt das Tattoo-Archiv einen Platzhalter-Karussell
  statt eines leeren Zustands. Besuchsformat wurde korrigiert (`visit 0001`),
  der fehlende `.archive-empty`-Anker bleibt offen.
- `tests/scroll-browser.mjs` und `tests/ref09-layout-browser.mjs` (siehe
  Batch 2): Motion-Echos bzw. Reduced-Motion-Poster sind retired.

## So prüfst du es (3 Zeilen)

1. `/creative/onskin` aufrufen: landet auf `/creative/tattoos`, Filter und
   Überschrift sagen `tattoos`.
2. Auf der Startseite: Rubrik-Zeile zeigt vier gleich große Wörter mit
   sichtbarem Abstand, Zähler `01/ 04`; ganz unten am Ende `04/ 04`.
3. INDEX öffnen: weiterhin nur `00/ home … 03/ contact`.

## Kommandos

```sh
node scripts/serve-preview.mjs --port 55232
H4_BASE_URL=http://127.0.0.1:55232 node tests/retired-slug-browser.mjs
H4_BASE_URL=http://127.0.0.1:55232 node tests/rubric-gap-browser.mjs
H4_BASE_URL=http://127.0.0.1:55232 node tests/naavi-format-browser.mjs
npm test
```
