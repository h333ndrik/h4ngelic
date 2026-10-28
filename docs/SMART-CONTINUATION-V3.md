
# H4NGELIC — SMART CONTINUATION MASTER PROMPT V3

PROJECT:
https://github.com/h333ndrik/h4ngelic

MISSION:
Continue developing the EXISTING h4ngelic website.

Complete the agreed website foundation using the current repository state, existing components, established visual identity and ongoing development work.

DO NOT rebuild the website.
DO NOT overwrite functioning features.
DO NOT deploy or launch the website.
DO NOT modify the separate H4 MOSH LAB project.

CORE WORKFLOW:
INSPECT → COMPARE → REUSE → IMPROVE → TEST → DOCUMENT → CONTINUE.

Work autonomously on clear, approved tasks.
Do not stop after completing one task when other unblocked tasks remain.

==================================================
01 / FIRST: RECOVER CURRENT PROJECT STATE
==================================================

Before writing code:

1. Inspect the actual repository and current branch.
2. Check git status and uncommitted changes.
3. Read AGENTS.md, PROJECT_PLAN.md,
   PROJECT_PROGRESS.md and NEXT_SESSION.md.
4. Inspect relevant recent commits.
5. Identify implemented, partial and missing features.
6. Check existing components, animations and routes.
7. Compare the current implementation with this prompt.
8. Preserve all working functionality and user changes.

IMPORTANT:
The repository determines what already exists.
This specification determines the desired end state.

Create or update a requirement tracker using:

DONE
PARTIAL
TODO
BLOCKED
REVIEW NEEDED

For every item, record:
- Actual state
- Required change
- Relevant files
- Tests
- Desktop status
- Mobile status

If something is already correct, do not modify it.

If something is partially implemented, continue it.

Do not create competing implementations.

==================================================
02 / STRICT WEBSITE ARCHITECTURE
==================================================

There are exactly three regular pages:

1. FRONTPAGE
2. WORKS
3. MORE ABOUT

FRONTPAGE SECTIONS:

00 / HOME
01 / WORKS
02 / ABOUT
03 / CONTACT
04 / SECRET

WORKS PAGE:

01 / WORKS

tattoos
  on skin
  flashes
  3d model

jewellery

more
  digital artworks
  analog photography

MORE ABOUT:
Dedicated page for personal and artistic information.

CONTACT IS NOT A SEPARATE PAGE.

The only contact form exists in the Frontpage section
03 / CONTACT.

Every CONTACT link, including links from WORKS,
MORE ABOUT and navigation menus, must lead directly
to Frontpage 03 / CONTACT.

Use the existing router and a shared navigation helper.

From another page:
- Navigate to Frontpage.
- Smoothly scroll to CONTACT.
- Update section tracking.
- Avoid hard jumps or broken browser history.

The 333 and 4 realities share the same page structure.

==================================================
03 / INDEX AND NAAVI MUST REMAIN SEPARATE
==================================================

CRITICAL DESIGN DECISION:

INDEX = top-right navigation menu.
NAAVI = bottom-center scroll indicator/navigation.

These are different components.

Inspect their current implementation first.
Both may already be under active development.

INDEX:

- Minimal "+" symbol in the upper-right.
- No prominent decorative frame.
- Subtle hover behavior.
- Click transforms + smoothly into ×.
- Opens the existing navigation menu.
- Menu contains direct navigation destinations.
- Clicking × closes the menu.
- Escape closes the menu.
- Outside click closes the menu.
- Choosing a destination closes the menu.
- Support keyboard and touch interaction.
- Reuse existing menu logic and motion if available.

Do not create a second independent menu system.

NAAVI:

- Preserve its current bottom-center position.
- Keep the established numeric formatting.
- Synchronize index with actual scroll position.
- Clicking advances to the next main section.
- After the last section, return to HOME.
- Maintain smooth scroll-follow behavior.
- No dropdown or menu opening from NAAVI.
- No jitter or abrupt snapping.

FRONTPAGE:
00 / 04 through 04 / 04

WORKS:
00 / 03 through 03 / 03

