# The Other Side — image memory and motion

This extends the existing site on `feat/other-side-color-memory-parallax`. The original chrome mesh, physics, infinity path, route handling, mode gestures and audio controller remain in place. The implementation uses the existing Canvas2D image pipeline and homepage Three.js renderer; there is no new animation or rendering dependency.

## Shared image history

`src/image-memory.js` holds a bounded numeric macroblock field and the image-copy kernel. The complete rendered output becomes the next history image. Each cell samples displaced pixels from that previous output, then admits a small amount of current source data. Different cells have stable hold times, drag and recovery rates. Changing the source therefore does not immediately erase its old colors; another movement can move the surviving pixels again.

`src/ambient-film.js` owns the bounded output/history canvases and its single adaptive scheduler. It processes cursor strokes, scroll motion, hero corners, moving typography, hover edges, clicks and transition intents through that field. Per-channel artistic gains are applied in the renderer. Idle updates are capped at 6Hz desktop / 3Hz mobile; active updates at 24Hz / 18Hz, with a lower cap when measured draw time is too high. Hidden documents, reduced motion and Normal Mode stop the continuous effect.

Photographs keep at most two clipped source-pixel regions so native dialogs and image boundaries remain correct. Their displacement uses the same history sampling kernel. Their numeric inputs also reach the background field. Before a route replacement, available outgoing photo history is composited into the shared material history. Route changes remove obsolete photo canvases and input targets without resetting global material pixels, seed or memory.

## Physical input

`src/motion-mosh.js` connects the existing publishers to the image field. Signed vectors are CSS-pixel displacement over the reported `deltaMs`. The hero publishes eight projected geometry corners; the existing kinetic type publishes four transformed corners. Opposing edges are retained, so rotation or scaling around a stationary center still produces movement.

`src/finite-hover-motion.js` samples the resolved visual transform at at most 12Hz during a finite hover/magnet transition. It caches the layout footprint and stops after the final pose. Both expansion and contraction contribute vectors. Link hit targets remain stationary. `src/corruption.js` coalesces pointer input before submitting it; there is no canvas rendering or geometry measurement for each raw pointer event.

Actual native scroll displacement advances the source crop at an initial gain of `.4`. The field follows the signed movement of the visible content. Inertia events carry zero additional source travel. Source offsets ease smoothly within finite image overscan on long pages, so `.4` is a local starting gain, not a promise of unbounded constant travel. No repeating texture tiles or reset of image history are used.

## Transitions and actual page pixels

Mode transitions use 950ms by default, configurable from 750–1200ms. Ordinary route transitions use 340ms, configurable from 250–450ms. Reverse mode changes use a distinct reconstruction sequence. Native browser view-transition snapshots sample the actual departing and arriving page, including text and dialogs. Local hover/click pixel filters operate on live inner visuals and preserve their glow and click targets.

Browser-owned page snapshots remain a coordinated image layer; arbitrary DOM pixels are **not** recursively read back into Canvas. Material and available photo pixels have true output feedback. Numeric `h4:transitionintent` events coordinate their motion with the native page transition. Unsupported browsers retain working navigation and mode changes without this optional snapshot layer.

## Tuning

Edit `src/data/livingDecaySettings.js` for persistence, pixel displacement, block size, scroll/cursor/hero/type/hover sensitivities, color bleeding, occasional local negative exposure, recovery, source parallax and transition durations. During development, `?fx=1` opens the existing calibration panel, which follows the settings schema. Production does not import that panel. `?test=1` development hooks expose bounded read-only diagnostics for browser checks.

The same original sources and editable portfolio/contact data remain documented in the main README. The material texture is an experimental background, not an invented portfolio project.

## References

The audit in [DATAMOSH-EXPERIENCE-AUDIT.md](DATAMOSH-EXPERIENCE-AUDIT.md) records exact pinned references. Niccolò Fanton's MIT `data-mosh` informed signed geometry velocity, stable block sampling, output feedback and selective residual reconstruction. Supermosh informed the visual direction; its GPL video/FFmpeg pipeline was not imported. This Canvas implementation is codec-inspired temporal image processing, not actual compressed-video packet removal.

## Validation

See the accompanying validation report for commands, actual browser evidence, measurements and remaining limits. Historical reports describe their original versions and are not measurements of this update.
