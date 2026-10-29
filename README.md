> Continuation: read [AGENTS.md](AGENTS.md), [PROJECT_PLAN.md](PROJECT_PLAN.md),
> [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) and [NEXT_SESSION.md](NEXT_SESSION.md)
> before editing. The active scope is the [V3.1 refinement brief](docs/V3.1-REFINEMENT.md)
> with the user's correction to use all eight supplied Tattoo photographs.
> The progress files distinguish implemented changes from current verification.

# h4ngelic

Artist website with an interactive chrome wordmark, a horizontal typographic category strip, a connected Work archive, an About page and the inquiry form at Home `03 / CONTACT`. It uses vanilla JavaScript, Vite and Three.js. Existing hero geometry, chrome, figure-eight movement, rotation physics and the accepted memory-mosh experience are retained.

INDEX and NAAVI are separate: the top-right `+` opens the numbered `00 /`–`04 /` menu; bottom-centre NAAVI follows the current page's section stops. Home exposes Home, Works, About, Contact and the final secret; Work follows Tattoos, Jewellery and More. Contact links return to the homepage form.

The three main categories are `tattoos`, `jewellery` and `more`. On Skin contains **all eight genuine supplied JPEG photographs**, committed unchanged at `public/images/tattoos/tattoo-01.jpg` through `tattoo-08.jpg`, in a native horizontal carousel. The green-and-black original remains a Digital Artwork with a smaller responsive preview and no Ink-Reveal. Other collections show `archive in progress.` until genuine work is supplied. No stock images or invented project descriptions are included.

**Edit content:** [Projects, images, About, contact and soundtrack](docs/CONTENT.md). Central data lives in `src/data/artworks.js` and `src/data/siteContent.js`. [Tattoo provenance](docs/assets/tattoo-originals-v31.json) records each original's filename, dimensions and SHA-256. Instagram and `h4ngelic@gmail.com` are configured; actual mail delivery still needs server configuration. The `h4 moshlab ↗` footer link is the approved accessible `#` placeholder until its real destination is supplied. H4 MOSH LAB itself is outside this refinement.

The V3.1 source uses calm reversible section entrances, restrained shared hover, a hidden right-footer `VISIT 0000` counter, borderless hero controls and one shared 4px UI radius. Photos and corruption surfaces keep square edges. The approved SMASH MP3 is public and unchanged; it loads on first use and plays through the central audio controller with fades, sound ducking, global mute/volume and route/mode continuity. The previous private-only soundtrack restriction is superseded by the user's explicit approval.

**Downloadable preview:** [HTML](docs/previews/h4ngelic-preview.html) · [ZIP](docs/previews/portfolio-preview.zip). Download the HTML and open it in a browser, or extract the ZIP first. GitHub's source view does not run the website. The files are self-contained for offline use; see [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) for the exact version, hash and matching checks. The current V3.1 export has passed production-route and exact-byte offline checks in Chromium at 1440/390/320px, including native touch and actual embedded SMASH playback.

## Development

Use Node.js 24.19.0 (`.nvmrc`; Vite requires Node.js 22.12+).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

Use the existing checkout; cloud tasks do not need a second worktree. No credentials, remote APIs or environment variables are required to run the frontend. Fonts, artwork and rendering assets are local. The inquiry backend has separate server-only mail configuration: [INQUIRY.md](docs/INQUIRY.md).

```sh
npm test
npm run images:optimize
npm run build
npm run preview -- --port 4173
npm run preview:export
npm run preview:package
```

`predev` and `prebuild` generate responsive WebP derivatives while preserving original bytes. `preview:export` builds `artifacts/h4ngelic-preview.html`; packaging checks the exact original Digital Artwork and approved soundtrack before updating the downloadable files.

Run browser suites **serially**, without asset preparation/builds changing a live development page. Current V3.1 harnesses are:

```sh
H4_BASE_URL=http://127.0.0.1:5173 node tests/v31-navigation-browser.mjs
H4_BASE_URL=http://127.0.0.1:5173 node tests/footer-v31-browser.mjs
H4_BASE_URL=http://127.0.0.1:5173 node tests/v31-motion-browser.mjs
H4_BASE_URL=http://127.0.0.1:5173 node tests/v31-ui-browser.mjs
H4_BASE_URL=http://127.0.0.1:5173 node tests/master-inquiry-browser.mjs
H4_BASE_URL=http://127.0.0.1:5173 node tests/sound-controls-browser.mjs
H4_BASE_URL=http://127.0.0.1:5173 H4_SMASH_NATURAL_END=1 node tests/smash-v31-browser.mjs
npm run test:drift
npm run test:gallery
H4_PREVIEW_URL=http://127.0.0.1:4173 node tests/seo-browser.mjs
npm run test:standalone
```

