# R12 — Rubrik-Reihen: Geometrie als Struktur (B-F4 / B-F12)

Stand: Branch `v3.1.1-fixes`, Startpunkt `1ce4123`. Kein Merge, kein Deploy.

## Befund (User, /creative, 05.11.)

Die vier Unterrubriken standen nicht auf einer Grundlinie; der Pfeil von `jewellery` klebte am Wort `tools`,
zwischen den anderen Wörtern standen große Lücken. B-F4/B-F12 waren als `fixed` gemeldet — es war aber nur ein
Zahlenwert (`--rubric-gap`) geändert worden, nicht die Struktur. Status hier ehrlich auf `reproduced` zurückgestuft.

## Ursachen (Teil 0, Punkt 5)

| Ursache | Trifft zu? | Beleg |
| --- | --- | --- |
| a) Pfeil ist eigenes Flex-Kind | **teilweise** | Der Pfeil lag nicht neben dem Link, aber als eigenes Flex-Kind im `.category-magnet` mit `align-items: center`; es gab keine gemeinsame Baseline-Kette. |
| b) inhaltsunabhängige Verteilung (`space-between`-Äquivalent) | **ja, Hauptursache** | `.category-strip` und `.rubric-cross-links` nutzten `grid-template-columns: repeat(4, minmax(0, 1fr))`: gleiche Zellen → der sichtbare Abstand hing von der Wortlänge ab (99.64 / 49.88 / 149.53 px bei 1440). |
| c) Whitespace-Textknoten zwischen Items | nein (Reihen), ja (Footer) | Strip/Filter/Cross-Links hatten keine; die Footer-Cluster schon — im Flex-Layout wirkungslos, aber jetzt strukturell entfernt. |
| d) unterschiedliche `line-height`/`vertical-align` je Item | nein (Werte identisch), aber ohne Baseline-Alignment | alle Items 1.12 / `baseline`; die Zeile war `align-items: center`. |
| e) Pfeil als Textglyph mit Font-Metriken | nein | `.arrow` ist ein CSS-gezeichnetes `<i>`, kein Glyph. |

## Messung (vollständig in `phase0-before.json` / `phase0-after.json` / `row-geometry.json`)

### Frontpage-Reihe `.category-strip`

| Viewport | Stand | display | Items | Gap-Token | Gaps (Pfeil-Ende → nächstes Wort) | Baseline-Streuung je Zeile |
| --- | --- | --- | --- | --- | --- | --- |
| 320 | vorher | grid | 4 | 10.00px | +57.33, -214.34, +71.72 | 0.00px |
| 320 | nachher | flex | 4 | 10.00px | +10.00, -148.61, +10.00 | 0.00px |
| 390 | vorher | grid | 4 | 10.00px | +84.89, -259.27, +101.11 | 0.00px |
| 390 | nachher | flex | 4 | 10.00px | +10.00, -167.80, +10.00 | 0.00px |
| 1440 | vorher | grid | 4 | 19.44px | +99.64, +49.88, +149.53 | 0.00px |
| 1440 | nachher | flex | 4 | 19.44px | +19.44, +19.44, +19.44 | 0.00px |

### Cross-Links `.rubric-cross-links`

| Viewport | Stand | display | Items | Gap-Token | Gaps (Pfeil-Ende → nächstes Wort) | Baseline-Streuung je Zeile |
| --- | --- | --- | --- | --- | --- | --- |
| 320 | vorher | grid | 3 | 10.00px | -212.66, +97.16 | 0.00px |
| 320 | nachher | flex | 3 | 10.00px | +10.00, +10.00 | 0.00px |
| 390 | vorher | grid | 3 | 10.00px | -248.25, +131.80 | 0.00px |
| 390 | nachher | flex | 3 | 10.00px | +10.00, +10.00 | 0.00px |
| 1440 | vorher | grid | 3 | 19.44px | +125.33, +208.16 | 0.00px |
| 1440 | nachher | flex | 3 | 19.44px | +19.44, +19.44 | 0.00px |

### Archiv-Filter `.work-filters`

