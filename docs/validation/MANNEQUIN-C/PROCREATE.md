# Procreate-Roundtrip

Paket (ausserhalb des Repos):
`outputs/mannequin-remodeling/procreate/`

| Datei | Bytes | Zweck |
| --- | --- | --- |
| `mannequin_paint.obj` | 5.918.099 | 49.838 Tris, `usemtl skincolor` |
| `mannequin_paint.mtl` | 254 | `map_Kd skincolor.png`, kein absoluter Pfad |
| `skincolor.png` | 78.624 | 2048×2048, neutral `#f0efeb` |

Die MTL-Kopie in diesem Ordner ist die Datei, gegen die
`tests/mannequin-c.test.js` prueft (relativer Pfad, kein `/Users/`, kein Ns 722,5).

UV-Status: 0 exakte Ueberlappungspaare (`uv-overlap-procreate.json`), Fuellgrad
0,372 der Textur. Gemalte Pixel landen damit nicht doppelt auf der Rueckseite.

Ablauf: OBJ + MTL + PNG gemeinsam per AirDrop/Dateien auf das iPad, in Procreate
"3D-Modell importieren", malen, danach "Teilen → 3D-Modell exportieren". Die
exportierte PNG sitzt exakt auf der UV-Map von Variante C.

Der Demo-Design-Button auf der Website bleibt fuer C deaktiviert: das
projektseitige Decal-Placement ist auf die prozedurale UV-Map von A/B
zugeschnitten. C traegt keine Decals, bis in V3.2-M1 ein eigenes Placement
autoriert ist.
