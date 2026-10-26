# V6 implementation: navigation, inquiry and isolated effects

Current feature branch: `feat/v6-navigation-inquiry`.
Checkpoint before V6: `b9142dc` on `feat/spatial-archives-hidden-relief`.
This is the working V6 plan and acceptance record. Earlier validation reports
describe earlier commits; they do not establish that the V6 changes pass.
No merge, production deployment or external email delivery is implied.
The checkpoint is remotely reviewable in
[PR #15](https://github.com/h333ndrik/h4ngelic/pull/15). Its
[historical validation](SPATIAL-MASTER-VALIDATION.md) includes the complete
pre-V6 relief/offline checks, an intermittent native-touch overload failure
and a one-run-per-route Lighthouse baseline; none is relabelled as V6 proof.

## Actual repository and preserved foundation

- Vite 8, ordinary JavaScript/DOM templates and CSS; Three.js is the only
  production dependency. There is no React, CMS, database or authentication.
- `src/pages.js` renders shared semantic HTML for the browser and the static
  build. `src/routes.js`, `navigation.js` and `app.js` handle real links,
  History API navigation, focus and scroll restoration.
- The production build prerenders routes, metadata, JSON-LD, sitemap, robots
  and a genuine 404. Preview indexing remains disabled; the confirmed
  production origin is `https://h4ngelic.com`.
- The homepage hero lazily imports the existing Three.js entry only when
  visible. Preserve its chrome geometry, extrusion, infinity movement,
  rotation/interaction physics and pause/quality controls.
- Existing h4 cursor/favicon assets, native captured-page mode transitions,
  document ink, visitor memory, final exact-monogram relief, image viewer,
  Horizontal Drift and Digital ink reveal are reused.
- Other Side material history and bounded image-memory scars already exist.
  They are a foundation for the isolated V6 experiment, not evidence that its
  stronger accumulation or prolonged performance has been approved.
- `scripts/serve-preview.mjs` is a local static GET/HEAD server. No submission
  backend, mail provider, production host integration or credentials existed
  at the audit checkpoint.

## Ordered implementation

| Phase | Smallest safe change | Validation gate |
| --- | --- | --- |
| A / audit | Inspect source/assets, preserve checkpoint, record baseline/build/test context. | Keep historical and new measurements separate. |
| B / P1 | Shared compact INDEX with exactly Home, Work, About, Contact; Home brand link; derive a homepage-only bottom-center chapter counter from real sections; connected WORK anchor navigation and legacy URL compatibility; direct jumps bypass delayed entrances. | Navigation, reload/history, keyboard, touch, 320/390px, mode/scroll preservation. |
| C / P1.5 | Isolated development playground reusing the actual material system; cumulative click/pointer/scroll damage, continuous bounded idle evolution and varied rupture transitions. Keep the working public effect intact during validation. | Actual image damage persists, retained navigation history, new entry seed, reduced effects, cleanup and prolonged resource observations. Do not automatically promote experiments globally. |
| D / P2 Work | One vertical WORK flow: Tattoos (Tattoos/Flashes), Jewellery, More (Analog/Digital). Reuse shared galleries, native scrolling, direct anchors and existing modal/FLIP context restoration. | Mouse, wheel, trackpad, swipe, keyboard, boundary release and exact viewer return. |
| E / P2 inquiry | Shared editorial form, real labels/validation, optional message and artwork context, multiple validated image/PDF attachments, removal, accessible progress/errors, bounded secure server adapter. | Real backend acceptance and email delivery are separate claims; test both only where configured. |
| F / P3 | Approved copy, `mixed media` tagline, Instagram, coherent footer, later reversible About/form entrance, direct-jump bypass, shared arrows/glow and faint timed HOLD 4 hint. | Readability, layout/focus stability, reduced motion, SEO/static HTML and representative browser/performance checks. |

## Implemented source awaiting the V6 verification gates

| Area | Actual implementation | Status |
| --- | --- | --- |
| Global navigation / chapters | `index.html`, `global-navigation.js`/`.css`, `global-navigation-state.js`, `app.js`: one compact shared INDEX, actual-page active state, derived homepage chapter control and route refresh. | Implemented; complete responsive/history/browser acceptance remains pending. |
| Connected WORK / direct URLs | `pages.js`, `routes.js`, `navigation.js`, `connected-work.js`, `archive-structure.css`, `app.js`: all three main groups stay in one document, new navigation uses real Work fragments, old category/project URLs remain supported. Homepage child links are removed. | Implemented; final input/context restoration checks remain pending. |
| Reality controls / hidden hint | `xray.js`, existing shortcut/tap binders and hint styles: one-second `4` toggles both realities; `333` remains; forms are excluded; timed HOLD 4 copy is shared. | Implemented; final keyboard/touch/overload checks remain pending. |
| Isolated material experiment | `dev/other-side-playground.js`/`.css`, `dev/playground-field.js`, `data/playgroundSettings.js`: DEV-only `?playground=1`, explicit Start, existing real material/kernel, reconstruction from the previous damaged frame, bounded two-buffer canvas, pause/reset/cleanup. Public material settings and hero remain unchanged. | Isolated implementation; final rendered-pixel/prolonged browser validation and any global promotion remain pending. |
| Inquiry | `inquiry-content.js`, `inquiry.js`/`.css`, `inquiry-validation.js`, `data/inquirySettings.js`, `server/inquiry.mjs`, Vite/preview middleware: shared Home/Contact form, real project context, bounded attachments, independent server validation and fixed-recipient Resend adapter. | Implemented adapter/UI; final integration acceptance remains pending. Real credentials, verified sender, hosting and live email delivery are still unavailable. |
| Approved content / polish | `siteContent.js`, `seoContent.js`, `footer.js`, `v6-polish.css`, `easter-eggs.js`/`.css`, `scroll-choreography.js`, `data/motionSettings.js`: confirmed content, mixed-media tagline, footer Instagram/visit layout, direct entrance bypass and consistent treatment. | Implemented; visual, focus, reduced-motion and metadata checks remain pending. |

Module paths above are under `src/` unless stated otherwise. Implementation
does not mean a complete phase passed. Current browser checks are coordinated
serially; results must identify the exact V6 build before these gates close.
The working inquiry setup and honest delivery limitation are documented in
[INQUIRY.md](INQUIRY.md).

Hold `4` for about one second must toggle either reality once per hold.
Retain the existing `333` reverse shortcut and four/three-tap mobile gesture.
Typing in form fields must never activate a reality switch. The V6 hint is
`HOLD 4 TO SEE THE OTHER SIDE.` / `HOLD 4 TO REVERSE.`; it remains faint,
fades in over approximately .6 seconds and hides after approximately 2 seconds.

The current V6 content changes are centralized in `siteContent.js` and
`seoContent.js`: Hendrik, the exact approved informal About paragraphs,
`mixed media`, the confirmed Instagram profile and the confirmed contact
email. Do not fabricate project titles, biographies or image descriptions.

## Asset and configuration inventory

| Requirement | Available / outstanding |
| --- | --- |
| Genuine published portfolio work | Supplied `public/images/digital-artworks/green-black-original.jpg` (1440×1920), preserved original, plus 320/640/960/1440px WebP derivatives. |
| Tattoos, confirmed Flashes, Jewellery, Analog Photography | No genuine project photographs supplied in the repository. Keep honest empty states; brand/hero reflection textures and browser fixtures are not portfolio entries. |
| h4 branding | Exact existing `public/assets/h4-monogram.svg`, cursor variants and favicon variants are present. Reuse them. |
| Other Side visual material | Existing local Living Decay/corrupted-film material and effect code are available. The twelve-panel reference is aesthetic guidance, not a tile layout. |
| THE OTHER SIDE V23 soundtrack | Not present. Existing locally synthesized mode sound is not V23. Preserve working audio/mute; do not silently replace it or claim the missing recording was integrated. |
| Inquiry destination | Confirmed by V6: `h4ngelic@gmail.com`. Instagram: `https://www.instagram.com/h4ngelic/`. |
| Inquiry delivery | Requires actual runtime/endpoint, email provider credentials, verified sender and abuse/rate-limit configuration. Secrets stay server-side. Until configured, present an honest unavailable state and do not claim successful delivery. |
| Attachments | Validate server-side as well as in the UI; cap count, individual/total bytes and accepted formats. Keep uploads transient and disclose external provider/retention configuration. |
| Production crawlability | Domain confirmed; actual host, DNS, CDN/WAF, redirects, crawler access and deployed headers remain external verification tasks. Preview `noindex` is intentional. |
| Mannequin | Actual optimized human/arm GLB and verified authored body/tattoo placement remain absent. Synthetic browser fixtures do not validate human UVs or a Procreate workflow. |
| External interaction references | Prior attempts returned network-proxy 403. Do not claim a direct visual comparison or reuse of unavailable reference source. |

## Explicit scope gates

V6 says: **“Do not implement P4 or P5 until the earlier priorities have been
reviewed and approved.”** Existing optional mannequin groundwork remains
inactive without real content; do not expand or enable it in this phase.
WORLD, Flowfield About, The Tangled Moment, The Loose Thread and additional
unrequested secret interactions remain deferred. P1.5 changes must first be
isolated and validated rather than silently applied to every public page.

## V6 acceptance checklist

All boxes below are pending until verified against the actual V6 build.

- [ ] Production build and relevant existing automated tests pass; record the
  exact commit/artifact and distinguish inherited checks from V6 checks.
- [ ] INDEX has exactly four real primary links, active state, Escape and
  keyboard/touch operation, without overlapping hero controls.
- [ ] Brand returns Home; homepage strip contains only three main horizontal
  links; chapter counter uses the actual homepage sections and is absent from
  unrelated routes.
- [ ] WORK is connected; direct category links, reload, back/forward and
  old published category/project URLs remain usable.
- [ ] Direct navigation reveals its target promptly, without forced entrance
  sequences; natural vertical scrolling never becomes trapped.
- [ ] One-second `4`, single-hold latch, `333`, mobile four/three taps and
  form-field exclusions work; navigation preserves current reality/context.
- [ ] Isolated material test proves accumulating actual damage, evolving
  earlier layers, retained active history, fresh-entry variation and bounded
  resources under prolonged interaction; public hero remains unchanged.
- [ ] Gallery hover/click feedback, native modal, Escape, focus and exact
  document/carousel return work on mouse, touch and keyboard.
- [ ] Inquiry validates name/email/files, supports multiple files/removal,
  artwork context, honest progress/errors and safe server-side submission.
- [ ] Delivery is marked confirmed only after a configured backend/provider
  actually accepts it; no credentials or fabricated success reach the browser.
- [ ] Approved About copy, mixed-media tagline, Instagram/footer alignment,
  timed hint and privacy-respecting visitor-return behavior are correct.
- [ ] Semantic content, metadata, canonicals, sitemap and real route status
  remain valid without WebGL or animation; previews stay out of search.
- [ ] Desktop, 320px and 390px, reduced motion, visibility/offscreen cleanup,
  cold interior-route loading and repeated navigation are checked.
- [ ] Report actual Lighthouse/browser measurements with conditions. LCP
  ≤2.5s, INP ≤200ms and CLS ≤.1 are targets, not claims of measured field p75.
- [ ] Export and verify a new working HTML preview after final source changes;
  preserve the earlier downloadable preview while V6 is in progress.

Append phase outcomes and actual evidence here as each gate completes. Do
not scatter V6 decisions across additional planning documents.
