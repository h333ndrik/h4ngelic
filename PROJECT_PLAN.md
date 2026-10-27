# Persistent foundation implementation plan

Source: user master brief received 2026-10-27. This latest brief supersedes older UI choices where explicit: remove Berlin header, shared bottom NAAVI including final04/04, restrained hovers, free-text contact. Preserve accepted memory-mosh, hero and actual artwork.

Each checkbox below is an individually identified requirement. Checked items require evidence in PROJECT_PROGRESS.md; unchecked deferred/external items remain outside current completion. Phase order: A audit/checkpoints → B hero/NAAVI → C Works → D About → E Inquiry → F gallery → G hover/cursor → H footer/Visit → I Other Side regression → J full QA/export.

## Exact requirement ledger

# H4NGELIC — MASTER BUILD & CONTINUOUS DEVELOPMENT

You are the development agent for the existing h4ngelic website.

Your mission is to FINISH the agreed website foundation, not merely propose changes.

Work systematically, verify results, preserve completed functionality and maintain persistent documentation so future Codex sessions can resume with the simple instruction "Mache weiter".

DO NOT rebuild the site from scratch.
DO NOT modify H4 MOSH LAB.
DO NOT invent missing assets.
DO NOT stop after completing only one task if more work can be done reliably.

==================================================
01 / INITIAL REPOSITORY AUDIT
==================================================

Before making changes:

- [x] **S01-01** Inspect the actual repository and git status.
- [x] **S01-02** Identify the current framework, routes, components, styles, assets, animation systems and dependencies.
- [x] **S01-03** Check what is implemented, partially implemented or missing.
- [x] **S01-04** Preserve existing functionality and uncommitted user changes.
- [x] **S01-05** Do not assume previous descriptions reflect the current implementation.

Create or maintain:

PROJECT_PLAN.md
PROJECT_PROGRESS.md
NEXT_SESSION.md

Also create or update the repository's AGENTS.md with concise durable continuation instructions, preserving existing project instructions.

PROJECT_PLAN.md must contain the full requirements below as individually trackable tasks.

PROJECT_PROGRESS.md must record:
- [x] **S01-06** DONE: implemented and verified
- [x] **S01-07** IN PROGRESS: currently being developed
- [x] **S01-08** TODO: not yet implemented
- [x] **S01-09** BLOCKED: cannot proceed without external information or assets
- [x] **S01-10** REVIEW NEEDED: uncertain design or technical decision

NEXT_SESSION.md must record:
- [x] **S01-11** Current branch and git state
- [x] **S01-12** Last verified task
- [x] **S01-13** Current incomplete task
- [x] **S01-14** Relevant files/components
- [x] **S01-15** Required next action
- [x] **S01-16** Testing instructions
- [x] **S01-17** Known problems and blockers

Do not mark a feature DONE without verifying it.

==================================================
02 / FRONTPAGE
==================================================

Preserve the existing h4ngelic identity.

Required changes:

- [x] **S02-01** Keep h4ngelic branding in the upper-left corner.
- [x] **S02-02** Remove "berlin, de" from the upper-right corner.
- [x] **S02-03** Do not add a second NAAVI index in the header.
- [x] **S02-04** Preserve the existing 3D chrome hero and its functioning interactions.
- [x] **S02-05** Preserve the subtle anthracite background gradient.
- [x] **S02-06** Move REVEAL, SLOW, PAUSE and SOUND controls to the lower-left area.
- [x] **S02-07** Make the controls significantly smaller, cleaner and less visually dominant.
- [x] **S02-08** Preserve their functionality.
- [x] **S02-09** Remove the redundant "mixed media" label from the lower-left area.
- [x] **S02-10** Keep WORK, ABOUT and CONTACT navigation links in the lower-right area.
- [x] **S02-11** Retain directional arrows on frontpage navigation links.
- [x] **S02-12** Rename SELECTED WORKS to WORKS throughout the interface and relevant labels.
- [x] **S02-13** Maintain strong alignment between the bottom controls, footer and navigation.
- [x] **S02-14** Avoid collisions at all responsive breakpoints.

