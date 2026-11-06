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
Repos) und im Repo entfernt. Inhalt: Herkunftskette des Assets (FBX-Import des
Basismeshs `free-female-mannequin-base-mesh`), der damalige Redistributions-
Befund und die Tooling-Lizenzen (Blender GPL,
glTF-Transform MIT, KTX-Software Apache-2.0, Draco/Basis Apache-2.0). Nichts
davon ist verloren: die Apache-2.0-Nachweise der tatsaechlich ausgelieferten
Decoder stehen unveraendert in `public/draco/README.md` und
`public/basis/README.md`, die Herkunft liegt in der lokalen Notiz und in der
Git-Historie.

**Stand 05.11.2026:** Die Lizenz ist geklaert (CC0 1.0, Nutzerbestaetigung),
oeffentliche Herkunftsangabe in `CREDITS.md`. Die Herkunftskette lautet belegt:
`female_mannequin.fbx` -> FBX-Import in `mannequin_white.png.blend` -> Voxel-
Remesh (249.194 Tris) -> Dezimierung (49.838 Tris) -> KTX2/Draco. Die frueher
hier behauptete "lokale Neuerstellung" war falsch (Audit 05.11.2026).

Bundle-Nachweis: Die Preview-Suite durchsucht `dist/` rekursiv nach
`LICENSE-NOTE`, `CREDITS` und dem Namen der Bezugsplattform (je 0 Treffer) und
bestaetigt, dass `docs/` und `CREDITS.md` nicht gebundelt werden.

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

## V3.2-M3 — Optik: AO in der Albedo

Ziel war die weiche Studioschattierung der Referenzpuppe: dezente Abdunkelung in
Hals, Achseln, Unterbrust, Leiste, Kniekehle und Zehen. Geometrie und UVs
bleiben unangetastet, geaendert werden nur Textur und Material.

### Bake-Parameter (`scripts/bake-mannequin-ao.py`, Konstanten oben)

| Konstante | Wert | Begruendung |
| --- | --- | --- |
| `RESOLUTION` | 2048 | Atlasgroesse aus M1 |
| `AO_DISTANCE` | 0.18 Szeneneinheiten | Modell ist 5.0085 hoch (1 Einheit ~34 cm) → rund 6 cm an einer 1.70-m-Figur. Mit 0.12 (~4 cm) war die Schattierung im Render kaum sichtbar, 0.5 (~17 cm) saettigt. |
| `AO_STRENGTH` | 0.35 | innerhalb der geforderten 0.25–0.4 |
| `AO_SAMPLES` | 64 | Bake-Rauschen ohne sichtbare Restkornung |
| `AO_BLUR_RADIUS` | 2 Texel | glaettet innerhalb der UV-Inseln |
| `GRADIENT_STRENGTH` | 0.04 | unten 4 % dunkler, abschaltbar (0.0) |
| `BAKE_MARGIN` | 16 px | Blender-Margin, damit Mipmaps an Inselraendern keine neutrale Kante ziehen |
| `BASE_COLOR` | `#f0efeb` | unveraendert |

Komposit: linearisiertes Basislicht × AO × Verlauf, Ausgabe als sRGB-PNG. Keine
Saettigungs- oder Farbverschiebung, keine specular-/Metallic-Aenderung.

### Ergebnis

| Wert | vorher | nachher |
| --- | --- | --- |
| Tris | 49.838 | 49.838 |
| UV-Fuellgrad | 0.372054 | 0.372054 |
| UV-Ueberlappungen (exakt) | 0 | 0 |
| Textur | flach `#f0efeb` | `skincolor_baked.png`, 2048, mean 0.813, min 0.538 |
| GLB | 316.604 B, `d8306c2b…68ccb` | **653.640 B, `d9edb0e4d7b01f53eabe680dc19c8f0dbe9a1fd0ce0f20916cfe790b43c06976`** |
| Bounding-Box-Drift | — | 0.000000 (Toleranz 0.005 fuer Draco-14-Bit) |

Vorher/Nachher als 3/4-Render (Cycles, 64 Samples, neutrale Studio-Beleuchtung,
`scripts/render-mannequin-evidence.py`): `ao-before-3q.png`, `ao-after-3q.png`,
direkt nebeneinander in `ao-before-after.png`. Textur: `skincolor_baked.png`.

### Entscheidungen und Abweichungen

1. **AO-Distanz 0.18 statt Startwert 0.12.** Mit 4 cm war die Schattierung im
   Render praktisch unsichtbar; 6 cm trifft "weiche Studioschattierung", ohne
   dass es dreckig wirkt. Beides steht als Konstante im Skript.
2. **Procreate-OBJ nicht neu exportiert.** Ein Export aus dem quantisierten GLB
   verschiebt die UVs auf das 16-Bit-Draco-Raster; zwei Faces beruehrten sich
   dann (Schnittflaeche 2e-8). Da Geometrie und UVs unveraendert sind, bleibt
   das M1-OBJ (5.918.099 B, 0 Ueberlappungen) und nur `skincolor.png` wurde
   ersetzt. MTL unveraendert, relativ, kein absoluter Pfad.
3. **Textur-Komposit mit Bake-Margin.** Die erste Fassung hat die Margin-Texel
   mit Basisfarbe ueberschrieben; im Render entstanden helle Nahtlinien, weil
   Mipmaps dort hineinsampeln. Jetzt gilt alles als gueltig, was der Bake
   geschrieben hat (Inselflaeche + Margin), und die AO-Werte werden nur
   innerhalb dieses Bereichs geglaettet. Ohne diesen Schritt bluten fremde
   UV-Inseln ineinander und es entstehen dunkle Kratzer.
4. **Dateigroesse steigt auf 653 KB** (statt 316 KB), weil die Albedo jetzt ein
   echtes 2048-Bild ist. Weiterhin deutlich unter dem 1,5-MB-Budget.
5. **Keine separate `occlusionTexture`.** Wie gefordert liegt AO in der Albedo,
   damit Procreate und der Web-Renderer dieselbe Textur lesen.

### Repro

```text
KTX_TOOLS=/pfad/zu/ktx/bin node scripts/retexture-mannequin-c.mjs
npm run verify:assets
```

Der Lauf entpackt den aktuellen GLB, backt in Blender, komprimiert mit
identischen Draco/KTX2-Settings (kein Simplify), prueft Tris, Bounding-Box und
UV-Ueberlappungen und aktualisiert Manifest, Config-Filename und Procreate-Textur.

### Tests (M3)

| Suite | Ergebnis |
| --- | --- |
| `npm test` | 387/387 PASS (neu: Textur-Varianz, Bake-Parameter, fester SHA) |
| `npm run test:mannequin-preview` | 3 Viewports, C-only, Einfahrt, Reduced Motion, No-WebGL, Bundle ohne LICENSE-NOTE |
| `npm run test:seo` | 18 Routen + 404 |
| `npm run build` | 18 Routen + 404 |
| `npm run verify:assets` | Derivat- und Quell-Hash OK |

A/B-Assets und Registry bleiben unangetastet (0 Requests im Build, nur
Dev-Zugang ueber `?variant=a|b`).

## V3.2-M3 Nachzug — Einfahrts-Loop mit echtem Stop-Trigger

### Befund

`src/section-entrance.js` rief `stop()` auf, ohne dass die Funktion existierte.
Der Aufruf landete still bei `window.stop` (Dokument-Ladevorgang abbrechen) und
tat nichts. Gleichzeitig wurde der Loop nur von Scroll-/Resize-Events
angefordert — der Commit "Section-Einfahrt frame-getrieben" hatte den Loop also
nie tatsaechlich frame-getrieben gemacht.

Zweiter Befund aus der Messung: mit `rootMargin: '150% 0px'` lag die Section auf
allen drei Profilen schon am Seitenanfang im Arm-Fenster (Section-Top 1147 px
bei 844 px Viewport). Der Loop lief damit auch dann, wenn niemand hinsah.

| Profil | Section-Top bei Scroll 0 | Arm-Fenster (150 %) | im Fenster? |
| --- | --- | --- | --- |
| 1440 × 1000 | 1549 px | bis 2500 px | ja |
| 390 × 844 | 1147 px | bis 1688 px | ja |
| 320 × 900 | 1146 px | bis 1800 px | ja |

### Fix

1. `stop()` existiert jetzt echt: es haelt das rAF-Handle und ruft
   `cancelAnimationFrame`. `update()` gibt das Handle beim Start frei, damit
   `stop()` keinen laufenden Frame abbricht.
2. Der Loop fordert sich selbst neu an (`schedule()` am Ende von `update()`) und
   traegt damit die Pose auch dann nach, wenn ein blockierter Main-Thread
   (GLB-Decode) Scroll-Events verschluckt.
3. Exit-Trigger bleibt der IntersectionObserver, aber mit `rootMargin: '15% 0px'`:
   knapp genug, dass er ausserhalb des Sichtbereichs wirklich greift, weit genug,
   dass der erste sichtbare Frame schon eine berechnete Pose hat.
4. `document.hidden` pausiert den Loop (`visibilitychange`), Reduced Motion
   setzt die Endpose und startet keinen Loop.

### Stop-Assert (Beweis)

`tests/section-entrance-browser.mjs` laeuft auf der isolierten Harness
`tests/fixtures/section-entrance.html`, die nur `src/section-entrance.js` laedt.
Ein globaler rAF-Zaehler waere auf `/work/tattoos` nicht zurechenbar (siehe
Beobachtung unten); auf dem Harness stammt jeder Call aus dem Einfahrts-Modul.

| Assert | Messung (390 × 844) | Ergebnis |
| --- | --- | --- |
| A ausserhalb Arm-Fenster | 0 rAF-Calls / 500 ms | PASS |
| B im Arm-Fenster, ruhig | 30 rAF-Calls / 500 ms | PASS |
| C betreten → verlassen | 0 Calls, `cancelAnimationFrame` genutzt, Pose eingefroren | PASS |
| D dispose | 0 Calls, auch nach erneutem Scrollen | PASS |
| Reduced Motion | 0 Calls, Pose `x=0`, `opacity=1` | PASS |

Rohdaten: `section-entrance-stop.json`. Die Einfahrts-Aequivalenz zur Frontpage
im Production-Build (`npm run test:mannequin-preview`) bleibt gruen.

### Beobachtung (nicht angefasst, V3.1-Eigentum)

`horizontal-drift` haelt auf `/work/tattoos` einen eigenen Frame-Loop, der am
Seitenanfang bereits ~30 rAF-Calls / 500 ms erzeugt. Der Anteil waechst ueber
die Zeit (4 → 10 → 30 Calls). Gehoert zu V3.1 und liegt ausserhalb dieses
Laufs — nicht geaendert, hier nur dokumentiert, weil er den globalen
rAF-Zaehler unbrauchbar macht.

## V3.2-M3 Nachzug — 1024er Albedo (Groessenexperiment)

### Vorab-Regel

> GLB ≥ 30 % kleiner **und** SSIM der 3/4-Renderings ≥ 0.98 → 1024 behalten,
> sonst 2048 wiederherstellen und nichts committen.

