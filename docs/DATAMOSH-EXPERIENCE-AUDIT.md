# Datamosh experience — audit before implementation

Baseline and rollback: `d789c21d9c5d9c01cb936771998d692aadc0b50c` on `feat/interaction-datamosh`. Work continues on the requested existing `feat/other-side-color-memory-parallax` branch, which initially points at the same commit. A frozen built baseline is retained at `/tmp/h4-color-memory-before-d789c21` for local comparison. The previous reports describe their original versions.

## Current strengths

The site already has one lazy homepage-only Three.js scene, real TextGeometry, raycaster, physics, projected-logo motion publishing, cached scroll choreography, responsive galleries/navigation, one shared mode/audio controller, desktop `4` hold / `333`, mobile four-/three-tap controls and bounded organic touch ink. These should be extended rather than recreated.

`temporal-mosh.js` genuinely transports opaque prior-source pixels in bounded regions and selectively reconstructs them. Native mode/navigation transitions sample the actual rendered page, including dialogs; live inner-label sampling preserves real click targets. Hidden/reduced/Normal gating, quality profiles, exact monogram assets and resource cleanup are established.

## Actual limitations

- `ambient-film.js` copies the previous output but then repaints the full clean material each frame; history only partially survives in regional overlays (alpha capped at .65). Most of the backdrop has no lasting image memory.
- Background cursor/hero/type effects use separate ROI histories. Their damaged pixels do not enter the ambient history, and page changes discard those ROIs.
- Pointer coalescing retains the strongest older velocity, horizontal direction is reduced to a sign and vertical motion is attenuated. Stable cells are rehashed during recovery, adding movement unrelated to input.
- Hover expansion/contraction is a CSS transition without actual movement telemetry. A single entry impulse cannot represent its moving edges. Pure scale changes are currently ignored by the motion consumer unless rotation is present.
- The hero publisher already projects eight corners, but discards their signed motion into aggregate bounds and an absolute angular speed. Opposite edge vectors can cancel at the center. Hero gain also shares the typography control.
- The background has no actual slower source-position parallax.
- Local pixel filters override the existing CSS glow while active.
- Navigation is configured at 600ms and hard-clamped to 480–720ms, above the newly requested 250–450ms range.
- Native page snapshots are browser-owned images, not recursive Canvas feedback. They can coordinate with material history but cannot honestly be described as feeding DOM pixels back into it.
- The hero canvas is intentionally excluded from ordinary 2D ink. Its existing pointer/raycast path is the correct future entry for surface-bound 3D paint; a flat screen overlay would be wrong.

## Technical references inspected

Primary: [niccolofanton/data-mosh](https://github.com/niccolofanton/data-mosh), pinned `d3251ba84a66393f3ac474222f40e041f75f3948`, MIT, copyright 2026 Niccolò Fanton. Actual files under `datamosh-demo/src/datamosh/` include `index.ts`, `effect.ts`, `shaders.ts`, `velocity-pass.ts`. Its relevant principles are current-minus-previous screen geometry vectors, block-center sampling, quantized advection, previous **output** feedback, selective source residual, zero-motion identity sampling and correctly sized ping-pong buffers. Codec-inspired sector loss is not actual video packet loss. Short lost-sector toggling is not adopted; the website needs slower heterogeneous recovery without strobing.

Aesthetic reference: [Supermosh](https://github.com/supermosh/supermosh.github.io), pinned `c6724b47b03fd19d5be20b78bb947f8c8f4d4b5a`, GPL-3.0. Its encoded-video/WASM/WebCodecs pipeline is studied, not imported. No GPL source or new FFmpeg stack is copied. Source inspection does not establish that the remote demo was visually tested here; external preview/media endpoints are restricted in this environment.

Final-feature reference: the installed Three.js 0.186.1 `DecalGeometry` and official r186 decal example. The addon projects mesh vertices via `mesh.matrixWorld` and emits world-space vertices; the example compensates parenting using `mesh.attach()`. A future local-space proxy or equivalent inverse transform is required to avoid double-transforming paint on the animated wordmark. This is an audit, not an early ink implementation.

## Implementation sequence and validation gate

1. Establish one persistent, bounded image-memory field using the existing Canvas infrastructure: previous-output advection, stable cell vectors, selective current-image reconstruction, heterogeneous hold/recovery and real color persistence.
2. Feed actual scroll, cursor, hero, typography, hover and click movement into that shared field. Keep photo surfaces as coordinated histories using the same image kernel. Preserve global memory across reversal, rest and internal navigation. Source-position parallax must generate image motion rather than simply translate an overlay.
3. Coordinate stronger mode transitions and faster route transitions with that live history; retain native snapshots for actual DOM pixels and original navigation/audio semantics.
4. Expose bounded artistic controls, test source-A→source-B persistence and successive displacement, then inspect desktop/mobile motion in the browser and record evidence.
5. **Only after the preceding datamosh/browser gate:** implement surface-bound Normal-homepage 3D ink through the existing raycaster, geometry and render loop. Test adhesion during actual rotation, depth/occlusion, click-vs-drag, fading and disposal. No unrelated feature follows it.

The earlier proposed mobile Contact-message Easter egg remains outside this task and unimplemented.
