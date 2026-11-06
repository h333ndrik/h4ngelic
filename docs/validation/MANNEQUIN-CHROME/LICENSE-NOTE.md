# License note

**Status: original work — no third-party asset license applies to the generated mannequin.**

The female mesh, UV layout and material are produced exclusively from numeric
profiles and Blender primitives in `scripts/mannequin-female-build.py`. The
script imports no FBX, OBJ, GLB, sculpt, image or purchased asset, and the
output has no `derived-from` reference.

The external female mannequin sometimes used as a visual style reference is
not included, copied, modified or redistributed in this branch. It contributes
no vertices, UV coordinates, materials, textures or topology. No Sketchfab
asset is shipped in the repository or in `public/models/mannequin-female-*.glb`.

The committed builder, generated GLB files, UV atlas, guide renders and demo
motif are treated as project-owned work. They may be used, modified and
redistributed with this repository without a separate third-party asset grant.

Evidence: `poly-trace.json` records `external_asset_inputs: []`; the unit test
rejects FBX/skin-texture references in the builder; both GLBs contain one mesh,
one primitive, one material, zero images and zero textures.