Gebacken mit `node scripts/retexture-mannequin-c.mjs --resolution 1024`; alle
anderen Konstanten unveraendert (AO_DISTANCE 0.18, AO_STRENGTH 0.35,
AO_SAMPLES 64, Blur 2, Gradient 0.04, Basis `#f0efeb`, Roughness 0.62), keine
Vereinfachung der Geometrie.

### Messwerte

| Wert | 2048 | 1024 | Delta |
| --- | --- | --- | --- |
| GLB | 653.640 B (`d9edb0e4…c06976`) | **457.000 B** (`d76abc16…fbd71fb`) | **−30,08 %** |
| Textur-PNG | 955.528 B (2048²) | 333.524 B (1024²) | −65,1 % |
| Tris | 49.838 | 49.838 | 0 |
| UV-Fuellgrad | 0.372054 | 0.372054 | 0 |
| UV-Ueberlappungen | 0 | 0 | 0 |
| Bounding-Box-Drift | — | 0.000000 | — |
| Luminanz mean | 0.81316 | 0.81139 | −0.002 |

SSIM der 3/4-Renderings (`scripts/compare-render-ssim.mjs`, Gauss 11×11,
σ 1.5): **1.000000**, PSNR **92.9 dB**, groesste Einzelabweichung **1/255**.
Im Render ist der Unterschied damit nicht sichtbar — die AO-Schattierung ist
niedrigfrequent genug fuer 1024.

Bilder: `resolution-2048-3q.png`, `resolution-1024-3q.png`, nebeneinander in
`resolution-1024-vs-2048.png`. Rohwerte: `resolution-comparison.json`.

### Entscheidung

**1024 bleibt.** Beide Bedingungen der Vorab-Regel erfuellt (30,08 % ≥ 30 %,
SSIM 1.0 ≥ 0.98). Manifest, Config-Filename, Pin-Konstanten in
`tests/mannequin-c.test.js` und die Procreate-Textur sind mitgezogen; OBJ und
MTL blieben unangetastet (`map_Kd skincolor.png`, relativ).

**Bewusster Trade-off:** die Procreate-Paintflaeche halbiert sich (1024 statt
2048 Pixel pro Kante). Falls beim Bemalen feinere Details gebraucht werden,
genuegt ein Lauf mit `--resolution 2048` und ein Commit der drei betroffenen
Dateien (GLB, Manifest/Pins, Procreate-PNG).

### Scene-Scale fuer die AO-Konstanten

`ao-bake.json` fuehrt jetzt `sceneScale`: Modellhoehe 5.0085 Einheiten,
angenommene Koerpergroesse 1.70 m → 1 Einheit = 0.3394 m. Daraus folgt
AO_DISTANCE 0.18 = **6.11 cm** an einer echten Figur — der nachvollziehbare
Ersatz fuer den frueheren Richtwert "1 Einheit ~34 cm".

## V3.2-M3 Nachzug — Barrierefreiheit des Viewers

### Semantik

| Element | vorher | nachher |
| --- | --- | --- |
| Viewer-Frame | `role="img"`, Label "…static A-pose preview", nicht fokussierbar | `role="img"`, `tabindex="0"`, Label nennt die Pfeiltasten, `aria-keyshortcuts="ArrowLeft ArrowRight Home Escape"` |
| Beschreibung | nur im `aria-label` | zusaetzlich `<p class="sr-only" id="mannequin-viewer-help">` als DOM-Text, per `aria-describedby` verknuepft |
| Canvas | `aria-hidden="true"` | unveraendert (dekorativ, kein Doppel-Vorlesen) |
| Live-Region | lag **innen** im `role="img"` | liegt jetzt in der `<figure>` |

Der Umzug der Live-Region war noetig: `role="img"` macht seine Kinder
presentational, damit war `role="status"` fuer Screenreader gar nicht
vorhanden. Betroffen war auch `src/mannequin-preview-loader.js` — es sucht den
Status jetzt ueber `closest('.mannequin-preview')` statt im Frame.

Rotations-Updates bleiben stumm: Winkel, Bewegung und Shoot-Zustand liegen
weiterhin nur in `data-*`-Attributen, nie in einer Live-Region.

### Tastatur

| Taste | Verhalten |
| --- | --- |
| `←` / `→` | 15° pro Tastendruck (`keyStep = π/12`); gehalten dreht mit `keySpeed` 1.35 rad/s und derselben Daempfung wie das Ziehen (`inertiaDamping` 3.2) |
| `Home` / `0` | zurueck auf `initialYaw` der Variante (C = 0 rad), Flick wird abgebrochen |
| `Escape` | bricht den laufenden Flick ab, Pivot und Skalierung zurueck auf Ruhe, danach Auto-Rotation |
| Fokusverlust | gehaltene Taste wird vergessen (`blur`), die Figur dreht nicht weiter |

Auto-Rotation pausiert bei jeder Tastaturinteraktion und kommt nach
`idleDelay` 2000 ms zurueck. `preventDefault` greift nur, wenn der Viewer
`document.activeElement` ist — ausserhalb scrollt die Seite unveraendert.
Reduced Motion schaltet weiterhin nur Auto-Rotation und Flick ab; Tastatur und
Ziehen bleiben aktiv.

Fokusring: 2 px `#ecece8`, Offset 3 px — dasselbe Token wie der
Demo-Design-Button, nur ausserhalb des Frames, damit er auf dem dunklen Bild
nicht als Rahmen verschwindet.

### Tests

Neu im Production-Lauf (`tests/mannequin-preview-browser.mjs`): Rolle, Label,
`tabindex`, sr-only-Text, Canvas versteckt, keine Live-Region im Bild-Role,
Tab erreicht den Viewer, Fokusring im Computed Style, `ArrowRight` ≈ 15°,
gehaltene Taste dreht weiter, `Home` setzt zurueck, `preventDefault` nur
fokussiert, `Escape` beendet den Flick, Reduced Motion haelt die Auto-Rotation
aus. Dazu ein Markup-Test in `tests/mannequin-c.test.js`.

Axe ist im Repo nicht installiert (keine neuen Dependencies) — die Pruefung
laeuft daher ueber explizite Attribut- und Verhaltens-Asserts.

| Suite | Ergebnis |
| --- | --- |
| `npm test` | **388/388** (neu: Viewer-Semantik) |
| `npm run test:mannequin-preview` | 3× hintereinander PASS, inkl. A11y-Block |
| `npm run test:mannequin-variants-dev` | PASS (A/B weiter nur im Dev) |
| `npm run test:seo` | 18 Routen + 404, ohne Three.js/Font/Reflexions-Requests |
| `npm run build` | 18 Routen + 404 |

## V3.2-M3 — Merge-Gate (Stand vor der Lizenzbestaetigung)

> **Aufgehoben am 05.11.2026.** Der Befund unten beschreibt den Stand, bevor
> der Nutzer die Lizenz bestaetigt hat. Mit CC0 1.0 (siehe `CREDITS.md`) ist
> die Bremse geloest; die Merge-Vorbereitung laeuft in M4a. Kein Merge in
> diesem Lauf.

**Damals: MERGE BLOCKIERT — Lizenz des Basismeshs unbelegt. Benoetigt:
Lizenztyp (CC0 / CC-BY / Editorial) und bei CC-BY eine oeffentliche Attribution
im Repo.**

Geprüft am Branch `v3.2-mannequin-female` (Stand `7281381`):

| Ort | Befund |
| --- | --- |
| `CREDITS.md`, `docs/CREDITS.md`, `LICENSE*` im Wurzelverzeichnis | nicht vorhanden |
| `docs/validation/MANNEQUIN-C/LICENSE-NOTE.md` | bewusst entfernt, liegt als `outputs/mannequin-remodeling/LICENSE-NOTE-C.md` ausserhalb des Repos |
| `docs/validation/MANNEQUIN-PROCEDURAL/LICENSE-NOTE.md` | betrifft `public/models/mannequin.glb` (eigenes Lathe-Werk) und haelt ausdruecklich fest, dass das Download-Basismesh **nicht** verwendet wird |
| `docs/validation/MANNEQUIN-CHROME/LICENSE-NOTE.md` | betrifft die prozeduralen Chrome-Puppen A/B, ebenfalls ohne Fremdanteil |
| Lizenztyp (CC0 / CC-BY / Editorial) irgendwo im Repo | nicht dokumentiert |

Damit existierte fuer Variante C **keine** oeffentliche Lizenz- oder
Credits-Angabe, obwohl sie ein bearbeitetes Derivat des Basismeshs ist. Die
Notiz stand damals auf "NICHT freigegeben zur Weiterverbreitung" und nannte die
offenen Punkte (kommerzielle Nutzung, Redistribution eines bearbeiteten
Derivats).

**Aufloesung am 05.11.2026:** Der Nutzer hat die Lizenz als CC0 1.0 bestaetigt
(Asset-Seite, kein Lizenzartefakt im Download-ZIP). Herkunft und Bearbeitung
stehen jetzt in `CREDITS.md`; die Notiz ausserhalb des Repos wurde korrigiert
(FBX-Import statt "lokale Neuerstellung"). Weiterhin gilt: kein Merge und kein
Deploy in diesem Lauf.

## M4a — Vorbereitung (Credits, Provenienz, MTL)

### Credits-Status

Die Lizenz des Basismeshs ist **geklärt: CC0 1.0 Universal (Public Domain
Dedication)**, bestätigt durch den Nutzer am 05.11.2026. Öffentliche Angabe im
Repo: `CREDITS.md` (Titel, Lizenz, Lizenzlink, Belegstatus, Bearbeitung,
Audit-Verweis). Kein Lizenzartefakt im Download-ZIP — die Angabe beruht auf der
Asset-Seite. Autor und Quell-URL sind bewusst „nicht erfasst" statt geraten.

Bundle-Nachweis: `dist/` enthält weder als Dateiname noch als Inhalt
`LICENSE-NOTE`, `CREDITS` oder den Namen der Bezugsplattform (0 Treffer);
`docs/` und `CREDITS.md` werden nicht gebundelt. Der Preview-Test prüft alle
drei Begriffe, der Unit-Test prüft stattdessen den Inhalt von `CREDITS.md`.

### Korrigierte Stellen (Vorher → Nachher)

| Datei | Vorher | Nachher |
| --- | --- | --- |
| `LICENSE-NOTE-C.md` (außerhalb Repo) | „lokale Neuerstellung des Users (Remesh/Join)" | durchgestrichen + „KORRIGIERT am 05.11.2026: FBX-Import des Basismeshs" mit Vertex-Beleg; Statuszeile auf CC0 gesetzt |
| `REPORT.md` (4 Stellen) | Basismesh der Bezugsplattform, offener Redistributions-Befund | belegte Kette FBX → Blend → Remesh → Dezimierung; Merge-Gate als **aufgehoben** markiert |
| `PROJECT_PROGRESS.md` | „Lizenz ungeklärt, Branch nicht gepusht" | „Lizenz geklärt, CC0, `CREDITS.md`, Audit-Pfad" |
| `MANNEQUIN-PROCEDURAL` / `MANNEQUIN-CHROME` Lizenznotizen | — | **unangetastet** (andere Assets). Beobachtung: die Formulierung „contains no third-party mannequin asset" bezieht sich auf `mannequin.glb` und könnte beim Lesen auf das ganze Repo bezogen werden; nicht geändert, hier vermerkt |