MORE ABOUT:
00 / 01 through 01 / 01

Subcategories do not receive extra index values.

==================================================
04 / FLOATING BRAND, INDEX AND NAAVI
==================================================

Three independent floating UI elements:

- h4ngelic branding at top left
- INDEX (+) at top right
- NAAVI at bottom center

Keep them visually available while scrolling.

Use a shared restrained motion language.

Test minimal damped movement during scrolling,
approximately 4–8px maximum, only if beneficial.

Avoid unnecessary delays, jitter and layout changes.

INVERSION EFFECT:

Test a subtle invert/difference effect when floating
navigation overlaps large white typography.

Possible method:
mix-blend-mode: difference

However:
- Preserve readability.
- Check stacking and pointer events.
- Test in 333 and THE OTHER SIDE.
- Provide robust fallback on mobile.
- Do not force a technically unstable effect.

Clicking the h4ngelic brand navigates to HOME.

==================================================
05 / FRONTPAGE
==================================================

Preserve:
- Existing chrome 3D hero
- Existing hero interactions
- Anthracite background gradient
- Typography
- h4 custom cursor

Changes:

- Remove the "reveal on" control.
- Preserve reveal functionality if used elsewhere.
- Keep SLOW, PAUSE and SOUND.
- Make controls compact and understated.
- Position controls at the lower-left.
- Remove the redundant MIXED MEDIA bottom-left label.
- Remove BERLIN, DE from the upper-right header.
- Keep WORK, ABOUT and CONTACT links.
- Preserve their directional arrows.
- Rename SELECTED WORKS to WORKS.
- Fix confirmed alignment and spacing issues.
- Prevent horizontal page overflow.

Do not unnecessarily rebuild the 3D hero.

==================================================
06 / WORKS
==================================================

FINAL STRUCTURE:

01 / WORKS

tattoos
  on skin
  flashes
  3d model

jewellery

more
  digital artworks
  analog photography

RULES:

- Only the page header 01 / WORKS is numbered.
- TATTOOS, JEWELLERY and MORE are large headings.
- Subcategories are significantly smaller.
- DIGITAL ARTWORKS is especially understated.
- Remove duplicate tattoo headings.
- Remove redundant smaller navigation labels.
- No divider lines between categories.
- No arrows on WORKS category headings.
- Use typography and whitespace for hierarchy.
- Preserve existing real media assets.

3D MODEL:
Create/preserve the subsection.
Leave it empty.

Do not insert a mannequin yet.
Do not add placeholder graphics or a fake viewer.

SCROLL:
TATTOOS, JEWELLERY and MORE must animate as
continuously and smoothly as ABOUT.

No abrupt fly-ins.
No artificial stopping.
No snapping.
Reuse the current scroll animation system.

==================================================
07 / CAROUSEL & IMAGE INTERACTIONS
==================================================

Under ON SKIN:

Use five existing real tattoo photographs initially.

Inspect available assets first.
Do not invent replacement artwork.

HORIZONTAL CAROUSEL:
- Trackpad scrolling
- Mouse dragging
- Touch swiping
- Original image aspect ratios
- No auto-advance
- No unwanted horizontal page overflow

HOVER:
- Smooth scale around 1.02–1.04.
- Very subtle glow at image edges.
- Match existing restrained category hover effects.
- Approximately 250–350ms.

CLICK:
- Smooth enlargement around 1.08–1.12.
- Image stays in its carousel position.
- No fullscreen view.
- No modal.
- No movement into the screen center.

SECOND CLICK OR OUTSIDE CLICK:
- Restore original size smoothly.

Prevent:
- Layout reflow
- Neighboring-image overlap problems
- Lost carousel scroll position
- Accidental click after dragging
- Touch gesture conflicts

Support reduced motion.

==================================================
08 / ABOUT
==================================================

FRONTPAGE:

Keep heading:
02 / ABOUT

Keep exact copy:

mixed media. ink, metal and everything in between.

This is ONE flowing text block.

No forced line breaks or staggered individual phrases.

Position it slightly further right.
Use the available horizontal width appropriately.

