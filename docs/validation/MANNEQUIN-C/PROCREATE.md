# Procreate-Roundtrip

Paket (ausserhalb des Repos):
`outputs/mannequin-remodeling/procreate/`

| Datei | Bytes | Zweck |
| --- | --- | --- |
| `mannequin_paint.obj` | 5.918.099 | 49.838 Tris, `usemtl skincolor`, unveraendert seit M1 |
| `mannequin_paint.mtl` | 325 | `map_Kd skincolor.png` relativ, `illum 1` (matt) |
| `skincolor.png` | 955.528 | **2048×2048**, AO-Bake fuer die Malflaeche |

Die MTL-Kopie in `procreate/` ist die Datei, gegen die
`tests/mannequin-c.test.js` prueft (relativer Pfad, kein `/Users/`, kein
Glanzwert des Ursprungsmaterials).

## Zwei Bakes, identische UVs (M4a)

| Zweck | Auflösung | Bytes | Ort |
| --- | --- | --- | --- |
| Web-GLB | 1024 × 1024 | 333.524 (PNG) / 457.000 (GLB) | `public/models/mannequin-c.<hash>.glb` |
| Procreate-Malfläche | 2048 × 2048 | 955.528 | Procreate-Paket + `skincolor_paint_2048.png` |

Parameter identisch (AO 0,18 / 0,35 / 64 Samples / Blur 2 / Verlauf 4 %,
Basis `#f0efeb`); nur die Auflösung unterscheidet sich. Die frühere Fassung
hatte die Malfläche auf 1024 mitgezogen — das ist damit behoben.

`node scripts/retexture-mannequin-c.mjs --paint-only` backt nur die
Malfläche neu und lässt das ausgelieferte GLB byte-identisch.

## Material

Matt: `illum 1`, `Ks 0`, `Ns 0`. Die Glanzwerte des Ursprungsmaterials
(Ns 722.500000, Ks 0.500000, illum 2) sind bewusst nicht übernommen.

## Härtung

`scripts/check-procreate-package.mjs <ordner>` prüft das gesamte Paket:
kein `/Users/`-Pfad in OBJ/MTL/README, relatives `map_Kd`, keine
Ursprungs-Glanzwerte, PNG-Auflösung. Ergebnis: `procreate-package.json`
(0 Verstöße).

UV-Status: 0 exakte Ueberlappungspaare (`uv-overlap-procreate.json`), Fuellgrad
0,372064 im OBJ (0,372054 im GLB). Gemalte Pixel landen nicht doppelt auf der
Rueckseite.

Ablauf: OBJ + MTL + PNG gemeinsam per AirDrop/Dateien auf das iPad, in Procreate
"3D-Modell importieren", malen, danach "Teilen → 3D-Modell exportieren".

Der Demo-Design-Button auf der Website bleibt fuer C deaktiviert: das
projektseitige Decal-Placement ist auf die prozedurale UV-Map von A/B
zugeschnitten.

Herkunft und Lizenz: `CREDITS.md` im Repository.