Rest-Treffer im Repo: `CREDITS.md` (Dokumentation) und der Bundle-Guard in
`tests/mannequin-preview-browser.mjs` (Verbote-Liste). Beide gewollt. Die
wörtlichen Altformulierungen der Korrekturen stehen unverändert in der
Git-Historie (`d0d826b` und älter).

### Zwei-Bake-Nachweis

| Ziel | Auflösung | Bytes | SHA-256 (Anfang) | UV-Füllgrad |
| --- | --- | --- | --- | --- |
| Web-GLB | 1024 | 457.000 | `d76abc164512…` | 0.372054 |
| Web-Textur (`skincolor_baked.png`) | 1024 | 333.524 | `109a6e06a026…` | — |
| Procreate-Malfläche | 2048 | 955.528 | `cb9095e33740…` | — |
| Procreate-OBJ (unverändert) | — | 5.918.099 | `8b7ee09f0c81…` | 0.372064 |

Beide Bakes mit identischen Parametern (AO 0,18 / 0,35 · 64 Samples · Blur 2 ·
Verlauf 4 % · Basis `#f0efeb`), identischem UV-Layout (`uvFillBefore` =
`uvFillAfter` = 0.372054 in beiden Reports) und 49.838 Tris. Das Web-GLB bleibt
**byte-identisch** (`d76abc16…c06976`); nur die Malfläche wuchs von 1024 auf 2048.

Neuer Modus `node scripts/retexture-mannequin-c.mjs --paint-only` backt
ausschließlich die Malfläche und lässt das ausgelieferte GLB unangetastet.

### MTL & Paket

`mannequin_paint.mtl` (325 B, `13ce0c1bbafe…`): `map_Kd skincolor.png` relativ,
`illum 1`, `Ks 0 0 0`, `Ns 0`. Die Glanzwerte des Ursprungsmaterials
(`Ns 722.500000`, `Ks 0.500000`, `illum 2`) sind nicht übernommen.

`scripts/check-procreate-package.mjs` prüft das gesamte Paket (OBJ, MTL, README,
PNG) auf `/Users/`-Pfade, relatives `map_Kd`, Glanzwerte und PNG-Auflösung.
Ergebnis `procreate-package.json`: **0 Verstöße**, 4 Dateien.

### Merge-Probe (kein Merge ausgeführt)

