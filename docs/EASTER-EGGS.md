# Hidden messages and ink interactions

`src/data/easterSettings.js` configures these small interactions. `initEasterEggs(document)` installs delegated events and returns a cleanup function. The current public experience uses the existing charcoal and off-white palette.

## Centered header message

The hero's returning-visitor button is positioned absolutely at 50% of the masthead, whose equal left and right insets keep its center aligned with the viewport. It does not participate in the header's flex layout: the original h4ngelic and Berlin labels retain their positions. Its invisible target is at least 44 px tall and wide. On small screens the copy occupies a separate centered row above the hero controls.

Hovering on desktop or tapping reveals the text at 30% opacity. It fades in over 600 ms, remains revealed for 2.2 seconds, then fades out even if the pointer stays inside. Leaving and returning, or tapping again, allows rediscovery. Native keyboard activation works; visible keyboard focus provides an outline and fully readable copy for as long as the button retains focus. `aria-describedby` connects each hotspot to its message for assistive technology. Reduced motion removes opacity transitions.

Exact visitor messages are:

1. `nice to meet you.`
2. `you came back.`
3. `twice wasn't enough?`
4. `getting familiar.`
5. `we're practically friends now.`
6. `you know your way around here.` (also used for later visits)

No visitor copy or visit number appears in the visible footer.

## Reserved footer secret

On Home, `renderFooter({ home: true })` reserves 30svh of empty space after Contact and before the final footer. The future hidden hint sits at the center of that area and uses exactly `press 4 for the other side.` with the same hover/tap/focus behavior as the header.

**The hint and Other Side mode are disabled by default.** `src/data/featureFlags.js` exports `otherSideEnabled: false`. `src/footer.js` omits the hint markup while this flag is false; `src/app.js` skips the mode bootstrap and the hero material stays in its normal mode. The empty space remains. The postponed mode is not publicly advertised and pressing `4` does not activate it. The existing mode implementation remains in the repository for a later development phase; this update does not enable it.

When the actual shortcut is approved and ready, change the shared feature flag so bootstrap and hint become available together. `renderFooter({ home: true, otherSideEnabled: true })` exposes only the reusable hint markup for isolated previews/tests; revealing it never changes the mode or pretends to implement a shortcut.

Configured Instagram, email and booking destinations appear as compact footer links on interior pages. On Home the prominent Contact row already provides them. Unset destinations create no invented footer links.

## Returning visitors and privacy

Persistent visitor memory is **disabled by default** (`visits.enabled: false`). The fallback uses `nice to meet you.`. Default browsing does not access browser storage getters or methods, cookies, identifiers, analytics or a backend. Internal route changes refresh the header copy through `h4:pagechange` without creating another visit.

To enable persistence later, first integrate an appropriate consent mechanism, then set `visits.enabled: true` **and** pass a synchronous consent function:

```js
const dispose = initEasterEggs(document, {
  hasVisitorConsent: () => yourConsentIntegration.hasConsent('decorative-visitor-memory'),
});
```

The example API represents the site's future consent integration; no consent provider is included. The setting alone does not enable storage. Dispatch `h4:privacychange` after consent changes so the gate is reevaluated immediately. It also checks consent before each read and write. Withdrawal removes this feature's saved record on a best-effort basis and restores the fallback. Storage failures leave the interaction usable.

Once authorized, the only stored value is `{ count, lastSeen }` under `h4ngelic.visits.v1`, with no personal or random identifier. A new visit requires at least 30 minutes of separated inactivity; immediate reloads and internal navigation preserve the count. Activity writes are throttled to once a minute, with a checkpoint on page departure/document hiding. No permanent timer is used.

## Procedural ink traces

A completed click or tap on a noninteractive area leaves an immediate off-white pigment trace. `src/ink-imprint.js` generates fresh numeric SVG geometry for every impression: an asymmetric contour with a varying point/lobe count, irregular edges, internal dry gaps and a varying number of small organic satellite fragments. Main and satellite pigment densities vary independently. This does not reuse a stored silhouette with a new angle or scale. A longer stationary press increases size and spread.

Scrolling, dragging more than 8 px, text selection and cancelled gestures do not leave ink. Canvas, navigation, links, controls, dialogs and unconfigured contact destinations are excluded. Add `data-no-ink` to a future interactive region if its semantics are not already covered by the exclusion selector.

The default cap is 12 marks. Each lives for 2.4–3.5 seconds, then its element, animation listener and fallback timer are removed. The fixed, clipped, `pointer-events: none` layer does not enlarge the document or intercept input, and needs no animation frame loop. Reduced motion keeps the gentle fade and removes spreading transforms. Route changes, document hiding, preference changes and disposal clear active marks. These SVG traces are ephemeral interface effects, not portfolio artwork.

## Integration and verification

- Render `renderFooter({ home: true })` on Home or `renderFooter()` elsewhere.
- Call `initEasterEggs(document)` once after initial content exists; dispose it before replacing the application lifecycle.
- Dispatch `h4:pagechange` on `document` after a client-side/offline route change.
- Stable hooks include `data-secret-hotspot`, `data-secret-message`, `data-visitor-hotspot`, `data-visit-message`, `data-footer-secret-space`, `data-other-side-hint` and `data-ink-mark`.

Run `node --test tests/easter-eggs.test.js` for exact visitor copy, visit separation, consent gates, inactive/future footer markup and procedural geometry variation. With the development server running, `npm run test:easter` checks 1440/390/320 px layouts, original header label insets, exact message centering, timed hover/tap rediscovery, keyboard access, gated footer hint, unique ink contours, cleanup, input exclusions, native touch scrolling and zero default storage access. Its isolated consent fixture uses an in-memory store.