Do not change the hero's visual identity unnecessarily.

==================================================
03 / NAAVI — SHARED NAVIGATION SYSTEM
==================================================

The navigation component is officially called NAAVI.

Implement ONE reusable NAAVI component across the site.

DESIGN:
- [x] **S03-01** Identical visual appearance across routes.
- [x] **S03-02** Always positioned at the bottom center.
- [x] **S03-03** Consistent typography, size, spacing and animation.
- [x] **S03-04** Standard h4 custom cursor hover animation.
- [x] **S03-05** No dropdown, popover or expanding menu.
- [x] **S03-06** Click moves to the next main section.
- [x] **S03-07** After the final section, cycle back to HOME.
- [x] **S03-08** Smooth navigation without abrupt jumps.
- [x] **S03-09** Synchronize the active index with scrolling.
- [x] **S03-10** Respect reduced-motion preferences.
- [x] **S03-11** Avoid conflicts with form fields and keyboard input.

FRONTPAGE INDEX:
00 / 04 — HOME
01 / 04 — WORKS
02 / 04 — ABOUT
03 / 04 — CONTACT
04 / 04 — final secret section containing the hidden 4

WORKS INDEX:
00 / 03 — HOME
01 / 03 — WORKS / TATTOOS
02 / 03 — JEWELLERY
03 / 03 — MORE

MORE ABOUT PAGE:
00 / 01 — HOME
01 / 01 — ABOUT

On the dedicated ABOUT page, display 01 / 01 when the ABOUT content is active.

The index must appear ONLY at the bottom center, never duplicated in the header.

Use route-specific navigation targets but shared styling and interaction.

Where HOME refers to another route, use proper route navigation rather than attempting to scroll to a nonexistent element.

Ensure that WORKS subcategories do not receive additional main index numbers.

Do not change the existing large editorial section headings simply to match NAAVI values.

==================================================
04 / WORKS — FINAL CONTENT HIERARCHY
==================================================

The WORKS page uses the following hierarchy:

01 / WORKS

tattoos
    on skin
    flashes
    3d model

jewellery

more
    digital artworks
    analog photography

TYPOGRAPHY AND LAYOUT:

- [x] **S04-01** Only the page header is numbered: 01 / WORKS.
- [x] **S04-02** Tattoos, Jewellery and More are large, unnumbered category headings.
- [x] **S04-03** On Skin, Flashes, 3D Model, Digital Artworks and Analog Photography are subordinate headings.
- [x] **S04-04** Subcategory headings must be significantly smaller than main headings.
- [x] **S04-05** Digital Artworks should be particularly restrained in scale.
- [x] **S04-06** Maintain a coherent typographic system throughout the page.
- [x] **S04-07** Remove duplicate tattoo headings.
- [x] **S04-08** Remove redundant small tattoo/flash navigation labels.
- [x] **S04-09** Remove ALL divider lines between categories.
- [x] **S04-10** No horizontal or vertical category separator lines.
- [x] **S04-11** Use whitespace, scale and rhythm to structure content.
- [x] **S04-12** Remove arrow symbols from WORKS headings and subheadings.
- [x] **S04-13** Keep directional navigation arrows restricted to the Frontpage.
- [x] **S04-14** Apply subtle, consistent text-hover feedback.

IMPORTANT:

Create the 3D MODEL subsection now, in the correct position underneath TATTOOS.

Leave its content empty.

Do NOT insert a mannequin, placeholder graphic, canvas, model viewer or fake loading state.

The mannequin is deferred to a later development phase.

==================================================
05 / TATTOO PHOTO CAROUSEL
==================================================

Implement a functional horizontal photo carousel under ON SKIN.

For V1 use five distinct real tattoo photographs.

Inspect existing repository assets first.

If suitable tattoo photographs are unavailable, do not use stock photographs or fake assets. Record the missing assets and continue other tasks.

CAROUSEL REQUIREMENTS:

