# Mannequin integration — Ist / Soll

| Area | Ist at `11e78a1` | Soll M0d |
| --- | --- | --- |
| Route markup | `src/pages.js` injects one `renderMannequinPreview()` into the tattoo/works archive model section | Keep the same section and route placement |
| Prerender | `src/mannequin-preview-content.js` emits a `figure` + deferred placeholder; no canvas/GLB | Keep no-canvas prerender and add a static poster fallback |
| Trigger | `src/mannequin-preview-loader.js` observes `[data-mannequin-preview]` with IO `rootMargin: 240px` | Keep the same single lazy trigger |
| Renderer | `src/mannequin-preview.js` dynamically imports Three, GLTFLoader and RoomEnvironment | Keep one lazy module; use female model config, custom PMREM horizon and decal overlay |
| Model | `/models/mannequin.glb`, 892 vertices / 1,748 triangles, white matte | `/models/mannequin-female-{a,b}.glb`, one chrome material, ≤6,000 triangles |
| Variant | Hard-coded default B in `src/mannequin-preview-content.js` | One central config selects A/B and model URL; no second loading strategy |
| Material | White `mannequin_matt` | `mannequin_chrome`, values derived from `src/main.js:137` |
| EnvMap | RoomEnvironment/Pmrem imported for the preview | Custom three-band PMREM, created once per module/renderer |
| Design | None | One lazily loaded PNG decal projected on the chest; base chrome untouched |
| Tests | `tests/mannequin-preview-browser.mjs` checks cold 0 WebGL/GLB and 6 A/B screenshots | Extend for design request, reduced motion, failure fallback, CLS and final viewport/motion battery |
| Unit contract | `tests/mannequin-procedural.test.js` validates M0c GLB | Add female GLB/atlas/material/scale tests without altering M0c tests |
| Evidence | `docs/validation/MANNEQUIN-PROCEDURAL/` | Add only new files under `docs/validation/MANNEQUIN-CHROME/` |

## Loader references

- `src/app.js:332` installs the route-scoped observer after content rendering.
- `src/app.js:312` disposes it before a route change.
- `src/mannequin-preview-loader.js:19` is the sole dynamic import of the model renderer.
- `src/mannequin-preview.js:110` is the sole model GLB request.
- `src/main.js:108–124` is the Hero environment setup; it remains unchanged.
