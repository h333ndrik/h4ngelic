# Homepage motion

The homepage uses native scrolling and native CSS sticky positioning. No wheel
or touch gesture is intercepted. The poses are a direct function of the current
scroll position: scrolling up reverses them, and stopping freezes them. There
is no animation clock or idle render loop for these effects.

`src/data/motionSettings.js` contains the editable distances and timing ranges.
All durations are **scroll distances**, not seconds. The pure sampling helpers
live in the same file so Node tests do not need a CSS loader or a browser.

## Markup and lifecycle

Call `initScrollChoreography(content)` after rendering the homepage and call its
returned disposer before replacing that content. The initializer returns a
no-op on Work/About routes, where there are no motion sections. This module
does not import the Three.js entry point or change logo physics.

Each of the three homepage sections has this structure:

```html
<section class="content-section selected-work" data-motion="work">
  <div class="section-pin">
    <h2 class="kinetic-heading">
      <span class="kinetic-heading-text">01 / selected works</span>
    </h2>
    <div class="category-strip">
      <a class="category-link" href="/work/tattoos">
        <span class="kinetic-item">
          <span class="category-magnet">tattoos <i class="arrow"></i></span>
        </span>
      </a>
      <!-- jewellery and paintings use the same structure -->
    </div>
  </div>
</section>
```

Contact uses `data-motion="contact"`, `.contact-links` and `.contact-link` with
the same two inner wrappers, including unconfigured disabled spans. About uses
`data-motion="about"` and keeps its paragraph/link as their existing elements:

```html
<p class="about-preview-copy kinetic-item" data-motion-item="copy">…</p>
<a class="text-link kinetic-item" data-motion-item="link" href="/about">more about ↗</a>
```

`.kinetic-item` owns scroll translation and rotation; `.category-magnet` owns
the independent, small pointer hover translation. Anchor hit areas stay in the
three-column grid. Heading masking belongs to `.kinetic-heading`, and its
inner text owns the heading transform. Shared heading typography remains in
the site's normal stylesheet.

Static HTML is visible by default. Only the initialized root receives
`data-scroll-choreography`; all motion CSS is scoped to that capability. The
section pin uses `overflow: clip`, which does not create an intermediate
scroll container. Do not add `overflow: hidden/auto` to its ancestors.

## Sequence settings

The latest homepage refinement begins before the sticky stage. For Work and
Contact, `pinnedProgress()` maps one continuous range from
`sectionTop - viewportHeight * approach` to `sectionTop + pinRun`. With the
default `approach: .85`, the heading starts revealing as the section's top
reaches 85% of the viewport height. Link stagger begins just after that.

| Setting | Current value | Effect |
| --- | --- | --- |
| `approach` | `.85` | Viewport fraction before the section reaches the top |
| `pin.work` / `pin.contact` | `.68` / `.58` | Extra section height in viewport heights |
| `pin.mobileWork` / `pin.mobileContact` | `.48` / `.44` | Shorter extra height at 700px and below |
| `fly.distanceVw` | `1.35` | Starting travel in viewport widths, beyond the right edge |
| `fly.rotation` | `6.5` | Starting rotation in degrees; settles at zero |
| `fly.start` / `stagger` / `duration` | `.025` / `.14` / `.66` | Fractions of the combined approach and pin range |
| `fly.overshoot` / `overshootAt` | `12` / `.78` | Pixel overshoot and local progress at its turning point |
| `heading.start` / `end` / `rise` | `0` / `.27` / `112` | Masked heading reveal range and starting rise in percent |
| `hero.start` / `end` / `scale` | `.02` / `.90` / `.97` | Hero wrapper fade range and final scale |

The three links finish at section progress `.965`, shortly before release at
`1`. The first segment strongly decelerates; the final segment continuously
returns from the small overshoot to exact alignment. The sticky wrapper remains
at least one viewport tall and releases through ordinary browser layout.

About is unpinned. Its shorter range starts with the section at 88% of viewport
height and ends at 8%. The copy runs from `.045` to `.84`, the More About link
from `.18` to `1`, with travel of `1.12` and `1.04` viewport widths respectively.
All three headings share the same typography and sampling helper; About maps
that helper to its own approach range. Edit these values in
`src/data/motionSettings.js`; CSS spacing and typography live in
`src/homepage.css`.

## Temporary typographic echoes

