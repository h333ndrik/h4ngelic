# License note — procedural mannequin

The asset at `public/models/mannequin.glb` is an original procedural work. Its
geometry is generated solely from numeric lathe profiles and primitive
parameters committed in `scripts/mannequin-build.py`.

- No vertices, UV coordinates, materials, textures, rigging, topology or other
  structure from any external model are used.
- The rejected Sketchfab base-mesh asset is not imported, referenced, copied or
  used as an input. It is not committed to this repository.
- No texture or image is embedded in the GLB.
- No `derivedFrom` or third-party asset metadata is present.
- The only external dependency is the Blender application used to execute the
  committed deterministic build script.

This repository contains no third-party mannequin asset requiring
redistribution permission.
