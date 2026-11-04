# Mannequin-Integration — Variante C (A/B/C + Procreate-Roundtrip)

Branch `v3.2-mannequin-female`, Basis `9dd66ce`. Kein Merge, kein Deploy.

## Ergebnis in einem Satz

Die 3D-Model-Subsection auf `/work/tattoos` zeigt jetzt drei umschaltbare
Varianten (A smooth, B faceted, C sculpted als Default), dreht langsam, laesst
sich ziehen und zurueckschleudern, laedt jedes GLB genau einmal und bleibt auf
kalten Routen Three.js-frei.

## Quelle und Ableitung (Poly-Count-Trace)

| Schritt | Datei | Tris | Bytes |
| --- | --- | --- | --- |
| Sculpt (lokal, nicht im Repo) | `mannequin_smooth.glb` | 249.194 | 7.856.644 |
| glTF-Transform `optimize --simplify-ratio 0.20` | `simplified.glb` (temp) | 49.838 | 1,69 MB |
| Blender UV-Reparatur + mattes Material | `repaired.glb` (temp) | 49.838 | 2.290.964 |
| KTX2 + Draco (16-Bit-Texcoords) | `public/models/mannequin-c.d8306c2b1b08.glb` | 49.838 | **316.604** |

- Quell-Hash: `4a74c0187786c4c25ebb85577281c5d82ca759e6f9d6022e0db5806eb4aece04`
- Derivat-Hash: `d8306c2b1b08af813508ee3c671588df0030cf1f50f66c4784f1fe07e1168ccb`
- Zwei komplette Pipeline-Laeufe erzeugten byte-identische Derivate.
- Zielbudget: ≤60k Tris und <1,5 MB — beides eingehalten (49.838 Tris, 316 kB).

## UV-Arbeit (Procreate-Roundtrip)

`scripts/build-mannequin-web-asset.py` (Blender 4.5.0 Alpha):

1. Smart Project (30°, Margin 0,0006), Pack Islands, Layout auf 0..1 skaliert.
2. UVs auf das 16-Bit-Draco-Raster gesnappt (`UV_SNAP_BITS = 16`), damit die
   spaetere Quantisierung keine neuen Splitter erzeugt.
3. Ueberlappende und fast kollabierte Faces (Dreiecksflaeche < 2 % des Medians)
   werden in ein freies Raster ueber der Hauptflaeche umgepackt; das laeuft bis
   zur Fixpunktbildung (max. 4 Durchlaeufe).
4. Shade Smooth ohne Auto-Smooth-Modifier, GLB-Export mit `export_apply=False`
   (ein Modifier wuerde die UVs erneut aufschneiden).

| Messung | Wert |
| --- | --- |
| Ueberlappende Loops vorher | 102 |
| Ueberlappende Faces vorher | 55 |
| Degenerierte UV-Faces | 127 |
| Reparierte Faces | 160 (0,32 %) |
| Exakte Ueberlappungspaare nachher (GLB und OBJ) | 0 |
| UV-Fuellgrad der Textur | 0,372 |

Geprueft mit `scripts/check-mannequin-uv-overlap.py`: echter
Dreiecks-Schnittflaechen-Test (Sutherland-Hodgman) statt
`bpy.ops.uv.select_overlap`, weil Blender kleine, aber klar getrennte Dreiecke
als Ueberlappung meldet. Beide Nachweise liegen bei:
`uv-overlap-web.json`, `uv-overlap-procreate.json`.

`uv-overlap-web.json` prueft den **entpackten** Web-GLB (`gltf-transform copy`),
also exakt die Vertexdaten, die der Browser nach dem Draco-Decode sieht.

## Procreate-Paket

Ordner `outputs/mannequin-remodeling/procreate/` (ausserhalb des Repos):

- `mannequin_paint.obj` — 5.918.099 Bytes, 49.838 Tris, `usemtl skincolor`
- `mannequin_paint.mtl` — `map_Kd skincolor.png`, kein absoluter Pfad, Ns 144,4
- `skincolor.png` — 2048×2048, `#f0efeb`

`docs/validation/MANNEQUIN-C/procreate/mannequin_paint.mtl` ist die Kopie, gegen
die der Unit-Test prueft. Anleitung: `README_PROCREATE.md` im Paketordner.

## Rendering

- Default beim Laden: **C** (`data-mannequin-variant="C"`).
- Genau ein GLB-Request pro Variante, auch beim Zurueckschalten (ArrayBuffer-Cache
  im Modul); kalte Route: 0 WebGL-Kontexte, 0 GLB, 0 Preview-Chunk.
- Ein Renderer, Modellwechsel disposed Geometrie/Material/Textur des Vorgaengers
  (`data-mannequin-disposed` zaehlt mit).