- [x] **S05-01** Horizontal trackpad scrolling.
- [x] **S05-02** Mouse drag to navigate.
- [x] **S05-03** Mobile touch swipe.
- [x] **S05-04** Smooth native-feeling movement.
- [x] **S05-05** No automatic sliding.
- [x] **S05-06** Original image proportions preserved.
- [x] **S05-07** Balanced spacing and consistent visual hierarchy.
- [x] **S05-08** No decorative borders or cards.
- [x] **S05-09** No unwanted whole-page horizontal overflow.

IMAGE EXPANSION:

When the user clicks or taps a photograph:
- [x] **S05-10** Animate that photograph smoothly into a larger centered view.
- [x] **S05-11** Keep the photograph's aspect ratio.
- [x] **S05-12** Keep the surrounding website subtly visible.
- [x] **S05-13** Avoid harsh transitions or excessive dimming.

When clicking the expanded photograph again,
or clicking outside it:
- [x] **S05-14** Animate it back to the exact original location.
- [x] **S05-15** Restore the normal carousel layout.
- [x] **S05-16** Preserve carousel scroll position.
- [x] **S05-17** Preserve image order.
- [x] **S05-18** Do not remount or restart the entire gallery.

Support Escape for closing and appropriate keyboard navigation.

Distinguish drag gestures from clicks to avoid accidental opening.

Prefer a reliable shared-element or equivalent FLIP transition.

Respect prefers-reduced-motion.

This interaction should later be reusable in other galleries, but first make the five-photo prototype fully functional.

==================================================
06 / OTHER GALLERIES
==================================================

Keep JEWELLERY as its own major category.

Keep MORE as its own major category.

Under MORE:
- [x] **S06-01** DIGITAL ARTWORKS first.
- [x] **S06-02** ANALOG PHOTOGRAPHY second.

DIGITAL ARTWORKS:
- [x] **S06-03** Significantly smaller typography than the main headings.
- [x] **S06-04** Subtle, visible hover glow.
- [x] **S06-05** Same restrained text-hover language as the rest of the website.
- [x] **S06-06** No aggressive neon effect.
- [x] **S06-07** No independent NAAVI index number.

ANALOG PHOTOGRAPHY:
- [x] **S06-08** Preserve existing photos and gallery structure.
- [x] **S06-09** Check for available real assets.
- [x] **S06-10** Do not invent unavailable imagery.

Future spatial/organic gallery experiments are optional and must not delay completing the functional photo carousel.

Do not duplicate images or change approved content without cause.

==================================================
07 / ABOUT — HOMEPAGE SECTION
==================================================

Preserve the section title:

02 / ABOUT

Reduce its visual size slightly, around 15–20%, where appropriate.

Keep the EXACT descriptive copy:

mixed media. ink, metal and everything in between.

IMPORTANT TYPOGRAPHY RULE:

This must be ONE flowing text block.

Do not separate the phrases into individual blocks.
Do not manually force three lines.
Do not stagger individual sentences.
Let the text wrap naturally according to screen width.

Move the text block slightly to the right and make better use of available horizontal space.

Maintain balanced negative space.

MORE ABOUT:
- [x] **S07-01** Reduce link size significantly.
- [x] **S07-02** Position it beneath the description.
- [x] **S07-03** Align it with the beginning of the description.
- [x] **S07-04** Remove the underline.
- [x] **S07-05** Preserve functional navigation to the About page.
- [x] **S07-06** Keep hover feedback subtle and consistent.
- [x] **S07-07** Avoid large gaps or exaggerated animation.

Preserve approved copy.

==================================================
08 / DEDICATED ABOUT PAGE
==================================================

Preserve the existing About page content unless a clear technical or layout issue is found.

- [x] **S08-01** Add the shared NAAVI at the bottom center.
- [x] **S08-02** Show 01 / 01 for the active ABOUT view.
- [x] **S08-03** Ensure the navigation works correctly.
- [x] **S08-04** Do not add a duplicate index at the top.
- [x] **S08-05** Remove the unwanted horizontal line above the footer.
- [x] **S08-06** Add the shared VISIT indicator.
- [x] **S08-07** Keep typography, spacing and hover interactions consistent with the website.

