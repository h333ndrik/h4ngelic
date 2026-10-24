# h4ngelic

Artist website with an interactive chrome wordmark, a horizontal typographic category strip, a filterable Work archive, an About page and a homepage contact section. The hero's extrusion, material, motion and physics are retained; resource-aware resolution and tessellation keep it lighter on constrained devices. The repository originally contained only a README and `.gitignore`; the supplied screenshot and recording informed the hero implementation. The earlier ChatGPT mockup and original geometry were unavailable, so an exact match to that older version cannot be verified.

**Inhalte bearbeiten:** [Anleitung für Projekte, Bilder, About und Kontakt](docs/CONTENT.md). Editable data lives in `src/data/artworks.js` and `src/data/siteContent.js`. The archive starts empty and contact destinations stay unset until real projects and addresses are supplied.

**Aktueller Stand — [Refinement 09 / Control vs. Corruption](docs/REFINEMENT-09.md):** `4` oder Numpad `4` mindestens eine Sekunde halten, um The Other Side zu öffnen. Drei getrennte `3`-Drücke innerhalb von zwei Sekunden führen zurück. Der kurze Übergang zerlegt echte Browser-Aufnahmen der sichtbaren Website einschließlich Schrift und geöffneten Bildern. Dazu kommen lebende chemische Filmflächen, stärkere bildbasierte Cursor-Schlieren, exakt konturgleiche farbige Cursor/Favicons und verankerte mehrfarbige Tintenflecken. Normal Mode bleibt `#303033`; Hero, Geometrie, Physik und bestehender Klang bleiben erhalten. Sound sitzt bei den oberen Hero-Steuerungen.

**HTML-Vorschau ohne ZIP:** [Einzelne HTML-Datei](docs/previews/h4ngelic-preview.html) herunterladen und im Browser öffnen. Sie enthält die vollständige interaktive Website und benötigt kein Internet. Alternativ: [ZIP herunterladen](docs/previews/portfolio-preview.zip), entpacken und die HTML-Datei öffnen.

**Aktuelle Standbilder:** [Homepage](docs/previews/ref09/home-1440-normal.png), [mobil](docs/previews/ref09/home-390-normal.png), [The Other Side](docs/previews/ref09/home-1440-other.png), [echter Datamosh-Zwischenstand](docs/previews/ref09/native-datamosh-390.png), [Work](docs/previews/ref09/work-normal.png) und [About](docs/previews/ref09/about-normal.png). Prüfung, Messwerte, Grenzen und konfigurierbare Parameter stehen in [REFINEMENT-09.md](docs/REFINEMENT-09.md). `npm run preview:export` erzeugt einen neuen Offline-Export. Die älteren Vorschauen und Berichte dokumentieren vorherige PR-Stände; [LOADING-REFINEMENT.md](docs/LOADING-REFINEMENT.md) enthält den historischen Ladevergleich.

## Development

Use Node.js 24.19.0 (`.nvmrc`; Vite requires Node.js 22.12+).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

Use the existing checkout; cloud tasks are isolated and do not need a separate Git worktree. No credentials, remote APIs or environment variables are required to run the site. All fonts, artwork and rendering assets are hosted locally.

```sh
npm test                 # Content, routing, physics, quality and image tests
npm run test:browser     # Run with the dev server active; Chromium required
npm run test:artwork     # Compare the actual reveal on/off at the same 3D pose
npm run test:portfolio   # Page links, filters, history, horizontal mobile layout
npm run test:micro       # Magnets, reveals, cursor, rendering pause, 320/390px
npm run test:gallery     # Viewer transitions, keyboard/touch, image races/errors
npm run test:artwork-transitions # Shared gallery/detail image transitions and fallbacks
npm run test:seo         # Prerendered HTML, metadata, strict HTTP status, robots
npm run test:motion      # Pinning, reverse/stop poses, native wheel/touch, resize
npm run test:navigation  # Lazy-import races, one scene, scroll history, fallback
npm run test:easter      # Document-anchored ink, hidden text, visits and storage failures
npm run test:xray        # Public hold/touch switching, return, hint and navigation
npm run test:master      # Full combined motion/navigation/fixture/media checks
npm run test:mode-audio  # Real Web Audio, mute and unsupported-audio fallback
npm run test:hover       # Shared scale/glow, arrows and responsive bounds
npm run test:corruption  # Actual sampled pixels, recovery and lifecycle
npm run test:material    # Cold material load, real mesh change and exact chrome restoration
npm run sounds:export    # Review WAVs from the same runtime PCM/settings
npm run images:optimize  # Generate responsive WebP files and image dimensions
npm run build
npm run preview -- --port 4173
npm run measure:performance -- --base-url http://127.0.0.1:4173 --label local
npm run preview:export   # Download/open artifacts/h4ngelic-preview.html offline
```

