# Motion and interaction — V3.1

This document describes the current implementation. The active requirements and
verification status are [V3.1-REFINEMENT.md](V3.1-REFINEMENT.md) and
[PROJECT_PROGRESS.md](../PROJECT_PROGRESS.md). Older fly-in/echo descriptions
and historical browser reports do not establish current V3.1 acceptance.

Native scrolling is the single clock for editorial entrances. Poses are a
function of the current scroll position: reverse scroll reverses them and
stopping freezes them. The controller does not intercept wheel or touch input
and runs no idle animation loop. The accepted hero, physics and memory-mosh
remain separate existing systems.

## Markup and lifecycle

`initScrollChoreography(content)` handles Home's `data-motion` sections and
Work's `.work-group` parent/subcategory headings. It is a no-op on About when
there are no matching motion targets. Dispose it before replacing route content;
styles, generated label wrappers, observers, focus state and scheduled frames
are cleaned up. The module never imports the Three.js hero.

Home Work retains this wrapper structure:

```html
<section class="content-section selected-work" data-motion="work">
  <div class="section-pin">
    <h2 class="kinetic-heading">
      <span class="kinetic-heading-text">01 / WORKS</span>
    </h2>
    <div class="category-strip">
      <a class="category-link" href="/work/tattoos">
        <span class="kinetic-item">
          <span class="category-magnet">tattoos <i class="arrow"></i></span>
        </span>
      </a>
      <!-- jewellery and more share the same structure -->
    </div>
  </div>
</section>
```

Contact uses `data-motion="contact"`, its `.kinetic-heading-text` and one
`.inquiry-enter` wrapper containing the complete form. Title and form receive
identical horizontal displacement and opacity. The former one-shot inquiry
observer is retired. About retains its existing paragraph/link targets:

```html
<p class="about-preview-copy kinetic-item" data-motion-item="copy">…</p>
<a class="text-link kinetic-item" data-motion-item="link" href="/about">MORE ABOUT ↗</a>
```

Outer `.kinetic-item` targets own scroll displacement; inner
`.category-magnet`/`.interaction-visual` targets own hover and magnetic movement.
Semantic hit areas do not move. Static HTML stays visible before enhancement.
Motion CSS is scoped to `data-scroll-choreography`.

## Calm entrances

Settings and pure samplers live in `src/data/motionSettings.js`.
`sampleCalmProgress()` uses bounded smooth interpolation with zero rotation,
no overshoot, no stagger and no decorative copies. Legacy sampler export names
remain thin compatibility adapters; runtime choreography uses the calm helpers.
The old `fly` and trail configuration/runtime are retired.

| Setting | Value | Purpose |
| --- | --- | --- |
| `calm.start` / `end` | `.16` / `.90` | Local content reveal range |
| `calm.distanceVw` / `maximumDistance` | `.055` / `36` | Travel capped at 36px |
| `approach` | `.85` | Home Work starts as its top approaches 85% of viewport height |
| `pin.work` / `pin.mobileWork` | `.68` / `.48` | Existing extra sticky height, in viewport heights |
| `heading.start` / `end` / `rise` | `0` / `.27` / `112` | Retained masked numbered-heading rise, in percent |
| `about.approach` / `finish` | `.68` / `.10` | Shorter unpinned About approach |
| `about.copyStart` / `copyEnd` | `.16` / `.90` | About paragraph's local reveal range |
| `about.linkStart` / `linkEnd` | `.24` / `.98` | Approved modest link offset |
| `hero.start` / `end` / `scale` | `.02` / `.90` / `.97` | Existing hero wrapper fade and final scale |
| `heroBar.start` / `end` | `.02` / `.55` | Controls and hero navigation fade together |

Home Work's three category labels share one pose and enter simultaneously.
Its large numbered heading keeps the existing rise. Native sticky layout still
uses `pinnedProgress()` from `sectionTop - viewportHeight * .85` through
`sectionTop + pinRun`. No viewport-wide flight remains.

Contact is unpinned. Its progress runs from
`sectionTop - viewportHeight * .68` through
`sectionTop - viewportHeight * .10`; title and complete form then use the same
calm sampler. Reverse scroll restores the same previous pose without a
one-shot visible latch. About remains unpinned with its approved paragraph/link
timing and smaller relative inset.

On Work, `.work-group-heading` and every `.archive-category-heading` in that
group share the parent's `.68`–`.10` approach range through
`sampleArchiveHeading()`. Labels arrive together, including On Skin, Flashes,
3D Model, Digital Artworks and Analog Photography. Only their intrinsic child
visual translates; the full-width heading does not widen the page. The Work
category strip separately follows measured brand/INDEX bounds in the shared
navigation controller.

The old exported `pin.contact`/`pin.mobileContact` settings are retained for
compatibility; current Contact rendering does not use them to pin the form.

## Hero bottom bar and depth

Both existing bar halves — `.controls` and `.hero-nav` — share
`--hero-bar-opacity`. They fade fully by hero progress `.55`, become inert and
ignore pointer input while hidden, and restore on reverse scroll. The controller
restores their original inert state on disposal. No bar is moved out of its
original layout. Reduced motion switches opacity immediately at the threshold.

The accepted `#stage` wrapper still fades/scales as the hero exits. Existing
camera-only composition in `src/hero-depth.js` is independent of logo transforms,
quaternions and physics. `src/data/heroDepthSettings.js` retains:

| Setting | Value | Effect at full progress |
| --- | --- | --- |
| `start` / `end` | `.02` / `.92` | Fractions of the hero scroll-out distance |
| `distance` | `.08` | Increase base camera Z distance by 8% |
| `horizontal` / `vertical` | `.012` / `.005` | Offsets relative to base camera distance |
| `fieldOfView` | `1` | Add one degree to the original field of view |

Resize caches geometry and base camera distance; the visible hero's existing
render loop samples the cached values. Reverse restores the original camera;
reduced motion restores its base composition. WebGL remains paused offscreen
or in a hidden document. V3.1 does not replace this accepted behaviour.

## Shared hover, arrows and radius

`src/data/uiEffectSettings.js` publishes the shared hover values once; CSS
surface/type/glow/radius tokens live in `src/ui-tokens.css`.

- Text, large labels and image interiors target at most `1.025` scale.
- Hover/release use 300ms and `cubic-bezier(.2,.8,.25,1)`.
- Magnetic movement is capped at 2px within stationary category/contact targets.
- Glow strength is `.2` of the earlier treatment; Other Side preserves its
  existing restrained white/violet variation.
- Arrows share `.72em` dimensions, 1.25px stroke, a
  `clamp(7px, .22em, 18px)` label gap and at most 2px hover movement.
- `--radius-soft: 4px` covers the named UI surfaces. Images, carousel photos,
  corruption material and the full page canvas remain square.

The same interaction wrappers cover INDEX summary/entries, NAAVI, More About,
footer links/location/counter, form submit, hero controls and gallery controls.
The visit counter is the deliberate exception to the invisible-secret hover
exclusion: it uses the shared hover while retaining its own faint discovery.
Other hidden mode hints keep their independent stationary reveal.

Entry/focus/resize fitting constrains scale and magnetic travel to available
space. An already clipped carousel item is not enlarged further by the generic
hover layer. The existing selected photograph can grow in place to `1.1` under
the carousel controller; its inner hover scale becomes `1`, avoiding doubled
zoom. No website-level zoom or camera movement is introduced by image selection.

The wrapper observer watches child changes and disabled/aria-disabled changes,
so changed control labels and newly available SMASH/gallery buttons are enhanced.
It does not observe animation styles. Touch does not retain mouse hover or
magnets. Reduced motion removes nonessential transforms/transitions while
keyboard focus remains visible.

## Accessibility and performance

Focus on a real descendant field/link immediately exposes its section at rest
without changing section height. Focus on a section container from INDEX,
NAAVI or route navigation **does not** latch the content at rest; reverse scrub
continues to work. Focusout restores the appropriate scroll-derived pose.

The horizontal three-category strip stays horizontal on small screens, with
native local scrolling available when settled or focused. Footer clusters also
scroll locally around NAAVI's reserved centre. Do not replace the categories
with stacked rows, add scroll snap that traps vertical escape, or apply global
scroll padding that moves the hero during control focus.

Reduced motion removes nonessential pinning, travel and heading masking. A
live preference change clears motion attributes/styles and resamples the
current position when animation is re-enabled. The hero bottom bar still uses
its instantaneous hidden/visible state so covered controls remain unreachable.

Scroll events coalesce into one animation frame and reuse cached geometry.
Resize/ResizeObserver, mode changes and visibility restoration request new
measurements. Per-value caching avoids endpoint DOM writes. Hidden documents
cancel pending work. UI motion uses transform and opacity; the shared bounded
hover filter is confined to labels/images, never the whole page or WebGL canvas.
Other Side motion samples feed the existing corruption publisher rather than
creating another rendering system.

Diagnostics include `data-motion-progress`, `data-motion-state`,
`--kinetic-x`, `--kinetic-opacity`, `--heading-x`, `--heading-y`,
`--heading-opacity`, `--archive-heading-x`, `--archive-heading-opacity`,
`--hero-bar-opacity`, `--motion-run` and `--motion-pin-height`. These are output,
not artist-editable content fields.

## Verification

Run affected tests serially. Current V3.1 motion/UI harnesses are:

```sh
node --test tests/scroll-motion.test.js tests/about-motion.test.js tests/hero-depth.test.js
H4_BASE_URL=http://127.0.0.1:5173 node tests/v31-motion-browser.mjs
H4_BASE_URL=http://127.0.0.1:5173 node tests/v31-ui-browser.mjs
H4_BASE_URL=http://127.0.0.1:5173 node tests/v31-navigation-browser.mjs
H4_BASE_URL=http://127.0.0.1:5173 node tests/master-inquiry-browser.mjs
```

The browser harnesses cover actual poses/reversal, parent/subcategory timing,
focus, bar fades, shared surfaces and responsive navigation at 1440/390/320px,
with reduced motion and both realities. Source or prepared harnesses are not
passing results. Actual outcomes, failures, exact preview version and the next
checkpoint belong in [PROJECT_PROGRESS.md](../PROJECT_PROGRESS.md) and
[NEXT_SESSION.md](../NEXT_SESSION.md). Earlier reports such as
[CONTROL-CORRUPTION.md](CONTROL-CORRUPTION.md) and
[REFINEMENT-REPORT.md](REFINEMENT-REPORT.md) are historical where V3.1 supersedes
those behaviours.
