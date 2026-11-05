# WORLD SOUND — real-source 90 s loops and matched transitions (v3)

Updated 2026-11-05 on local branch `v3.2-world-sound` (new commit on top of
`4ab1a75`, no history rewrite). Not pushed, merged or deployed.

Status: **IMPLEMENTED / CHROMIUM VERIFIED**. The four runtime M4A files are cut
from the user-supplied sources, decoded at the exact frame count, and exercised
by the unit and browser suites. Subjective listening remains the user's call;
see [Listening checklist](#listening-checklist) and
[Limitations](#limitations-and-observations).

## What changed from v2

| | v2 | v3 |
| --- | --- | --- |
| Loop source | synthesized by `scripts/renderWorldLoops.mjs` | real user-supplied `.mov` audio, cut to 90 s |
| Loop length | 90.00 s / 3,969,000 frames | unchanged |
| Loop seam | periodic render, no blend | 8 s wrap blend, head preserved byte-exactly |
| Transition source | synthesized | two user-supplied whoosh SFX |
| Transition length | 61,740 frames (1.4 s) | **39,690 frames (0.9 s, the visual transition config)** |
| Producer | `renderWorldLoops.mjs` | `scripts/buildWorldSound.mjs` |
| Committed M4A set | 5,771,564 B | **5,680,943 B** |
| Key | authored F minor grid | measured per source, see below |

`scripts/renderWorldLoops.mjs` remains in the repo as the v2 renderer and is no
longer used to produce the delivered files. `scripts/buildWorldSound.mjs` is the
current producer and validator.

## Sources

All four files were measured on disk; raw ffprobe JSON is under
`docs/validation/world-sound/measurements/`.

| ID | File | Container / codec | Rate | Channels | Duration | SHA-256 |
| --- | --- | --- | ---: | ---: | ---: | --- |
| loop-333 | `~/Desktop/h4ngelic_sounddesign.mov` | MOV / MP3 audio stream | 44.1 kHz | 2 | 313.531519 s | `21edd9ee0e487c82956fdb0499f0fcb8a4b75de3bdcc0ac9cca54bed450aa807` |
| loop-4 | `~/Desktop/h4ngelic_sounddesign_2.mov` | MOV / MP3 audio stream | 48 kHz → 44.1 kHz | 2 | 232.934208 s | `98024fc04622902c8dffe19d3dd82ac7de7e2d7376d70f23fd3393ba96f13f4b` |
| sfx-a | `~/Downloads/poorartistt-cinematic-whoosh-sfx-type-05-566460.mp3` | MP3 | 48 kHz → 44.1 kHz | 2 | 3.024000 s | `bc319429e24c46671b49fcc95d7fef0535ab5329e737f317ee8fab7df9d0e269` |
| sfx-b | `~/Downloads/poorartistt-cinematic-whoosh-sfx-type-06-566459.mp3` | MP3 | 48 kHz → 44.1 kHz | 2 | 3.024000 s | `8ef8fb6a5516870068b2e591dfdd91551ed4b6eb02d2760138d0a4034c3098df` |

Origin: user-supplied files, stated as user-owned. **License verification is the
user's responsibility; this pass cannot verify ownership or clearance.**

Measured source loudness (ffmpeg `ebur128=peak=true`):

| ID | Integrated | True peak | LRA |
| --- | ---: | ---: | ---: |
| loop-333 | −26.6 LUFS | −12.6 dBFS | 5.8 LU |
| loop-4 | −16.0 LUFS | −5.1 dBFS | 3.5 LU |
| sfx-a | −7.7 LUFS | +1.8 dBFS | 20.0 LU |
| sfx-b | −10.1 LUFS | +1.1 dBFS | 20.0 LU |

The `loudnorm` cross-check landed within 0.3 dB on both loops.

### Extraction

```sh
ffmpeg -y -i h4ngelic_sounddesign.mov   -vn -map 0:a:0 \
  -acodec pcm_s24le -ar 44100 -ac 2 masters/loop-333-source.wav
ffmpeg -y -i h4ngelic_sounddesign_2.mov -vn -map 0:a:0 \
  -af "volume=<gain>" -acodec pcm_s24le -ar 44100 -ac 2 masters/loop-4-source.wav
```

Loop 4 was resampled 48 → 44.1 kHz by ffmpeg's default resampler. The two `.mov`
files are different takes: duration gap 80.6 s and RMS correlation 0.2205 (below
the documented 0.5 threshold), so they were not treated as duplicates.

Local masters (gitignored, never committed):

| Master | Bytes | SHA-256 |
| --- | ---: | --- |
| `masters/loop-333-source.wav` | 82,960,542 | `c631a8ae396d922fdd8710e0fce48f271c86ee612dd24f2caf180ce824f9ea9c` |
| `masters/loop-4-source.wav` | 61,634,490 | `35f6f8a5cac780d7ed5a4d5b807c48294695e11fb3563889a2070a1fa3a54771` |

### Key analysis

Method: Krumhansl-Schmuckler correlation over a 12-bin chroma vector
(8192-sample Hann FFT, 55–2200 Hz, first 90 s).

| Loop | Best key | Correlation | Confidence | Runner-up |
| --- | --- | ---: | ---: | --- |
| 333 | A minor | 0.867 | 0.123 | F major 0.744 |
| 4 | F major | 0.800 | 0.064 | D minor 0.736 |

Neither source measures as **F minor**, and both correlations are too close to
call the mode confidently. No pitch shift was applied: a ±3-semitone guess on
ambiguous material would damage the user's own mix more than it would help.
The handover is therefore harmonious by shared pitch material (F/A/C is present
in both chroma sets) and by the matched sub/ping anchors, not by a forced
transposition. If the user wants a literal F-minor grid, re-cut with an explicit
transpose decision; see [How to change the vibe](#how-to-change-the-vibe).

## Loop contract

- `LOOP_SECONDS = 90`, `LOOP_FRAMES = 3,969,000`, one constant for both worlds.
- `WRAP_SECONDS = 8`. Frames `0 .. N-W` are a byte copy of the master (head
  preserved); only `N-W .. N` is written from floats.
- No pitch shift, no time-stretch, no silence padding.
- First 88,200 frames (2 s) are bit-identical to the source head.

### Wrap shape (measured deviation from the literal brief)

The brief's literal shape (outgoing tail + incoming head with full head gain at
the final sample) was built and measured. It fails the seam gates on both loops:
loop 4 drops **36.27 dB** at the loop point because its head starts in natural
silence; loop 333 fails level continuity at **4.95 dB**. The rejected variant and
its gate values are stored as `specVariant` in
`docs/validation/world-sound/v3-build.json`.

Delivered shape: the outgoing tail follows a smooth dB ramp to the measured
intro level, then a 2 ms equal-power handoff to loop frame 0. Length is
`max(lead-in + 2 ms, 2 ms)`.

| Loop | Tail level | Intro level | Fade applied | Handoff | Lead-in |
| --- | ---: | ---: | ---: | ---: | ---: |
| 333 | −16.87 dB | −29.26 dB | −12.39 dB | 89 frames | 1 frame |
| 4 | −14.15 dB | −64.14 dB | −50.00 dB | 184 frames | 96 frames |

### Seam gates (both pass)

| Gate | 333 | 4 | Limit |
| --- | ---: | ---: | --- |
| Seam step | 0 | 0 | ≤ p95 of last 2 s (`0.006425` / `0.000027`) |
| Level continuity, last vs first 250 ms | 0.03 dB | 0.05 dB | ≤ 1.0 dB |
| Seam transient over surrounding 2 s | −0.65 dB | −2.83 dB | ≤ +3 dB |
| Max 100 ms loudness gradient, last 3 s | 1.47 dB | 0.90 dB | ≤ 1.5 dB |

Head preservation, first 88,200 frames:

| Loop | Source head SHA-256 | Loop head SHA-256 |
| --- | --- | --- |
| 333 | `76a0f10eb943624fc6f104d6e9034dba6c8980a29f75e7899f2676cc38ccfe06` | identical |
| 4 | `ce83a6f4186324031ce449f7e3972e9c6a675929d815690a91f02eb6a3bdc7b4` | identical |

## Transitions

The one-shot length is read from the live visual config in
`src/data/livingDecaySettings.js` (`modeTransitionMs = 900`), not hardcoded in
the audio layer: `TRANSITION_FRAMES = round(0.9 × 44100) = 39,690`. This
supersedes the older 1.4 s cut; a 1.4 s file would outlive the 0.9 s picture.
The file is played in full — never truncated, never early-faded.

Cut procedure: remove the measured leading silence sample-exactly, then take a
39,690-frame window centred on the global bass-energy peak (20–250 Hz RMS over
100 ms windows, 10 ms hop), with 20 ms fades on the window edges only.

| ID | Onset removed | Trimmed body | Peak (source) | Peak RMS | Window start (source) | Frames | Sweep |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| sfx-a | 0.3502 s | 109,208 | 1.550 s | −2.72 dB | 1.1252 s | 39,690 | rising |
| sfx-b | 0.1846 s | 111,232 | 1.135 s | −3.68 dB | 0.7096 s | 39,690 | falling / impulsive |

Mapping, stored as reversible data in `worldSoundSettings.transitionRouting`:

| Direction | File | Why |
| --- | --- | --- |
| 333 → 4 | `x-333-4.m4a` | rising sweep = chrome melting into the corrupted world |
| 4 → 333 | `x-4-333.m4a` | falling/impulsive sweep = cleansing release back to clean chrome |

Swap the two values in `transitionRouting` to reverse the mapping without
renaming files or editing logic. `BED_DIP_DB = -6`; the bed is dipped by one
cosine bowl over the crossfade window, and if SMASH is active the deeper of the
two attenuations applies (`min`, never the sum).

## Delivered files

44.1 kHz stereo, 256 kbps AAC-LC, AudioToolbox encode + `ffmpeg` bit-exact
remux. Exactly four files are committed.

| Runtime path | Frames | Bytes | SHA-256 | LUFS | True peak |
| --- | ---: | ---: | --- | ---: | ---: |
| `public/assets/audio/loop-333.m4a` | 3,969,000 | 2,847,109 | `d28de00523a59d246403c8edfcfc0ff169b4b99943fa6c7b9ff4dbc8e697f821` | −18.0 | −3.4 dBFS |
| `public/assets/audio/loop-4.m4a` | 3,969,000 | 2,774,228 | `ab235d059fec354ebbdf60e0e056e7469883489194825a8d25ea7211f86f8476` | −18.0 | −6.3 dBFS |
| `public/assets/audio/x-333-4.m4a` | 39,690 | 30,015 | `5ee49fedc6d43cb0e144b7e5272ae13086fe2e9728d2e90fb4dba297e4447090` | −18.0 | −10.6 dBFS |
| `public/assets/audio/x-4-333.m4a` | 39,690 | 29,591 | `477df723d4d9de83c3757aad3cd0958de53b92444fa616225aa7c4346a102878` | −18.1 | −9.3 dBFS |

All four true peaks stay below −1 dBTP; every loop sits at −18.0 LUFS.

### Payload

| Load | Bytes |
| --- | ---: |
| First gesture (active loop only) | 2,847,109 |
| First mode switch (other loop + its transition) | 2,804,243 |
| Return switch (reverse transition) | 29,591 |
| Full four-file set | 5,680,943 |

Nothing is fetched before the first trusted gesture. Decoded buffers are cached;
repeated switching neither re-fetches nor re-decodes.

### Fallback

`worldSoundSettings.paths` keeps ordered candidates **M4A → FLAC → WAV** for
every asset. A candidate is accepted only after `decodeAudioData` and an exact
frame-count check (`round(masterFrames × deviceRate / 44100)`), so encoder
padding can never shift the loop seam. Only the M4A files are deployed; adding
FLAC/WAV files later makes the fallback audible with no component change.

## Runtime wiring

| File | Responsibility |
| --- | --- |
| `scripts/buildWorldSound.mjs` | Measure sources, assemble loops, gates, cut transitions, normalize, encode, publish, `--validate`. Build tooling only. |
| `src/audio/worldSoundSettings.js` | Paths, frame contract, routing, `bedDipDb`, gains, limiter, ducking and the visual-config duration bridge. |
| `src/audio/worldSound.js` | One shared transport, per-world loop voices, gain crossfade, transition one-shots, lazy decode/cache, bed dip, release. |
| `src/mode-audio.js` | Central controller: SOUND ON/OFF, volume, persistence, SMASH ducking, tab-hide suspension, `world.release()` on mute/hide. |
| `src/xray.js` | First-gesture unlock and mode-change handoff. Unchanged V3.1 logic. |
| `src/sound-controls.js` | Existing SOUND ON/OFF and volume UI. |

A mode switch starts the matching one-shot and the bed dip at switch start; the
loop crossfade begins as soon as the incoming buffer is ready and ends at
`switchStart + 900 ms`, together with the one-shot. `crossfade.windowSeconds`
records the configured window, `durationSeconds` the actual fade length (a decode
tick may shorten the start, never the window). The outgoing loop is stopped after
the crossfade plus `inactiveStopGraceMs`; retargeting cancels that stop and reuses
the voice. SOUND OFF and tab-hide call `world.release()`: no SFX is scheduled, the
dip is dropped and the context is suspended.

## Guided listening (Phase 4)

There is no play button and no autoplay. The SOUND switch remains the hard
control; the entry points below only decide when the designed loop may fade in.

### Unlock (4.1)

- Exactly one `AudioContext`, created lazily on the first trusted gesture.
- Unlock is registered on `pointerdown`, `touchend`, `click` and `keydown`,
  each with `{ once: true, passive: true }`; the first trusted event detaches
  the set.
- `resume()` is invoked synchronously during the event dispatch, before any
  await, and a one-sample silent source with gain 0 primes older iOS.
- Unlock performs zero fetches and zero decodes. It is state only.
- A stored mute preference always wins: unlocking is allowed, playing is not.

### Trigger cascade (4.2)

| Stage | Entry | Behaviour |
| --- | --- | --- |
| 1 | `pointerdown` on the chrome hero wordmark (`#stage`, `#logo-canvas`, poster) | unlock + fade the active loop in over 1.8 s |
| 2 | first desktop `pointermove` that travels more than 200 px after unlock | same fade-in; throttled to one check per 100 ms; inert on coarse pointers |
| 3 | first scroll that takes the hero fully out of view | same fade-in; `IntersectionObserver` observes visibility only, no per-scroll layout reads |

Each stage fires at most once per session; the first match wins. Activation is
idempotent: an already running loop is ramped, never restarted. A fade requested
during a decode starts as soon as the buffer resolves, with one start and no gap.

### Activity indicator (4.3 b)

Three decorative bars beside SOUND show that audio is actually running. The
indicator is `aria-hidden="true"`, never announced, never a control, and its
16 × 10 px slot is always reserved so nothing shifts when it appears.

- `AnalyserNode.fftSize = 32`; `getByteFrequencyData` is read at most 30 times
  per second (one read per 33 ms).
- The rAF loop exists only while `audio.audible` is true. Mute, suspend, tab hide
  and stop cancel the rAF and disconnect the analyser synchronously in the same
  notification tick.
- `prefers-reduced-motion: reduce` renders a static three-bar active state; it
  schedules no rAF and attaches no analyser.
- No waveform, spectrum, numeric readout or extra bar.

### Honest label (4.3 c)

The button names state, not action: **sound on** / **sound off**. The visible
text and accessible name both update on every toggle. No play icon is used.

### Tap to resume (4.3 d)

The SOUND control changes to **tap to resume** only after a genuinely failed
resume (for example a blocked visibility return). It is a real button, keyboard
reachable, and its accessible name becomes “tap to resume sound”. A successful
resume clears the state automatically. After a failure, automatic
visibilitychange retries stop until the user presses the affordance, so a broken
resume cannot spam attempts. The state is never shown on first load or while
audio is running normally.

### iOS silent switch (4.3 a)

After the first successful activation on iOS, a quiet line appears attached to
SOUND for about 6 s: “hearing nothing? check the silent switch.” It is not a live
region, is shown at most once, and the dismissal is persisted in
`localStorage['h4ngelic.sound.ios-hint.v1']`. The silent switch itself is never
detected or probed.

### Performance budget (4.4)

Measured on the local Chromium build with `__H4_AUDIO_PERF__` instrumentation,
current commit versus the pre-indicator baseline `a64f808`:

| Metric | Measured |
| --- | ---: |
| Incremental `unlock()` cost (context already exists) | 0.0–0.2 ms |
| `startListening()` synchronous cost | 0.1–0.5 ms |
| Indicator start / stop cost | 0.0–0.1 ms |
| Unlock + cascade + indicator handler total | **0.4–0.7 ms** (budget < 2 ms) |
| Added startup: `guidedInit` + indicator DOM creation | **0.1–0.4 ms** (budget < 2 ms) |
| First `AudioContext` construction (platform cost, not added JS) | 118–175 ms headless Chromium |
| Gesture → first loop source, current | 121–209 ms cold, 119–135 ms warm |
| Gesture → first loop source, baseline `a64f808` | 263 ms cold, 545–737 ms warm |
| Analyser reads while playing | 3–20 per second (limit 30) |
| Decoded PCM with one world resident | 3,969,000 × 2 ch × 4 B = **31,752,000 B** |
| Observed JS heap delta after first decode | −2.0 to +10.2 MB across runs (GC noise; not a memory claim) |
| Audio-path long tasks > 50 ms (audio-only window) | 0 |
| Layout shifts from indicator appearance | 0 |

No idle prefetch is issued: after the first loop is playing the only second-loop
load is the existing mode-gesture preload, so no autonomous bytes or second
decoded buffer exist. This is stricter than the conditional-prefetch rule. The
pointermove listener is passive and throttled to 100 ms; stage 3 uses an
`IntersectionObserver` and never reads layout per frame.

## Verification (2026-11-05)## Verification (2026-11-05)

All commands were run serially on this branch; actual output is under
`docs/validation/world-sound/v3/phase4b/`.

| Check | Actual result |
| --- | --- |
| `npm test` | **402 passed, 0 failed** (`phase4b/node-tests.txt`) |
| `tests/world-audio-formats-browser.mjs` | 4/4 files decode at exact frame counts; 250 ms seam level continuity ≤ 1 dB; **0 audio-path long tasks**; 0 console errors |
| `tests/world-sound-browser.mjs` | 6/6 profiles at 1440/390/320 × full/reduced; lazy load, one active loop, both transitions, full-length one-shots, SFX/crossfade end together, no audio-path long task, missing-file degradation |
| `tests/guided-listening-browser.mjs` | 8/8 scenarios: wordmark + 1.8 s fade, 200 px stage 2, hero-out-of-view stage 3, touch stage 2 inert, stored mute across all stages, keyboard tap-to-resume, one-time persisted iOS hint (`phase4b/guided-listening-browser.txt`) |
| `tests/audio-performance-browser.mjs` | PASS: handler 0.7 ms, startup 0.1 ms, analyser 15–20 reads/s, zero audio-only long tasks, static reduced-motion bars, 390/320 both motion profiles, in-flight decode (`phase4b/audio-performance-browser.txt`) |
| `tests/mode-audio-browser.mjs` | PASS: gesture-only startup, no legacy 0.7 s cue, file transitions, one shared context, route/mute persistence |
| `tests/sound-controls-browser.mjs` | 8/8 profiles: mute suspension, volume, keyboard/touch, persistence, no early requests |
| `tests/smash-v31-browser.mjs` | PASS at 1440/390/320: exact file, deferred fetch, attack/tail/stop, world-bus duck/release |
| `npm run build` | PASS; exactly four M4A copied with matching hashes (`build.txt`) |
| `node scripts/buildWorldSound.mjs --validate` | `pass: true` for all four files |

The build's `prebuild` step re-encodes `public/images/optimized/*`; those files
were restored after the build and are not part of this commit.

## Listening checklist

1. **Loop seam (~90 s).** On headphones and speakers, listen through at least
   three wraps per world. No click, dropout, doubled downbeat or reverb reset.
   WORLD 333's opening is naturally quiet; judge the seam by the level of the
   last 250 ms against the first 250 ms, not by the first sample.
2. **Transition sync.** Switch 333 → 4 and 4 → 333 while watching the visual
   tear. The 0.9 s one-shot starts with the switch and ends with the picture; the
   crossfade ends at the same instant. Neither direction may clip the tail.
3. **World-4 density.** WORLD 4 should stay recognisably related to WORLD 333 —
   same sub and metallic thread, smeared and warped, never harsh noise and never
   louder in the low end.
4. **iOS silent switch.** On a real iPhone, test the hardware silent switch in
   both positions after a fresh gesture, then a route change and background /
   resume. Record device, iOS version and observed behaviour; Chromium cannot
   prove Safari behaviour.
5. **SMASH ducking.** Start and stop SMASH in both worlds, including during a
   mode switch. The bed and any one-shot duck smoothly, never stop or lose
   phase, and the deeper attenuation wins when both apply.
6. **Mute / volume persistence.** Change volume and mute, reload, and confirm the
   saved state with no early `AudioContext` or audio request. SOUND OFF suspends;
   SOUND ON resumes the same transport.
7. **Tab suspension.** Hide and restore the tab. Audio suspends while hidden and
   continues from the same transport position on return.

## How to change the vibe

- **Loop seam length:** `WRAP_SECONDS` in `scripts/buildWorldSound.mjs` (8 is
  current, 4–16 allowed). Re-run the builder and the seam gates; never ship an
  audible seam.
- **Bed dip during a switch:** `worldSoundSettings.bedDipDb` (−6 current). One
  constant, applied as a cosine bowl over the crossfade.
- **Guided fade-in:** `initGuidedListening({ fadeSeconds: 1.8 })` in
  `src/xray.js`; keep it inside the 1.5–2 s window.
- **Transition direction:** swap the two entries in `transitionRouting`. No file
  rename, no logic edit.
- **Bitrate / size:** `encodeAac()` in the builder (256 kbps current). If a loop
  exceeds 3.2 MB, drop to 192 kbps and re-run `--validate`; record both.
- **Pitch/tonality:** the sources measure A minor (333) and F major (4), not
  F minor. If an F-minor grid is required, transpose at build time and re-run the
  seam and harmonic checks; do not guess a shift in the runtime engine.

## Limitations and observations

- **Subjective listening: OPEN — user.** Automated checks cannot judge musical
  fit on real speakers.
- **Real iOS Safari: BLOCKED.** No physical device or iOS runtime is available.
- **Mid-switch visual re-switch: BLOCKED at the visual controller.** The audio
  engine retargets a second crossfade smoothly (covered by a test-only hook), but
  the V3.1 visual snapshot controller rejects a second gesture while a capture is
  active. Left unchanged by scope.
- **Key analysis is ambiguous** (see above). No pitch shift was applied.
- **OBSERVATION, outside audio scope:** `tests/mobile-interactions-browser.mjs`
  fails its no-cold-WebGL-on-About assertion on this branch and on base
  `11e78a1`. Diagnostics: `docs/validation/world-sound/mobile-interactions-current.json`
  and `mobile-interactions-base.json`. Not fixed in this pass.
- **OBSERVATION:** the v2 document's 1.4 s transition contract and 61,740-frame
  numbers are historical; the live contract is the 0.9 s visual config above.