Do not implement the optional Flowfield photograph effect yet.

==================================================
09 / CONTACT & INQUIRY FORM
==================================================

Preserve the approved text and structure of the existing form, except for the following specific change.

Replace:

YOUR EMAIL

with:

HOW TO REACH YOU

Placeholder:

email, instagram, phone number...

This must be a required free-text field allowing:
- [x] **S09-01** Email addresses
- [x] **S09-02** Instagram usernames
- [x] **S09-03** Phone numbers

Do NOT enforce email-only validation.

Keep all other existing form copy unchanged.

LAYOUT:
- [x] **S09-04** Field labels must remain clearly above input borders.
- [x] **S09-05** No overlap between labels, fields or placeholder text.
- [x] **S09-06** No focus-induced layout shift.
- [x] **S09-07** Unified input spacing.
- [x] **S09-08** Subtle and accessible focus states.

INQUIRY ENTRANCE ANIMATION:
- [x] **S09-09** Animate the inquiry form smoothly into view when scrolling.
- [x] **S09-10** Use a subtle upward movement combined with opacity.
- [x] **S09-11** Approximately 600–800ms, adjusted to match the site's existing motion system.
- [x] **S09-12** Optional very slight stagger between fields.
- [x] **S09-13** No exaggerated movement.
- [x] **S09-14** No layout reflow.
- [x] **S09-15** Animate once in a predictable way.
- [x] **S09-16** Respect prefers-reduced-motion.
- [x] **S09-17** Keep form interaction immediately usable.

FUNCTIONALITY:
- [x] **S09-18** Verify validation and real form submission behavior.
- [x] **S09-19** Do not simulate successful delivery.
- [x] **S09-20** If email delivery or a backend is missing, document the precise blocker.
- [x] **S09-21** Preserve the user's entered content on submission errors.

==================================================
10 / HOVER & ANIMATION REFINEMENT
==================================================

Perform a website-wide hover audit.

The current hover effects are too intense.

- [x] **S10-01** Reduce excessive white heading glow by approximately 75–85%.
- [x] **S10-02** Avoid neon halos and oversized text shadows.
- [x] **S10-03** Keep hover responses visible but restrained.
- [x] **S10-04** Standardize transition durations around 250–350ms.
- [x] **S10-05** Use smooth, consistent easing.
- [x] **S10-06** Avoid unnecessary scaling.
- [x] **S10-07** Apply uniform hover behavior to headings, links, buttons and controls.
- [x] **S10-08** Use the standard h4 cursor interaction on ALL navigation elements, including NAAVI.
- [x] **S10-09** Preserve clear keyboard focus indicators.
- [x] **S10-10** Maintain appropriate touch interactions.

Do not remove or globally suppress existing scroll or entrance animations.

Instead:
- [x] **S10-11** Fix abrupt jumps.
- [x] **S10-12** Fix animation conflicts.
- [x] **S10-13** Fix scroll-triggered overlap.
- [x] **S10-14** Make timing and easing more coherent.

THE OTHER SIDE's intentional glitch effects are not ordinary hover effects and should not be globally reduced by accident.

==================================================
11 / FOOTER & VISIT
==================================================

- [x] **S11-01** Remove unwanted horizontal footer divider lines.
- [x] **S11-02** Keep H4NGELIC © 2026 at the lower-left position where applicable.
- [x] **S11-03** Place VISIT directly beside H4NGELIC.
- [x] **S11-04** Display VISIT on every relevant page and subpage.
- [x] **S11-05** Use ONE shared global visit count.
- [x] **S11-06** Route changes must NOT increment the count.
- [x] **S11-07** Preserve the existing visit-memory behavior if working.
- [x] **S11-08** Keep NAAVI separately centered at the bottom.
- [x] **S11-09** Ensure VISIT, NAAVI and footer links never overlap.
- [x] **S11-10** Align footer elements consistently on desktop and mobile.
- [x] **S11-11** Use responsive layout rules rather than fragile unrelated absolute offsets.

