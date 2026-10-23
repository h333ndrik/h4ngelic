# Footer and ink interactions

`src/data/easterSettings.js` contains the small interaction settings. `src/footer.js` renders semantic footer content without browser APIs; `initEasterEggs(document)` adds the behavior and returns a cleanup function.

## Ink traces

Clicking or tapping a noninteractive area leaves a small irregular off-white pigment trace. A completed tap creates the mark immediately; scrolling, dragging more than 8 px, text selection and cancelled gestures do not. Canvas, navigation, links, controls, dialogs and unconfigured contact destinations are excluded. A longer stationary press increases the size, up to 1.5 times the normal mark.

The default cap is 12 marks. Each lives for 2.4–3.5 seconds, then its element, animation listener and fallback timer are removed. The fixed, clipped, `pointer-events: none` effect layer does not enlarge the document or intercept input. It has no animation frame loop. The traces are tiny SVG interface shapes, not additional artwork or portfolio entries.

The Other Side mode changes the existing marks through the `--ink-color-1` to `--ink-color-4` variables. Reduced motion disables the spreading transform. Route changes, document hiding, preference changes and disposal clear active marks. Add `data-no-ink` to a future interactive region if its semantics are not already covered by the exclusion selector.

## A discreet footer hint

The footer contains a 44 px minimum-height mode button with an accessible name and the `4` keyboard shortcut. Its visual text starts invisible. Entering the hotspot fades the exact “PRESS 4 TO SEE THE OTHER SIDE.” hint to 35% opacity over 600 ms, holds it for two seconds and fades it away even while the pointer remains there. Leave and re-enter to discover it again.

Configured Instagram, email and booking destinations appear as compact footer links on interior pages. On Home the prominent Contact row already provides them, so the footer avoids duplicating them. Unset destinations create no invented footer links.

Keyboard focus supplies a visible outline and fully readable text for as long as the button retains visible focus. Touch users can activate the same button. After the `h4:modechange` event announces `detail.mode: 'xray'`, the text briefly becomes “YOU FOUND THE OTHER SIDE.”, then returns to the ordinary hint. `src/xray.js` owns actual mode activation, button state and the live-region announcement; the footer module owns only hint presentation.

## Returning visitors and privacy

Persistent visitor memory is **disabled by default** (`visits.enabled: false`). The nonpersistent fallback always shows “nice to meet you.” and, if configured, “visit 001”. Default browsing does not access `localStorage`, `sessionStorage`, cookies, identifiers, analytics or a backend. Internal routes can refresh the footer through `h4:pagechange` without creating another visit.

This decorative feature is not treated as technically essential. There is no assumed German/EU legal exemption and no custom consent banner in the website. To enable persistence later, first integrate a valid consent mechanism and assess the applicable requirements. Then set `visits.enabled: true` **and** pass a synchronous consent function:

```js
const dispose = initEasterEggs(document, {
  hasVisitorConsent: () => yourConsentIntegration.hasConsent('decorative-visitor-memory'),
});
```

The example consent API is a placeholder for the site's actual approved integration, not an included service. The flag alone does not enable storage. Dispatch `h4:privacychange` after consent changes so the module reevaluates the gate immediately; it also rechecks the consent function before every write. Withdrawal removes this feature's saved record on a best-effort basis and restores the nonpersistent fallback. Storage failures also leave the footer usable.

Once authorized, the only stored value is `{ count, lastSeen }` under `h4ngelic.visits.v1`. It has no personal or random identifier. A new visit requires at least 30 minutes of separated inactivity; page reloads and internal navigation update the existing visit. Activity writes are throttled to once a minute, with a final checkpoint on page departure/document hiding. No permanent timer is needed.

Exact messages are configured as: “nice to meet you.”, “you came back.”, “twice wasn't enough?”, “getting familiar.”, “we're practically friends now.” and, from visit six onward, “you know your way around here.”.

## Integration contract

- Render `renderFooter({ home: true })` on Home or `renderFooter()` elsewhere.
- Call `initEasterEggs(document)` once after the initial content is available; dispose it before replacing the application lifecycle.
- Dispatch `h4:pagechange` on `document` after a client-side/offline route change.
- The Other Side dispatches `new CustomEvent('h4:modechange', { detail: { mode: 'xray' } })` on `document`; normal mode uses `mode: 'normal'`.
- `data-ink-mark`, `data-visit-message`, `data-visit-number`, `data-xray-toggle`, `data-xray-hint`, `data-xray-hint-text` and `data-mode-status` are stable integration/test hooks.

Pure visit-counting, privacy-gate and footer-rendering checks run with `node --test tests/easter-eggs.test.js`. With the development server running, `npm run test:easter` checks actual ink/cleanup, control exclusions, hover/keyboard hint behavior, touch scrolling, default zero-storage access and an isolated consent gate at 1440/390/320px. Its consent fixture uses an in-memory fake store; it writes no personal visitor data.
