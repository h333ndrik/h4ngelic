# h4ngelic

Artist website with an interactive chrome wordmark, a horizontal typographic category strip, a filterable Work archive, an About page and a homepage contact section. The original hero's geometry, material, physics and cursor are retained. The repository originally contained only a README and `.gitignore`; the supplied screenshot and recording informed the hero implementation. The earlier ChatGPT mockup and original geometry were unavailable, so an exact match to that older version cannot be verified.

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
npm test                 # Content rendering, physics, motion and reveal tests
npm run test:browser     # Run with the dev server active; Chromium required
npm run test:artwork     # Compare the actual reveal on/off at the same 3D pose
npm run test:portfolio   # Page links, filters, history, horizontal mobile layout
npm run build
npm run preview -- --port 4173
npm run preview:export   # Download/open artifacts/h4ngelic-preview.html offline
```

Browser tests default to `/usr/bin/chromium`; override `CHROMIUM_PATH` for another installation. Outside this cloud machine, install Chromium or use Playwright's documented browser installation. `H4_BASE_URL` can change the dev-server test target. Screenshots are saved in ignored `artifacts/`. The production bundle does not expose the `?test=1` development inspection hook.

## Pages and hosting

The site remains a small vanilla-JavaScript/Vite application. Normal anchors navigate to `/work`, `/work?category=tattoos`, `/work?category=jewellery`, `/work?category=paintings`, `/about` and `/#contact`. Refreshing a content route requires the host to serve `index.html` for page paths, while serving existing assets normally. Vite dev/preview provide this HTML fallback. The downloadable offline preview uses hash routes only inside that file; the production website keeps clean URLs.

The Three.js module is loaded only on the homepage, and the hero suspends GPU rendering while scrolled offscreen. Its controls remain anchored inside the hero instead of floating above the new sections. No CMS, backend, database or authentication dependency is needed. The gallery renderer supports multi-image projects, descriptions, years, additional metadata and drafts through the content files; no stock images or fictitious projects are included.

## Wordmark and interaction

The real Three.js text mesh uses shallow extrusion **0.455**, bevel thickness 0.055, and bevel size 0.035. Liberation Sans Bold approximates the sans-serif letters visible in the supplied reference; the original logo font/mesh was not supplied. Its SIL Open Font License is included under `public/fonts/`. Run `node scripts/build-font.mjs` to regenerate the committed subset typeface from the bundled font.

The base layer follows a seamless 15-second horizontal figure eight with one Y turn and two X turns. The independent interaction layer adds displacement and quaternion rotation. Cursor hits derive their impulse from pointer velocity and their torque from the hit location. Dragging uses a damped spring with pointer capture; release preserves momentum. After four seconds of inactivity the extra transform returns over about two seconds. Bounds adapt to the displayed mesh's oriented extent.

On touch devices horizontal dragging moves the wordmark; vertical gestures retain normal page scrolling and cancel the grab. Touch-only devices retain the system pointer. The supplied SVG symbol is at `public/assets/h4ngelic-cursor.svg`, displayed 15% smaller at 27.2×40.8 px with native CSS hotspot `(9, 2)`; its original paths and proportions are preserved. There is no lagging DOM cursor.

Reduced-motion preferences start the base animation paused, disable hover impulses and free drift, and still permit direct grabbing. Visitors can explicitly start animation with Play. If WebGL creation fails or its context is lost, a static wordmark replaces the canvas. Render resolution is capped at 2× on desktop and 1.5× on touch devices.

## Original artwork reveal

The supplied `poster3_backpiece 2.svg` is preserved unchanged as `public/assets/tattoo-original.svg`. It contains an embedded opaque PNG rather than vector paths or transparent outlines. `tattoo-texture.webp` is a 1024×1448 optimized rendering of those original pixels, preserving the composition. The original is not fetched during the hero's normal startup.

The chrome shader derives white line reflections from the artwork's luminance gradients, discarding the white page. Reflection coordinates respond to surface normals and viewing direction. The effect is rendered within the actual mesh material, so it cannot draw outside the wordmark. Reveal opacity follows the **displayed** quaternion, including physical tumbling, around 150° yaw with a smooth 30° fade on either side.

Optional configuration before Vite startup/build:

- `VITE_REVEAL_ANGLE`: target yaw in degrees (default `150`).
- `VITE_TATTOO_ARTWORK_URL`: replacement artwork texture URL (default bundled WebP). The offline export embeds the default assets only.

Real contact destinations and portfolio project entries still need to be added to the content files. The artwork supplied for the chrome reflection is not automatically assigned portfolio metadata. This feature branch is for review; it does not deploy or merge anything.
