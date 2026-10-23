# h4ngelic

Interactive chrome wordmark and artist frontpage. The repository initially contained only this README and a `.gitignore`; the supplied screenshot and 3.85-second recording informed this implementation. The earlier ChatGPT mockup and its source geometry were not available, so an exact match to that earlier version cannot be verified. Work, about and contact remain placeholders at the user's request.

## Development

Use Node.js 24.19.0 (`.nvmrc`; Vite requires Node.js 22.12+).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

Use the existing checkout; cloud tasks are isolated and do not need a separate Git worktree. No credentials, remote APIs or environment variables are required to run the site. All fonts, artwork and rendering assets are hosted locally.

```sh
npm test                 # 15 deterministic physics, motion and reveal tests
npm run test:browser     # Run with the dev server active; Chromium required
npm run test:artwork     # Compare the actual reveal on/off at the same 3D pose
npm run build
npm run preview -- --port 4173
npm run preview:export   # Download/open artifacts/h4ngelic-preview.html offline
```

Browser tests default to `/usr/bin/chromium`; override `CHROMIUM_PATH` for another installation. Outside this cloud machine, install Chromium or use Playwright's documented browser installation. `H4_BASE_URL` can change the dev-server test target. Screenshots are saved in ignored `artifacts/`. The production bundle does not expose the `?test=1` development inspection hook.

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

The exact earlier mockup, existing portfolio implementation and link destinations are still unavailable. This feature branch is for review; it does not deploy or merge anything.