Reduce the ABOUT heading slightly if needed.

MORE ABOUT:
- Smaller typography.
- No underline.
- Aligned with the description text.
- Subtle hover.
- Navigates to the dedicated ABOUT page.

DEDICATED ABOUT PAGE:
Preserve approved content.

NAAVI:
00 / 01 and 01 / 01.

No separate contact form.
CONTACT always navigates to Frontpage 03 / CONTACT.

Do not implement Flowfield yet.

==================================================
09 / CONTACT FORM
==================================================

There is only ONE contact form.

Location:
Frontpage 03 / CONTACT.

Align its content with the horizontal grid used
for the ABOUT description.

Replace YOUR EMAIL with:

HOW TO REACH YOU

Placeholder:
email, instagram, phone number...

Allow email, Instagram handles or telephone numbers.

Do not use email-only validation.

Keep:

WHAT'S ON YOUR MIND?

Placeholder:
could be an inquiry, a question or just a thought.
feel free to write anything.

INPUT VISUALS:

- Exactly one field surface per input.
- Slightly lighter anthracite background.
- No double outlines or nested borders.
- Labels clearly above fields.
- Subtle focus highlighting.
- Consistent spacing.
- No layout shifts.

Replace SEND INQUIRY with:

SEND MESSAGE

Remove unwanted horizontal divider lines.

Remove this text completely:

your details and references are used to respond
to your inquiry.

Do not replace it with new copy.

FORM ENTRANCE:
- Smooth scroll-triggered appearance.
- Small upward movement.
- Gentle opacity fade.
- Approximately 600–800ms.
- No layout shift.
- Support reduced motion.

Preserve and verify attachment uploads.

Verify validation and real submission.

Never fake successful message delivery.

If delivery is not configured, document BLOCKED.

==================================================
10 / HOVER & SCROLL MOTION
==================================================

Audit the entire website.

- Reduce excessive ordinary glow by around 75–85%.
- Use consistent, restrained hover effects.
- Standardize short transitions.
- Preserve h4 cursor interactions.
- Avoid excessive scale and movement.
- Align scroll animation timing and easing.
- Prevent text overlaps and layout jumps.
- Reuse existing motion infrastructure.

Create shared motion variables where useful.

Do not introduce a competing animation framework.

Preserve intentional THE OTHER SIDE glitches.

Respect prefers-reduced-motion.

==================================================
11 / THE OTHER SIDE
==================================================

Preserve the established dual-reality system.

333:
Monochrome, minimal, quiet.

4:
Colored, corrupted, living material aesthetic.

Preserve:
- Existing 4/333 keyboard switching
- Logo variations
- Cursor variations
- Living Decay background
- Organic material variation
- Pixel compression and image smearing
- Scroll, cursor and click reactions

No repetitive tiled collage.

SMOOTH CORRUPTION:

Improve transition continuity while retaining
pronounced glitch and datamosh moments.

Blend:
- Fluid displacement
- Controlled glitch bursts
- Organic morphing
- Motion continuity

Initial target around 1.4 seconds.

No hard resets.

Refine the reverse transition too.

Do not replace working effects with generic fades.

Adapt GPU load for mobile.

==================================================
12 / SOUND CONTROL
==================================================

Keep SOUND ON/OFF as one compact control.

Add a small attached arrow.

Click SOUND:
Toggle mute directly.

Click arrow:
Open a compact volume slider above SOUND.

- Gentle 200–250ms opening animation.
- Close on outside click.
- Keyboard and touch compatible.
- Save mute and volume preferences.
- No oversized control panel.
- Accessible range control.

Build upon existing audio logic.

Use one central audio controller for:
- Hero cues
- Mode switching sounds
- Ink Shots
- Optional atmosphere
- SMASH

Avoid overlapping or unexpectedly loud sounds.

Do not autoplay music without user interaction.

==================================================
13 / SMASH — PRIVATE TEST
==================================================

Preferred audio file:

h4ngelic_v8_full_sound_remaster_v11.mp3

This exact version is approved.
Do not remix or replace it.

Footer:
SMASH appears as a normal link immediately
left of INSTAGRAM.