The Digital payload harness `tests/v31-digital-payload-browser.mjs` compares separately served before/after production builds; preserve its recorded baseline until measurement is complete. Run the full real soundtrack's natural-end check rather than shortening or seeking the supplied audio. Commands are not test results; current outcomes, failures and next actions are in the progress files.

Browser tests default to `/usr/bin/chromium`; override `CHROMIUM_PATH` for another installation. `H4_BASE_URL` selects the development test target. SEO checks use `H4_PREVIEW_URL` and the built strict preview server. Screenshots and machine-readable reports go under ignored `artifacts/`; selected verified evidence can be copied into documentation. Additional component/regression commands are listed in `package.json`. The production bundle does not expose the `?test=1` inspection hook.

## Pages and hosting

Normal anchors navigate to `/work`, `/work/tattoos`, `/work/flashes`, `/work/jewellery`, `/work/more`, `/work/analog-photography`, `/work/digital-artworks`, `/about` and `/#contact`. `/work/paintings` remains a legacy archive. Existing `/work?category=…` bookmarks redirect to canonical category paths. Published artworks get `/work/{category}/{id}` URLs. The offline file alone uses hash routes.

The build prerenders HTML for published routes, plus `404.html`, `sitemap.xml` and `robots.txt`. Work and About remain readable without JavaScript. `npm run preview` serves actual 404 responses and legacy redirects; a production host must serve generated directory indexes and its 404 document rather than rewrite every missing path to Home. See [SEO and hosting](docs/SEO.md) and [architecture](docs/ARCHITECTURE.md).

Progressive navigation retains document state, keyboard focus and back/forward scroll restoration. Unsupported or reduced-motion browsers use simpler updates; failures fall back to normal navigation. Metadata lives in `src/data/seoContent.js`, with canonical origin `https://h4ngelic.com`. Builds default to preview `noindex`. `H4_DEPLOYMENT=production npm run build` only builds files; this pass does **not** merge or deploy. Empty archives and incomplete untitled projects stay excluded from indexing and the sitemap.

The Three.js hero is lazy-imported only for the visible homepage. Cold Work and About routes do not download or initialize it. Rendering pauses outside the viewport and while the document is hidden. An optional validated Flash mannequin has its own deferred path and remains inactive without genuine configured content. No CMS, database or authentication dependency is needed.

## Motion and shared interactions

Home's `01 / WORKS`, `02 / ABOUT` and `03 / CONTACT` share the existing editorial structure. Work retains a short native sticky interval and its numbered heading rise. Its category labels now enter **simultaneously** from the right over a bounded distance, without rotation, stagger, overshoot or echoes. Contact's title and form share that calm reversible pose; About keeps its approved paragraph/link timing. Work's parent and subcategory labels share their group's progress. Settings and lifecycle details are in [MOTION.md](docs/MOTION.md).

Shared inner visuals use at most `1.025` scale, 300ms timing and a restrained glow. Magnetic category/contact movement is capped at 2px inside stationary hit areas; geometry fitting keeps labels within their available space. The existing selected carousel photograph can enlarge in place to `1.1` without multiplying the inner hover scale. Arrows share geometry and close spacing. Reduced motion removes nonessential movement; touch does not activate mouse magnets or the custom cursor. INDEX, NAAVI, footer links/counter, form submit and hero controls reuse this interaction language.

One `--radius-soft: 4px` token applies to form fields, INDEX, hero controls/volume popup, NAAVI, the artwork dialog and hint surfaces. Photographs, Digital Artwork images, corruption effects and the page canvas remain unrounded. Digital archive/detail previews use approximately half their former width and advertise matching 320/640px variants, with reserved dimensions and lazy loading. Actual payload comparisons belong in the test record, not inferred percentage claims.

Viewer transitions preserve image proportions, asynchronous decoding, keyboard/touch navigation, Escape and focus restoration. Horizontal Drift keeps native horizontal scroll and vertical page escape without scroll snap. Detailed workflows: [ARTWORK-TRANSITIONS.md](docs/ARTWORK-TRANSITIONS.md), [CONTENT.md](docs/CONTENT.md).

## Footer memory and sound

The right footer cluster contains the hidden `VISIT 0000` counter, SMASH, Instagram and `berlin, de`; the left cluster contains branding and `h4 moshlab ↗`. NAAVI keeps its reserved centre and shares their baseline. At narrow widths the clusters can scroll locally so readable targets remain reachable without whole-page overflow.

Only `{ count, lastSeen }` is stored locally under `h4ngelic.visits.v1`. Thirty minutes of inactivity creates a separated visit; internal navigation does not increment it. All seven former returning-visitor phrases are removed. The counter uses the final hint's subtle hover/focus/tap reveal with no layout shift. `visits.enabled: false` disables storage; `requireConsent: true` restores the optional host gate. No external analytics or identifier is used.

