# B-F19 — Footer-Zone: Cursor und Scroll-Gutter (nur Messung, kein Fix)

Basis `1608499`, gemessen auf dem Branch-Stand nach B-F29 (`6909e2a`).
Werkzeug: `scripts/measure-footer-zone.mjs` → `measurement.json`, Screenshots
`zone-{1440,390,320}.png` und `gutter-forced-*.png`.

## 1. Warum hier gemessen wird

Der Hit-Test meldet über die gesamte Fläche den Logo-Cursor (dieser Lauf:
**21.861 Punkte, 0 Fremd-Cursor**), der User sieht über NAAVI/Footer aber den
Systempfeil. Also muss die Ursache etwas sein, das kein DOM-Element mit
`cursor`-Deklaration ist — oder eine Regel, die auf dem User-Gerät nicht greift.

## 2. Scroll-Metriken der Footer-Cluster

| Viewport | Container | scrollWidth / clientWidth | scrollHeight / clientHeight | overflow-x / -y | scrollbar-width | Gutter (`offsetHeight − clientHeight`) |
| --- | --- | --- | --- | --- | --- | --- |
| 1440 | `.footer-left` | 624 / 624 | 44 / 44 | auto / hidden | none | 0 px |
| 1440 | `.footer-details` | 163 / 163 | 44 / 44 | auto / hidden | none | 0 px |
| 390 | `.footer-left` | **146 / 123** | 44 / 44 | auto / hidden | none | 0 px |
| 390 | `.footer-details` | **128 / 123** | 44 / 44 | auto / hidden | none | 0 px |
| 320 | `.footer-left` | **146 / 88** | 44 / 44 | auto / hidden | none | 0 px |
| 320 | `.footer-details` | **128 / 88** | 44 / 44 | auto / hidden | none | 0 px |

Aktive Regel in allen Fällen: `.footer-left::-webkit-scrollbar { display: none; }`
bzw. dieselbe für `.footer-details`; dazu `scrollbar-width: none` aus
`src/easter-eggs.css:19-35`.

Beide Cluster scrollen also bei 390/320 horizontal **innerhalb** der 44-px-Zeile.
Vor B-F29 lag `.footer-left` bei 234 (390/320), jetzt bei 146 — der entfernte
Platzhalter hat den Überhang um 88 px verkleinert.

## 3. Gutter-Versuch (H1)

Versuch: `::-webkit-scrollbar { display: block; width: 16px }` plus
`scrollbar-width: auto !important`, zusätzlich ein Browserstart mit
`--disable-features=OverlayScrollbar`.

Ergebnis: `clientHeight` bleibt in allen Läufen **44 px**, `offsetHeight` 44 px.
Der headless Chromium dieser Umgebung reserviert **keinen** Platz für
Scrollbalken; ein klassischer, platzfressender Gutter lässt sich hier nicht
erzeugen. Der Versuch ist damit **nicht entscheidend** (weder Beleg noch
Widerlegung), siehe `measurement.json → reports[*].gutter`.

## 4. Punktabtastung im 2-px-Raster

Abgetastet wurden `.footer-left`, `.footer-details` und `[data-naavi]`, jeweils
8 px über den Rand hinaus, `elementsFromPoint` mit 4 Ebenen.

| Viewport | Punkte | Abweichungen vom Logo-Cursor |
| --- | --- | --- |
| 1440 | 12.303 | **0** |
| 390 | 5.221 | **0** |
| 320 | 4.337 | **0** |

Verglichen wird der Bild-Teil des Cursor-Werts. Der erste Messlauf zählte 1.474
„Abweichungen" bei 1440 — das war ein Methodenfehler: `footer-instagram` endet
mit dem Fallback-Keyword `pointer` statt `auto`, das Bild ist identisch. Nach
Normalisierung bleibt 0.

Punkte **8 px unter** dem Cluster landen auf `<footer>` bzw. `<div>` — jeweils
mit Logo-Cursor, kein fremdes Element (`measurement.json → below`).

## 5. Hypothesen

| # | Hypothese | Befund | Verdikt |
| --- | --- | --- | --- |
| H1 | Gutter/Scrollbalken der Cluster | Cluster scrollen real (146 > 88 bei 320 px), die Scrollbar-Fläche gehört keinem DOM-Element und erbt daher keinen `cursor`; hier nicht erzeugbar (Overlay-Scrollbars) | **plausibel, nicht bewiesen** |
| H2 | Overlay über der Zone | nur `a.chapter-counter.naavi` ragt in die Zone — das ist der Footer selbst, kein Overlay | widerlegt |
| H3 | iframe | 0 `<iframe>` im Dokument | widerlegt |
| H4 | Compositing-Layer | kein Vorfahre mit `transform`/`filter`/`will-change`/`contain` (0 Treffer) | widerlegt |
| H5 | Media-Query | **alle** Cursor-Deklarationen liegen in `@media (any-hover: hover) and (any-pointer: fine)` (`src/cursor.css:35`); greift die Query nicht, gibt es seitenweit den Systempfeil | erklärt den Footer **nicht** allein (Symptom ist dort lokal), bleibt aber der Grund, warum ein Gerät komplett ohne Logo-Cursor laufen kann |

## 6. Entscheidung

Genau eine Hypothese bleibt übrig, die zum **lokalen** Symptom passt: **H1**.
Bewiesen ist sie hier nicht, weil die Umgebung keine platzfressenden
Scrollbalken kennt. Nach Regel „erst messen, dann fixen" wird **kein Fix**
gebaut (kein Commit 6, keine gestapelte Spalte).

## 7. Frage an den User (entscheidet den nächsten Schritt)

1. Steht macOS → Systemeinstellungen → Darstellung → „Scrollbalken anzeigen" auf
   **Immer** oder **Automatisch**?
2. Sitzt der Systempfeil genau auf dem schmalen Streifen am **unteren Rand** des
   Footer-Clusters (dort, wo ein Scrollbalken läge), oder über der ganzen
   Textzeile?
3. Tritt es auch bei 1440 px Breite auf, wo die Cluster gar nicht scrollen?

Antwort auf (2)/(3) entscheidet: „nur unterer Streifen, nur schmal" → H1
bestätigt, dann Weg A (gestapelte Spalte ab 600 px) bauen. „Überall, auch
1440" → H1 widerlegt, nächster Kandidat ist H5 (Media-Query auf dem Gerät).
