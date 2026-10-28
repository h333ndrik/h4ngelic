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

`node --test tests/image-memory.test.js tests/ambient-film.test.js tests/mode-snapshot.test.js` passes 44 focused tests. These include an independent pixel-compositing oracle over 64.8 simulated seconds: real prior image information remains displaced from an unchanged source after motion has stopped. Tests also verify unchanged color controls, idle evolution, navigation/resize retention, bounded resources, normalized snapshot echo weights, distinct signed reverse displacement and exact lifecycle cleanup. Changing coarse compression blocks to finer ones preserves the damaged world while enforcing the new, smaller displacement budget.

The real browser harness is `tests/persistent-memory-browser.mjs`. With a running development server:

```sh
H4_BASE_URL=http://127.0.0.1:5173 node tests/persistent-memory-browser.mjs
```

The browser run passed at 1000/390/320px using actual mode gestures, pointer input, internal navigation, viewport resizing and 15 seconds of real idle. It read pixels from the displayed Canvas2D, with these measured results:

| Viewport | Real idle interval | Changed pixels | Retained scar cells before / after idle |
| --- | ---: | ---: | ---: |
| 1000px | 15.014s | 536,524 of 760,000 | 1008 / 1008 |
| 390px | 15.005s | 111,489 of 272,640 | 343 / 343 |
| 320px | 15.007s | 113,073 of 223,488 | 281 / 281 |

Maximum retained displacement also stayed exactly unchanged through each idle interval. Existing material controls remained identical; internal navigation and resizing preserved the seed and damaged state. Returning to Normal stopped ambient frames, and fresh entry produced a different seed. All three cold interior profiles loaded no hero/Three.js and created zero WebGL contexts, with no runtime errors. Actual desktop and 320px idle screenshots were visually inspected: the damaged material remains visible behind readable typography.

The pixel deltas demonstrate continued evolution; the retained addresses and independent minute-long compositing oracle establish that this evolution does not reconstruct the whole clean source. They are not physical-phone FPS measurements. Raw evidence is in `artifacts/persistent-memory/results.json` and the corresponding `idle-*.png` screenshots. Browser tooling here uses Chromium/SwiftShader.

The existing native snapshot pixel suites also pass against the stronger capture graph. Actual bright glyph information moved 4,598 pixels outside its original mask with zero unexpected chroma and exact live-DOM restoration. In the real artwork dialog, 9,817 actual image pixels moved outside their old mask and 32,707 pixels changed; the grayscale source retained zero unexpected chroma. On release, only 25 channels differed by one 8-bit level (mean .000145688), within the existing strict raster rounding bound. The displaced image screenshot was inspected. Both suites retain once-only callbacks, interruption and reduced-motion/unsupported fallbacks. A separate unpaused reverse snapshot configured to 750ms completed in 1,158ms including software rendering and native setup; the public world switch remains configured to 950ms. Evidence: `artifacts/mode-snapshot/results.json` and `artifacts/mode-snapshot-modal/results.json`.