Work and Contact receive two `.motion-echo` spans per flying label. The spans
are empty, `aria-hidden="true"`, noninteractive and unselectable. Their
`data-echo-text` attribute supplies decorative CSS-generated text; the original
label remains the only semantic text and interaction target. About uses its
ordinary fly-in without extra echo layers.

`trail` in the motion settings controls the effect:

- `layers: 2` caps the effect at two copies.
- `distanceVw: .045` is capped at 64px on desktop and 26px at 700px and below.
- `opacity: .22` and `secondaryOpacity: .13` keep both copies restrained.
- `fadeIn: .08`, `fadeOutStart: .38` and `fadeOutEnd: .82` describe local item
  progress. Displacement contracts cubically and the copies disappear before
  the text reaches its final position.

Both displacement and opacity come from the same local scroll progress as the
original label. Reversing scroll restores the exact earlier echo state;
stopping does not let it drift. There is no blur, RGB separation, duplicate
link or persistent duplication. Section clipping contains offscreen travel.

## Hero depth composition

The existing `#stage` wrapper fades and scales as the hero exits. A separate
camera-only composition in `src/hero-depth.js` adds restrained depth without
writing the sculpture's transforms, quaternions or physics state. The original
infinity movement, rotation, chrome material and tattoo reveal continue.

`src/data/heroDepthSettings.js` contains the camera settings:

| Setting | Current value | Effect at full progress |
| --- | --- | --- |
| `start` / `end` | `.02` / `.92` | Fractions of the hero's scroll-out distance |
| `distance` | `.08` | Increase base camera Z distance by 8% |
| `horizontal` / `vertical` | `.012` / `.005` | Offsets relative to base camera distance |
| `fieldOfView` | `1` | Add one degree to the original 35° field of view |

The offsets use a smooth bounded interpolation, and the camera continues to
look at the origin. Scroll reversal restores its original position and FOV.
Resize caches the hero's document position, height and base camera distance;
updates read the cached values inside the existing hero render loop. Hit
testing updates and uses the same composed camera. The viewport observer and
document-visibility lifecycle still pause WebGL offscreen or in a hidden tab.
No second scene or independent camera animation loop is created. Reduced motion
restores the base camera and removes the wrapper fade/scale.

For diagnostics, each section exposes `data-motion-progress` and
`data-motion-state` (`before`, `active`, `settled` or `focus`). Link wrappers
expose `--kinetic-x`, `--kinetic-rotate`, `--kinetic-opacity`; headings expose
`--heading-y` and `--heading-opacity`. Pin sizes are `--motion-run` and
`--motion-pin-height`. These values are diagnostic output, not content fields.

## Accessibility and performance

Keyboard focus within a section immediately shows its heading and all links
at the final position. This also applies when the router focuses `#contact`
after a Contact anchor jump. The override lasts while focus stays in that
section. It does not alter document height, avoiding native anchor/tab layout
jumps. The Contact and phone pin distances are deliberately shorter.

Below 700px, the ordinary horizontal row scrollbar becomes available as soon
as the sequence settles, or immediately on focus. Keep the base row's minimum
column widths and accessible horizontal scrolling; never replace it with three
stacked rows. Touch scrolling remains entirely native.

`prefers-reduced-motion` skips all pinning, travel, heading masking and hero
fading. A live preference change removes motion attributes and inline variables;
turning motion back on samples the current scroll position. Focus, observers,
event listeners, attributes, styles and queued animation frames are cleaned up
when the page changes.

Scroll events schedule one animation frame and reuse cached section bounds.
Only resize/ResizeObserver callbacks request new layout measurements. Per-value
caching avoids repeated DOM writes at the endpoints. No work runs on a timer
or on every display frame while the page is idle; hidden documents cancel the
pending frame. UI animation uses transform and opacity only.

Run `node --test tests/scroll-motion.test.js tests/hero-depth.test.js` for
endpoint, overshoot, stagger, early approach, echo, camera reversal and
stopped-scroll determinism checks. With the development server
running, `npm run test:motion` checks actual pinned stages, reverse/stopped
poses and echoes, native wheel/touch scrolling, resize, 320/390/768/1920px layout
and live reduced-motion changes. `npm run test:portfolio` also checks Contact anchor focus
and navigation. These browser checks write review screenshots to `artifacts/`.
Current execution results are recorded in [REFINEMENT-REPORT.md](REFINEMENT-REPORT.md).
