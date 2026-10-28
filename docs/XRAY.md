# The other side — Control vs. Corruption

The latest master brief and follow-up explicitly activate The Other Side. The previous postponed state belongs to PR #10 and is retained as history in [REFINEMENT-REPORT.md](REFINEMENT-REPORT.md). The current shared flag is:

```js
export const featureFlags = {
  otherSideEnabled: true,
};
```

Normal Mode retains the charcoal editorial site, chrome material, original geometry, tattoo reflection, infinity movement, interaction physics and native h4 cursor. The alternative mode adds damaged photographic material, solarized media and local sampled-pixel corruption. Its internal identifier remains `xray`; the public name is **the other side**.

## Activation and lifecycle

Hold main-keyboard `4` or numpad `4` continuously for at least 1,000ms. Releasing earlier cancels; repeated keydown events do not restart the timer or create another toggle. Release the key before starting a new hold. Another complete hold returns to Normal Mode. Modifiers, composing/typing fields, blur, document hiding and page navigation cancel unfinished holds. No state is stored for the selected mode; enhanced navigation retains the existing document controller.

`src/xray-shortcut.js` owns the keyboard timer. `src/mode-hold.js` adds a one-second pointer/touch hold on the hidden footer control. Moving or scrolling cancels that hold. A short tap only discovers the hint. Native Enter/Space and assistive button activation remain untimed alternatives, so the secret is usable without a physical number key or a timed motor gesture.

`src/xray.js` coordinates one document-level controller, the exact footer labels, the mute control, media filters, palette and transition. `h4:modeprepare` is dispatched during the initial accepted input gesture; `h4:modechange` marks the actual change and `h4:modeprogress` shares its existing 650ms transition progress with the wordmark shader. Reduced-motion and constrained-device profiles use simpler transitions. A failed image or denied audio context does not prevent navigation or switching.

## Reference provenance

The received material is the purple negative tattoo/arm image, the cyan/green/yellow-orange false-color body image, the three-part film-burn/macroblock/smear image and the approximately six-second `ScreenRecording_10-24-2026 21.mov`. The video shows displaced image history, torn block boundaries, bleached highlights and violet/green negative regions. These references informed the first implementation.

The brief also announced Reference 03 (chemical-film landscape) and Reference 05 (destroyed blue/purple/white film); those two files were not supplied at this stage. The first background is an original generated film-damage texture based on the received triptych/video and the written direction. It is not a supplied photograph or a portfolio project. Its burned white islands, deep blue/violet densities, acid-green stains and irregular emulsion damage avoid a plain gradient or repeating decorative tile. Additional references can guide a later material adjustment without changing the interaction architecture.

## Dedicated pixel surfaces

`src/corruption-lifecycle.js` preloads the film and dynamically imports `src/corruption.js` after the initial discovery gesture. The normal initial page load does not create effect canvases or download the film. The controller activates surfaces only for The Other Side.

The fixed film background uses a single cover-cropped local image. Cursor damage is rendered into at most two small Canvas2D regions: one active region and one anchored recovering region. `src/corruption-field.js` supplies bounded, velocity-responsive impulses and deterministic cell offsets. The renderer copies actual film/photo pixels and earlier damaged pixels into displaced macroblocks and stretched horizontal strips. It does not paint colored particle squares. Old regions stay where they were damaged until they recover or the bounded region pool is recycled.

The source for a photograph is prepared once from the decoded image, with the same solarized color tables; source pixels are not read back on every pointer update. Local/CORS-readable images can use the interactive surface. If preparation is unavailable, the existing image/filter remains usable. Photo regions live inside their photograph container or the native dialog's top layer. Arbitrary DOM text is not rasterized, dragged or made unclickable. This is a localized image/history-based datamosh-style effect, not actual manipulation of a video codec or every live DOM pixel.

