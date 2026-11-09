# Material source — Hero chrome

## Phase 0 reproduction gate

The untouched M0c builder was run before this branch was created:

```text
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python scripts/mannequin-build.py -- --variant B \
  --output /tmp/m0c-repro.glb --report /tmp/m0c-repro.json

committed  2b144ddec12b3490a71718a26c8c814247518fe475d7dfa59c76f0ed445952ad
reproduced 2b144ddec12b3490a71718a26c8c814247518fe475d7dfa59c76f0ed445952ad
cmp        0
```

The M0c evidence and GLB are unchanged.

## Actual Hero material

Source: `src/main.js`.

| Property | Actual value | Source |
| --- | --- | --- |
| Material class | `MeshPhysicalMaterial` | `src/main.js:137` |
| Base colour | `#e4e4e4` | `src/main.js:137` |
| Metalness | `1` | `src/main.js:137` |
| Roughness | `.135` | `src/main.js:137` |
| Environment-map intensity | `1.35` | `src/main.js:137` |
| Clearcoat | `.15` | `src/main.js:137` |
| Clearcoat roughness | `.12` | `src/main.js:137` |
| Renderer tone mapping | `ACESFilmicToneMapping` | `src/main.js:103` |
| Tone-mapping exposure | `1.05` | `src/main.js:104` |
| Clear colour | `#242424`, alpha 0 | `src/main.js:101` |

There is no CSS gradient token or alternate shader that supplies the Hero
logo's base silver. `src/wordmark-xray.js` is an optional post-lighting mode
shader layered over the same chrome material and does not replace its normal
material. `src/reveal.js` adds the optional reflected artwork to that same
material. The normal chrome source is therefore uniquely `src/main.js:137`.

## Actual Hero environment

Source: `src/main.js`.

- `RoomEnvironment` is constructed at line 108.
- Every `MeshStandardMaterial` in it is multiplied to scalar `.42` at line 110.
- Two charcoal/HDR softbox planes use `new Color(6, 6, 6)` at lines 113–120:
  - upper panel `8 × 3`, position `(-1, 5, 9)`, looking at origin;
  - lower panel `9 × 4`, position `(3, -8, 6)`, looking at origin.
- `PMREMGenerator.fromScene` uses sigma `.035`, near `.1`, far `100`, and
  `size: quality.environmentSize` at line 123.
- `src/render-quality.js:6` selects environment size `256` for desktop and
  `128` for mobile/constrained profiles.

The M0d client must create its own PMREM once per preview context. It uses the
same `.035` sigma and quality sizes, but replaces the Hero room with the
specified three-band studio horizon so the metal silhouette reads against the
page. The resulting intensity is measured rather than invented.
