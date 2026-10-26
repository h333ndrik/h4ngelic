# Persistent material and world rupture

This extends the existing shared Canvas2D image-memory renderer. It does not replace the Living Decay source, palette, composition renderer or scroll mechanics.

## Why the world used to become clean

`image-memory.js` correctly transported previous output, but every cell continuously reconstructed toward the undistorted source address. Its transient velocities and energy then decayed to zero. Given enough idle time, repeated reconstruction erased the motion damage even with high feedback persistence.

The global ambient field now also retains a signed **sampling scar** per existing numeric cell. Actual scroll, cursor, typography, hover, object and transition displacement write these addresses. When transient motion relaxes, the existing recovery process samples the same original material through those retained displacements. It can reconstruct locally without exposing a wholly clean keyframe.

The history still follows `next = displaced previous output + selective source residual`; the residual's destination is now the damaged material condition. The existing slow four-region idle flow continues moving actual preceding output. Idle flow never accumulates new permanent offsets, avoiding a background that slowly pushes every cell to an extreme.

Scars are bounded to `min(58px, 1.8 × cell size)` per axis. The current 1400/600-cell and 1120×800/512×768 backing-store limits remain unchanged. Local photograph regions retain their original finite recovery; persistent scars are enabled only for the global material.

Navigation retains the shared field, seed and canvases. A real viewport resize reprojects the old history and scars rather than clearing them. The existing scratch canvas holds that temporary copy and immediately returns to 1×1. A redundant resize does nothing. Fresh mode activation keeps the established automatic seed policy; explicit debug seeds remain reproducible. Normal Side, reduced motion and hidden documents stop the renderer as before.

No palette, exposure, bleaching, brightness, white-balance, color-variation or source-artwork settings changed. All permanent addresses come from movement, rather than a new aesthetic randomization pass.

## Stronger world captures

World transitions retain the established 950ms choreography and separate entering/leaving phase maps. Macroblock regions cover more of the actual captured page and stretch farther horizontally. A displaced echo carries real outgoing/incoming pixels through the strongest rupture; arithmetic weights always sum to one, avoiding additive white or glow.

The two browser-owned captures overlap earlier while they distort in different directions. Reverse mode reconstructs through its distinct sampling sequence and opacity schedule. Local hover/click effects do not gain this echo, and ordinary route durations remain unchanged.

These are native browser snapshot filters with a bounded lifetime. They do not make DOM snapshots recursively readable by Canvas, and they are not encoded-video packet loss. The global material continues to use genuine previous-output pixel feedback.

## Verification

`node --test tests/image-memory.test.js tests/ambient-film.test.js tests/mode-snapshot.test.js` passes 43 focused tests. These include an independent pixel-compositing oracle over 64.8 simulated seconds: real prior image information remains displaced from an unchanged source after motion has stopped. Tests also verify unchanged color controls, idle evolution, navigation/resize retention, bounded resources, normalized snapshot echo weights, distinct signed reverse displacement and exact lifecycle cleanup.

The real browser harness is `tests/persistent-memory-browser.mjs`. With a running development server:

```sh
H4_BASE_URL=http://127.0.0.1:5173 node tests/persistent-memory-browser.mjs
```

It uses actual mode gestures, pointer input, internal navigation, viewport resizing and 15 seconds of real idle at 1000/390/320px. It reads displayed Canvas2D pixels and reports retained numeric scars, continued idle evolution, unchanged controls, new fresh-entry seeds, clean Normal rendering suspension and no interior Three.js loading. Results are written to `artifacts/persistent-memory/results.json` when run; this document does not claim an unexecuted browser result.
