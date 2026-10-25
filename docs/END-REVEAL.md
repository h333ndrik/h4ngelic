# Final h4 reveal

The homepage ends with a large, quiet h4 impression behind the existing one-second mode-switch instruction. It is part of the final section, after Contact, rather than a fixed page watermark. Work and About do not contain it.

`public/assets/h4-monogram.svg` reuses the exact fill path and even-odd cutouts from `public/assets/h4ngelic-cursor.svg`. The cursor's decorative white outline is omitted for the large brand silhouette. No replacement font, traced approximation, new 3D geometry or additional renderer is used. The original cursor SVG remains unchanged, and the geometry is checked verbatim in the unit test.

On the Normal Side, translucent tonal shading and restrained edge relief sit over the continuous page gradient. The mark starts revealing when the final section reaches 90% of viewport height and settles as it reaches 10%. A small local rise and scale follow that same progression. The instruction stays above it at its existing foreground layer and keeps its existing discovery, keyboard and touch behavior.

On The Other Side, the same silhouette contains the Living Decay material. This inner material moves independently using a small transform, while the existing full-page mode transition captures the real mark. Entry and reverse choreography remain unchanged. The background image is requested only after entering The Other Side, with a smaller mobile variant.

`src/end-reveal.js` schedules one frame per scroll or layout change while the final section is near the viewport. Layout bounds are cached between measurements. IntersectionObserver limits its active area; visibility changes stop updates and the material animation. Reduced motion reveals the static silhouette once the final section reaches 45% of viewport height, with no rise, scale or animated material. Disposing a route removes observers and listeners.

The reveal range and easing live in `src/data/endRevealSettings.js`. Appearance and section dimensions live in `src/end-reveal.css`; the footer markup lives in `src/footer.js`.

Validation commands:

```sh
node --test tests/end-reveal.test.js tests/easter-eggs.test.js
H4_BASE_URL=http://127.0.0.1:5173 node tests/end-reveal-browser.mjs
```

The browser script checks desktop, 390px, 320px and reduced-motion profiles; it writes viewport screenshots and actual results to `artifacts/end-reveal/`. It checks that the mark stays absent at the hero and Contact, progresses through the final reveal, retains the exact mask through `4` and `333`, keeps the instruction above the mark, pauses while hidden and remains absent from Work and About.

Verified on 25 October 2026 against the development preview in headless Chromium: desktop 1440×1000, touch 390×844, touch 320×844 and reduced motion 1000×800 all passed. Normal and Other viewport screenshots were visually reviewed for the original sharp silhouette and foreground readability. The hidden-page check dispatches a controlled visibility change; it verifies the lifecycle and animation stop rather than claiming a physical mobile-device measurement.
