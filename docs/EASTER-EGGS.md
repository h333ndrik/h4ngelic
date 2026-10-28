# Hidden messages, local visits and ink

`src/data/easterSettings.js` configures the hidden text, local visitor memory and temporary ink. `initEasterEggs(document)` installs delegated events once and returns a disposer. The latest master brief changes the former disabled visit counter and short viewport-fixed marks.

## Header greeting

The returning-visitor hotspot stays at the exact horizontal center of the hero header, independently of the original left h4ngelic label and right Berlin label. Its target remains at least 44px high/wide. Copy is 14px on desktop and 12px on mobile; on small screens it uses a separate centered row above the controls.

Hover or tap fades the copy in over 600ms to 35% opacity. It remains briefly visible and fades automatically after the configured two-second interval, including when the pointer stays over it. Leaving/re-entering or tapping again rediscovers it. Keyboard focus adds a visible outline and fully readable copy; `aria-describedby` associates the text with its hotspot. Reduced motion removes the opacity transition.

The exact messages are:

1. `nice to meet you.`
2. `you came back.`
3. `twice wasn't enough?`
4. `getting familiar.`
5. `we're practically friends now.`
6. `you know your way around here.` (also used for later visits)

## Local visitor memory

The latest request enables persistence by default: `visits.enabled: true`, `requireConsent: false`, `showNumber: true`. Only `{ count, lastSeen }` is stored under `h4ngelic.visits.v1`. There are no personal/random identifiers, cookies, analytics requests, backend or login.

A visit requires 30 minutes of separated inactivity. Immediate reloads, section changes and enhanced route navigation do not inflate the count. Activity writes are throttled to once a minute, with a checkpoint on hiding/departure; no permanent timer runs. Re-entry merges the saved count so another tab cannot simply lower it. Missing, malformed, denied or full storage falls back gracefully to the greeting and available local state.

To disable memory, set `visits.enabled: false`; this avoids even accessing the storage getter. A host that requires an explicit consent integration can instead set `visits.requireConsent: true` and supply:

```js
initEasterEggs(document, {
  hasVisitorConsent: () => yourConsentIntegration.hasConsent('decorative-visitor-memory'),
});
```

That example represents an optional host API; no consent provider is bundled. Dispatch `h4:privacychange` when the host policy changes. With the gate enabled, reads/writes recheck it and withdrawal attempts to remove this feature's record before restoring the fallback. This optional policy must not be confused with the current owner-requested local-memory default.

## Hidden instruction and separate counter

Home reserves `30svh` after Contact. The hidden instruction is horizontally centered at 40% of that area's height, slightly above its midpoint. Both modes use the same element and position:

- Normal: `HOLD 4 TO SEE THE OTHER SIDE.`
- Other Side: `HOLD 4 TO REVERSE.`

The hint uses the same faint hover/tap/focus behavior as the greeting. The public flag is now `otherSideEnabled: true`. The control exposes `data-mode-hold`: a short pointer tap reveals the copy, a stationary one-second hold switches mode, and movement/scrolling cancels. Native keyboard/assistive button activation is an accessible untimed alternative; the ordinary `4` shortcut still requires one second. See [XRAY.md](XRAY.md).

A **separate** hidden `VISIT 001` counter sits at the horizontal center of the very bottom homepage footer with a small margin above the bottom. It is not beside the header greeting or on the mode instruction. `showNumber: false` removes this counter. The footer's small visible `sound on/off` control is the accessible transition-audio mute option. Configured contact destinations remain compact links on interior pages; unset destinations create no fabricated addresses.

## Organic ink blots

A completed click/tap on a noninteractive area creates an immediate off-white liquid stain. `src/ink-imprint.js` generates a new numeric SVG contour, protrusions, internal gaps and satellite droplets for every mark, with independent density/asymmetry. A longer stationary press increases size/spread. The appearance is an irregular ink blot, not a literal fingerprint, reused circle or generic particle burst.

Marks use page coordinates (`client + scroll`) inside an absolute document layer. Scrolling carries a mark with its original document location; it does not remain fixed in the viewport or follow the cursor. The cap is twelve simultaneous marks. Each lives for 6–12 seconds, spreads slightly, fades and removes its element, listener and fallback timer. The layer is clipped and noninteractive and needs no RAF loop. Other Side pigment uses the active corrupted palette.

Dragging more than 8px, scrolling, text selection and cancelled gestures do not create ink. Links, controls, native dialogs, the 3D canvas and unconfigured contact entries are excluded. `data-no-ink` excludes a future region when needed. Route changes, document hiding, reduced-motion changes and disposal clear marks. Reduced motion keeps the gentle fade and removes spreading transforms.

## Integration and verification

Render `renderFooter({ home: true })` on Home and `renderFooter()` elsewhere. Initialize the document controller once, and dispatch `h4:pagechange` after enhanced/offline navigation. Stable hooks include `data-secret-hotspot`, `data-secret-message`, `data-visitor-hotspot`, `data-visit-message`, `data-footer-secret-space`, `data-other-side-hint`, `data-mode-hold`, `data-mode-mute`, `data-visit-counter-hotspot`, `data-visit-number` and `data-ink-mark`.

`node --test tests/easter-eggs.test.js` checks messages, visit separation/policies, footer markup and procedural variation. `npm run test:easter` checks 1440/390/320px layouts, centering, faint timed rediscovery, separate footer positions, ink shape/lifetime/scroll anchoring, input exclusions, native touch scrolling and local memory/failure/opt-out/optional-consent behavior. Executed current results belong in [CONTROL-CORRUPTION.md](CONTROL-CORRUPTION.md).
