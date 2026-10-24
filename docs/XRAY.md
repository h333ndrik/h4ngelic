# The other side — postponed

The latest approved homepage brief explicitly postpones The Other Side / X-Ray
Mode. The current public experience uses the original `#303033` charcoal
palette. Pressing `4` or numpad `4` does not change it. No solarization,
false-color treatment or global distressed filter is initialized.

The earlier implementation remains in the repository as dormant development
material. Its presence is not a public feature or a completed part of this
homepage refinement. Existing filenames, event names and the internal `xray`
identifier are retained for that future work.

## One release boundary

`src/data/featureFlags.js` contains the shared gate:

```js
export const featureFlags = {
  otherSideEnabled: false,
};
```

The flag controls three related integration points:

| Integration | Behavior while `false` |
| --- | --- |
| `src/app.js` | Does not dynamically import or initialize `src/xray.js` |
| `src/main.js` | Does not import or attach `src/wordmark-xray.js` to the chrome material |
| `src/footer.js` | Omits the public shortcut hint and control from rendered HTML |

The dormant controller's filters, overlay and local texture therefore do not
initialize in the normal application. The hero retains its ordinary chrome
material and tattoo-reveal treatment. Dynamic modules may still exist in build
output; the disabled application does not request or start them.

After the homepage Contact section, `.footer-secret-space` reserves `30svh`
of empty space. When future work makes the shortcut ready for public use, the
same flag allows the centered hidden hint:

`press 4 for the other side.`

Its interaction is already built using the same hidden-message behavior as the
header visitor hotspot: hover/tap discovery, low-opacity text, timed fade and
keyboard access. The default build leaves the reserved area empty so it does
not advertise an unavailable shortcut. See [EASTER-EGGS.md](EASTER-EGGS.md).

The flag is a future activation mechanism, not approval to release the mode.
Leave it `false` for this refinement. A later task can review the dormant
implementation, finish the intended art direction, enable the shared flag and
rebuild the site. Changing content, adding artwork or editing ordinary motion
does not require enabling it.

## Prepared one-second shortcut

The follow-up request is prepared behind that same disabled flag. In the dormant
controller, hold `4` or numpad `4` continuously for at least **1,000 ms** to enter
or leave the mode. Short taps do nothing and never accumulate. Keeping the key
held toggles only once; release it before starting another hold.

`src/data/xraySettings.js` exposes `shortcutHoldMs: 1000`.
`src/xray-shortcut.js` uses one cancellable timer, with no animation loop.
Key release, window blur, a hidden document, text composition, modifiers,
entering an editable field or page navigation cancels an unfinished hold.
Typing fields and browser shortcuts keep their normal behavior. Disposal removes
the timer and listeners. `tests/xray-shortcut.test.js` checks the 999/1,000 ms
boundary, repetitions, cancellations and cleanup with a deterministic clock.

This preparation does **not** activate the public mode or its hint. The user
explicitly confirmed that it should stay disabled.

## Retained development material

These files belong to the previous mode implementation:

- `src/xray.js`, `src/xray.css`: controller, palette and media treatment.
- `src/data/xraySettings.js`: configurable tonal curves, palette, texture
  strength, transitions and constrained-device treatment.
- `src/wordmark-xray.js`: optional color processing inside the existing
  wordmark material shader.
- `scripts/assets/xray-distress.svg` and `npm run assets:xray`: editable texture
  source and its offline rasterization step.
- `scripts/measure-xray.mjs`: historical mode-comparison measurement tooling.

The former mode used document-memory state and local assets without browser
storage or external tracking. Its earlier keyboard, touch, media-pixel and
runtime observations are retained in the historical reports. They do not prove
that a future activation meets the new brief.

## Verification scope

`npm run test:xray` now guards the postponed state. Against a running server it
checks desktop, touch and reduced-motion profiles on Work, About and Home:
ordinary charcoal presentation, inert `4`/numpad shortcuts, absent public hint,
no mode filters/overlay/controller/shader/texture requests, and the reserved
homepage footer space. `H4_BASE_URL` selects a different server, including a
built preview. Tests of pure dormant color helpers can remain in `npm test`
without making the mode public.

Current build, browser and performance results belong in
[REFINEMENT-REPORT.md](REFINEMENT-REPORT.md). [FINAL-REPORT.md](FINAL-REPORT.md)
and [MASTER-PERFORMANCE.md](MASTER-PERFORMANCE.md) retain actual PR-9 results,
including the earlier active-mode pixel comparisons and timings. Those values
are historical and are not measurements of this refinement.
