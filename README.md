# h4ngelic

Artist website with an interactive chrome wordmark, a horizontal typographic category strip, a filterable Work archive, an About page and a homepage contact section. The hero's extrusion, material, motion and physics are retained; resource-aware resolution and tessellation keep it lighter on constrained devices. The repository originally contained only a README and `.gitignore`; the supplied screenshot and recording informed the hero implementation. The earlier ChatGPT mockup and original geometry were unavailable, so an exact match to that older version cannot be verified.

**Inhalte bearbeiten:** [Anleitung für Projekte, Bilder, About und Kontakt](docs/CONTENT.md). Editable data lives in `src/data/artworks.js` and `src/data/siteContent.js`. The archive starts empty and contact destinations stay unset until real projects and addresses are supplied.

**Review-Vorschau:** [Interaktive Offline-Vorschau als ZIP](docs/previews/portfolio-preview.zip) herunterladen, entpacken und `h4ngelic-preview.html` im Browser öffnen. Standbilder: [Homepage](docs/previews/homepage.png), [mobil](docs/previews/mobile.png), [Work](docs/previews/work.png), [About](docs/previews/about.png). Diese Dateien sind ein Review-Snapshot des Feature-Branches; eine neue Vorschau lässt sich mit `npm run preview:export` erzeugen.

## Development

Use Node.js 24.19.0 (`.nvmrc`; Vite requires Node.js 22.12+).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

Use the existing checkout; cloud tasks are isolated and do not need a separate Git worktree. No credentials, remote APIs or environment variables are required to run the site. All fonts, artwork and rendering assets are hosted locally.

```sh
npm test                 # 28 content, physics, motion, quality and image tests
npm run test:browser     # Run with the dev server active; Chromium required
npm run test:artwork     # Compare the actual reveal on/off at the same 3D pose
npm run test:portfolio   # Page links, filters, history, horizontal mobile layout
npm run test:micro       # Magnets, reveals, cursor, rendering pause, 320/390px
npm run test:gallery     # Viewer transitions, keyboard/touch, image races/errors
npm run images:optimize  # Generate responsive WebP files and image dimensions
npm run build
npm run preview -- --port 4173
npm run measure:performance -- --base-url http://127.0.0.1:4173 --label local
npm run preview:export   # Download/open artifacts/h4ngelic-preview.html offline
```

Browser tests default to `/usr/bin/chromium`; override `CHROMIUM_PATH` for another installation. Outside this cloud machine, install Chromium or use Playwright's documented browser installation. `H4_BASE_URL` can change the dev-server test target. Screenshots are saved in ignored `artifacts/`. The production bundle does not expose the `?test=1` development inspection hook.

## Pages and hosting

The site remains a small vanilla-JavaScript/Vite application. Normal anchors navigate to `/work`, `/work?category=tattoos`, `/work?category=jewellery`, `/work?category=paintings`, `/about` and `/#contact`. Refreshing a content route requires the host to serve `index.html` for page paths, while serving existing assets normally. Vite dev/preview provide this HTML fallback. The downloadable offline preview uses hash routes only inside that file; the production website keeps clean URLs.

The Three.js module is imported only when the homepage hero enters the viewport. Work and About never download or initialize the scene. Rendering stops while the hero is offscreen or the document is hidden and resumes without advancing the animation by the hidden interval. Its controls remain anchored inside the hero instead of floating above the new sections. No CMS, backend, database or authentication dependency is needed. The gallery renderer supports multi-image projects, descriptions, years, additional metadata and drafts through the content files; no stock images or fictitious projects are included.

## Restrained UI interactions

The three category labels move at most 3 px under a mouse, inside stationary link hit areas. IntersectionObserver reveals below-hero sections once with opacity and a 10 px rise; keyboard focus reveals content immediately. The artwork viewer uses a native modal dialog, short opacity/scale transitions, asynchronous image decoding, arrow-key navigation, Escape, focus restoration and an image-error state. It is initialized only when artwork exists.

