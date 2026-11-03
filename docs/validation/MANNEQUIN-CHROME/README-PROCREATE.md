# Procreate roundtrip — mannequin design

## Canvas and scale

- Canvas: **4096 × 4096 px**, 8-bit RGBA, sRGB, transparent background.
- Optional Procreate document DPI: **300 dpi**. DPI does not alter the UV mapping.
- One full UV axis represents **2000 mm** of body height.
- Scale: `2000 / 4096 = 0.48828125 mm/px` (`2.048 px/mm`).
- A 1700 mm figure occupies **3481.6 px** vertically at this scale.
- Use the supplied `uv-atlas.png` or `uv-atlas-preview.png` as the position reference.
  The preview adds an opaque measuring background; the production atlas itself is transparent.

## Layer order

1. Transparent base layer (keep it empty).
2. Optional `guides/front-390-guide.png` or a 1440 px orthographic guide at low opacity.
3. Finished transparent design.
4. Optional highlight/detail layer.

Keep the artboard at 4096 px and keep the design background transparent. Do not
paint outside the part rectangle named in `uv-atlas.json`. The torso seam is at
the back centre; front designs stay between the atlas `torso_front` bounds.

## Export

- Format: PNG.
- Transparency: on.
- Color profile: sRGB.
- Maximum dimensions: 4096 × 4096 px.
- Maximum file size: 2 MB.
- Return path: `public/textures/designs/<slug>.png`.
- Optional metadata: `public/textures/designs/<slug>.json`.

Example metadata:

```json
{
  "part": "torso_front",
  "anchorUV": [0.2810354, 0.2384],
  "widthMM": 120,
  "wrap": "clamp"
}
```

The demo pair is `demo-mark.png` plus `demo-mark.json`. In the browser, the PNG
is requested only after the **demo design** control is activated. It is applied
with `DecalGeometry`; it never replaces the chrome material or its global map.

## Evidence renders

The `guides/` directory contains the default B figure:

- `front.png`, `back.png`, `left.png`, `right.png` at 1440 × 1440.
- Matching `*-guide.png` files with a 12% grey silhouette, 1 px outline and
  back-centre seam marks.
- `front-390.png` and `front-390-guide.png` for mobile composition.

The public source files remain under `public/textures/mannequin/guides/{a,b}/`.

**Native Procreate import is NOT PRÜFBAR in this run:** Procreate was not
available in the test environment. The PNG contract, dimensions, alpha channel,
sRGB declaration, scale and browser decal path were verified separately.