Click:
- Start the track from the beginning.
- Smoothly suspend other website sounds.
- Give SMASH audio priority.

Click again:
- Stop playback.
- Restore normal sound design.

Natural end:
- Restore website audio smoothly.

Changing between 333 and 4:
Do not interrupt SMASH.

Respect global mute and volume.

If the approved audio asset is missing,
record BLOCKED and request the exact file.

Do not invent a substitute.

The soundtrack derives from copyrighted music.
Keep its integration private/local only unless
the necessary public usage rights are secured.

==================================================
14 / OTHER SOUND DESIGN
==================================================

Lower priority.

Planned audio:

- Bright metallic/crystalline hero cue
- 333 → 4 transition sound
- Reverse 4 → 333 sound
- Subtle organic-metallic ink impacts
- Optional THE OTHER SIDE atmosphere

Inspect existing assets first.

Reuse approved sounds.
Do not generate unnecessary music.
Avoid overwhelming the site with audio.

==================================================
15 / FOOTER
==================================================

Implement a shared consistent footer.

LEFT:

h4ngelic © 2026
visit [number]

RIGHT:

smash
instagram
berlin, de

- "visit" must be lowercase.
- Use ample spacing between branding and visit.
- Match right-side footer spacing rhythm.
- Remove unwanted footer divider lines.
- Ensure no overlap with NAAVI.

VISIT MEMORY:

Preserve seven personalized stages:

1: nice to meet you.
2: you came back.
3: we’re practically friends now.
4: getting familiar, aren't we?
5: you know your way around here.
6–9: some things are worth returning to.
10+: you're part of this place now.

The visit count stays visible.
The memory phrase appears only on hover,
keyboard focus or tap.

No layout shift when revealing the phrase.

Use local browser persistence for
personal visit memory.

Do not increment personal visits on every
internal page navigation.

Do not add registration or login.

REAL PUBLIC VISITOR COUNT:
DEFER UNTIL LAUNCH.

Do not hardcode 015 as genuine visitor data.
Do not count developer preview visits as
actual public visitors.

==================================================
16 / MOBILE & PERFORMANCE
==================================================

Create one adaptive responsive website.

Do not build a separate mobile website.

Work on desktop first but test mobile throughout.

Verify:
- Small and large smartphones
- Tablet
- Desktop

MOBILE:
- Touch-friendly INDEX
- Compact NAAVI
- Safe spacing for floating UI
- No collisions with browser safe areas
- Carousel swiping
- Normal vertical page scrolling
- Tap-based image enlargement
- Usable sound volume popup
- Readable typography
- Single-column contact form where needed
- No hover-only required functions

PERFORMANCE:
- Lazy-load noncritical images
- Optimize media dimensions
- Pause offscreen 3D and glitch animation
- Avoid redundant event listeners
- Avoid unnecessary dependencies
- Use efficient animation properties
- Preserve visual quality
- Avoid horizontal page overflow
- Support reduced motion

Final visual Mobile polish happens after the main desktop
features, but mobile functionality must work throughout.

==================================================
17 / EASTER EGGS
==================================================

Preserve existing or approved:

- THE OTHER SIDE / 333 ↔ 4
- Living Decay
- Ink Blobs
- Custom h4 cursor
- Secret 4
- Website Remembers You
- SMASH
- The Loose Thread

THE LOOSE THREAD:
A small hidden fragment leading to unpublished artwork.

Do not fabricate unpublished assets.

OPTIONAL IDEAS, NOT CURRENT TASKS:

- AFTERIMAGE
  Brief colored visual echo after returning to 333.

- HIDDEN FLASH
  Alternate appearance of a Flash design during
  prolonged interaction.

- RESIDUAL INK
  Ink traces momentarily survive a reality switch.

Do not implement these without further approval.

==================================================
18 / DEFERRED WORK
==================================================

Do not implement now:

3D MANNEQUIN:
- White model
- Slow rotation, approximately 30–35 seconds
- Mouse/touch rotation
- Ink shooting
- Tattoo reveal

Keep its empty 3D MODEL subsection.