Reduced motion disables the magnetic movement and section reveals and makes viewer transitions immediate. Touch interaction does not activate magnets or the custom cursor. Pointer updates are coalesced to animation frames; section reveals do not install scroll handlers. The bottom-left tagline comes unchanged from the existing hero-tagline feature: “art on skin & beyond”.

Local portfolio and portrait images are automatically converted into responsive WebP variants by `predev` and `prebuild`; original files are preserved. The gallery uses `srcset`, lazy loading, asynchronous decoding and reserved image dimensions. See [content editing](docs/CONTENT.md) for the workflow.

Actual mobile Lighthouse lab results and reproducible settings are in [docs/PERFORMANCE.md](docs/PERFORMANCE.md): homepage **50 → 71**, Work **88 → 100**, with total transfer reduced by **66.7%** and **96.5%** respectively. The homepage uses three runs per build; Work uses one. These software-WebGL measurements are not real-phone frame rates or field Core Web Vitals.

## Wordmark and interaction

The real Three.js text mesh uses shallow extrusion **0.455**, bevel thickness 0.055, and bevel size 0.035. Liberation Sans Bold approximates the sans-serif letters visible in the supplied reference; the original logo font/mesh was not supplied. Its SIL Open Font License is included under `public/fonts/`. Run `npm run assets:hero` to regenerate the committed subset typeface, matching static SVG fallback and compact mobile reflection image. The full source TTF is not downloaded at runtime.

The base layer follows a seamless 15-second horizontal figure eight with one Y turn and two X turns. The independent interaction layer adds displacement and quaternion rotation. Cursor hits derive their impulse from pointer velocity and their torque from the hit location. Dragging uses a damped spring with pointer capture; release preserves momentum. After four seconds of inactivity the extra transform returns over about two seconds. Bounds adapt to the displayed mesh's oriented extent.

On touch devices horizontal dragging moves the wordmark; vertical gestures retain normal page scrolling and cancel the grab. Touch-only devices retain the system pointer. The supplied SVG symbol is at `public/assets/h4ngelic-cursor.svg`, displayed 15% smaller at 27.2×40.8 px with native CSS hotspot `(9, 2)`; its original paths and proportions are preserved. Native hover (+6%) and pressed (−4%) variants add subtle size feedback with aligned hotspots. Reduced motion keeps the default size. There is no lagging DOM cursor.

Reduced-motion preferences start the base animation paused, disable hover impulses and free drift, and still permit direct grabbing. Visitors can explicitly start animation with Play. The matching static SVG stays visible until the first rendered frame and remains the fallback if WebGL fails. Render resolution is capped at 2× on desktop, 1.5× on touch devices and 1× when low memory, few CPU cores or Save-Data indicate constrained resources. That profile also reduces environment-map size and tessellation and disables antialiasing. Sustained low frame rates can lower resolution further, without changing the chrome material, motion or physics.

## Original artwork reveal

The supplied `poster3_backpiece 2.svg` is preserved unchanged as `public/assets/tattoo-original.svg`. It contains an embedded opaque PNG rather than vector paths or transparent outlines. `tattoo-texture.webp` is a 1024×1448 optimized rendering of those original pixels, preserving the composition. Mobile and constrained devices use the 640×905 `tattoo-texture-640.webp` variant. The original SVG is not fetched during the hero's normal startup.

The chrome shader derives white line reflections from the artwork's luminance gradients, discarding the white page. Reflection coordinates respond to surface normals and viewing direction. The effect is rendered within the actual mesh material, so it cannot draw outside the wordmark. Reveal opacity follows the **displayed** quaternion, including physical tumbling, around 150° yaw with a smooth 30° fade on either side.

Optional configuration before Vite startup/build:

- `VITE_REVEAL_ANGLE`: target yaw in degrees (default `150`).
- `VITE_TATTOO_ARTWORK_URL`: replacement artwork texture URL (default bundled WebP). The offline export embeds the default assets only.

Real contact destinations and portfolio project entries still need to be added to the content files. The artwork supplied for the chrome reflection is not automatically assigned portfolio metadata. This feature branch is for review; it does not deploy or merge anything.