Do not redesign the footer unnecessarily.

==================================================
12 / THE OTHER SIDE
==================================================

Inspect and verify the existing 333 / 4 system.

NORMAL / 333:
- [x] **S12-01** Minimal monochrome visual identity.
- [x] **S12-02** White h4 logo.
- [x] **S12-03** Subtle anthracite gradient.

THE OTHER SIDE / 4:
- [x] **S12-04** Colored alternate h4 identity.
- [x] **S12-05** Alternate cursor styling.
- [x] **S12-06** Continuous, seamless living-corruption background.
- [x] **S12-07** No obvious tiled collage.
- [x] **S12-08** Variation in color, density, organic decay and compressed digital textures.
- [x] **S12-09** Interactive responses to scroll, cursor and clicks.
- [x] **S12-10** Smooth mode transitions.
- [x] **S12-11** Preserve functioning audio interactions.

Check the established switching shortcuts and reverse behavior.

Do not rebuild the corruption system if the existing one works.

Fix verified regressions only.

Keep the underlying artwork content consistent across the two modes.

If implementation details are ambiguous, record REVIEW NEEDED rather than inventing a replacement effect.

==================================================
13 / WEBSITE-WIDE PROFESSIONAL AUDIT
==================================================

Inspect the entire website.

CHECK:
- [ ] **S13-01** Responsive spacing and alignment
- [ ] **S13-02** Typography consistency
- [ ] **S13-03** Component reuse
- [ ] **S13-04** Cursor behavior
- [ ] **S13-05** Hover behavior
- [ ] **S13-06** Navigation accuracy
- [ ] **S13-07** Scroll interactions
- [ ] **S13-08** Overlapping elements
- [ ] **S13-09** Unwanted horizontal overflow
- [ ] **S13-10** Broken links
- [ ] **S13-11** Form functionality
- [ ] **S13-12** Image loading and layout shifts
- [ ] **S13-13** Accessibility
- [ ] **S13-14** Reduced-motion support
- [ ] **S13-15** Performance
- [ ] **S13-16** Desktop and mobile behavior
- [ ] **S13-17** Console errors and runtime warnings

FIX CONFIRMED ISSUES.

If unsure whether a visual difference is deliberate:
- [ ] **S13-18** DO NOT change it.
- [ ] **S13-19** Mark REVIEW NEEDED.
- [ ] **S13-20** Explain the issue.
- [ ] **S13-21** Suggest a minimal solution.
- [ ] **S13-22** Continue with independent confirmed tasks.

Never perform a speculative global redesign.

Preserve the experimental identity while achieving a coherent, professional finish.

==================================================
14 / DEFERRED FEATURES — DO NOT IMPLEMENT YET
==================================================

3D MANNEQUIN:
- [x] **S14-01** White 3D model
- [x] **S14-02** Automatic 30–35-second revolution
- [x] **S14-03** Manual mouse/touch rotation
- [x] **S14-04** Ink shooting interaction
- [x] **S14-05** Later localized tattoo reveal

Create only the empty 3D MODEL subsection now.

WORLD:
- [x] **S14-06** Separate immersive 3D experience
- [x] **S14-07** WORLD 333, accessed from the clean reality
- [x] **S14-08** WORLD 4, accessed from THE OTHER SIDE
- [x] **S14-09** Portal to switch realities internally
- [x] **S14-10** Future phoenix-bird.zip integration
- [x] **S14-11** Surreal monumental sculptural environment

OTHER FUTURE IDEAS:
- [x] **S14-12** MORE ABOUT Flowfield image effect
- [x] **S14-13** Advanced spatial Flashes gallery
- [x] **S14-14** Additional Analog Photography interactions
- [x] **S14-15** Advanced tattoo reveals
- [x] **S14-16** Further Easter Eggs
- [x] **S14-17** Additional sound design

Document these items, but DO NOT include them in the current completion criteria.

==================================================
15 / IMPLEMENTATION STRATEGY
==================================================

Work in this order:

PHASE A
Audit and project checkpoint files.

PHASE B
Frontpage, NAAVI, page layout and responsive fixes.