Rendering is scheduled only for pending input or recovering regions. Defaults cap regions at 620×420 CSS px on desktop or 360×300 on mobile, DPR 1 and at most 30 paint frames per second. The block drawing budget adapts downward after expensive frames. Hiding the document, leaving the mode, navigating, resizing or enabling reduced motion clears the regions; no idle corruption loop remains. Geometry reads are limited to active surface mapping, including an image while its hover transform changes. Work/About do not import the hero or create a second Three.js scene.

## Existing wordmark material

The actual 3D geometry in the repository is the `h4ngelic` text mesh. The h4 micro-logo is the native SVG cursor, not a separate 3D mesh. `src/wordmark-xray.js` chains onto the existing material hook after the supplied tattoo-reflection hook. It samples film damage in object-local coordinates and adds corroded color regions, small edge losses, magenta fringes and white hot highlights while retaining the geometry, pose and physics. The cursor's recognizable SVG silhouette stays intact.

The existing hero render/visibility loop remains responsible for WebGL. Material amount and canvas transparency follow shared transition progress so the film can appear behind the same sculpture. Returning to Normal restores the opaque charcoal clear and original chrome treatment. The bright material is an emission-like shader treatment; no separate full-screen bloom pass or second scene is implied.

## Metallic crystal audio

`src/mode-audio.js` synthesizes related stereo cues from damped, inharmonic resonances, a brief strike and two quiet early reflections. Enter rises slightly; return descends. Both last 0.7 seconds by default. A short attack, bounded PCM peak, controlled master gain and compressor prevent abrupt level spikes. A new transition fades/stops the previous voice before starting its replacement; ended nodes disconnect.

AudioContext allocation/resume starts from the accepted trusted key/pointer/button gesture. Sound playback starts at the actual mode transition, not at the beginning of a cancelled hold. The footer's `sound on/off` button mutes playback and stops a current voice; mute state remains in document memory across navigation. Unsupported or denied Web Audio is a silent fallback. There are no external audio files or runtime audio requests.

Use `npm run sounds:export` to generate review WAVs from the same PCM/settings; exported review files are not runtime dependencies.

## Editable intensity

| File | What to edit |
| --- | --- |
| `src/data/featureFlags.js` | Shared mode/control release switch |
| `src/data/xraySettings.js` | `shortcutHoldMs`, transition duration/rate, palette, saturation, channel separation and non-monotonic color tables |
| `src/data/corruptionSettings.js` | Distress, material burn, grain, color/pixel corruption, glow, smear and recovery strength; field and device-quality bounds |
| `src/data/modeAudioSettings.js` | Sound enable, volume, duration, partials, decay, enter/leave sweep and quiet reflections |
| `src/data/uiEffectSettings.js` | Shared hover magnification/glow, magnet distance and arrow geometry/spacing |
| `src/data/easterSettings.js` | Hidden-copy timing, local visit policy and ink lifetime/cap |

Current intensity defaults are `distressIntensity: 1`, `filmBurnIntensity: 1`, `grainIntensity: .7`, `colorCorruption: 1`, `pixelCorruption: 1`, `glowStrength: 1` and `smearingIntensity: 1`. `recoveryMs: 1600` is the base lifetime; velocity can extend it, while a higher `recoverySpeed` restores pixels faster. Setting an intensity to zero removes that contribution, not every other independent effect. Keep device caps bounded when adjusting strength.

## Verification and limits

`npm test` includes actual PCM-envelope, hold/cancellation, input, field velocity, cap, anchored recovery and deterministic cell tests. Browser suites cover actual trusted Web Audio, public keyboard/touch switching, mute/navigation, pointer response and sampled pixels. Current executed results, production-build checks, real measurements, screenshots and the transferable preview belong in [CONTROL-CORRUPTION.md](CONTROL-CORRUPTION.md).

An empty real archive cannot prove the final look of future tattoo photography. Physical mobile GPUs, Safari audio policies and future large portfolios need their own review. Older PR-9 and PR-10 scores are historical and must not be presented as measurements of this update.