Browser tests default to `/usr/bin/chromium`; override `CHROMIUM_PATH` for another installation. Outside this cloud machine, install Chromium or use Playwright's documented browser installation. `H4_BASE_URL` can change the dev-server test target. SEO checks use `H4_PREVIEW_URL` and require the built strict preview server; add `H4_EXPECT_DEPLOYMENT=production` only for an explicitly built production configuration. Screenshots are saved in ignored `artifacts/`. The production bundle does not expose the `?test=1` development inspection hook.

## Pages and hosting

The site remains a small vanilla-JavaScript/Vite application. Normal anchors navigate to `/work`, `/work/tattoos`, `/work/jewellery`, `/work/paintings`, `/about` and `/#contact`. Existing `/work?category=…` bookmarks redirect to their canonical category path. Published artworks get `/work/{category}/{id}` URLs. The downloadable offline preview uses hash routes only inside that file; the production website keeps clean URLs.

The production build prerenders genuine HTML for every published route, plus `404.html`, `sitemap.xml` and `robots.txt`. Work and About remain readable without JavaScript. `npm run preview` serves these documents with actual 404 responses and legacy redirects. A production host must serve the generated directory indexes and its 404 document rather than rewrite all missing paths to the homepage. See [SEO and hosting](docs/SEO.md) and [architecture decisions](docs/ARCHITECTURE.md).

JavaScript progressively enhances those anchors with short native View Transitions, retained document state, keyboard focus transfer and back/forward scroll restoration. Unsupported or reduced-motion browsers update immediately; a rendering failure falls back to ordinary document navigation. Direct URLs, refreshes and no-JavaScript navigation retain the prerendered documents. A delayed homepage module also waits for the visible hero before creating WebGL, so leaving during its download cannot initialize a scene on Work.

Metadata is edited in `src/data/seoContent.js`; the confirmed canonical origin is `https://h4ngelic.com`. Builds default to **preview** (`noindex`). A future production build explicitly uses `H4_DEPLOYMENT=production npm run build`; this does not deploy anything. Empty archives and incomplete projects remain excluded from indexing and the sitemap. No training-crawler policy is added or changed.

The Three.js module is imported only when the homepage hero enters the viewport. Work and About never download or initialize the scene. Rendering stops while the hero is offscreen or the document is hidden and resumes without advancing the animation by the hidden interval. Its controls remain anchored inside the hero instead of floating above the new sections. No CMS, backend, database or authentication dependency is needed. The gallery renderer supports multi-image projects, descriptions, years, additional metadata and drafts through the content files; no stock images or fictitious projects are included.

## Motion and shared interactions

The homepage has three matching large headings: “01 / SELECTED WORKS”, “02 / ABOUT” and “03 / CONTACT”. Work and Contact remain horizontal three-column strips on an uninterrupted charcoal surface, without section lines, link boxes or hover panels. Their reversible timeline begins when the section approaches approximately 85% of the viewport height and continues through a shorter native sticky interval. Labels fly from beyond the right edge with scroll-based staggering, slight rotation and controlled overshoot. Up to two low-opacity monochrome echoes shrink and disappear before the final crisp position. About uses a shorter unpinned sequence. Parameters are in `src/data/motionSettings.js`; see [MOTION.md](docs/MOTION.md).

The hero combines its existing wrapper fade/scale with a small camera distance, perspective and position change: at most 8% more camera Z distance and one additional degree of field of view. `src/hero-depth.js` runs inside the existing visible-hero render loop and reads cached geometry. It never writes the logo’s animation transforms or physics state. Scroll reversal restores the original camera, and reduced motion disables this composition. Settings are in `src/data/heroDepthSettings.js`; [MOTION.md](docs/MOTION.md) explains the editable values and echo timing.
Category, configured Contact and important navigation labels retain their at-most-3px magnetic movement inside stationary hit areas. Shared inner wrappers also scale suitable labels to 122%, large category/contact labels toward 120% only where their column has room, and photographs to 108%. White hover glow in Normal Mode becomes stronger white/green/violet/magenta glow in The Other Side. Invisible secret hotspots are excluded. Arrows share geometry, stroke and a close responsive gap to their labels. `MORE ABOUT` is larger at 24–44px. Settings live in `src/data/uiEffectSettings.js`. Real archive photographs link to their canonical artwork detail URLs. Supported browsers pair the selected photograph across the page transition; browser Back can return it to its archive position while restoring scroll. Detail photographs open the native modal viewer with an aspect-preserving expansion/return, asynchronous decoding, arrow-key navigation, Escape, focus restoration and an image-error state. Reduced-motion and unsupported browsers retain ordinary links and immediate/simpler presentation. The reusable architecture activates when genuine project images are added; the empty archive contains no stock placeholders. See [ARTWORK-TRANSITIONS.md](docs/ARTWORK-TRANSITIONS.md).

