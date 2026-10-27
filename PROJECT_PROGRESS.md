# Verified project progress

Updated: 2026-10-27. Branch: feat/master-foundation; base 6c17a94 (feat/website-completion).

## DONE

- A / Repository and latest brief audit: clean base confirmed before branch creation; vanilla Vite/Three, src/pages.js renderer, data files, native gallery, inquiry adapter and accepted memory-mosh identified. Existing 330-test evidence belongs to previous milestone, not this new implementation.
- A / Persistent specification and continuation files created: PROJECT_PLAN.md has the complete user specification with individually identified requirements; AGENTS.md and NEXT_SESSION.md point to current work. Verification: full uploaded brief read; git status/log and source inspected.

- E / Inquiry implemented and verified: HOW TO REACH YOU required free text; safe email-only reply_to; 700ms once IO entrance with reduced-motion/focus bypass. `node --test tests/inquiry.test.js tests/inquiry-entrance.test.js`: 23/23. `node tests/inquiry-http.mjs`: actual loopback HTTP/provider mock checks pass for email/social/phone/errors. `node tests/master-inquiry-browser.mjs`: six profiles (1440/390/320 × motion/reduced) pass; no runtime errors/overflow; preserves content and attachments on503. Evidence artifacts/master-foundation/inquiry.json. Live delivery remains BLOCKED below. Changed src/inquiry*, server/inquiry.mjs and matching tests.
- G / Hover implemented and verified: .2 ordinary glow, 1.025/1.02 text and1.015image scales,300ms; boundededges/hitareas. `node --test tests/ui-effects.test.js tests/finite-hover-motion.test.js`:22/22; hover-containment browser1614/1440/390/320 and hover browser desktop/touch pass, zeroerrors. Evidence artifacts/master-foundation/hover-containment.json. Changed interactions.css, data/uiEffectSettings.js, v6-polish.css; mosh core/finitepublisher unchanged. Micro harness updated but not rerun.

- B / NAAVI implemented and verified: one shared static/live bottom-center link, Home00..04/04 including finalh4; Work01..03/03; About01/01. Six focused Node tests and six actualbrowserprofiles1440/390/320 ×motion/reduced pass: smoothcycles, scrollsync, realrouteHome, focusedfieldclearance, typingexclusion, sharedhover, no coldAboutWebGL. Evidence artifacts/master-foundation/naavi.json. Removed headerINDEX dependency and staleapp.edition access. Changed global-navigation*, naavi-content.js, app.js, index.html, prerender.mjs.
- C/D/H / Work hierarchy, About, hero/footer layout implemented and verified:42focusedNode; layout1440/1000/801/800/390/320; About1440/390/320 ×motion/reduced pass. Exact hierarchy, empty3dmodel, no arrows/dividers, smallbottomcontrols, singleflowingAbout, visibleVisitbesidecopyright and stablecount acrossroutes. Evidence artifacts/master-foundation/layout/ (continuedJSON800/390/320; earlierprofilesstdout+screenshots) and artifacts/website-completion/about/results.json. InitialsoftwareGPUstallrecovered with freshbrowserperprofile; no productfailure. Changed pages/archive/homepage/footer/easterCSS/style/data content+motion.

- F / Gallery and nativecarousel verified: finalgallery1440/390/320 and nativecarousel1000/390/320 PASS. ProportionalFLIP,38%transparent scrim, samephoto/outside/Escapeclose, exactscroll/focusreturn; horizontal trackpad/drag/swipe/keyboard and verticalscroll release. Synthetic mixed-input latching also occurred on unchanged6c17a94: harness uses at most two actual gestures and records wheelDeltas; production scroll code unchanged. Evidence artifacts/native-carousel/results.json and regressions.json. Review fixes: cancel NAAVI digits on motionpreferencechange, retain nativeh4cursor on expandedphotos; focusedbrowser queued.

- I / Other Side regression verified: memory-mosh-browser1000/390/320active +390reduced PASS, actual prepared/destination/released byte-equality, exactlytwo buffers, source1 across navigation/resize and source2 only freshactivation, idle evolves/staticreduced, zero coldinteriorWebGL/runtimeerrors. Core renderer/hero/audio/devLab diffs empty. Evidence artifacts/v71/memory-browser-results.json.

## IN PROGRESS


## TODO

- J / Current Node337/337PASS; allfive integration suitesPASS (gallery/nativecarousel/v6/portfolio/memory). Evidence artifacts/master-foundation/regressions.json retains originalnativegesturefailure and resumedresults. FocusedaccessibilityPASS: actual280ms NAAVIdigit animation cancels on prefchange; genuineexpandedartworkkeepsh4cursor. Hero suite exposed globalroot scroll-padding shifting bottomcontrols; removed that global rule and retained form-only margins/focusguard. Actualhero suite nowPASS: desktoprender/controls/push/drag/release/return, mobiletouchscroll/dragcancel, reducedpause and disabledWebGLfallback. AfterrootCSSfix NAAVI formclearance/cycles rechecked1440/390/320reduced PASS (naavi-focus.json). No hero/physics sourcechanges. Production/offline/performance/package/PR pending.

## BLOCKED

- Five distinct real tattoo photographs, Flashes and Analog assets are not in repository. Only one confirmed green/black digital artwork exists. Keep empty working carousel shell; never publish reference textures/fixtures as portfolio photos.
- Real email delivery needs configured Resend key, verified sender and server hosting. Existing adapter available; no real success claimed. Offline HTML cannot mail.

## REVIEW NEEDED

- Physical-device confirmation of mixed mouse/touch gesture boundaries. Chromium CDP sometimes consumes a first gesture after changing axes; the same occurs on unmodified baseline. Current native-input suite passes with at most two real gestures (deltas recorded), no artificial page-scroll forwarding.
- Preserve functioning Other Side rather than replacing it; no new visual decision needed.

## Deferred (excluded from completion)

WORLD333/4, mannequin viewer/rotation/ink (only empty3dmodel heading now), About Flowfield, spatial Flashes, further Analog/Tattoo experiments, Easter Eggs and additional sounds.
