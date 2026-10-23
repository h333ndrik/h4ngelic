# The other side

Press `4` (main keyboard or numpad, with either Num Lock state) or activate the quiet footer control to switch between Normal and X-Ray. The button is keyboard and touch accessible. Repeated keydown events, modified shortcuts, text inputs, selects and editable elements keep their normal behavior.

The mode lives only in the current document's memory. Enhanced navigation preserves it; a fresh full-page load starts in Normal. No cookies, localStorage, sessionStorage, analytics or server requests are used by this feature. The footer visitor feature has its own separate privacy configuration.

## Visual treatment

The visible supplied reference shows a tattooed arm with violet/purple solarization, acid-green shadows, dirty cyan and overexposed pink-white highlights. **Only one of the two references mentioned in the master brief was attached.** This implementation is a configurable interpretation of that visible reference; a match to the missing second reference cannot be assessed.

`src/data/xraySettings.js` controls:

- `channels`: nine sample values per red/green/blue curve, from black to white. Non-monotonic curves create solarization; different curves create false color.
- `saturation` and `channelSeparation`: how much photographic color remains and the small color-registration error.
- `palette`: background, readable foreground, muted copy and four accent/ink colors.
- `grainOpacity` and `liteGrainOpacity`: static analog exposure/texture strength.
- `transitionMs` and `transitionFramesPerSecond`: bounded mode-transition timing, currently 650 ms and at most 30 filter updates per second.

SVG component-transfer curves process the existing image presentation, with a small red/green channel displacement on capable devices. They apply automatically to project images, artwork-viewer images, an optional About portrait and the hero canvas/fallback. Original image files, semantic `<img>` elements, alt text and Three.js scene/physics are unchanged. Text and navigation are never passed through the image filter.

A single inline static SVG texture supplies irregular chemical blooms, fine grain, dust and broken scratches. It makes no external request and has `pointer-events: none`. The alternate interface keeps readable pale text over a distressed dark-violet ground rather than filtering the entire document. No decorative gradient is added to ordinary headings.

The short transition interpolates the actual tonal curves toward or away from identity. A restrained exposure wash accompanies the transition; there are no repeating flashes. Once settled, the module runs no animation loop. Reversing during a transition starts from the current treatment rather than stacking filters or creating another effect layer.

Touch, Save-Data, low-memory and low-core devices use a lighter single-pass image treatment and a cheaper CSS color treatment on the animated hero. Reduced-motion mode switches immediately without the transition wash or curve animation. The same original h4 cursor remains in use.

## Integration

```js
const stopXRay = initXRay();
// Delegated footer controls remain functional after route changes.
// Optional methods: stopXRay.setMode('xray'), .toggle(), .refresh().
// Call stopXRay() when disposing the entire application.
```

State is reflected by `html[data-mode="normal"|"xray"]`. The document emits `h4:modechange` with `{ mode }`. Footer hints own their own discovery/acknowledgement timing. Ink colors inherit `--ink-color-1` through `--ink-color-4`. `h4:pagechange` refreshes all current toggle buttons automatically.

The module creates exactly one `svg[data-xray-filters]` (two named filter definitions) and one `.xray-distress` layer. Repeated toggles reuse them. Cleanup removes listeners, cancels pending animation frames, removes the layers and restores root attributes/properties. The ordinary theme has no residual media filter after the exit transition.

## Validation

`node --test tests/xray.test.js` checks identity/solarization endpoints, non-monotonic false-color curves, reversible deterministic interpolation, keyboard guards and resource-based quality selection. Full keyboard/touch, repeated-toggle, image-pixel and reduced-motion browser checks are part of the integration acceptance tests; run them before reporting visual acceptance. The archive remains empty until genuine portfolio projects are entered, so the browser tests may use a temporary fixture made from the already supplied tattoo texture without publishing that fixture.

Run the repeatable real-application image check with `npm run test:xray` while a server is active. Set `H4_BASE_URL=http://127.0.0.1:4173` to check the production build's external CSS as well as Vite development styles. The test opens the real Work page, inserts the supplied tattoo texture only as a temporary DOM fixture, and compares rendered image pixels in full, touch/lite and reduced-motion profiles. It checks exact Normal restoration, both `4` keys and ten interrupted toggles. Device hints are explicitly overridden for coverage; the results are not device-performance measurements. Screenshots are saved to ignored `artifacts/xray/`.

The real-application check passed against both Vite development styles and the production build's external stylesheet. At 256 × 362 pixels, the full treatment changed 92,114 of 92,672 screenshot pixels (sum of RGB differences greater than 18); the lite treatment changed 92,669. Returning to Normal restored every image pixel exactly in both profiles. Main-keyboard/numpad toggling, ten interrupted toggles, stable effect-layer counts and reduced-motion behavior passed. These are rendering/behavior checks, not frame-rate measurements. Fresh loading and runtime measurements for the complete integration are documented in the final performance report.
