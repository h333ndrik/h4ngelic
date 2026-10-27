# Master foundation update

Source checkpoint: `57e2e794da7d1ee181616d5f2a45d783eaaf5a95` on
`feat/master-foundation`, built on the existing website-completion branch.
[Review PR #18](https://github.com/h333ndrik/h4ngelic/pull/18) builds on PR #17.
All available implementation work is complete; five real tattoo photographs
and live mail configuration are still external blockers.

## Result

- One shared **NAAVI** at the bottom centre: Home 00→04/04→Home, Work 01→03/03→Home,
  About 01/01→Home. The final h4 is a real stop. No header INDEX or dropdown.
  Focused form fields clear the dock; the hero buttons keep the page at Home.
- Hero controls are small and lower-left, with the original chrome wordmark,
  physics, figure-eight movement, lazy loading, arrows and native h4 cursor.
  Berlin and the redundant mixed-media label are removed from the hero.
- WORKS has the requested hierarchy: tattoos → on skin / flashes / empty 3d model;
  jewellery; more → digital artworks / analog photography. Only01/WORKS is numbered.
  No category dividers, duplicate mini navigation or Work heading arrows.
- Native carousels preserve aspect ratios, scroll/focus and image order.
  Proportional FLIP expansion now closes on the photograph, outside or Escape;
  its transparent viewer leaves the surrounding site visible.
- About remains one naturally wrapping approved paragraph, with a small inset,
  smaller title/link and restrained36/28 px movement. Dedicated About copy stays.
- HOW TO REACH YOU is required free text for email/social/telephone. The mail
  adapter sets reply_to only for a valid email address. The 700 ms form entrance
  runs once; focus and reduced motion expose it immediately. Errors retain data.
- Ordinary hover glow is 80% weaker, scales are 1.02–1.025 for text and 1.015 for
  images, with 300 ms transitions and viewport bounds. Intentional mosh is retained.
- Shared VISIT appears beside copyright on every footer; routes do not add visits.
  Accepted Other Side renderers, hero geometry and H4 MOSH LAB are unchanged.

## Verification

**337/337 Node tests pass.** Five serial integration suites pass for gallery,
native carousel, inquiry/navigation, portfolio routes and persistent memory.
Focused checks cover NAAVI at 1440/390/320 with normal/reduced motion, post-fix
form clearance at the same widths, layout at 1440/1000/801/800/390/320, About,
hover containment at 1614/1440/390/320, free-text contact, changing motion preference
while an actual digit animation runs, and the native cursor on the genuine image.
The hero suite verifies desktop physics/controls, mobile touch, reduced pause and
WebGL-disabled fallback. No production hero/physics change was needed.

Build/export passes: 12 prerendered routes plus 404, preview noindex policy intact.
Actual HTTP/no-JS and live interior checks pass. Cold Work/About/Contact do not
request the Three scene, hero font or reflection assets. The hero remains the
existing 610.36kB /158.03kB gzip lazy chunk.

The **exact exported HTML** passes offline 1440/390/320 and native 390px checks,
with no external HTTP or runtime errors. The ZIP HTML matches those bytes; the
supplied original JPEG is embedded unchanged and fixture IDs are excluded.
The managed browser disallows file://, so those tests execute the exact bytes in
an isolated document with network rejected. This is not a physical-device claim.

### Actual performance measurements

Lighthouse 13.5.0, Chromium 154/SwiftShader, simulated mobile network/4×CPU;
**one run per page**, no before/after improvement or field-FPS claim.

| Page | Score | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home |75|1.21s|1.62s|1341ms|0.00258|
| Work |99|1.31s|1.80s|12ms|0|

Home's existing Three workload remains a measured cost. Review on actual hardware
before altering the accepted hero merely to chase a software-rendered lab score.
Raw reports, test logs, hashes and preserved failure history are in
[the evidence folder](validation/master-foundation/README.md).

A lone synthetic wheel/touch gesture can be consumed by Chromium after changing
input axes; this also reproduced on unmodified 6c17a94. The native-carousel test
uses at most two actual gestures and records their deltas. Production still has
no manual vertical-scroll relay or CSS scroll snap. Physical-device confirmation
of this boundary is REVIEW NEEDED.

## Content and delivery

The sole confirmed portfolio image remains the supplied green/black digital
original. Tattoo/Flash/Analog carousels show 0/0 and archive in progress until
real work is supplied. No reference texture or duplicate fixture is published.
Add projects through src/data/artworks.js; see[CONTENT.md](CONTENT.md).

Real delivery requires RESEND_API_KEY, a verified INQUIRY_FROM sender and a deployed
same-origin /api/inquiry service. Tests use a local provider mock; no live mail
is claimed. Offline HTML cannot submit mail. See[INQUIRY.md](INQUIRY.md).
WORLD, mannequin content, Flowfield and further sounds remain deferred.

## Preview and continuation

[Downloadable HTML](previews/h4ngelic-preview.html) ·
[ZIP](previews/portfolio-preview.zip) ·
[Opening instructions](previews/README-WEBSITE-UPDATE.txt).
On GitHub choose Download raw file, save the HTML and open it in a computer browser.
The GitHub source view does not execute the site. No production deployment or merge.

Read AGENTS.md, PROJECT_PLAN.md, PROJECT_PROGRESS.md and NEXT_SESSION.md before
continuing. Available work is verified; resume external blockers once assets or
mail configuration arrive, without repeating verified work.

```sh
npm test
npm run dev -- --port 55173 --strictPort
H4_BASE_URL=http://127.0.0.1:55173 npm run test:naavi
H4_BASE_URL=http://127.0.0.1:55173 npm run test:foundation
npm run preview:export
npm run preview -- --port 55383
H4_PREVIEW_URL=http://127.0.0.1:55383 node tests/seo-browser.mjs
npm run test:standalone
npm run preview:package
```

Run browser suites serially and finish them before building.