PHASE C
WORKS hierarchy, typography, no divider lines.

PHASE D
ABOUT and dedicated ABOUT page.

PHASE E
Contact form and inquiry animation.

PHASE F
Photo carousel and image expansion.

PHASE G
Unified hover and cursor system.

PHASE H
Footer and VISIT corrections.

PHASE I
THE OTHER SIDE verification and confirmed fixes.

PHASE J
Full QA and regression testing.

Adapt this order only when dependencies require it.

For each task:
1. Inspect existing implementation.
2. Make the smallest reliable change.
3. Test the result.
4. Mark the task completed only if verified.
5. Update progress documentation.
6. Move immediately to the next unfinished task.

Prioritize working code over unnecessary explanations.

Do not stop merely to ask for confirmation on clear, approved requirements.

For genuine uncertainty, document REVIEW NEEDED and work on another task.

==================================================
16 / PERSISTENCE & CODEX LIMIT RECOVERY
==================================================

CRITICAL REQUIREMENT:

The project must remain resumable across independent Codex sessions.

Never rely solely on the current conversation or temporary context.

Maintain PROJECT_PLAN.md as the complete specification.

Maintain PROJECT_PROGRESS.md as the verified task ledger.

Maintain NEXT_SESSION.md as the exact execution checkpoint.

Keep AGENTS.md concise and instruct future agents to read these files before modifying the project.

After EVERY meaningful completed task:
- [ ] **S16-01** Update task status.
- [ ] **S16-02** Record changed files.
- [ ] **S16-03** Record verification commands and outcomes.
- [ ] **S16-04** Record blockers and unresolved decisions.
- [ ] **S16-05** Record the next exact step.

When a session ends or context becomes constrained:
- [ ] **S16-06** Save the most accurate possible checkpoint.
- [ ] **S16-07** Record any unfinished partial work.
- [ ] **S16-08** Avoid marking incomplete work as finished.
- [ ] **S16-09** Preserve git state and user changes.
- [ ] **S16-10** Never claim a commit or push occurred unless verified.

In all future sessions, including when the user says only:

"Mache weiter"

You must:

1. Read AGENTS.md and the three project documentation files.
2. Inspect git status and recent relevant changes.
3. Verify whether the previous task was completed.
4. Resume at the first unfinished unblocked task.
5. Avoid repeating verified work.
6. Continue implementing sequentially.
7. Keep updating the checkpoint files.

If the previous session ended unexpectedly, reconcile the actual code with the last checkpoint before continuing.

Do not erase existing work.

Do not assume a usage limit can be bypassed or that execution will restart automatically.

The purpose of this system is reliable resumption when a new session becomes available.

==================================================
17 / COMPLETION CONDITIONS
==================================================

Do NOT declare the website foundation finished simply because all tasks have been attempted.

Completion requires:

- [ ] **S17-01** All available, approved foundation features implemented.
- [ ] **S17-02** Navigation and layouts verified.
- [ ] **S17-03** WORKS hierarchy correct.
- [ ] **S17-04** Contact interaction verified or external blocker documented.
- [ ] **S17-05** Functional photo carousel using available real assets.
- [ ] **S17-06** Hover and cursor behavior consistent.
- [ ] **S17-07** Footer and VISIT behavior verified.
- [ ] **S17-08** THE OTHER SIDE regression checks completed.
- [ ] **S17-09** Desktop/mobile checks completed.
- [ ] **S17-10** No known critical runtime or layout regressions.
- [ ] **S17-11** All unresolved uncertainties clearly documented.

Deferred WORLD, mannequin and optional artistic effects are excluded from this milestone.

At the end of each session, provide a short report:

DONE
IN PROGRESS
BLOCKED
REVIEW NEEDED
TEST RESULTS
EXACT NEXT STEP

Then maintain the persistent checkpoint.

START NOW.

Inspect the repository.
Build the complete persistent project plan.
Identify what is already implemented.
Immediately begin fixing the highest-priority unfinished task.
Continue through the backlog while execution resources permit.
