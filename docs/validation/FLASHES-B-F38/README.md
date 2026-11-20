# B-F38 — Flashes-Fotos einspeisen

Quelle: `/Users/h4ngelic/Desktop/website/flashes` (Achtung: der Ordnername endet
auf ein **Leerzeichen**, deshalb schlug der Pfad aus dem Auftrag fehl).
Ziel: `public/images/flashes/`, Sektion `/creative/tattoos#flashes`.

## 1 — Quelle

30 Dateien, 107,1 MB auf der Platte. Darin stecken **15 Motive**, jedes liegt
zweimal byte-identisch vor (`IMG_5327.PNG` und `IMG_5327 2.PNG`). Format: PNG,
2480 × 3508 (A4 @300 dpi), sRGB. `hasAlpha: yes` laut `sips`, aber **0
transparente Pixel** in allen 15 Bildern (Messung im Browser-Canvas über alle
Pixel, minAlpha 255) → PNG-Foto ohne Transparenz → Umwandlung in JPG.

## 2 — Duplikate

- `sha256` über alle 30 Dateien: 15 Paare sind byte-identisch (siehe Spalte
  „Quelle"); von jedem Motiv wurde **nur ein** Exemplar eingespeist.
- Abgleich mit allen Bildern im Repo (`public/images/**` außer `optimized/`):
  **keine** Überschneidung, es wurde nichts doppelt importiert.
- Heuristik „gleiche Maße + Größe ±5 %": alle 15 haben dieselben Maße
  (2480 × 3508), die Dateigrößen unterscheiden sich aber deutlich (1,7–7,7 MB),
  also keine weiteren Verdachtsfälle.

## 3 — Kompression (sips, Temp-Verzeichnis, Originale unangetastet)

