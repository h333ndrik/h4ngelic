# Optional Flash placement viewer

The normal flat Flash image remains the primary artwork. An explicit **3d placement** button on a Flash detail page may open a second view; **flat artwork** returns to the original images. Closing the viewer or leaving the route releases its WebGL resources. No model, Three.js module or WebGL context is requested by this feature until that button is selected. Automatic rotation stops offscreen, when the document is hidden and under reduced motion; manual dragging and arrow keys remain available.

## Actual asset status

No original mannequin FBX, GLB, OBJ or USDZ is present in this checkout or the available uploaded attachments. The current attachments contain SVG brand/artwork files and video references. Therefore:

- No UV inspection or repair has been performed on an original mannequin.
- No female mannequin model has been fabricated or substituted.
- No previously failed USDZ is described as paint-ready.
- No public Flash entry currently shows an unconfigured 3D switch.
- A real model, separated placement materials and validation remain required before the optional viewer can be visually accepted.

The viewer integration is implemented; model conversion and Procreate compatibility are **not** claimed to be complete. The original FBX and intended flash-placement texture are the missing inputs.

## Blender → Procreate → web

1. **Inspect the original FBX in Blender.** Import with its correct scale and orientation; keep an untouched copy. Check geometry, normals, transforms, material slots and any embedded texture dependencies. Inspect each paintable mesh in the UV Editor with a checker texture. A material existing does not demonstrate valid UVs.
2. **Validate or repair UVs.** Every paintable face needs finite, non-zero-area UV coordinates in a documented UV map. Check unwanted overlaps, extreme stretching and faces outside the intended texture domain. Apply deliberate seam placement and unwrap missing/broken regions. Pack UV islands with enough padding for the chosen texture resolution; verify seams on the actual model. Preserve a known valid existing map instead of blindly replacing it.
3. **Prepare paintable materials.** Give each paintable region an explicit material and a real image texture. Use simple image-based material connections for interchange. Keep the tattoo/flash imagery on an independently identifiable material or decal surface, separate from the neutral body. A flash baked into the same texture that will be neutralized cannot meet the site's material separation contract.
4. **Export a Procreate-compatible interchange asset.** OBJ with its MTL and actual image dependencies is a practical interchange path; use a USDZ only if the actual exporter and installed Procreate version support and validate it. Do not merely rename an FBX or GLB extension. Open the exported asset in Procreate and paint a test stroke on every intended region. Export it again and inspect seams and textures in Blender. This real round trip is the acceptance test for paint-readiness.
5. **Create the finished placement.** Paint in Procreate, export the painted asset/textures and relink/inspect them in Blender. Confirm original tattoo color, transparency and placement. Name the neutral body material `Body` and the independently protected artwork material `Tattoo`, or use other exact names consistently in configuration. Use a separate decal surface if the intended artwork and body are not already separated. Check transparency sorting and z-fighting.
6. **Prepare a web GLB.** Remove unused cameras, lights, rigs and hidden geometry; reduce unnecessary polygons without damaging silhouette or placement UVs. Use appropriately sized textures and image compression, preserve alpha where needed and retain the exact intended material names. Export **GLB** with materials and images embedded. This initial viewer does not install Draco, Meshopt or KTX2 decoders: export ordinary geometry and browser-supported embedded PNG/JPEG textures unless decoder support is explicitly added later.
7. **Validate the actual export.** Re-import the GLB in Blender, check a glTF validator and open it in the site's viewer on desktop and mobile. Check that the tattoo is a distinct material, matches the flat artwork and remains intact when the body becomes neutral. Verify no missing images, wrong normals or oversized texture allocations. Set `validated: true` only after these checks and the real Procreate round trip pass.

## Enable a real model

Place the validated model in `public/models/` and add the following to an existing real, published **flashes** project in `src/data/artworks.js`:

```js
mannequin: {
  model: '/models/your-validated-placement.glb',
  validated: true,
  bodyMaterialNames: ['Body'],
  tattooMaterialNames: ['Tattoo'],
},
```

Use the exact authored material names. Both lists must be nonempty and disjoint; an invalid/incomplete configuration renders no 3D switch. A model with missing named materials fails safely back to the original flat artwork. `validated` is an editor's recorded acceptance decision, not an automatic UV test.

The loader preserves tattoo materials and every unknown material unchanged. Only explicitly listed body materials become neutral rough sculptural materials. The viewer does not shoot pigment onto the mannequin or apply hero color effects: those optional treatments would require separate art-direction checks to avoid obscuring the flash.

The detail view supports drag/touch rotation, arrow-key rotation, Home/reset and slow automatic yaw. The camera fits the actual model bounds without an orbit-control dependency. No model-specific positioning or tattoo-placement asset is invented at runtime.

## Checks and current limits

`tests/flash-mannequin.test.js` covers category/validation gating, safe GLB paths, disjoint material roles and escaped rendering. The implementation guards stale asynchronous loads and disposes geometries, original/replacement materials, textures, renderers, observers and listeners on close/navigation. Device pixel ratio follows the existing constrained/mobile quality rules.

No genuine model visual/UV/Procreate test can be reported until those assets are supplied. No mannequin footage or screenshots are presented as evidence of a completed asset pipeline.

The current standalone HTML exporter embeds the site's existing image assets, but it does **not** yet embed future GLB files and their dependencies. This optional model viewer is prepared for the served website. When a genuine model is added, extend the standalone export and its safe URL handling deliberately, then test that exact exported HTML with networking disabled. The current model-free preview must not be presented as proof of future offline GLB support.