- Auto-Rotation 0,18 rad/s, Hover 0,55 rad/s, nach 2 s Idle zurueck zur Automatik,
  Drag mit Traegheit, Touch-Swipe ueber Pointer Events (`touch-action: pan-y`).
- Flick (Peak > 2,4 rad/s ≈ 320 px/s) startet die dokumentierte Ersatzanimation
  (620 ms raus, 180 ms halten, 760 ms zurueck, easeInOutCubic/easeOutCubic).
- `prefers-reduced-motion`: keine Auto-Rotation, kein Flick, Drag bleibt.
- Ohne WebGL bleibt das Poster stehen, kein Canvas, State `failed`.
- DPR-Cap 2, feste Frame-Hoehe → kein Layout-Shift.

Screenshots: `variant-{a,b,c}-{1440,390,320}.png`, `fallback-poster-1440.png`.
Messwerte: `requests.json`.

## Tests

| Suite | Ergebnis |
| --- | --- |
| `npm test` | 385/385 PASS (379 vor dieser Arbeit + 6 neue C-Tests) |
| `npm run test:seo` | 18 Routen + 404, direkte Routen ohne Three.js-Requests |
| `npm run test:mannequin-preview` | 3 Viewports × A/B/C, 9 Screenshots, Rotation/Drag/Flick/Reduced-Motion/No-WebGL/Leak-Probe |
| `npm run build` | 18 Routen + 404 |
| `npm run verify:assets` | Derivat-Hash und Quell-Hash OK |

## Bewusste Abweichungen

1. **Simplify-Ratio**: `0.25` ergab ~71k Tris und verfehlte das Budget; benutzt
   wurde `0.20` (49.838 Tris). Der Befehl steht so in `scripts/build-mannequin-c.mjs`.
2. **Draco-Texcoords 16 Bit** statt Default 12: mit 12 Bit entstanden nach dem
   Decode 431 ueberlappende Faces, mit 16 Bit plus UV-Snapping 0.
3. **Textur-Fallback**: `/Users/h4ngelic/Desktop/skincolor.png` existiert nicht
   mehr, `mannequin_white.png.blend` liefert kein bakebares Bild. Verwendet wird
   die dokumentierte neutrale 2048er-Textur `#f0efeb` (im GLB als KTX2).
4. **Route**: Das Repo kennt kein `/creative/*`. Die Rubrik heisst `/work/tattoos`
   (`F7`/`B-F7` existiert hier nicht). Ich habe keine Route umbenannt, sondern die
   bestehende Subsection `#model-3d` erweitert.
5. **Hero-"Abschiessen"**: Es gibt keine Hero-Logo-Animation, die das Modell aus
   dem Viewport schiesst (`src/physics.js` kennt nur Impuls/Rotation). Ersatz mit
   dokumentierter Standard-Kurve, `TODO(V3.2-M1)` in
   `src/mannequin-preview-config.js`.
6. **Renderer-Disposal**: Die Aufgabe nennt in §1.2 "neues GLB in denselben
   Renderer" und in §5 "Renderer disposen beim Variantenwechsel". Ich folge §1.2
   (ein Kontext, Modell-Buffer werden disposed) — sonst waere "A→C ohne Reload"
   nicht ohne Kontext-Flackern moeglich.

## Beobachtungen (nicht angefasst)

- `.chapter-counter` (`position: fixed`, bottom center, V3.1-Bestand) liegt je
  nach Scrollposition ueber dem unteren Rand des Frames. Globales Element,
  ausserhalb dieses Scopes.
- **Orientierung A/B vs. C**: A/B sind mit `-Z` nach vorn modelliert (Bestand,
  siehe `docs/validation/MANNEQUIN-CHROME/variant-a-1440.png`), C mit `+Z`.
  Beim Wechsel C→A wirkt das wie ein Sprung um 180°. Nicht geaendert: A/B
  muessen unveraendert bleiben und das Demo-Decal liegt auf der sichtbaren
  A/B-Seite. Vorschlag fuer V3.2-M1: alle Varianten auf `+Z`-Front drehen und
  das Decal neu authorieren.
- `npm run test:mobile` scheitert an `tests/mobile-interactions-browser.mjs:193`
  (`page.waitForURL` nach `goto('/work/tattoos')`). Auf dem Basis-Commit
  `9dd66ce` in einem separaten Worktree reproduziert — vorbestehend, nicht durch
  diese Aenderung verursacht.

## Repro

```text
# einmalig: KTX-Software 4.4.2 (toktx) bereitstellen, z. B. unter /private/tmp/ktx-software
KTX_TOOLS=/pfad/zu/ktx/bin node scripts/build-mannequin-c.mjs
# optional: MANNEQUIN_SOURCE=/pfad/mannequin_smooth.glb
#           MANNEQUIN_TEXTURE=/pfad/skincolor.png
node scripts/verify-mannequin-assets.mjs
```
