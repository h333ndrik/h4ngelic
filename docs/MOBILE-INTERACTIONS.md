# Mobile interactions — Phase 1

Only Phase 1 of the mobile brief is implemented. The proposed Contact-message Easter egg (Phase 2) is intentionally absent and requires the user's explicit approval after review. The existing hidden instruction and its desktop behavior are preserved.

On coarse-pointer devices, the exact h4 brand icon is a fixed, minimum-44px control on Home, Work and About. Four deliberate taps within a fixed two-second window enter The Other Side; three taps return. A small line and monogram movement show progress. The control sits above the ink layer and above the hero's bottom navigation area. Desktop keeps its existing one-second `4` hold and released `333` sequence.

`mode-taps.js` recognizes completed short pointer gestures and native keyboard/assistive activation. Swipes, long holds, canceled pointers, autorepeat, hidden/blur/navigation states, detached controls and duplicate compatibility clicks cannot manufacture taps. Incomplete sequences clear after two seconds. Accepted transitions lock until the existing controller changes mode. `mobile-mode.js` delegates preparation, sound and mode changes to `xray.js`; there is no second transition or audio implementation.

Finger movement/native panning can create sparse organic ink at the actual client position plus the current page scroll. Passive Touch Events survive the browser's pointer cancellation when native scrolling takes ownership. One scheduled frame coalesces input; a held finger is required, so inertial scrolling after release creates no synthetic traces. Marks use document coordinates, share the existing twelve-mark limit and fade after 6–10 seconds. Normal touch uses purple, green, pink and blue; Other Side adds the existing distressed image material. Desktop blank-click ink remains unchanged.

Interactive elements and the h4/hidden-instruction areas are protected. Their geometry is cached at gesture start, with fixed h4 bounds interpreted in viewport coordinates. Vertical native scrolling over the hero may leave ink; horizontal sculpture dragging keeps its original behavior. Reduced motion lowers stamping frequency and removes nonessential fracture motion.

Configuration: `src/data/easterSettings.js` (`ink.touch`) and the bounded defaults in `src/mode-taps.js`. UI appearance: `src/mobile-mode.css`. The monogram assets and sound system are reused unchanged.

Verification:

```sh
npm test
H4_BASE_URL=http://127.0.0.1:5173 npm run test:mobile
H4_BASE_URL=http://127.0.0.1:5173 npm run test:easter
H4_BASE_URL=http://127.0.0.1:5173 npm run test:xray
npm run preview:export
npm run test:standalone
```

The focused browser checks pass at 390px, 320px, reduced motion and desktop, with zero runtime errors. They use actual CDP touches and native keyboard events, not an immediate test-only mode setter. A 1,279ms native pan moved the page 321px and created five bounded traces, with sampled lifetimes 7.32–9.64 seconds and exact client+scroll coordinates. Tests also exercise actual expiry, repeated switching/audio once per mode, canceled/incomplete taps, route reachability, document anchoring, exclusions and hidden cleanup. Eleven tap-binder tests cover compatibility clicks and lifecycle edge cases.

Progress and Other Side screenshots in `artifacts/mobile-interactions/` show the real Work page. The ink-coordinate screenshots deliberately use a browser-only blank scrolling fixture; they are not artwork or a proposed page design. Chromium touch emulation and software rendering do not establish real iPhone frame rates or Safari behavior.