The spacious final section reveals the exact h4 silhouette behind `HOLD 4 TO SEE THE OTHER SIDE.`; in The Other Side it reads `HOLD 4 TO REVERSE.`. Desktop `4`/Numpad `4` requires a continuous one-second hold in either direction; `333` also returns. Touch retains the separate four-tap/three-tap h4 control. Short holds, typing, blur and navigation cancel incomplete activation. INDEX and NAAVI stay independent of this interaction.

The exact `public/audio/h4ngelic_v8_full_sound_remaster_v11.mp3` is 3,210,973 bytes, SHA-256 `307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b`. SMASH fetches/decodes it only on the first trusted activation and reuses the cache. The central controller schedules a 1.8s fade-in, the final approximately five-second fade-out and a one-second manual stop, restoring site sounds after stop/end. Global mute/volume apply to the complete mix; navigation and mode changes retain the track. The downloadable HTML includes the approved bytes for offline playback, while decoding still waits for a gesture. This embedding inherently increases the downloaded HTML's size.

## The Other Side and ink

The accepted Living Decay backplane retains damaged pixels, palette history and displacement scars across navigation and resizing. Scroll, logo/text movement, hover, clicks and navigation feed the existing bounded corruption system; the strongest mode transitions damage actual visible page snapshots. Mode switching, the final h4 bridge and the chrome hero remain intact. Reduced motion uses the existing simpler fallback. Settings live in `src/data/corruptionSettings.js`, `xraySettings.js` and `livingDecaySettings.js`.

Blank clicks/taps on suitable background areas leave bounded, temporary procedural ink marks. Links, controls, dialogs and scrolling gestures are excluded; actual mesh hits retain 3D paint/drag priority. Digital Artwork uses the ordinary gallery without Ink-Reveal. The isolated `?playground=1` experiments, H4 MOSH LAB, WORLD, mannequin and Flowfield work are outside this refinement. Background implementation notes remain in [LIVING-DECAY.md](docs/LIVING-DECAY.md), [DATAMOSH-EXPERIENCE.md](docs/DATAMOSH-EXPERIENCE.md), [MOBILE-INTERACTIONS.md](docs/MOBILE-INTERACTIONS.md) and [END-REVEAL.md](docs/END-REVEAL.md); older measurements are historical unless the current progress record identifies a rerun.

## Wordmark and original reflection artwork

The Three.js text mesh retains extrusion **0.455**, bevel thickness 0.055 and bevel size 0.035. Liberation Sans Bold approximates the supplied reference lettering because the original font/mesh was not supplied; its SIL Open Font License is in `public/fonts/`. `npm run assets:hero` regenerates the committed subset typeface, static fallback and compact reflection texture. The full source TTF is not downloaded at runtime.

The base layer follows a 15-second horizontal figure eight with one Y turn and two X turns. Its independent physical layer adds cursor impulses, displacement and quaternion rotation. Dragging uses a damped spring and pointer capture; release retains momentum. After four seconds of inactivity, extra motion returns over about two seconds. Touch permits horizontal grabbing while vertical gestures scroll the page. The lower-left tagline remains the current approved `mixed media` text.

The exact supplied h4 cursor paths remain intact. V3.1 reduces all six native variants by a further 5%; the base is now 25.84×38.76px with hotspot `(9, 2)`. Hover and pressed variants retain aligned hotspots; NAAVI uses the primary h4 interactive variant. Reduced motion keeps the base size; touch uses the system pointer. There is no lagging DOM cursor.

Reduced motion starts base animation paused, with explicit Play still available. The matching SVG stays visible until the first WebGL frame and provides a failure fallback. Resolution caps remain 2× desktop, 1.5× touch and 1× on constrained devices, with reduced environment/tessellation quality where appropriate. Sustained low frame rates may lower resolution without changing chrome, motion or physics.

The supplied `poster3_backpiece 2.svg` is preserved as `public/assets/tattoo-original.svg`. Its embedded opaque PNG is represented by local 1024×1448 and mobile 640×905 WebP textures. The chrome shader derives white reflection lines from luminance gradients inside the actual mesh, responding to displayed orientation, including physical tumbling, around 150° yaw with a smooth 30° fade. The SVG is not fetched during normal hero startup.

Optional configuration before startup/build:

- `VITE_REVEAL_ANGLE`: target yaw in degrees, default `150`.
- `VITE_TATTOO_ARTWORK_URL`: replacement texture URL; offline export embeds the defaults.

This branch is for review. No launch, merge, deployment, main change or `api/inquiry.js` edit is part of V3.1.
