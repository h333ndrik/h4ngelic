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

- `pin.work` / `pin.contact`: additional section height in viewport heights.
  The defaults are 1.12 and .95. Below 700px they shorten to .68 and .60.
  The sticky wrapper itself is at least one viewport tall. At the end of the
  additional distance it releases through ordinary browser layout.
- `fly.distanceVw`: starting horizontal travel in viewport widths, currently
  1.5. `rotation` starts at 6.5 degrees and reaches zero.
- `fly.start`, `stagger`, `duration`: fractions of the pin's additional scroll
  distance. The last item must finish before progress 1, when the pin releases.
  The default three-item endpoint is .93.
- `fly.overshoot`: the brief distance past the final column position, currently
  14px. `overshootAt` is the local progress at that turning point. The first
  segment decelerates; the final segment returns continuously to exactly zero.
- `heading`: masked upward reveal before the pinned link sequence. All three
  headings use the same sampling helper. About maps it to its shorter,
  unpinned approach range.
- `about`: paragraph/link entrance ranges and smaller travel distances.
- `hero`: fade/scale applied to the existing `#stage` wrapper as the hero exits.
  The original scene animation continues while visible; its existing viewport
  observer still owns pausing WebGL. No scene material, geometry, rotation or
  interaction state is changed here.

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

Run `node --test tests/scroll-motion.test.js` for endpoint, overshoot, stagger,
reverse and stopped-scroll determinism checks. With the development server
running, `npm run test:motion` checks actual pinned stages, reverse/stopped
poses, native wheel/touch scrolling, resize, 320/390/768/1920px layout and live
reduced-motion changes. `npm run test:portfolio` also checks Contact anchor focus
and navigation. These browser checks write review screenshots to `artifacts/`.