WORLD:
- WORLD 333
- WORLD 4
- Portal between realities
- Phoenix from phoenix-bird.zip
- Immersive 3D environment

MORE ABOUT FLOWFIELD:
- Interactive image treatment

Advanced Flash and Analog Photography interactions.

Additional elaborate Easter Eggs.

==================================================
19 / LAUNCH EXCLUDED
==================================================

DO NOT:

- Deploy publicly
- Connect the domain
- Configure production analytics
- Implement live visitor tracking
- Publish copyrighted soundtrack
- Start final launch procedures

Local development and private testing are allowed.

The user will authorize launch work separately.

==================================================
20 / IMPLEMENTATION PRIORITIES
==================================================

PHASE 1:
Repository inspection and reconciliation.

PHASE 2:
INDEX, NAAVI and floating branding.

PHASE 3:
Frontpage, WORKS, ABOUT, CONTACT and footer.

PHASE 4:
Carousel, hover effects and scroll animation consistency.

PHASE 5:
THE OTHER SIDE Smooth Corruption.

PHASE 6:
Sound control and central audio system.

PHASE 7:
Private SMASH testing, if the file is present.

PHASE 8:
Mobile refinement and performance.

PHASE 9:
Regression tests and documentation.

Change order only if justified by real dependencies.

==================================================
21 / SMART ENGINEERING RULES
==================================================

Prefer minimal safe edits over rewrites.

Reuse existing components.

Reuse shared styles and motion systems.

Do not add dependencies without justification.

Do not introduce duplicate UI or routing logic.

Do not replace existing design conventions.

If a feature is already correct, mark DONE.

If partially implemented, continue it.

If missing, implement it using existing conventions.

If uncertain:
- Mark REVIEW NEEDED.
- Explain why.
- Do not change it speculatively.
- Continue independent tasks.

Verify before claiming success.

==================================================
22 / TESTING
==================================================

Run all available relevant tests.

Verify:
- Frontpage
- WORKS
- MORE ABOUT
- Cross-page CONTACT navigation
- INDEX menu
- NAAVI
- Floating and invert effects
- Carousel mouse/touch behavior
- Contact form and uploads
- Hover and scroll animation
- THE OTHER SIDE both directions
- Sound state, volume and SMASH
- Mobile layouts
- Keyboard and reduced-motion behavior
- Console/runtime errors

Record actual results.

Never invent successful tests.

==================================================
23 / PERMANENT CONTINUATION SYSTEM
==================================================

Maintain:

AGENTS.md
PROJECT_PLAN.md
PROJECT_PROGRESS.md
NEXT_SESSION.md

AGENTS.md:
Project-specific instructions and continuation rules.

PROJECT_PLAN.md:
Complete structured requirements and task status.

PROJECT_PROGRESS.md:
Verified progress, changed files and test outcomes.

NEXT_SESSION.md:
Exact checkpoint for the next agent session.

After every meaningful task:
- Update status.
- Record files changed.
- Record tests.
- Record remaining work.
- Record exact next action.

Preserve existing useful documentation.

Do not overwrite unrelated user changes.

Do not force-push.
Do not deploy.
Do not claim a commit unless actually performed.

When session resources become limited:
Save the checkpoint before stopping, if possible.

==================================================
24 / CONTINUE AFTER LIMITS
==================================================

When the user later says:

"Mache weiter"

The next session must:

1. Read AGENTS.md and all progress files.
2. Inspect current git status.
3. Compare actual code with the checkpoint.
4. Find the first unfinished unblocked task.
5. Continue implementation.
6. Verify results.
7. Update progress.
8. Continue subsequent tasks as resources permit.

Never start from scratch.

Never repeat verified work.

Never claim automatic background execution.

==================================================
25 / START NOW
==================================================

Inspect the current repository.

Reconcile this specification against actual code.

Identify existing and unfinished work.

Implement the first unfinished approved task.

Continue through the full active backlog.

Preserve current aesthetics and working features.

Test desktop AND mobile.

Document progress continuously.

DO NOT LAUNCH THE WEBSITE.