Reduced motion disables dramatic choreography and nonessential pinning and makes viewer transitions immediate. Keyboard/anchor focus immediately reveals its section without changing pin geometry. Touch interaction does not activate magnets or the custom cursor. Pointer updates are coalesced to animation frames; scroll work uses cached geometry and one scheduled frame per update. The bottom-left tagline comes unchanged from the existing hero-tagline feature: “art on skin & beyond”.

Local portfolio and portrait images are automatically converted into responsive WebP variants by `predev` and `prebuild`; original files are preserved. The gallery uses `srcset`, lazy loading, asynchronous decoding and reserved image dimensions. See [content editing](docs/CONTENT.md) for the workflow.

Real below-fold images receive an IntersectionObserver mask/rise reveal; keyboard focus unmasks them immediately. The first critical detail image stays unmasked for loading performance. No image effect or viewer is created for the empty archive.

## Hidden messages, local memory and ink

The returning-visitor message remains at the exact horizontal center of the hero header, independently of the unchanged identity/location labels. Copy is 14px on desktop and 12px on mobile. Hover/tap reveals it at 35% opacity for roughly two seconds; keyboard focus keeps it fully readable.

The latest request enables local visitor memory by default. Only `{ count, lastSeen }` is stored under `h4ngelic.visits.v1`; 30 minutes of separated inactivity creates a new visit, while reloads and internal navigation preserve it. No identifier, external analytics, backend or login is used. Storage failures retain the greeting fallback. `visits.enabled: false` opts out without accessing storage, and `visits.requireConsent: true` restores the optional host consent gate.

After Contact, the 30svh secret area holds `HOLD 4 TO SEE THE OTHER SIDE.` at 40% of its height; in the alternate mode the same position reads `HOLD 4 TO REVERSE.`. Touch/pointer holding provides the discreet one-second alternative; native button activation remains available for keyboard and assistive technology. A separate hidden `VISIT 001` counter sits at the bottom center of the homepage footer. The small `sound on/off` control mutes transition audio. See [EASTER-EGGS.md](docs/EASTER-EGGS.md).

Blank clicks/taps leave fresh procedural liquid stains with irregular contours, internal gaps and satellite droplets. Marks use document coordinates and scroll with their creation location. They live for 6–12 seconds, are capped at twelve, and completely clean up afterward. Normal Mode uses off-white pigment; The Other Side uses its corrupted colors. Links, controls, dialogs, the hero canvas and scrolling gestures are excluded.

## The other side — active

`src/data/featureFlags.js` now has `otherSideEnabled: true`, following the new master brief. `src/xray.js` owns document-memory mode state. Main-keyboard/numpad `4` requires a continuous 1,000ms hold; short taps never accumulate, key repeats do not toggle twice, and blur, hidden state, typing or navigation cancels an unfinished hold. The state survives enhanced navigation without starting the Three.js hero on interior pages.

The 650ms visual transition combines non-monotonic color curves, channel separation, a damaged-film surface and the existing wordmark material hook. The original h4 cursor remains recognizable. Dedicated Canvas2D regions resample actual film/photo pixels and previous damaged pixels for macroblock displacement and horizontal temporal smearing. At most two anchored regions recover after movement; no arbitrary DOM screenshotting, particles or second Three.js scene is used. Reduced motion disables interactive corruption and elaborate motion.

Related 0.7-second metallic-glass cues are synthesized locally through Web Audio. The input gesture primes audio, the actual mode change starts it, repeated changes stop the previous voice, and the footer mute option remains available. Unsupported/denied audio never prevents switching. No audio download is required.

Effect strength is edited in `src/data/corruptionSettings.js`; palette/curves and hold/transition timing in `src/data/xraySettings.js`; sound in `src/data/modeAudioSettings.js`. [XRAY.md](docs/XRAY.md) documents the implementation, limits and reference provenance. The earlier postponed-mode decision and PR-10 measurements remain historical in [REFINEMENT-REPORT.md](docs/REFINEMENT-REPORT.md).

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
