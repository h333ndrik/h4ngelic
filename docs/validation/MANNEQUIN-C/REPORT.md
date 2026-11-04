# Mannequin-Integration — Variante C (A/B/C + Procreate-Roundtrip)

Branch `v3.2-mannequin-female`, Basis `9dd66ce`. Kein Merge, kein Deploy.

## Ergebnis in einem Satz

Die 3D-Model-Subsection auf `/work/tattoos` zeigt **nur noch Variante C**
(sculpted), faehrt beim Scrollen mit derselben Kurve ein wie das Frontpage-
Element "01 / creative", dreht langsam, laesst sich ziehen und
zurueckschleudern, laedt genau ein GLB und bleibt auf kalten Routen
Three.js-frei. A und B sind verborgen, aber im Code erhalten.

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

## V3.2-M2 — Finalisierung

### Nur C sichtbar

- Der Varianten-Umschalter ist aus Markup, CSS und Renderer entfernt
  (`[data-mannequin-variant-option]` existiert nicht mehr).
- **A/B: verborgen, NICHT loeschen (V3.2).** Die Registry in
  `src/mannequin-preview-config.js` bleibt vollstaendig, inklusive Modelle,
  Material-Erwartung und Demo-Design-Flag.
- Intern erreichbar nur im Dev-Server: `/work/tattoos?variant=a|b`
  (`mannequinDevVariant()` prueft `import.meta.env.DEV`). Im Production-Build
  ist der Zweig tot; ein Test bestaetigt, dass `?variant=b` dort wirkungslos
  bleibt und keine A/B-Datei geladen wird.
- Screenshots der versteckten Varianten: `hidden-variant-a-1440.png`,
  `hidden-variant-b-1440.png` (Vite-Dev, B mit Demo-Decal), Messwerte in
  `hidden-variants.json`.
- Demo-Design bleibt fuer C deaktiviert (`aria-disabled="true"` + sichtbarer
  Hinweis "no decals on the sculpted uv layout").
- `initialYaw` ist jetzt eine benannte Konstante pro Variante. C: `0` rad, weil
  C mit `+Z` nach vorn modelliert ist und die Kamera auf `+Z` steht — also
  frontale Startansicht. A/B-Assets und ihre Werte bleiben unangetastet.

### Scroll-Einfahrt wie "01 / creative"

Das Frontpage-Element wird in `src/scroll-choreography.js` bewegt:
`aboutSectionProgress(position, top, vh)` (approach .68 / finish .10) und
`sampleAboutItem(progress, 'link', viewportWidth)` (linkStart .24 / linkEnd .98,
Distanz `min(28px, 4.5vw)`, Easing `smoothProgress`). Der Titel selbst bleibt
dort statisch — die Einfahrt laeuft ueber die Rubrik-Links
(`--kinetic-x` / `--kinetic-opacity`).

`src/section-entrance.js` importiert genau diese beiden Sampler (kein
Copy-Paste) und setzt `--entrance-x` / `--entrance-opacity` auf `#model-3d`.
Testvergleich gegen die Frontpage bei identischem Scroll-Offset:

| Section-Top im Viewport | Frontpage `--kinetic-x` | Modell `--entrance-x` | Opacity |
| --- | --- | --- | --- |
| 620 px | 28.000 px | 28.000 px | 0.000 |
| 500 px | 27.792 px | 27.790 px | 0.008 |
| 380 px | 20.310 px | 20.310 px | 0.412 |
| 260 px | 6.401 px | 6.390 px | 0.861 |
| 160 px | 0.337 px | 0.330 px | 0.994 |

**Abweichung (begruendet):** Das Original ist scroll-gebunden und laeuft beim
Zurueckscrollen rueckwaerts. Die Aufgabe erlaubt fuer diesen Fall
"Originalverhalten uebernehmen", deshalb gibt es keinen einmaligen Time-out;
der IntersectionObserver schaltet nur den Frame-Loop scharf (Startpose wird
synchron gesetzt). `prefers-reduced-motion`: Endpose sofort, kein Listener,
keine Animation. Ohne JavaScript bleibt die Section sichtbar (CSS-Default 1).

### LICENSE-NOTE

`docs/validation/MANNEQUIN-C/LICENSE-NOTE.md` ist **wortgleich** nach
`outputs/mannequin-remodeling/LICENSE-NOTE-C.md` verschoben (ausserhalb des
Repos) und im Repo entfernt. Inhalt: Herkunftskette des Assets (Sketchfab-
Basismesh), der Redistributions-Befund und die Tooling-Lizenzen (Blender GPL,
glTF-Transform MIT, KTX-Software Apache-2.0, Draco/Basis Apache-2.0). Nichts
davon ist verloren: die Apache-2.0-Nachweise der tatsaechlich ausgelieferten
Decoder stehen unveraendert in `public/draco/README.md` und
`public/basis/README.md`, die Herkunft liegt in der lokalen Notiz und in der
Git-Historie.

Bundle-Nachweis: Die Preview-Suite durchsucht `dist/` rekursiv nach
`LICENSE-NOTE` (0 Treffer) und bestaetigt, dass `docs/` nicht gebundelt wird.

### Tests (V3.2-M2)

| Suite | Ergebnis |
| --- | --- |
| `npm test` | 386/386 PASS |
| `npm run test:mannequin-preview` | 3 Viewports, nur C, Einfahrt == Frontpage, Reduced Motion, No-WebGL, Leak, Bundle ohne LICENSE-NOTE |
| `npm run test:mannequin-variants-dev` | A/B via `?variant=`, kein Umschalter, C bleibt Default (Vite-Dev) |
| `npm run test:seo` | 18 Routen + 404, keine Three.js-Requests auf direkten Routen |
| `node tests/v23-static-titles-browser.mjs` | 6/6 PASS (statische Titel unveraendert) |
| `npm run build` | 18 Routen + 404 |

### Beobachtungen (out of scope, unveraendert)

- `npm run test:mobile` scheitert an `tests/mobile-interactions-browser.mjs:193`
  — auf `9dd66ce` reproduziert.
- `.chapter-counter` (`position: fixed`) ueberlagert je nach Scrollposition den
  unteren Frame-Rand.
- A/B sind `-Z`-vorn, C ist `+Z`-vorn. Da nur C sichtbar ist, bleibt das ohne
  Wirkung; A/B-Assets wurden nicht angefasst.
