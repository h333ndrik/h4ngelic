# Living Decay and the final h4 reveal

This update extends the existing website on `feat/interaction-datamosh`, from rollback commit `7e5fdc3` (PR #12). It does not merge the review branches or deploy the site. The hero's geometry, chrome material, figure-eight movement, physical interaction and existing sounds are retained.

## Normal Side

One fixed page background uses `#282828 → #242424 → #202020`. Sections, navigation and the WebGL clear surface are transparent, so scrolling does not restart the gradient. Colors are centralized in `src/style.css`.

The final homepage section reveals the exact existing h4 SVG as a large, subtle relief behind the instruction. It is section-local and invisible at the hero and Contact entrance. Its progression follows native scrolling; reduced motion shows a static impression only when that section is visible. [End reveal](END-REVEAL.md) documents its asset and settings.

Review images: [Normal end section](previews/living-decay/end-normal.webp), [Other Side end section](previews/living-decay/end-other.webp), [mobile Normal](previews/living-decay/end-mobile-normal.webp), [mobile Other Side](previews/living-decay/end-mobile-other.webp). The instruction has keyboard focus in these captures; its outline is the accessibility focus indicator.

## The Other Side

The new background is a continuous composition synthesized from an optimized reference-inspired material, rather than a twelve-panel layout. Dirty white and lavender erosion, negative-space voids, green/violet compression fragments and restrained warm remnants share one field. The original uploaded artwork and the hero's original film maps are separate and unchanged; the new background is not published as a portfolio artwork.

Each new activation chooses a new composition seed. Internal navigation preserves the current seed, history and evolving world. A seed plus elapsed time and settings can restore the composition for development. Small independent regions evolve within the unified field; there are no image cards, repeating tiles or section background resets.

The animation samples cached source pixels and bounded feedback buffers. Desktop idle updates are capped at 6Hz and the mobile/constrained profile at 3Hz, with adaptive reduction when painting is expensive. Hidden documents and Normal mode stop rendering. Reduced motion keeps the material static and suppresses nonessential corruption.

## Shared interaction system

| Source | Response |
| --- | --- |
| Cursor | Sharp source-pixel damage, default radius 35px; adjustable from 25–45px |
| Hover and focus | Bounded local material disturbance; hover also displaces the actual label/image pixels |
| Click | Stronger local rupture, with the original action retained |
| Scroll | Measured velocity and a finite inertia tail advect the material |
| Section and typography movement | Existing entrance/exit paths disturb the image field without replacing their choreography |
| 3D logo | Its projected movement and angular velocity disturb the material; physics and mesh transforms are unchanged |
| Internal navigation | The actual old/new rendered pages participate in a short damaged transition |
| Hold `4` / released `333` | The strongest actual-page breakup/reconstruction; the final h4 silhouette participates naturally |

Producers reuse their existing animation or scheduled scroll updates. Shared samples are capped at 12Hz; the renderer retains at most two damage regions. There is no scroll interception or always-running pointer loop. Protected instructions, editable fields and disabled controls are excluded.

Local label effects filter a noninteractive inner visual with SVG `SourceGraphic`; the actionable parent stays live. Native View Transitions are reserved for route and mode changes. This avoids the native snapshot preparation phase swallowing a rapid click during a hover. Every temporary filter, map reference, timer and animation frame is released on completion or cancellation.

These are independently written image-based datamosh techniques. No GPL Supermosh source, FFmpeg pipeline or new runtime dependency is included. Native snapshots deform the actual rendered page but are not encoded-video keyframe manipulation or recursive DOM frame feedback. Canvas source/history buffers provide temporal image persistence on material and artwork surfaces.

## Editing and calibration

`src/data/livingDecaySettings.js` owns the validated controls. `src/data/interactionMoshSettings.js` owns discrete event timing, travel and cooldowns. `src/data/temporalMoshSettings.js` owns temporal buffer budgets. `src/data/endRevealSettings.js` owns the final reveal progression. Existing portfolio/contact/about content remains editable through [the content guide](CONTENT.md).

For development, run `npm run dev` and open `http://localhost:5173/?fx=1`. The calibration panel provides the seed, regeneration and all material/motion controls. It does not initialize Other Side by itself. `auto` keeps choosing fresh seeds; entering an integer permits repeatable material compositions. Keyboard-accessible sliders take effect in the current world. Close/collapse the panel to inspect the page.

The panel and its CSS are behind a compile-time `import.meta.env.DEV` guard. A production build neither emits its chunk nor exposes the panel. It uses no persistence, authentication or external service.

## Review and offline preview

The downloadable [HTML](previews/h4ngelic-preview.html) contains the full interactive site and embedded assets. Download it before opening; GitHub's code view does not execute it. The [ZIP](previews/portfolio-preview.zip) includes the same HTML and instructions. Production uses ordinary clean routes; only this offline file uses hash routes.

The final verification record is in [the interaction report](INTERACTION-DATAMOSH.md). Measurements from older refinement reports remain historical and are not presented as measurements of this update.