| Prüfung | Ergebnis |
| --- | --- |
| `main` / `origin/main` | `9123a00` (Merge PR #20), unverändert |
| merge-base | `9123a00` — `main` ist **Vorfahre** von HEAD |
| Divergenz | `main..HEAD` = 98 Commits, `HEAD..main` = **0** |
| `git diff --stat main...HEAD` | 1.627 Dateien |
| Probe-Merge (`--no-commit --no-ff`, Wegwerf-Worktree) | **0 Konflikte**, 1.627 Dateien übernommen, danach `--abort`, Worktree entfernt |
| Routing-Dateien auf `main` neu/geändert | keine — der Hinweis auf „creative/3dmodel" trifft auf diesen `main`-Stand nicht zu; Rubrik bleibt `/work/<kategorie>` mit `id="model-3d"` |

Erwartete Konflikte: **keine**. Der Merge wäre ein Fast-Forward-Inhalt ohne
Konfliktstellen; Konfliktrisiko entsteht erst, wenn `main` vor dem Merge neue
Commits bekommt.

Testreihenfolge für den Merge:
`verify:assets` → `npm test` → `npm run build` → `npm run test:seo` →
`npm run test:mannequin-preview` (3×).

### Readiness

| Bereich | Status | Beleg |
| --- | --- | --- |
| Credits/Lizenz | **OK** | `CREDITS.md`, CC0 bestätigt |
| Asset-Hash/Manifest | **OK** | `verify:assets` grün |
| Bundle-Abgrenzung | **OK** | 0 Treffer in `dist/` |
| Procreate-Paket | **OK** | Scanner 0 Verstöße, 2048er Malfläche |
| Merge-Probe | **OK** | 0 Konflikte |
| Routing | **offen (nach Merge)** | Rubrik-Route wird in M4b gesetzt, hier nicht angefasst |
| Deployment-Config | **offen** | Keine `vercel.json`/`_headers` im Repo. Erwartung: `Content-Type: model/gltf-binary` und `Cache-Control: public, max-age=31536000, immutable` für `/models/mannequin-c.<hash>.glb`. Vorschlag notiert, **nicht** angelegt (Freigabe nötig) |
| Procreate-Roundtrip | **offen** | iPad-Test durch den Nutzer |

### Offene Punkte

| # | Punkt | Status | Auswirkung |
|---|---|---|---|
| 1 | Basismesh-Autor unbekannt | offen | CC0 verlangt keine Attribution |
| 2 | Quell-URL unbekannt | offen | Herkunft nur über Audit belegt |
| 3 | Kein Lizenzartefakt im ZIP | offen | Lizenz = Nutzerbestätigung 05.11.2026 |
| 4 | Rubrik-Route unbestimmt | offen (nach Merge) | Verdrahtung in M4b |
| 5 | Procreate-Roundtrip ungetestet | offen | iPad-Test durch Nutzer |

### Beobachtungen (nicht angefasst)

- **Pipeline nicht idempotent:** ein voller Re-Run dekodiert das eigene
  Draco-Ergebnis und enkodiert erneut; der Bitstrom wandert um wenige Dutzend
  Bytes (457.000 → 456.968 B bei identischen Pixeln und Tris). Die Textur ist
  byte-stabil, die Geometrie-Quantisierung nicht. Deshalb wurde das Web-GLB in
  M4a nicht neu gebaut, sondern `--paint-only` genutzt.
- **Timing-Annahmen in älteren Browser-Tests:** drei feste Wartezeiten
  (60/120/350 ms) reichten auf dem Software-Renderer nicht mehr, weil ein Frame
  dort ~200 ms braucht. Umgestellt auf Frame-Warts und `waitForFunction`; keine
  Assertion wurde abgeschwächt.
- `test:mobile` scheitert bereits auf `9dd66ce` (unverändert), `.chapter-counter`
  überlappt je nach Scroll den Frame-Rand, A/B bleiben −Z-orientiert.

### Tests (M4a)

| Suite | Ergebnis |
| --- | --- |
| `npm test` | **392/392** |
| `npm run test:mannequin-preview` | **3× PASS** (3 Viewports, C-only, Einfahrt, A11y, Reduced Motion, No-WebGL, Leak, Bundle ohne `LICENSE-NOTE`/`CREDITS`/Bezugsplattform) |
| `npm run test:mannequin-entrance` | PASS (Assert A–D) |
| `npm run test:seo` | 18 Routen + 404 |
| `npm run build` | 18 Routen + 404 |
| `npm run verify:assets` | OK (457.000 B, `d76abc16…c06976`) |

## M4e — Darstellung: Aufblitzen, Hover, Transparenz

### 1. Diagnose (vor jeder Änderung gemessen)

**Aufblitzen.** Screencast (CDP, 154 Frames) plus rAF-Timeline im Page-Kontext.
Der Ladevorgang blockiert den Hauptthread ~2,6 s (GLB-Parse + KTX2-Transcode);
in dieser Zeit malt der Compositor kein neues Bild. Danach der Befund:

| Zeitpunkt | Zustand | Poster-Opacity | Renders |
| --- | --- | --- | --- |
| t=7791 | loading | 0.90 | 1 (leere Szene) |
| t=7942 | ready | 0.90 | 3 |
| t=8042 | ready | 0.82 | 5 |
| t=8353 | ready | 0.00 | 7 |

Ursache ist **kein Decode-Race und kein falsches Asset**: Die Textur ist beim
`parseAsync`-Resolve längst da, der erste Modell-Frame existiert. Das Problem
war das *Bild selbst* — das Poster war eine Inline-SVG-Silhouette mit
spitzen Gliedmaßen und silbernem Verlauf, das Modell eine hellere, realistische
Figur. Der 180-ms-Crossfade blendete zwei verschiedene Figuren übereinander:
genau der sichtbare Zwischenzustand. Netzwerk-Trace: genau ein GLB
(`mannequin-c.d76abc164512.glb`), keine A/B-Anfrage.

**Hover-Ausschlag.** rAF-Sampling über je 0,7–1,0 s vor/während des Hovers,
in zwei Zuständen (Einfahrt läuft / abgeschlossen). Gemessen:

| Größe | vor Hover | während Hover | Spanne |
| --- | --- | --- | --- |
| Canvas `left` | 35.00 px | 35.00 px | **0.00 px** |
| Canvas `width` | 1370.00 px | 1370.00 px | **0.00 px** |
| `--entrance-x` | 0.00 px | 0.00 px | **0.00 px** |
| yaw | 1.808 | → 2.159 | Rampe 0.02 → 0.35 rad/s |

Gegenprobe mit `prefers-reduced-motion` (keine Rotation): neun Screenshots
hintereinander pixelidentisch (centerX 685.00, Breite 190 px), yaw konstant
0.000. Hypothese A (Einfahrts-Offset) und C (Layout-Shift) sind damit
**widerlegt** — Hover fasst weder die Section-Transform noch das Canvas-Maß an.
Belegt ist nur Hypothese B: Hover wechselt die Zielgeschwindigkeit 0,18 → 0,55
rad/s. Diese Rampe war framerate-abhängig.

**Hintergrund-Inventar.**

| Quelle | Befund |
| --- | --- |
| Renderer | `alpha: true`, Clear `(0,0,0,0)` — Transparenz war technisch schon vorhanden |
| Scene (WebGL) | nur die Figur; keine Ground-Plane, kein Backdrop, kein Grid. Die Environment-Sphere wird nur für PMREM gebaut und sofort verworfen |
| CSS-Rahmen | `radial-gradient(at 50% 43%, #454540 …)` + `::before`-Verlauf + `.mannequin-preview-ground` (dunkle Ellipse) — **das** war der sichtbare Kasten |
| Poster | Inline-SVG mit Silberverlauf, keine Bilddatei |

### 2. Fixes

1. **Poster ist jetzt ein echtes Renderer-Bild.** Zwei transparente PNGs
   (`mannequin-poster-wide-20c3b7b4.png` 2740 px / 72 KB,
   `mannequin-poster-tall-915dcaff.png` 692 px / 21 KB), aufgenommen aus genau
   dem Renderer, mit dem das Modell später läuft (yaw 0, gleiche Kamera, gleiches
   Licht). Zwei Zuschnitte, weil `fitCamera()` je nach Seitenverhältnis auf
   Höhe oder Breite einpasst; Umschaltung über `<picture>` am CSS-Breakpoint
   600 px. Ergebnis: Poster und Modell sind **pixelgleich** —

   | Viewport | Poster (px / centerX) | Modell (px / centerX) |
   | --- | --- | --- |
   | 1440 | 53.362 / 685.5 | 53.360 / 685.5 |
   | 390 | 13.385 / 170.3 | 13.385 / 170.3 |

2. **Erst rendern, dann einblenden.** `renderFrame()` läuft jetzt *vor*
   `data-mannequin-state="ready"`. Ohne diesen Frame blendete der Crossfade auf
   einen noch leeren Canvas.
3. **Crossfade 240 ms** (`opacity .24s ease`), bei Reduced Motion weiterhin
   harter Schnitt.
4. **A/B aus dem Ladepfad.** Die Registry baut sich aus
   `import.meta.env.DEV ? {A,B} : {}` und `{...devVariants, C}`; `mannequin-female-a/b.glb`
   kommen im Production-Bundle **0×** vor. Im Dev-Server bleiben A/B über
   `?variant=a|b` erreichbar (Test `test:mannequin-variants-dev` grün).
5. **Transparenter Rahmen.** `background: none`, `::before` und
   `.mannequin-preview-ground` entfernt, Xray-Hintergrund entfernt. Der Canvas
   malt nur die Figur: Messung mit `omitBackground` ergibt **5,68 %** deckende
   Pixel im Rahmen (vorher: 100 %, weil der CSS-Verlauf die ganze Fläche füllte).
6. **Hover-Rampe begrenzt.** Neue Konstante
   `maxAngularAcceleration = 1.1 rad/s²`; die Winkelgeschwindigkeit kann pro
   Frame nur um `1.1 · Δt` springen. Ziel bleibt 0,55 rad/s, Auto-Rotation
   0,18 rad/s, Drag/Swipe/Flick unverändert.

### 3. Kontrast und Abnahme

Silhouette gegen den echten Seitenhintergrund: **5,8–6,1 : 1** (Median der
Figur `#a1a09c` gegen `#232323`) — deutlich über der 3:1-Schwelle für
großflächige Grafik. Albedo unverändert.

Evidence: `m4e-before-poster.png` / `m4e-before-model.png` (altes SVG-Poster
bzw. Modell mit Kasten), `m4e-poster-before-after.png` (direkt nebeneinander),
`m4e-poster-after.png` (neues Poster), `m4e-after-1440/390/320.png`.

### 4. Tests

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | 392/392 |
| `npm run test:mannequin-preview` | 2× PASS (3 Viewports, Übergang, Hover, Transparenz, A/B, A11y) |
| `npm run test:mannequin-entrance` | PASS (Assert A–D) |
| `npm run test:mannequin-variants-dev` | PASS (A/B nur im Dev) |
| `npm run build` | 18 Routen + 404 |

Neue Asserts: Poster-Box = Canvas-Box (±1 px), Poster-Quelle je Viewport,
`background-image: none` / `box-shadow: none` / `border 0`, GL `alpha: true`
und Clear-Alpha 0, Übergang (Poster deckend bis `state=ready`, erst dann fade),
Hover (Canvas-Spanne ≤ 1 px, `--entrance-x` unverändert), A/B-Assetnamen nirgends
im Bundle.

## M4f — deltaTime-Audit

Ziel: dieselbe Bewegung bei 30, 60 und 144 Hz. Referenzframerate bleibt 60 Hz,
dort aendert sich das Verhalten nicht.

### 1. Inventar (vor jeder Aenderung gelesen)

Alle Stellen im 3D-Viewer, die pro Frame oder pro Eingabe rechnen:

| Datei:Zeile (Stand `ad5ab14`) | Formel | deltaTime | Einheit | Befund |
| --- | --- | --- | --- | --- |
| `src/mannequin-preview.js:184` | `delta = min(0.05, (time - lastTime) / 1000)` | ja | s | KORREKT (Clamp 50 ms) |
| `...:188` | `applyShoot(time)`; `elapsed = now - shootStart` | ja | ms, absolute Zeit | KORREKT (zeitbasiert, keine Akkumulation) |
| `...:191` | `idle = time - lastInteraction > idleDelay` | ja | ms | KORREKT |
| `...:194–196` | Zielrate `0.18` / `0.55` / `1.35` rad/s | — | rad/s | KORREKT |
| `...:197` | `blend = min(1, delta * 3.2)` | ja | 1/s-Naeherung | VERDAECHTIG → exakt gefixt |
| `...:199` | `maxStep = 1.1 * Math.max(delta, 1/240)` | ja, mit Untergrenze | rad/s² | FEHLERHAFT ab > 240 Hz |
| `...:200` | `velocity += clamp(step, ±maxStep)` | ja | rad/s | KORREKT |
| `...:202` | `angle += velocity * delta` | ja | rad | VERDAECHTIG → Trapez gefixt |
| `...:236` | `angle += deltaX * 0.0075` | — (pro Pixel) | rad | KORREKT |
| `...:238` | `velocity = (deltaX*0.0075) / max(0.016, dtEvent)` | Ereigniszeit, 16-ms-Boden | rad/s | FEHLERHAFT |
| `...:241` | `peak = max(peak * 0.94, abs(v))` | nein (pro Ereignis) | 1/Ereignis | FEHLERHAFT |
| `...:146–177` | `applyShoot` Position/Scale aus `elapsed/outMs` usw. | ja | ms | KORREKT |
| `...:285–295` | Tastenschritt `keyStep` pro `keydown` | — (pro Tastendruck) | rad | KORREKT |
| `...:463` | erster Render vor `state=ready` | — | — | KORREKT |
| `src/section-entrance.js:76–85` | Pose aus `scrollY` + `sampleAboutItem` | — (Scroll-Position) | px | KORREKT: der Scroll ist die Uhr, keine Zeitintegration |
| `src/data/motionSettings.js` `smoothProgress` | `p³(10-15p+6p²)` | — | 0..1 | KORREKT (reine Funktion der Scroll-Position) |
| `src/flash-mannequin.js:61–63` | `yaw += dt * 0.12` | ja | rad/s | KORREKT (anderer Viewer, unangetastet) |

Erwartete Abweichungen der fehlerhaften Stellen:

| Stelle | 30 Hz | 60 Hz (Referenz) | 144 Hz |
| --- | --- | --- | --- |
| Ziehgeschwindigkeit mit 16-ms-Boden | korrekt | korrekt | 400 px/s gelten als 173 px/s → Peak 1,30 statt 3,00 rad/s, also **unter** der Flick-Schwelle 2,4 rad/s: kein Flick |
| Peak-Zerfall `* 0,94` pro Ereignis | 30 Zerfallsschritte/s | 60 Schritte/s (Referenz) | 144 Schritte/s: Zeitkonstante 2,4× kuerzer |
| `blend = k*dt` (1. Ordnung) | +5,4 % gegenueber e^(-k·dt) | Referenz | +1,1 % |
| `maxStep` mit 1/240-Boden | korrekt | korrekt | ab 240 Hz waechst die effektive Beschleunigung mit 1/dt |
| Euler-Integration des Winkels | +2,4 % Winkel nach 1 s | Referenz | +0,5 % |

### 2. Fixes (nur die fehlerhaften Stellen)

| Vorher | Nachher |
| --- | --- |
| `delta = min(0.05, dt)` | `MAX_FRAME_DELTA = 1/30`, `delta = clamp(rawDelta, 0, MAX_FRAME_DELTA)` |
| `blend = min(1, delta * 3.2)` | `blend = 1 - e^(-3.2 · delta)` |
| `maxStep = 1.1 * max(delta, 1/240)` | `maxStep = 1.1 * delta` |
| `angle += velocity * delta` (Euler: +2,4 % Winkel bei 30 Hz, +0,5 % bei 144 Hz) | `angle += (v_vorher + v_nachher)/2 * delta` (Trapezregel) |
| `velocity = dx·0.0075 / max(0.016, dtEvent)` | `velocity = dx·0.0075 / max(1/240, dtEvent)` |
| `peak = max(peak * 0.94, abs(v))` | `peak = max(peak · e^(-3.7125 · dtEvent), abs(v))` |
| `wake(): lastTime = 0` (jedes Ereignis verwirft einen Frame) | `wake(): nur wenn kein Frame laeuft` |

Neue, oben gebuendelte Konstanten in `src/mannequin-preview-config.js`
(`referenceFrameRate: 60`, `dragVelocityFloor: 1/240`, `dragVelocityLimit: 8`,
`peakDecayPerSecond: 3.7125 = -ln(0.94)·60`) und `MAX_FRAME_DELTA` in
`src/mannequin-preview.js`. Zusaetzlich schreibt der Loop seinen
Diagnosewert `data-mannequin-velocity` (nur lesbar).

Bei 60 Hz bleibt die Bewegung gleich: 0,18 rad/s Auto, 0,55 rad/s Hover,
Rampe 0,18 → 0,55 in ~0,34 s, Drag/Flick-Schwelle 2,4 rad/s unveraendert.

### 3. Messreihe (rAF-Override, `tests/mannequin-framerate-browser.mjs`)

Virtueller Takt je Seite: `requestAnimationFrame` und `performance.now` laufen
ab dem Laden mit exakt 1000/rate ms pro Frame; gemessen wird pro Frame
`mannequin-velocity` und `mannequin-angle`. Ziehgeste in allen Laeufen
identisch: 400 px/s Zeiger, 0,25 s, danach loslassen.

| Groesse | 30 Hz | 60 Hz | 144 Hz | Spanne |
| --- | --- | --- | --- | --- |
| Zeit bis 95 % Hover-Rate (0,55 rad/s) | 0,977 s | 0,977 s | 0,977 s | **0,04 %** |
| Winkel nach 1,0 s | 0,3662 rad | 0,3666 rad | 0,3668 rad | **0,16 %** |
| Hover-Rate (letzte 0,3 s) | 0,5380 rad/s | 0,5380 rad/s | 0,5381 rad/s | **0,03 %** |
| Auto-Rate nach Idle (letzte 0,3 s) | 0,1797 rad/s | 0,1797 rad/s | 0,1799 rad/s | **0,11 %** |
| Flick-Peak der Ziehgeste | 3,00 rad/s | 3,00 rad/s | 3,00 rad/s | **0,00 %** |
| Flicks pro Geste | 1 | 1 | 1 | — |

Drei Wiederholungen der Suite ergaben dieselben Werte (Spanne jeweils
≤ 0,25 %). Bei 60 Hz liegt die gemessene Hover-Rate 2 % unter 0,55, weil das
letzte 0,3-s-Fenster noch im exponentiellen Auslauf liegt; relevant ist die
Gleichheit zwischen den Frameraten. Rohdaten: `m4f-framerate.json`.
Repro: `npm run test:mannequin-framerate`.

Aufbau des Tests: pro Framerate eine eigene Seite, in der `requestAnimationFrame`
und `performance.now` von Anfang an mit festem Takt laufen; Zeiger-Ereignisse
werden am Anfang eines Frames ausgeloest. Eine fruehere Fassung schaltete die
Rate auf einer Seite um und streute dadurch bis 8,5 % — der erste Frame nach
dem Wechsel bekam ein fremdes Delta. Die gemessenen 0,977 s enthalten die
unvermeidbare Frame-Quantisierung des Rampenstarts (ein Frame nach dem Ereignis).

Mit dem alten Code haette derselbe Lauf bei 144 Hz nur 1,30 rad/s Peak
geliefert und damit keinen Flick ausgeloest — der Test schlaegt dann fehl
(`Flick-Peak`-Spanne 79 % statt 0 %).

### 4. Nicht-Regressionen und Teststand

| Pruefung | Ergebnis |
| --- | --- |
| `npm test` | 395/395 (392 + 3 neue Quelltext-Waechter) |
| `npm run test:mannequin-framerate` | PASS (30/60/144 Hz, Spanne < 5 %) |
| `npm run test:mannequin-preview` | PASS (3 Viewports, Poster/Canvas, Transparenz, Hover-Spanne ≤ 1 px, Reduced-Motion-Pixelgleichheit, A/B 0×, A11y) |
| `npm run test:mannequin-entrance` | PASS (0 / 30 / 0 / 0) |
| `npm run test:mannequin-variants-dev` | PASS |
| `npm run test:seo` | PASS (18 Routen + 404, kalte Routen ohne Three.js) |
| `npm run build` | 18 Routen + 404 |
| `npm run verify:assets` | OK (457.000 B, `d76abc16…c06976`) |

### 5. Beobachtungen (nicht angefasst)

- `applyShoot` baut pro Frame waehrend des Flicks eine `Box3` ueber die
  49.838 Tris. Das ist framerate-unabhaengig (reine Funktion der Zeit), kostet
  aber Hauptthread-Zeit. Kandidat fuer M1, nicht Teil dieses Audits.
- Der reduced-motion-Pfad rendert weiterhin nur on demand; die neun
  pixelidentischen Frames aus M4e bleiben unveraendert (Suite-Assert).

## M4g — Pointer-Rate & Box3

### 1. Ausgangslage (vor jeder Aenderung)

Stand `d40218d`:

| Stelle | Code |
| --- | --- |
| `src/mannequin-preview.js:262` | `const eventDelta = Math.max(motion.dragVelocityFloor, (now - view.lastInteraction) / 1000);` |
| `...:263` | `view.velocity = clamp((deltaX * 0.0075) / eventDelta, -8, 8)` |
| `...:269` | `peak = max(peak * Math.exp(-3.7125 * eventDelta), abs(v))` |
| `src/mannequin-preview-config.js:93` | `dragVelocityFloor: 1 / 240` (= 4,167 ms) |

Fehlerrechnung fuer eine 1000-Hz-Maus (1 ms Ereignisabstand) bei 400 px/s:

| Groesse | Wert |
| --- | --- |
| dx pro Ereignis | 400 px/s · 0,001 s = 0,4 px |
| berechnete Geschwindigkeit | (0,4 · 0,0075) / 0,004167 = **0,72 rad/s** |
| wahre Geschwindigkeit | 400 · 0,0075 = **3,00 rad/s** |
| Unterschlagung | Faktor **4,17** |
| Flick-Schwelle | 2,4 rad/s — wird nicht erreicht, also **kein Flick** |

Der Boden war als Divisionsschutz gedacht, wirkte aber als Glaettung: je hoeher
die Pollrate, desto kleiner dx und desto staerker die Unterschaetzung.

### 2. Feature-Detection `getCoalescedEvents`

Gemessen in der Testumgebung (HeadlessChrome 156, System-Chrome):

| Pruefung | Ergebnis |
| --- | --- |
| `typeof PointerEvent.prototype.getCoalescedEvents` | `undefined` |
| `typeof event.getCoalescedEvents` (vertrautes Ereignis) | `undefined`, Aufruf wirft `TypeError` |
| `typeof PointerEvent.prototype.getPredictedEvents` | `function` |
| eigenes `getCoalescedEvents` am Event-Objekt | zuweisbar (fuer den Testpfad) |

Die API fehlt hier also vollstaendig. Der Code prueft deshalb
`typeof event.getCoalescedEvents === 'function'` und faellt sonst auf die eine
Position des Ereignisses zurueck — ohne Fehler, ohne Sonderpfad. Der
Koaleszenz-Zweig wird separat geprueft: ein synthetisches `pointermove` bekommt
im Test eine eigene `getCoalescedEvents()` mit drei Zwischenpositionen.

### 3. Fixes

| Vorher | Nachher |
| --- | --- |
| Geschwindigkeit pro Ereignis, Boden 4,167 ms | Ringpuffer der letzten Positionen, Geschwindigkeit ueber `pointerWindowMs = 70` |
| `MIN_POINTER_DELTA` implizit 1/240 | `MIN_POINTER_DELTA = 1/2000` (0,5 ms), nur als Divisionsschutz |
| Peak-Zerfall pro Ereignis | Peak-Zerfall pro Frame (`e^(-3.7125 · delta)` in `tick`) |
| nur die Position des Ereignisses | `getCoalescedEvents()` mit relativen Zeitstempeln, sonst Einzelposition |
| `applyShoot`: `new Box3().setFromObject(pivot)` pro Frame | `shootBounds.copy(modelBounds).applyMatrix4(pivot.matrixWorld)` |

Details:

- **Ringpuffer**: `pointerSamples` haelt Zeitstempel + x; bei jedem Sample werden
  Positionen ausserhalb des Fensters verworfen (mindestens zwei bleiben stehen).
  Die Fensterabfrage laeuft rueckwaerts ohne Array-Allokation, weil sie bei
  1000 Hz rund 70 Positionen pro Ereignis sieht.
- **Zeitstempel der Koaleszenz**: nur die Relativabstaende der Browser-Uhr werden
  benutzt (`now - (event.timeStamp - sample.timeStamp)`), damit Ereignis- und
  Frame-Uhr nicht vermischt werden.
- **Loslassen**: `handlePointerUp` rechnet die Geschwindigkeit erneut ueber das
  letzte Fenster. Wer vor dem Loslassen laenger als 70 ms stillhaelt, loest
  keinen Flick mehr aus (bewusst; der Preview-Test wurde entsprechend auf
  "loslassen waehrend der Bewegung" umgestellt).
- **Bounds-Cache**: `modelBounds` wird beim Laden einmal gemessen
  (`sceneBounds()` zaehlt jede Scene-Messung in `data-mannequin-bounds-builds`),
  `applyShoot` transformiert nur noch die Kopie. `data-mannequin-shoot-ms` und
  `data-mannequin-shoot-avg-ms` protokollieren die Dauer des Shoot-Schritts.

### 4. Messreihe Pointer-Raten (`tests/mannequin-pointer-rate-browser.mjs`)

Geste: 400 px/s, 300 ms, Frame-Takt 120 Hz, Uhr ohne Pumpe (Ereignisse in
1-ms-Schritten, rAF nur an Framegrenzen).

| Ereignisintervall | vorher (`d40218d`) | nachher | Flicks vorher | Flicks nachher |
| --- | --- | --- | --- | --- |
| 1 ms (1000 Hz) | **0,72 rad/s** | 3,00 rad/s | **0** | 1 |
| 4,17 ms (240 Hz) | 3,00 rad/s | 3,00 rad/s | 1 | 1 |
| 8 ms (125 Hz) | 3,00 rad/s | 3,00 rad/s | 1 | 1 |
| 16 ms (62,5 Hz) | 3,00 rad/s | 3,00 rad/s | 1 | 1 |
| Koaleszenz (3 Samples/Ereignis) | nicht geprueft | 3,00 rad/s (111 Samples) | — | 1 |

Spanne nachher: **0,00 %** (alle Raten exakt 3,00 rad/s). Die Testreihe schlaegt
auf `d40218d` mit `Every pointer rate must report 3.00 rad/s (0.72, 3.00, 3.00, 3.00)`
fehl — der Nachweis, dass sie den Fehler greift. Rohdaten:
`m4g-pointer-rate.json`, Repro: `npm run test:mannequin-pointer`.

### 5. Frame-Zeit des Shoot-Schritts vorher/nachher

Messung: ein Flick (echte Maus, 260 px in 8 Schritten), Zeit um `applyShoot`
pro Frame; "vorher" in einer Wegwerf-Worktree-Kopie von `d40218d` mit denselben
zwei `performance.now()`-Aufrufen, "nachher" im ausgelieferten Stand.

| | Frames | min | median | max | Mittel |
| --- | --- | --- | --- | --- | --- |
| vorher (`Box3.setFromObject`) | 20 | 0,0 ms | 0,1 ms | 0,2 ms | 0,085 ms |
| nachher (gecachte Box) | 22 | 0,0 ms | 0,1 ms | 0,2 ms | 0,064 ms |

Ehrliches Ergebnis: Der Unterschied liegt in der Aufloesung von
`performance.now()` (0,1 ms). Die Annahme "Box3 ueber 49.838 Tris pro Frame" war
zu pessimistisch — three nutzt die bereits berechnete `geometry.boundingBox`,
der Aufruf kostet also nicht die Vertex-Zahl. Der Fix bleibt trotzdem sinnvoll:
keine Allokation und kein Traversal pro Frame, plus der Assert
`data-mannequin-bounds-builds` bleibt waehrend des Flicks konstant (im
Preview-Test geprueft).

### 6. Tests

| Pruefung | Ergebnis |
| --- | --- |
| `npm test` | 396/396 (3 M4f-Waechter erweitert, 1 neuer M4g-Waechter) |
| `npm run test:mannequin-pointer` | PASS (1/4,17/8/16 ms, Koaleszenz, Spanne 0,00 %) |
| `npm run test:mannequin-framerate` | PASS (t95 0,04 %, Winkel/s 0,16 %, Hover 0,02–0,03 %, Auto 0,07–0,11 %, Peak 0,00 %) |
| `npm run test:mannequin-preview` | PASS (3 Viewports, Poster/Canvas, Transparenz, Hover ≤ 1 px, Reduced Motion, A/B 0×, A11y, Bounds-Assert) |
| `npm run test:mannequin-entrance` | PASS (0 / 30 / 0 / 0) |
| `npm run test:mannequin-variants-dev` | PASS |
| `npm run test:seo` | PASS (18 Routen + 404, kalte Routen ohne Three.js) |
| `npm run build` | 18 Routen + 404 |
| `npm run verify:assets` | OK (457.000 B, `d76abc16…c06976`) |

### 7. Offene Punkte

- Der Koaleszenz-Pfad ist nur gegen ein synthetisches Ereignis mit
  nachgebildeter API geprueft; in dieser Chrome-Version existiert die echte API
  nicht, ein Geraetetest mit echter 1000-Hz-Maus steht aus.
- Eine Pause > 70 ms vor dem Loslassen gilt nicht mehr als Flick. Falls sich das
  im Gebrauch als zu streng erweist, ist `pointerWindowMs` die einzige Stellschraube.

## M4h — Push & Probe-Merge

### 0. Abweichung vom Erwartungswert (zuerst)

`origin/main` steht **nicht** auf `9123a00`. Und main hat sich waehrend dieses
Laufs ein zweites Mal bewegt:

| Zeitpunkt | `origin/main` | Inhalt |
| --- | --- | --- |
| Self-Check (erster Fetch) | `b5634bc` | `Merge pull request #22 from h333ndrik/v3.2-world-sound` |
| nach dem Probe-Merge (zweiter Fetch) | `e66e7b6` | `Record the world sound release: merge b5634bc, deployment and live asset verification` (aendert nur `NEXT_SESSION.md` und `PROJECT_PROGRESS.md`) |
| nach dem Report-Push (dritter Fetch) | `fdd42f5` | `Correct the mannequin branch SHAs in the release handoff` (nur `NEXT_SESSION.md`) |

Die Commits entstanden in einer parallelen Session (Worktree
`2026-11-03/world-sound-h4ngelic`, dort ist `main` ausgecheckt) — main wandert
waehrend dieses Laufs zweimal. Deshalb wurde der Probe-Merge gegen `e66e7b6`
**wiederholt**; die Zahlen unten gelten fuer `e66e7b6`. Fuer den letzten Stand
`fdd42f5` wurde ohne Worktree nachgeprueft
(`git merge-tree --write-tree origin/main v3.2-mannequin-female`): identische
drei Konfliktdateien, `fdd42f5` beruehrt ohnehin nur `NEXT_SESSION.md`.
Nichts wurde korrigiert oder umgeschrieben.

| Erwartet | Gemessen (`e66e7b6`) |
| --- | --- |
| `origin/main` = `9123a00` | `e66e7b6` |
| ~98 Commits voraus, 0 dahinter | 28 voraus, 11 dahinter (Basis `11e78a1`) |
| Probe-Merge ~1.627 Dateien, 0 Konflikte | 143 Dateien, 3 Konflikte |

### 1. Push

| | Wert |
| --- | --- |
| Range | `ad5ab14..b2433f5` |
| Commits | 2 (`d40218d` M4f, `b2433f5` M4g) |
| Remote danach | `origin/v3.2-mannequin-female` = `b2433f5` = `HEAD` |
| Force / Rebase / Amend | nein |
| Tags | keine |
| `origin/main` | `e66e7b6` (Stand nach dem Lauf) |
| `origin/mail-01-diagnostics` | `fb57c57` unveraendert |

`git push origin v3.2-mannequin-female` lief als Fast-Forward
(`ad5ab14..b2433f5`), Exit 0. Kein Merge, kein Deploy, keine Vercel-Aktion.

### 2. Probe-Merge (Wegwerf-Worktree, kein echter Merge)

| | Wert |
| --- | --- |
| Worktree | `/tmp/merge-probe-20261105` auf `origin/main` (`e66e7b6`) |
| Befehl | `git merge --no-commit --no-ff v3.2-mannequin-female` |
| Exit-Code | **1** (Konflikte) |
| Umfang | 143 Dateien, +10.971 / −217 |
| Konflikte | **3**, alle `UU` (beide Seiten geaendert) |

Konfliktdateien — reine Dokumentation/Konfiguration, kein Quellcode, kein Asset:

| Datei | Hunk | Konfliktmarker | Einschaetzung (nicht aufgeloest) |
| --- | --- | --- | --- |
| `.gitignore` | `@@@ -152,8 -152,5 +152,13 @@@` | Zeilen 155/161/164 | Beide Seiten haengen unabhaengige Bloecke an: main `work/` + `masters/` (Audio-Master), wir `__pycache__/`. Beide behalten. |
| `NEXT_SESSION.md` | `@@@ -1,118 -1,239 +1,185 @@@` | Zeilen 1/3/68 | Beide Seiten stellen einen neuen Checkpoint oben voran. Beide behalten, chronologisch; unser Text nannte noch das 2048er-Asset und wurde in M4i auf `d76abc164512` korrigiert. |
| `PROJECT_PROGRESS.md` | `@@@ -1,139 -1,61 +1,200 @@@` | Zeilen 1/138/197 | Gleiches Muster (neuer Abschnitt oben). Beide behalten. |

Gegenprobe ohne Worktree: `git merge-tree --write-tree origin/main v3.2-mannequin-female`
meldet dieselben drei Dateien je mit Stage 1/2/3 — der Befund ist reproduzierbar.

Aufgeraeumt: `git merge --abort` (Exit 0), `git worktree remove --force`,
`git worktree prune`. Danach: `HEAD` = `b2433f5`, `origin/main` = `b5634bc`,
`git status` sauber, kein Probe-Worktree mehr in `git worktree list`.

### 3. Divergenz zu main

| Groesse | Wert |
| --- | --- |
| Merge-Base | `11e78a1` (V3.2-M0c) |
| Commits nur auf main | 11 (World Sound M1–M9, PR #22, Release-Record) |
| Commits nur auf dem Branch | 28 |
| `origin/main` Vorfahre von `HEAD` | nein — der echte Merge wird ein echter Merge |
| Neue main-Commits seit `9123a00` | 86 |

Ueberschneidung der beiden Aenderungssaetze: genau **4 Dateien** —
`.gitignore`, `NEXT_SESSION.md`, `PROJECT_PROGRESS.md`, `package.json`. Die ersten
drei kollidieren, `package.json` mischt automatisch und behaelt beide
Skriptgruppen (81 Skripte, Abhaengigkeiten unveraendert: nur `three@0.186.1`).

### 4. Mannequin-C-Dateien im Probe-Merge

| Bereich | Dateien |
| --- | --- |
| `docs/validation/MANNEQUIN-C/` | 38 (inkl. `REPORT.md`, Manifest, Procreate-MTL, Screenshots) |
| `docs/validation/MANNEQUIN-CHROME/` | 35 |
| `public/models/` | 3 (`mannequin-c.d76abc164512.glb`, `mannequin-female-a/b.glb`) |
| `public/textures/mannequin/` | 22 (Guides, UV-Atlas) |
| `scripts/` | 11 (Bake, Build, Verify, UV-Checks) |
| `src/mannequin-preview*` | 5 |
| `src/section-entrance*` | 2 |
| `tests/` | 8 (`mannequin-*`, `section-entrance-*`) |
| `public/basis` + `public/draco` | 6 |
| Rest | Poster-PNGs, `CREDITS.md`, `src/app.js`, `src/pages.js`, `tests/content.test.js`, `package.json`, `.gitignore`, `NEXT_SESSION.md`, `PROJECT_PROGRESS.md` |

`origin/main` kennt `src/mannequin-preview-config.js` und das C-GLB nicht; main
hat nur das aeltere `public/models/mannequin.glb` aus M0c. Es gibt deshalb
keinen Dateikonflikt in Quellcode oder Assets.

### 5. Risikoeinschaetzung fuer den echten Merge

1. **Drei Doku-/Konfigurationskonflikte**, alle additiv — Aufloesung ist
   mechanisch (beide Seiten behalten), aber `NEXT_SESSION.md` und
   `PROJECT_PROGRESS.md` nennen veraltete Asset-Namen und muessen beim Aufloesen
   auf `d76abc164512` korrigiert werden.
2. **World Sound und Mannequin teilen `package.json`** (Skripte) und `src/app.js`
   (Init-Pfade). Der Auto-Merge sieht sauber aus, ist aber nur syntaktisch
   geprueft: nach dem Merge ist die volle Suite Pflicht, besonders
   `test:world-sound` und `test:mode-audio` neben den Mannequin-Suiten.
   Zusatzrisiko: main bewegt sich weiter (waehrend dieses Laufs zwei Commits),
   der Probe-Merge muss unmittelbar vor dem echten Merge neu laufen.
3. **Kalte Routen / SEO**: beide Zweige haben an Layout und Routen gearbeitet
   (World Sound an WORKS, Mannequin an `/work/tattoos`). Erwartung: 18 Routen +
   404 bleiben; muss nach dem Merge neu geprueft werden.
4. **Assets**: 11 MB GLB + Texturen kommen neu hinzu; `verify:assets` und der
   Bundle-Check (A/B 0×, `LICENSE-NOTE` 0 Treffer) muessen im gemergten Stand
   erneut laufen.

### 6. Testreihenfolge fuer den echten Merge

`npm run verify:assets` → `npm test` → `npm run build` → `npm run test:seo`
→ `npm run test:mannequin-preview` (3×) → `npm run test:mannequin-framerate`
→ `npm run test:mannequin-pointer`, danach die Weltklang-Suiten
(`npm run test:world-sound`, `npm run test:mode-audio`).

### 7. Bestaetigung

Kein echter Merge, kein Deploy, keine Vercel-Aktion, kein Force-Push, kein Tag.
`main` (`e66e7b6`) und `mail-01-diagnostics` (`fb57c57`) sind unveraendert; die
Arbeit lief ausschliesslich im Wegwerf-Worktree und wurde dort abgebrochen.
Asset unberuehrt: 457.000 B, 49.838 Tris, `d76abc164512…`; Procreate-Paket
unberuehrt (relativer `map_Kd skincolor.png`, kein `/Users/`-Pfad).

## M4i — Finalisierung

### 1. Baseline und Endstand

Erhoben auf `658e8e9`, alles seriell.

| Suite | Baseline | Endstand |
| --- | --- | --- |
| `npm test` | 396/396 | **402/402** (+3 Pointer-Fenster, +2 Referenz-Waechter, +1 geaenderter Waechter) |
| `test:mannequin-preview` | PASS | PASS (3 Viewports + Hinweis + Cursor) |
| `test:mannequin-entrance` | PASS (0/30/0/0) | PASS (0/30/0/0) |
| `test:mannequin-framerate` | PASS | PASS (t95 0,04 %, Peak 0,00 %) |
| `test:mannequin-pointer` | PASS | PASS (Spanne 0,00 %, neu: 0/1/3 Zwischenpositionen, Stillstand) |
| `test:mannequin-variants-dev` | PASS | PASS |
| `test:seo` | PASS | PASS (18 Routen + 404) |
| `build` | 18 Routen + 404 | 18 Routen + 404 |
| `verify:assets` | OK | OK (457.000 B, `d76abc16…`) |

### 2. Veraltete Asset-Referenzen

Grep nach `d9edb0e4d7b0`, `653.640`, alte GLB-Groesse:

| Fundstelle | Klasse | Behandlung |
| --- | --- | --- |
| `NEXT_SESSION.md:11` | aktiv irrefuehrend (Handoff) | M4i-Checkpoint oben, alter Block als „historisch, durch M4c/M4e ersetzt" markiert |
| `PROJECT_PROGRESS.md:8` | aktiv irrefuehrend | M4i-Abschnitt oben, M3-Ueberschrift als „historisch" markiert |
| `REPORT.md:267,395` | historisch (datierte M3-Messung) | unveraendert |
| `docs/validation/MANNEQUIN-C/resolution-comparison.json` | historische Messaufzeichnung | unveraendert |
| `REPORT.md:1054` | Aussage ueber den offenen Konflikt | auf „in M4i korrigiert" umgestellt |

Neu: `tests/mannequin-references.test.js` scannt alle Textdateien (ohne
`node_modules`, `dist`, `outputs`), erlaubt den alten Hash nur unter
`docs/validation/` oder in Abschnitten, deren umschliessende Ueberschrift
„historisch"/„ueberholt" sagt. Zweiter Test gleicht Config und Manifest ab:
ein Asset, 457.000 B, 49.838 Tris, `d76abc164512…`, und A/B sind nicht im
Production-Bundle.

### 3. pointerWindowMs: Messreihe und Entscheidung

Gemessen mit der ausgelieferten Funktion (`src/mannequin-pointer-window.js`),
Ereignisse alle 8 ms, Stillstand als eigene Regel:

| Geste | 70 ms | 100 ms | 150 ms |
| --- | --- | --- | --- |
| schnell 900 px/s | 6,75 · flick | 6,75 · flick | 6,75 · flick |
| langsam 380 px/s | 2,85 · flick | 2,85 · flick | 2,85 · flick |
| +60 ms Stillstand | 6,75 · flick | 6,75 · flick | 6,75 · flick |
| +100 ms Stillstand | 6,75 · flick | 6,75 · flick | 6,75 · flick |
| +150 ms Stillstand | 0 · kein flick | 0 · kein flick | 0 · kein flick |
| +200 ms Stillstand | 0 · kein flick | 0 · kein flick | 0 · kein flick |
| Ausreisser +60 px (Peak) | 8,00 (Deckel) | 7,69 | 6,13 |

Abnahmeregel: (a) schneller und langsamer Wisch fliegen, (b) Stillstand
>= 150 ms fliegt nicht, (c) kein Doppel-Trigger. **Alle drei Fenster erfuellen
die Regel.** Die Fensterlaenge steuert nur die Glaettung — ein einzelner
Ausreisser erreicht bei 70 ms den Deckel 8,00, bei 100 ms 7,69, bei 150 ms
6,13 rad/s. **Gewaehlt: 100 ms** (rund sechs Frames bei 60 Hz, ueblicher
Velocity-Tracker): daempft Ausreisser ohne die Traegheit von 150 ms.

Wichtiger Befund beim Messen: mit *einem* Wert fuer Fenster und Stillstand war
der Flick im Software-Renderer (10 fps, ein Pointer-Ereignis pro Frame)
unmoeglich — jedes Loslassen galt als Stillstand. Deshalb sind es zwei
Konstanten: `pointerWindowMs = 100` (Glaettung) und `pointerStopMs = 150`
(Stillstand). Messreihe: `m4i-pointer-window.json`, Repro:
`node --test tests/mannequin-pointer-window.test.js`.

### 4. Koaleszenz: ehrliche Deklaration

Feature-Detection in der Testumgebung (HeadlessChrome 156):
`typeof PointerEvent.prototype.getCoalescedEvents === "undefined"`, der Aufruf
wirft `TypeError`; `getPredictedEvents` ist vorhanden. Der Viewer prueft per
`typeof` und faellt auf die Ereignisposition zurueck.

Der Test deckt den Zweig jetzt mit 0, 1 und 3 Zwischenpositionen ab
(nachgebildete API): alle drei liefern 3,00 rad/s und genau einen Flick, die
leere Liste erzeugt 0 zusaetzliche Samples.

**Einordnung: Der Koaleszenz-Zweig ist durch einen Mock abgedeckt, kein
Integrationsnachweis. Manuelle Verifikation auf Hardware mit hoher
Polling-Rate offen.**

Manueller Pruefplan:

1. Geraet: Rechner mit 1000-Hz-Maus (Chrome) bzw. iPad mit Apple Pencil.
2. `/work/tattoos` oeffnen, zur Rubrik „3d model" scrollen, Modell laden lassen.
3. Schneller Wisch ueber die Figur, dann loslassen — erwartet: genau **eine**
   Flick-Animation, danach Auto-Rotation.
4. Wisch und 200 ms stillhalten, dann loslassen — erwartet: **kein** Flick.
5. Erfolg erkennbar an `data-mannequin-coalesced-samples > 0` (DevTools) und
   daran, dass Schritt 3 auch bei 1-ms-Ereignissen fliegt.

### 5. Poster: WebP statt PNG

| Datei | Format | Bytes | Masse | Breakpoint |
| --- | --- | --- | --- | --- |
| `mannequin-poster-wide-20c3b7b4.png` | PNG | 70,4 KB | 2740x1442 | > 600 px (Fallback) |
| `mannequin-poster-wide-2e2cce6c.webp` | WebP q90 | **26,3 KB** (−62,6 %) | 2740x1442 | > 600 px |
| `mannequin-poster-tall-915dcaff.png` | PNG | 20,7 KB | 692x906 | <= 600 px (Fallback) |
| `mannequin-poster-tall-fdf806bf.webp` | WebP q90 | **8,5 KB** (−58,7 %) | 692x906 | <= 600 px |

Vergleich gegen PNG (nur opake Pixel): maximale Kanalabweichung 35, Mittel 1,8
(wide) bzw. 2,0 (tall); **Alpha-Differenz 0** (WebP speichert den Alpha-Kanal
verlustfrei). AVIF waere kleiner (−77,5 %), aendert aber das Alpha (max. 18)
und faellt damit aus; WebP lossless ist exakt, bei tall aber nur −23,9 %.

Entscheidungsregel (>= 25 % kleiner, nicht wahrnehmbar, Alpha erhalten,
Poster/Canvas-Assert gruen) ist erfuellt. Das `<picture>` behaelt die
Breakpoints, WebP steht vor PNG; Crossfade 240 ms und Reduced-Motion-Schnitt
unveraendert.

LCP des Posters (3 Laeufe, Software-Renderer, identischer Ablauf):

| | Lauf 1 | Lauf 2 | Lauf 3 | Transfer |
| --- | --- | --- | --- | --- |
| PNG | 6092 ms | 2360 ms | 1992 ms | 72.094 B |
| WebP | 2888 ms | 1732 ms | 1680 ms | 26.932 B |

Die Streuung ist hoch (Software-Renderer, GLB-Decode im selben Fenster); der
Median faellt von 2360 auf 1732 ms. Keine Zahl geschaetzt.

### 6. Affordanz

- **Hinweis**: „drag to turn" liegt absolut im Rahmen (kein Layout-Shift, im
  Test gegen die Figure-Hoehe geprueft), `pointer-events: none`,
  `aria-hidden="true"` (die sr-only Hilfe beschreibt die Bedienung). Er
  erscheint einmal beim ersten Sichtbarwerden und verschwindet nach der ersten
  Geste oder nach 5 s. Reduced Motion: gleicher Zustand ohne Uebergang. Touch:
  haengt nicht an Hover.
- **Zeigerform — Abweichung**: `cursor: grab/grabbing` steht im CSS, greift
  aber nur ohne feinen Zeiger. Auf Desktop gewinnt der globale h4-Cursor aus
  `src/cursor.css` (F18: ein natives Cursor-Bild pro Modus, `!important` auf
  `html body *`). Eine Ausnahme waere ein Bruch dieses seitenweiten Vertrags;
  die Suite prueft deshalb das echte Verhalten (Desktop: h4-Cursor konstant,
  Touch: grab -> grabbing), und der Hinweis liefert die Affordanz.
  **Entscheidung fuer den Nutzer**, falls grab/grabbing auf Desktop gewuenscht ist.
- A11y unveraendert: `role="img"`, `tabindex="0"`, `aria-keyshortcuts`,
  sr-only Hilfe, Live-Region in der `<figure>`.

### 7. Quelltext-Waechter (M4f/M4g)

| Waechter | prueft | Verhaltens-Assert | refactor-fragil? |
| --- | --- | --- | --- |
| `motion uses per-second constants` | Config-Werte + Peak-Zerfall-Formel | Framerate-Suite misst die Wirkung | nein (Werte, keine Struktur) |
| `render loop integrates with delta time` | Regex auf `1 - Math.exp(...)`, `a*delta`, Trapez | Framerate-Suite (30/60/144 Hz) | **ja** — jede andere Schreibweise bricht ihn |
| `no fixed per-frame factors remain` | `doesNotMatch` auf `* 0.94` usw. | Framerate-Suite | **ja** — trifft auch harmlose neue Konstanten |
| `pointer path is rate independent` | Regex auf Modul-Aufrufe + `setFromObject`-Verbot in `applyShoot` | Pointer-Rate-, Pointer-Fenster- und Preview-Suite (Bounds-Zaehler) | teilweise |

Die beiden Regex-Waechter bleiben als schnelle Vorwarnung, sind aber nicht die
einzige Absicherung: jede ihrer Aussagen hat inzwischen einen Verhaltens-Test.

### 8. Deployment-Config (Vorschlag, NICHT angelegt)

`vercel.json` fehlt. Gemessen an einer bereits ausgelieferten GLB
(`curl -I https://h4ngelic.vercel.app/models/mannequin.glb`):

```
content-type: model/gltf-binary
cache-control: public, max-age=0, must-revalidate
```

Der Content-Type stimmt also schon; es fehlt nur die lange Cache-Zeit fuer die
gehashte Datei. Vorschlag:

```json
{
  "headers": [
    {
      "source": "/models/mannequin-c.:hash([a-f0-9]{12}).glb",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

Begruendung: der Dateiname enthaelt die ersten 12 Hex-Zeichen des SHA-256,
ein neuer Build erzeugt einen neuen Namen. Risiko: die `source`-Syntax von
Vercel (path-to-regexp) muss im Preview-Deployment geprueft werden — ein
falsches Muster greift stillschweigend nicht. `mannequin-female-a/b.glb` sind
nicht gehasht und bleiben absichtlich ohne `immutable`. **Keine Datei
angelegt** (Freigabe offen).

### 9. Offene Punkte

1. **iPad/Procreate-Roundtrip** — nur der Nutzer kann ihn testen.
2. **Koaleszenz auf echter Hardware** (1000-Hz-Maus) — der Mock deckt nur den Zweig ab.
3. **`vercel.json`** — Vorschlag oben, Freigabe offen.
4. **Merge-Entscheidung** — drei bekannte Dokumentkonflikte (M4h), Probe vor dem Merge wiederholen.
5. **grab/grabbing auf Desktop** — bewusst nicht gegen den F18-Cursor durchgesetzt.
6. `pointerStopMs = 150` ist die Abnahmegrenze; ein 100-ms-Halt fliegt noch. Falls
   sich das im Gebrauch falsch anfuehlt, ist es die einzige Stellschraube.

## M5 — Schema-Migration, Platzhalter-Pruefung, Merge-Gate bestanden

### Ausgangsstand

| | Wert |
| --- | --- |
| Branch-HEAD vor dem Lauf | `802c4a5` (= `origin/v3.2-mannequin-female`), Worktree sauber |
| `MAIN_SHA` (`origin/main`) | **`d5508243027dc454772d124327617ff1eef55a88`** |
| Merge-Base | `11e78a1` (V3.2-M0c) |
| Divergenz | Branch +36 Commits, main +115 Commits |
| Baseline | `npm test` **402/402**, `verify:assets` OK (457.000 B, `d76abc164512…`) |

### Phase 1 — Discovery

**URL-Schema auf main** (`src/routes.js`): kanonisch `/creative/<rubrik>`,
`all` → `/creative`; `projectURL()` → `/creative/<projekt-id>` (ein Segment);
`toolURL()` → `/creative/tools/<id>`; `legacyWorkDestination()` ist die
vollstaendige 301-Matrix fuer `/work/*`; `retiredCategorySlugs = { onskin: 'tattoos' }`.
**Abschnitte innerhalb einer Rubrik laufen ueber Anker** (`id="model-3d"`),
nicht ueber eigene Routen — kein Sitemap-Eintrag, kein eigener Pfad.

**Platzhalter:** `src/mannequin-preview-content.js` existiert auf **beiden**
Seiten. Auf main ist es die Server-Vorlage mit `.mannequin-preview-ground`,
`data-mannequin-src="/models/mannequin.glb"` und Figcaption
`procedural form / static / b`. Der Branch liefert an derselben Stelle den
fertigen Viewer (Poster, Geste, A11y, Design-Schalter, Variante C). Der
Platzhalter liegt damit **auf main**; Phase 3 wird zum Nachweis statt zum Neubau
(siehe unten) — gemaess Auftrag keine zweite Variante gebaut.

**Datei → main / Branch / Ergebnis**

| Datei | main | Branch (vor M5) | Ergebnis |
| --- | --- | --- | --- |
| `src/routes.js` | `/creative`, 301-Matrix, `toolURL` | `/work`, keine 301er | vom Branch **nicht** angefasst → main gewinnt automatisch |
| `src/pages.js` | 4 Rubriken, Tool-Seiten, Impressum, `#model-3d` mit `renderMannequinPreview()` | dieselbe Zeile + `data-section-entrance` | Auto-Merge, 1 Zeile Zusatz bleibt |
| `src/mannequin-preview-content.js` | Platzhalter-Figur | vollwertiger Viewer (C) | Branch gewinnt |
| `package.json` | `predev`/`prebuild` mit `sounds:hash`, world-sound-Skripte | `assets:mannequin-c`, `verify:assets`, 4 Mannequin-Tests | beide Seiten |
| `src/app.js` | `scheduleSlashInset()` unbedingt, `fitRubricRows`, `otherSideController` | nur auf `home`, plus `initSectionEntrance` | main-Muster + Section-Hook |
| `tests/content.test.js` | 4 Rubriken, `/creative` | 3 Rubriken, `/work` | main-Schema + Mannequin-Asserts |
| `tests/mannequin-preview-browser.mjs` | 2 Zeilen (Route-Pfad) | 718 Zeilen Umbau auf C | Branch-Stand + `/creative` |
| `.gitignore` | `work/`, `masters/` | `__pycache__/` | beide Seiten |
| `NEXT_SESSION.md`, `PROJECT_PROGRESS.md` | World-Sound-Checkpoint | M4i-Checkpoint | beide Checkpoints |

### Phase 2 — Schema-Migration (Commit `7238900`)

Der Branch haengt fachlich an main: `renderWorkPage()` kommt aus main, die
Rubrik-URLs kommen aus `routes.js`, und die Suiten pruefen beide zusammen.
Eine reine Textmigration auf dem Branch haette dessen eigene Suite sofort rot
gemacht (main rendert 4 Rubriken und `/creative`, der Branch prueft bis dahin
3 Rubriken und `/work`). Deshalb wurde main **in den Branch** gemergt und die
sieben Konflikte dort sachlich aufgeloest:

- Routen: uebernommen von main, `/creative/<rubrik>` kanonisch.
- `src/app.js`: `scheduleSlashInset()` laeuft wie auf main **unbedingt**
  (inkl. `fonts.ready`); `initSectionEntrance` bleibt ein eigener Hook —
  kein geteilter Chunk, der Hero bleibt unberuehrt.
- `package.json`: main-Skripte **plus** `assets:mannequin-c`, `verify:assets`,
  `test:mannequin-preview|-entrance|-framerate|-pointer|-variants-dev`.
- `.gitignore`: `work/` und `masters/` (main) **und** `__pycache__/` (Branch).
- Doku: beide Checkpoints erhalten, veraltete `d9edb0e4d7b0` / `653.640`
  ersetzt durch `d76abc164512` / 457.000 B.

Zusaetzlich auf main-Schema gezogen (nur Dateien, die der Branch besitzt):
`tests/mannequin-preview-browser.mjs`, `tests/mannequin-framerate-browser.mjs`,
`tests/mannequin-pointer-rate-browser.mjs`, `tests/mannequin-variants-dev-browser.mjs`,
`tests/section-entrance-browser.mjs`, `tests/fixtures/section-entrance.html`.

Verifikation: `grep -rn "/work" src/` liefert nur noch die 301-Matrix in
`src/routes.js` (3 Zeilen). In allen vom Branch stammenden Tests: 0 Treffer.

### Phase 3 — Platzhalter (Nachweis, kein Neubau)

Der Platzhalter lag auf main und wurde vom Branch-Viewer ersetzt. Im
gebauten Dokument `dist/creative/tattoos/index.html`:

| Pruefung | Ergebnis |
| --- | --- |
| `<figure class="mannequin-preview">` | genau **1** |
| `<canvas>` innerhalb der Figur | **0** (der einzige Canvas der Seite ist `#logo-canvas` im Hero) |
| `.mannequin-preview-ground` | **0** |
| Poster-`<img>` | **1** |
| `data-mannequin-variant` | `C` |
| `data-mannequin-src` | `/models/mannequin-c.d76abc164512.glb` |
| Platzhaltertext / "coming soon" in `src/` | 0 |

Damit ist der Endzustand erreicht: eine Viewer-Instanz, kein Platzhalter,
kein zweiter Canvas. Kein separates Commit noetig.

### Phase 5 — Gate gegen festen SHA: bestanden

Probe in `/tmp/merge-m5` auf `d5508243027dc454772d124327617ff1eef55a88`:
`git merge --no-commit --no-ff v3.2-mannequin-female` → **„Automatic merge went well"**.

| Kriterium | Soll | Ist | Ergebnis |
| --- | --- | --- | --- |
| G1 Konflikte | ≤ 3, nur `UU` | **0** | PASS |
| G2 Konfliktdateien | nur Doku | keine | PASS |
| G3 Quellcode-Konflikte | 0 | **0** | PASS |
| G4 Asset-Konflikte | 0 | **0** (`public/models/` unberuehrt) | PASS |
| G5 Worktree-Reste | keine | keine (`merge --abort`, `worktree remove --force`, `prune`) | PASS |

Umfang des Probe-Merges: **149 Dateien** — 74 `docs/`, 24 `public/textures/`,
12 `tests/`, 11 `scripts/`, 10 `src/`, 4 `public/images/`, 3 `public/models/`,
3 `public/draco/`, 3 `public/basis/`, 5 Root-Dateien.

Nach dem Aufraeumen unveraendert: Branch-HEAD `7238900`, `origin/main`
`d5508243`, Probe-Worktree entfernt.

### Phase 4/7 — Verifikation auf dem gemergten Stand

| Suite | Ergebnis |
| --- | --- |
| `npm run verify:assets` | **OK** — 457.000 B, sha256 `d76abc1645120eb217d0de062887ed029f40d963994f18d8024d64e93fbd71fb` |
| `npm test` | **431 Tests, 430 pass, 1 skip, 0 fail** |
| `npm run build` | **23 Routen + 404** |
| `npm run test:seo` | **PASS** — 23 semantische Routen, Canonicals, Legacy-Redirects, 404, Sitemap/robots |
| `npm run test:world-sound` | **PASS** — 390/320 px, reduced + no-preference, lazy load, 900 ms Crossfade, beide Richtungen |
| `npm run test:mode-audio` | **PASS** |
| `npm run test:mannequin-preview` (3 Laeufe) | **PASS** 3× — 3 Viewports, nur C, reduced motion, no-WebGL, Leak-Probe, Bundle ohne LICENSE-NOTE |
| `npm run test:mannequin-entrance` | **PASS** — `{"idle":0,"visible":30,"exit":0,"dispose":0}` |
| `npm run test:mannequin-framerate` | **PASS** — 30/60/144 Hz, Spanne < 5 % (t95 0,04 %, Winkel/s 0,16 %, Hover 0,25 %, Auto 0,19 %, Flick-Peak 0,00 %) |
| `npm run test:mannequin-pointer` | **PASS** — 1/4,17/8/16 ms, Peak 3,00 rad/s, Spanne 0,00 % |
| `npm run test:mannequin-variants-dev` | **PASS** — A/B nur ueber `?variant=`, kein Umschalter, C bleibt Default |
| `test:mobile` (390, Vite :5173) | **PASS** — „real 4/3 touch sequences, … Phase 2 untouched" |

**Zum `test:mobile`-Befund:** Der Test ist byte-identisch mit `origin/main`
(`git diff origin/main HEAD -- tests/mobile-interactions-browser.mjs` ist leer).
Ein erster Lauf gegen den **praerenderten Preview-Server** schlug fehl
(`data-mobile-taps` 1 statt 3, Zeile 138). Das ist die falsche Harness: der
Test ist auf den Vite-Dev-Server (`:5173`) ausgelegt. Gegen `npx vite` laeuft er
gruen. Keine Regression, kein vorbestehender Fehlschlag in diesem Lauf.

### Phase 6/8 — Merge, Push, Auslieferung

| | Wert |
| --- | --- |
| Merge-Commit auf `main` | **`494ee492a6b329577e7e140425b944198cff0ddc`** (`--no-ff`, 0 Konflikte) |
| `main` vorher | `d5508243027dc454772d124327617ff1eef55a88` |
| Push `main` | `d550824..494ee49` (Fast-Forward, ohne Force) |
| Push Branch | `802c4a5..b9ab902` (`v3.2-mannequin-female`) |
| Tests auf gemergtem `main` | `npm test` **431/431**, `verify:assets` OK, Build **23 Routen + 404**, SEO PASS |

**Auslieferung (lokaler Preview-Server auf dem gemergten Build):**

| Pruefung | Ist |
| --- | --- |
| `Content-Type` der GLB | `model/gltf-binary` |
| `Content-Length` / Bytes | 457.000 / 457.000 |
| SHA-256 der ausgelieferten Datei | `d76abc1645120eb217d0de062887ed029f40d963994f18d8024d64e93fbd71fb` |
| `<figure class="mannequin-preview">` auf `/creative/tattoos` | 1 |
| `<canvas>` in der Figur | 0 |
| Poster-`<img>` | 1 |
| `data-mannequin-variant` | `C` |
| GLB im kalten HTML (`modulepreload`/`link`) | keins |

### Deploy & Rollback

Der Merge nach `main` loest das Production-Deployment aus (Vercel baut aus
`main`). Kein eigenes `vercel.json` angelegt; main bringt seins mit.

Rollback (nur auf Zuruf): `git revert -m 1 494ee492a6b329577e7e140425b944198cff0ddc`
— entfernt den Merge und stellt den Stand von `d5508243` wieder her.
Voraussetzung: danach kein weiterer Commit auf `main`. `main` steht nach
diesem Lauf genau auf dem Merge-Commit, die Bedingung ist also erfuellt.

### Abweichungen vom Auftragstext (bewusst, begruendet)

1. **Phase 2 wurde als Merge von main in den Branch umgesetzt** statt als
   reiner Text-Commit. Grund: der Branch rendert ueber main-eigene Module;
   eine Textmigration ohne main-Code haette die Branch-Suite rot gemacht und
   die Konflikte nur verschoben. Ergebnis ist identisch (Branch spricht
   main-Schema) und der Rueckweg ist konfliktfrei.
2. **Phase 3 ohne eigenes Commit** — der Platzhalter lag auf main und ist im
   Branch bereits ersetzt; der Nachweis oben belegt den Endzustand.
3. **Routenzahl 23 statt 18** — main ist seit `11e78a1` auf 23 praerenderte
   Dokumente gewachsen (Tools, Artwork-Detailseiten, Impressum). Der Branch
   erbt sie; es ist kein Zuwachs aus der Mannequin-Arbeit.