| Viewport | Stand | display | Items | Gap-Token | Gaps (Pfeil-Ende → nächstes Wort) | Baseline-Streuung je Zeile |
| --- | --- | --- | --- | --- | --- | --- |
| 320 | vorher | flex | 4 | 10.00px | —, —, — | 0.00px |
| 320 | nachher | flex | 4 | 10.00px | —, —, — | 0.00px |
| 390 | vorher | flex | 4 | 10.00px | —, —, — | 0.00px |
| 390 | nachher | flex | 4 | 10.00px | —, —, — | 0.00px |
| 1440 | vorher | flex | 4 | 19.44px | —, —, — | 0.00px |
| 1440 | nachher | flex | 4 | 19.44px | —, —, — | 0.00px |

## Fix

- Eine Komponente `.rubric-row` (`src/rubric-row.css`): `display: flex`, `align-items: baseline`,
  `justify-content: flex-start`, `column-gap: var(--rubric-gap)`, `line-height: 1`. Kein `space-between`,
  keine `1fr`-Spalten mehr.
- Ein Link = ein Item (`.rubric-item`), Pfeil bleibt im Link und bekommt `margin-inline-start: var(--rubric-arrow-gap)`
  plus `--arrow-baseline-shift` (gemessen 0px: die Pfeilunterkante liegt exakt auf der Grundlinie,
  die Mitte damit auf halber Versalhöhe).
- Frontpage: zwei `.rubric-line`-Wrapper; ab 600px `display: contents` (eine Zeile), darunter zwei echte
  Flex-Zeilen mit demselben Gap und derselben Slash-Kante.
- Cross-Links: leerer Platzhalter-Slot entfernt (V25-Vertrag abgelöst), Zeile fließt mit einem Gap.
- Filterzeile bleibt einzeilig (`nowrap`, horizontal scrollend) zwischen Branding und INDEX.
- Footer-Cluster: keine Whitespace-Knoten mehr zwischen den Items; Geometrie unverändert (Streuung 0).
- `src/rubric-fit.js` misst nur noch Overflow (kein Spaltenmodell); `src/interactions.js` nimmt für Rubrik-Items
  den Abstand zum nächsten Item als Hover-Raum, damit die 2,5%-Rückmeldung erhalten bleibt.

## Beweis

| Suite | Ergebnis |
| --- | --- |
| `tests/row-geometry-contract.mjs` | 3 Viewports × 5 Reihen grün, Font-Fallback-Pass grün, Laufzeit ~20 s |
| `tests/tokens-audit.mjs` | 0 Befunde: kein `space-between`, keine `1fr`-Spalten, keine Literal-Margins an Items |
| `tests/typography-contract.mjs` | 1440/390/320 grün, Slash-Spalte 88,31 px / 32,7 px unverändert |
| `tests/link-glyph-contract.mjs` | 73 Link-Hover-Checks, eine `.arrow`-Quelle |
| `npm test` | 376 / 376 |
| Browser-Batterie | portfolio, v31-navigation, v25-cross-links, v32-structure, v32-micro, v23-titles, hover, microinteractions, hero-boot, gateprep-batch1, seo — grün |

## So prüfst du es

1. `/` bei 1440: die vier Wörter stehen auf einer Grundlinie, jeder Abstand ist gleich groß
   (`getComputedStyle(document.querySelector(".category-strip")).columnGap` → `19.44px`).
2. Bei 390/320: zwei Zeilen, beide beginnen auf der Slash-Kante, gleicher Abstand in beiden Zeilen.
3. `/creative/tattoos`: die Cross-Links fließen mit demselben Gap; `tools` klebt nicht mehr an `jewellery`.

## Vorbestehend rot (nicht Teil dieses Batches)

`tests/hero-background-browser.mjs` ist veraltet: es öffnet mit `reducedMotion: "reduce"`, dort bootet der Hero
bewusst als Poster (`is-poster-static`, kein WebGL, kein `__H4_TEST__`), und es prüft `.category-sublinks`,
die es im Markup nicht mehr gibt. Hero/Ink sind in diesem Batch laut Abgrenzung unangetastet.

