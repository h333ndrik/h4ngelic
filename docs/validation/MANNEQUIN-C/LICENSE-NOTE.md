# License note — Variante C (sculpted mannequin)

**Status: NICHT freigegeben zur Weiterverbreitung. Entscheidung liegt beim User.**

## Herkunftskette

1. `female_mannequin.fbx` — Sketchfab-Asset "free-female-mannequin-base-mesh"
   (Blender-4.4.0-Export, Diffuse `skincolor.png`).
2. `mannequin_white.png.blend` — lokale Neuerstellung des Users (Remesh/Join,
   Blender 4.5.0 Alpha).
3. `mannequin_smooth.glb` — Pipeline-Ergebnis aus (2), 249.194 Tris,
   SHA-256 `4a74c018…e04`. Liegt nur lokal in
   `outputs/mannequin-remodeling/real-run/export/`.
4. `public/models/mannequin-c.d8306c2b1b08.glb` — Web-Derivat aus (3),
   49.838 Tris, stark vereinfacht, neu entpackte UVs, neues Material.

## Befund

`docs/validation/MANNEQUIN-PROCEDURAL/LICENSE-NOTE.md` haelt fest, dass das
Sketchfab-Basismesh **abgelehnt** wurde, weil die Lizenz keine Redistribution
als eigenstaendiges GLB und keine zu aehnlichen Derivate erlaubt. Genau diese
Vorgabe verletzt die hier committete Datei potenziell: Sie ist ein stark
vereinfachtes, aber klar erkennbares Derivat derselben Anatomie.

Der Auftrag fuer diese Integration verlangt ausdruecklich die Einbindung von
`mannequin_smooth.glb`. Ich habe ihn umgesetzt und den Konflikt hier sichtbar
gemacht, statt ihn stillschweigend zu uebergehen.

## Was im Repository liegt

- `public/models/mannequin-c.d8306c2b1b08.glb` (316.604 Bytes) — Web-Derivat.
- Keine `.fbx`, keine `.blend`, kein Vollmodell mit 249k Tris.
- Keine `skincolor.png` aus dem Original-Asset. Die eingebettete Textur ist die
  neutrale Ersatztextur `#f0efeb` (2048×2048), erzeugt fuer diese Pipeline.
- Kein `derivedFrom`-Metadatum, kein Sketchfab-Hinweis im GLB.

## Vor einer Veroeffentlichung zu klaeren

- Erlaubt die konkrete Sketchfab-Lizenz kommerzielle Nutzung **und**
  Redistribution eines bearbeiteten Derivats? Falls nein: kommerzielle Lizenz
  kaufen, Asset ersetzen oder Variante C nur lokal betreiben.
- Bis zur Klaerung: Branch nicht mergen, nicht deployen, nicht pushen.

## Tooling-Lizenzen

- Blender 4.5.0 Alpha — GPL, nur Build-Tool, nicht ausgeliefert.
- `@gltf-transform/cli@4.5.1` — MIT, nur Build-Tool (kein npm-Dependency).
- KTX-Software 4.4.2 (`toktx`) — Apache-2.0, nur Build-Tool.
- Decoder im Repo: `public/draco/*` (Apache-2.0, aus `three@0.186.1`),
  `public/basis/*` (Apache-2.0, aus `three@0.186.1`). Keine neue Dependency.
