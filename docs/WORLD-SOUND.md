# WORLD SOUND — 90 s loops, matched transitions (v2)

Updated 2026-11-04 on branch `v3.2-world-sound` (new commit on top of `27315c6`,
no history rewrite). Pushed PR #22 stays at `27315c6`; this pass is local only
and has **not** been pushed, merged or deployed.

Status: **IMPLEMENTED / CHROMIUM VERIFIED**. Two 90 s world loops and two 1.4 s
transitions were rendered by one deterministic synthesis script, the four
runtime M4A files were replaced, and the whole audio chain was re-verified. The
subjective listening review on real hardware is still the user's call; see
[Limitations](#limitations-and-blockers).

## What changed from v1

| | v1 (shipped at `1f87e08`) | v2 |
| --- | --- | --- |
| Loop length | 16 bars, 1,365,677 frames (30.97 s) | 90.00 s, **3,969,000 frames** |
| Loop source | externally generated masters | one deterministic renderer, `scripts/renderWorldLoops.mjs` |
| Loop seam | 4 s equal-power crossfade of the tail into the head | periodic composition + 4 s pre-roll, trimmed exactly (no blend) |
| Transition length | 1.4 s (61,740 frames) | unchanged: 1.4 s (61,740 frames) |
| Build arc | none | 0-15 s intro → layers 15-60 s → fullest 50-75 s → back to intro by 90 s |
| Committed payload | 2,087,514 B | 5,771,564 B (3x duration at the same 256 kbps) |
| Loop decoding | required 44.1 kHz device context | accepts any device rate, duration-exact |

## One renderer for all four files

```sh
node scripts/renderWorldLoops.mjs --out work/world-sound-v2 --flac --determinism
```

- `--out DIR` output directory (default `work/world-sound-v2`), `--flac` also
  writes local FLAC derivatives, `--determinism` re-renders every asset and
  compares hashes, `--only=NAME` renders a single file.
- Pure Node, zero runtime and zero build dependencies; `ffmpeg` (and on macOS
  `afconvert`) are local build tooling only. Nothing in the site calls them.
- One seed per file, recorded below; the script uses no `Math.random`.

| File | Seed | Role |
| --- | --- | --- |
| `loop-333` | `0x333a11ce` | WORLD 333, clean |
| `loop-4` | `0x4c0ffee1` | WORLD 4, corrupted |
| `x-333-4` | `0x33340001` | 333 → 4 one-shot |
| `x-4-333` | `0x43330001` | 4 → 333 one-shot |

## Loop construction — periodic by design, no crossfade

The earlier brief described an equal-power wrap blend. That method was replaced
by something that removes the blend entirely, because a blend between two
different points of a *coherent* drone adds a measured level bump in the first
seconds of every loop:

1. Every sustained oscillator and LFO frequency is snapped to the 1/90 Hz grid,
   so each voice completes a whole number of cycles per loop and the phase at
   sample 0 equals the phase at sample 3,969,000. Worst case detune is
   **0.08 cent** (`43.6556` instead of `43.6535` Hz).
2. Every envelope, filter drift and event position is a function of loop phase,
   never of absolute render time.
3. The noise bed is filtered twice over the identical noise stream. Pass 1
   primes every filter state; pass 2 starts from the state the loop ends on.
4. The renderer writes 94 s: a 4 s pre-roll at loop phase 86-90 s, then loop
   phase 0-90 s, so the echo and reverb arrive at the first loop sample already
   warmed. The loop is trimmed at exactly 3,969,000 frames.

The result is a loop whose last sample and first sample are adjacent points of
the same continuous, periodic signal.

## Build arc

| Loop phase | What happens |
| --- | --- |
| 0-15 s | pink/chrome bed, F1 sub, F2/Ab2 anchors, C6 shimmer, 124 BPM sub pulse, slow air |
| 16-30 s | C3 drone enters (16→30 s), first sparse pentatonic notes (from 23 s) |
| 28-45 s | Eb3 drone (28→43 s), metallic ticks (28-70 s), F3 drone (38→53 s) |
| 46-60 s | high F5 shimmer voice (46→62 s), echo density, whale call (~58 s) |
| 54-70 s | nature layer: chirp phrases, insect grains, second whale call |
| 50-75 s | fullest state |
| 70-90 s | layers leave one at a time, master arc returns to the intro value |

Master arc gain, applied late in the chain so the effects follow it:
`0 s .56 → 12 s .60 → 26 s .69 → 45 s .83 → 58 s .95 → 70 s 1.0 → 79 s .90 → 90 s .56`.

Measured 5 s RMS after mastering (dBFS, both channels):

| Loop | 0 s | 15 s | 30 s | 45 s | 60 s | 75 s | 85 s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| WORLD 333 | −22.9 | −22.7 | −20.9 | −19.7 | −18.4 | −21.3 | −23.9 |
| WORLD 4 | −18.3 | −20.0 | −16.1 | −14.8 | −16.0 | −15.0 | −17.4 |

First 2 s versus last 2 s level: **+0.43 dB** (333) and **−0.48 dB** (4). The
seed law is "the last seconds are the intro texture again", and it holds.

Band balance (octave bands, dB relative to total energy). Low end is restrained
instead of dominant; the 1046.5 Hz anchor sits in the 1-2 kHz band:

| Loop | 20-60 | 60-120 | 120-250 | 250-500 | 500-1k | 1-2k | 2-4k | 4-8k | 8-16k |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 333 | −4.3 | −7.2 | −7.4 | −14.4 | −22.0 | −22.0 | −26.3 | −28.3 | −28.2 |
| 4 | −3.6 | −7.2 | −9.3 | −14.3 | −18.3 | −24.0 | −32.7 | −36.0 | −31.5 |

## Shared anchors

All four files are built from the same four anchors: **F1 sub 43.6535 Hz**,
**F2 87.3071 Hz**, **Ab2 103.8262 Hz** and the **bright metallic C6**
**1046.5023 Hz**. They are continuous drones in both loops (they never fade and
never change pitch), so any exit point of either loop is harmonically compatible
with a transition that starts or ends on them. World 4 warps the *upper* layers,
never the anchors themselves.

Spectral presence of the anchors, measured with a Hann-windowed 8192-sample probe
and reported relative to the local RMS:

| Probe | Loop | 43.7 Hz | 87.3 Hz | 103.8 Hz | 1046.5 Hz |
| --- | --- | ---: | ---: | ---: | ---: |
| 2.5 s | 333 | −11.5 | −13.4 | −16.7 | −33.5 |
| 44 s | 333 | −13.9 | −15.9 | −19.6 | −32.8 |
| 78 s | 333 | −10.5 | −13.0 | −18.0 | −33.6 |
| 2.5 s | 4 | −13.7 | −14.4 | −22.1 | −42.2 |
| 44 s | 4 | −23.4 | −22.3 | −25.3 | −39.5 |
| 78 s | 4 | −24.3 | −18.0 | −23.6 | −37.1 |

The levels differ with the build arc because the probe is relative to a local
RMS that rises by ~5 dB at the fullest state; the absolute anchor levels are
constant. `tests/world-sound-v2.test.js` asserts every anchor stays inside
−45…−6 dB relative at all three positions in both loops.

## Transitions

Both one-shots are exactly 61,740 frames (1.4 s). They are never truncated or
early-faded; the only taper is a 6 ms de-click on the very last samples, after
the music has already resolved. The loop crossfade stays at
`getLivingDecaySettings().modeTransitionMs` (currently 900 ms) and is not
derived from the file length.

| File | 0 s | middle | end |
| --- | --- | --- | --- |
| `x-333-4` | clean root drone + bright 1046.5 Hz ping | filtered-noise swell rising, metallic pitch-stretch glides down an octave, bitcrush dissolve | crushed 1046.5 Hz ping + detuned root |
| `x-4-333` | darker root + soft crushed ping | reverse swell, high shimmer cluster, rising glide back to 1046.5 Hz | dry, clean 1046.5 Hz ping + clean root |

## Delivery files

All four runtime files are 44.1 kHz stereo, 256 kbps AAC-LC in an MP4/M4A
container, encoded by macOS AudioToolbox (`afconvert`) and remuxed bit-exactly
with `ffmpeg` so the container is reproducible. On hosts without `afconvert`
the script falls back to `ffmpeg`'s native AAC encoder and records that in the
report.

| Runtime path | Frames | Bytes | SHA-256 | LUFS | True peak |
| --- | ---: | ---: | --- | ---: | ---: |
| `public/assets/audio/loop-333.m4a` | 3,969,000 | 2,841,326 | `d24116589b691f66e7723e6bca8d0a6d8bb67d502c4d94af52050ae3c01ae66c` | −18.0 | −5.8 dBFS |
| `public/assets/audio/loop-4.m4a` | 3,969,000 | 2,851,489 | `da82d0ee5ec7d17a2ac1080de9dbd76603e17dc420d6f38460f3442f079ed994` | −18.0 | −4.7 dBFS |
| `public/assets/audio/x-333-4.m4a` | 61,740 | 39,865 | `94ee50b3d914cef49d6f1f47e58351c3763d82f4d394c2430cfc47f397c1df6a` | −18.1 | −9.5 dBFS |
| `public/assets/audio/x-4-333.m4a` | 61,740 | 38,884 | `87e842957ec6d30938bdd1316f6058a4ddf0a4c5c167457e985745d47e7252a2` | −18.1 | −9.6 dBFS |

Exactly four audio files are committed. `tests/world-sound.test.js` asserts the
directory listing, byte sizes and hashes; `tests/world-sound-v2.test.js` asserts
the same values against the recorded render evidence.

### Local masters (not committed)

WAV and FLAC masters stay in `work/world-sound-v2/` on the build machine and are
deliberately absent from Git.

| Master | Bytes | SHA-256 |
| --- | ---: | --- |
| `loop-333.wav` | 23,814,044 | `52d6d70d4c2d4d202b6f2949e35ff1df086f7ca767354dabe6960113764e0f57` |
| `loop-4.wav` | 23,814,044 | `7166258389ab235486b2e4776395d8b4e5ed48cbf992013dfa5f1e57d93f994b` |
| `x-333-4.wav` | 370,484 | `8a98e8a2753812042c13105b7d6c663438b13e5401a00cf687b7a2b8e07fcf71` |
| `x-4-333.wav` | 370,484 | `9cc4aba6fcc9c291e5f60f3a61d6d05576a001767ee56f7215986a383871c271` |
| `loop-333.flac` | 18,062,831 | `6939c16d18ffb3b6bee9f8674babb54fe5a983f133948339573b973030d625e1` |
| `loop-4.flac` | 17,413,785 | `6caecb2ba05f0d8b31d993b84d9ac12154ef3aef25c8745df45de2f6f0bcd40d` |
| `x-333-4.flac` | 305,988 | `167befc1181ced238751d0851348a04e7bb9328bddabac1cc887419e69000bd6` |
| `x-4-333.flac` | 287,402 | `ac77ed4a18730841825eb93129c366b5a1c6d58f59284e54b3d959925ae21569` |

FLAC is lossless but ~6x larger than the M4A here, because the material is
noise-rich; it exists as a decode reference and as the second fallback format.

### Payload

| Set | Bytes | Note |
| --- | ---: | --- |
| v1 WAV masters (local only) | 17,129,180 | the eight files removed from history in the earlier pass |
| v1 committed M4A set | 2,087,514 | 31 s loops |
| **v2 committed M4A set** | **5,771,564** | 90 s loops, same 256 kbps |
| Previously generated FLAC set (v1) | 13,345,377 | not committed |

v2 is 3,684,050 bytes larger than v1 (+176.5%) and still 11,357,616 bytes
smaller than the v1 WAV masters. The increase is the requested threefold loop
duration at the same bitrate, not a format regression. Lazy loading is
unchanged: a first visit fetches only the active loop (2.84 MB) after the first
trusted gesture; the other loop and the matching transition are prewarmed from
the mode-start gesture.

## Seam evidence

Master WAV, 90 s loop point, both channels summed:

| Loop | Seam step | Mean internal step | Ratio |
| --- | ---: | ---: | ---: |
| 333 | 0.1353 | 0.0620 | 2.18x |
| 4 | 0.0046 | 0.0066 | 0.69x |

Chromium `decodeAudioData` of the committed M4A, per channel:

| Loop | Channel | Seam step | Mean step | Rank among internal steps |
| --- | --- | ---: | ---: | ---: |
| 333 | L | 0.0865 | 0.0612 | 73.8th percentile |
| 333 | R | 0.0444 | 0.0614 | 48.3rd percentile |
| 4 | L | 0.0003 | 0.0065 | 3.0th percentile |
| 4 | R | 0.0011 | 0.0065 | 12.1rd percentile |

The seam is ordinary sample-to-sample movement, not a discontinuity. Before the
switch to the AudioToolbox encoder, ffmpeg's native AAC left a constant 0.042
offset over the first 512 samples of `loop-4`; that is the artifact the encoder
change removes. The first and last 20 ms of every decoded loop stay non-zero, so
no encoder fade is added.

Frame counts after `decodeAudioData` (Chromium, 44.1 kHz offline context):

| Asset | WAV frames | FLAC frames | M4A frames |
| --- | ---: | ---: | ---: |
| WORLD 333 loop | 3,969,000 | 3,969,000 | 3,969,000 |
| WORLD 4 loop | 3,969,000 | 3,969,000 | 3,969,000 |
| 333 → 4 | 61,740 | 61,740 | 61,740 |
| 4 → 333 | 61,740 | 61,740 | 61,740 |

## Determinism

`--determinism` re-renders each file from scratch in the same run and compares
both the WAV and the M4A. All four pairs were byte-identical
(`docs/validation/world-sound/v2/render-report.json`, `determinism.identical:
true`). `tests/world-sound-v2.test.js` repeats the check for `x-4-333` in a
temporary directory on every test run.

## Runtime format fallback

`worldSoundSettings.paths` still holds ordered candidate arrays for every asset:
**M4A → FLAC → WAV**. The engine accepts a candidate only after checking channel
count, sample rate against the *device* rate, and a frame count that matches the
master duration exactly:

```
expectedFramesAtDeviceRate = round(masterFrames * deviceRate / 44100)
```

This is a real fix in this pass: `decodeAudioData` always returns a buffer at the
context rate, so on a 48 kHz output device the old strict 44.1 kHz check made
every world loop resolve to `missing` and the site went silent. 90 s at 48 kHz
is exactly 4,320,000 frames; encoder padding still fails the check and moves to
the next candidate.

Only the M4A candidates are deployed. The FLAC/WAV URLs are ready fallback paths;
adding those files later makes the fallback audible without component changes.
When every candidate fails the asset is recorded `missing` and stays silent — no
substitute audio is synthesized.

## Module map

| File | Responsibility |
| --- | --- |
| `scripts/renderWorldLoops.mjs` | Deterministic synthesis, 24-bit WAV masters, AAC/FLAC derivatives, loudness, seam/anchor/band analysis, determinism check. Build tooling only. |
| `src/audio/worldSoundSettings.js` | The only configuration source for paths, mode mapping, world gains, bus/transition gains, activation/crossfade timing, limiter, ducking, one-shot voice cap and the 90 s / 1.4 s duration contract. |
| `src/audio/worldSound.js` | Shared loop transport, `AudioBufferSourceNode.loop`, per-world gain crossfades, transition one-shots, lazy decode/cache, device-rate validation, missing-asset state and voice cap. |
| `src/mode-audio.js` | Existing central controller extended with the world engine: one `AudioContext`, master volume/mute, SMASH priority, visibility suspension, route persistence and preference storage. |
| `src/xray.js` | First-trusted-gesture unlock, mode-change handoff, target prewarm and visibility plumbing. No second audio controller exists. |
| `src/sound-controls.js` | Existing SOUND ON/OFF and volume UI; unchanged public controls drive the complete mix. |

`normal` maps to `333`; `xray` maps to `4`. The old synthesized 0.7 s mode cues
remain disabled by `modeAudioSettings.modeSoundsEnabled: false`.

## Playback and lifecycle

1. Page load creates no `AudioContext`, fetch or decode. The first trusted
   `pointerdown` or `keydown` creates the existing controller context and
   activates the current world loop.
2. The active loop is fetched and decoded once. The other loop and the relevant
   transition are prewarmed from an accepted mode-start gesture. Decoded buffers
   are reused across routes and mode reversals.
3. `AudioBufferSourceNode.loop = true`, `loopStart = 0` and
   `loopEnd = buffer.duration` provide sample-based looping. There is no
   `<audio>` element loop.
4. A mode change starts the matching 1.4 s one-shot and crossfades the loop
   gains. The incoming loop starts at the shared transport phase instead of
   restarting at sample zero.
5. The outgoing loop is stopped after the crossfade plus its bounded grace
   period. A retarget cancels that stop and reuses the still-running source.
6. One-shot transition voices are capped at two and the oldest is faded out if
   the cap is reached.
7. The world bus is `world bus → lowpass → compressor/limiter → duck gain →
   existing central master gain`. SMASH ducks the complete world and transition
   bus, then releases the duck on stop or natural end.
8. SOUND OFF ramps the master to zero and suspends the context. SOUND ON resumes
   the same context and transport. A hidden document suspends it and visible
   resume continues the current position.

## Tuning

Change paths, per-world gains, bus/transition levels, activation fade, lowpass,
limiter and ducking only in `src/audio/worldSoundSettings.js`. Do not duplicate
paths in components. The crossfade remains tied to
`src/data/livingDecaySettings.js:modeTransitionMs`.

To replace a loop, re-run the renderer and keep the 3,969,000-frame grid at
44.1 kHz, the periodic tuning, non-zero boundaries and the four anchors. Update
`expectedFrames` and `seconds` only in `worldSoundSettings.js`, plus the hashes
in `tests/world-sound.test.js` and the evidence file. A bad replacement must show
up as `BLOCKED` in tests, never as invented sound.

## Listening checklist

1. **Loop seam, ~90 s.** Listen through at least three wrap points per world on
   headphones and on speakers. There must be no click, no dropout, no doubled
   downbeat and no reverb reset. Compare the last seconds before the wrap with
   the intro texture that follows.
2. **Build arc.** Both loops should start sparse, fill in slowly, sit fullest
   around 50-75 s and be back at the intro texture at the wrap. It should never
   feel like a drop.
3. **Transition sync.** Switch 333 → 4 and 4 → 333 while watching the visual
   tear. The 1.4 s one-shot must start with the tear and play to its end; the
   loop crossfade follows the live visual setting (900 ms), so the tail of the
   one-shot deliberately overlaps the new loop.
4. **World-4 density.** Compare both worlds at the site's quiet level. The
   corrupted material should keep the same melodic thread — recognisable, worn,
   never harsh noise, never louder than WORLD 333 in the low end.
5. **SMASH ducking.** Start and stop SMASH in both worlds. The loop and any
   transition should duck smoothly, never stop or lose phase, and recover to the
   same level.
6. **iOS silent switch.** On a real iPhone, test the hardware silent switch in
   both positions after a fresh gesture, then test route changes, backgrounding
   and resume. Record the device, iOS version and observed behaviour; never infer
   it from Chromium.
7. **Mute and volume persistence.** Change volume and mute, reload, and confirm
   the saved state without an early `AudioContext` or audio request. SOUND OFF
   should suspend; SOUND ON should resume the existing transport.
8. **Tab suspension.** Hide and restore the tab. Audio should suspend while
   hidden and continue from the same transport position on return.

## Verification (2026-11-04, this pass)

| Check | Actual result |
| --- | --- |
| `npm test` (outside sandbox) | **393 passed, 0 failed** (385 baseline + 8 new audio tests) |
| `tests/world-audio-formats-browser.mjs` | **4/4 files PASS**: 3,969,000 / 61,740 decoded frames, continuous non-zero boundaries, head/tail 2 s within 2 dB, **0 long tasks**, 0 console errors |
| `tests/world-sound-browser.mjs` | **6/6 profiles PASS** at 1440/390/320 × full/reduced, both modes, plus missing-file degradation |
| `tests/mode-audio-browser.mjs` | PASS: gesture-only startup, no legacy cue, both file transitions, one shared context, route/mute persistence |
| `tests/sound-controls-browser.mjs` | **8/8 profiles PASS**: mute suspension, volume, keyboard/touch/persistence, no early requests |
| `tests/smash-v31-browser.mjs` | PASS at 1440/390/320: exact file, deferred fetch, native attack/tail/stop, world-bus duck/release |
| `npm run build` | PASS: 18 routes + 404 prerendered; exactly the four M4A files copied with unchanged hashes |
| Determinism | 4/4 files byte-identical on re-render (WAV + M4A) |

Evidence: `docs/validation/world-sound/v2/render-report.json` (synthesis,
loudness, seams, anchors, bands, determinism), `format-decode.json`,
`world-sound-browser.json`, `sound-controls.json`, `smash.json`.

The build's `prebuild` step re-encodes `public/images/optimized/*`; those files
were restored after the build and are not part of this commit.

## Limitations and blockers

- **Real iOS Safari: BLOCKED.** No physical iPhone or iOS runtime is available.
  Chromium touch emulation verifies gesture unlock, not Safari autoplay,
  interruption, route or hardware-output behaviour.
- **User-triggered mid-transition re-switch: BLOCKED at the visual integration
  boundary.** The audio engine retargets a second crossfade without restarting
  its transport, and the browser suite exercises that path through the test-only
  controller hook. The existing visual mode controller still rejects a second
  mode command while its capture is active, so no end-to-end gesture reaches it.
- **Subjective listening review: OPEN for the user.** All automated checks pass;
  musical judgement on real speakers is not something this pass can claim.
- **Device-rate resampling:** on a 48 kHz output device the browser resamples the
  44.1 kHz masters. Duration and loop length stay exact, but the samples are
  resampled by the platform. Recorded here because it is now an accepted path
  instead of a silent failure.
- The deployed package has no FLAC/WAV fallback files; the candidate chain is
  tested, production fallback becomes audible only if those files are added.
- **OBSERVATION, outside audio scope:** `tests/mobile-interactions-browser.mjs`
  still fails its no-cold-WebGL-on-About assertion on this branch and on base
  `11e78a1`. Existing diagnostics: `docs/validation/world-sound/mobile-interactions-current.json`
  and `mobile-interactions-base.json`. Not touched in this pass.

## Deferred work

Still **TODO**, not part of this pass:

- Hero first-touch cue.
- Color-mapped ink impact sounds.
- THE OTHER SIDE ambience layer independent of the mode loops.
- A downloadable offline preview package for the new 5.8 MB M4A set.
