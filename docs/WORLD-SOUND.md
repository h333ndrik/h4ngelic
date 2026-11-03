# WORLD SOUND PASS — file-based worlds and mode transitions

Updated 2026-11-04 on isolated branch `v3.2-world-sound` from base
`11e78a15b5cb6951a67b38ddd3ae8fde6eba8e6c`.

Status: **IMPLEMENTED / CHROMIUM VERIFIED / PARTIAL**. The local WAV masters
were replaced in Git history by four verified 256 kbps M4A derivatives, cutting
the runtime payload by 87.81%. The shared transport and both transition
directions pass browser checks, and the central sound controller still owns mute,
volume, SMASH priority and route persistence. Real iOS Safari listening and a
user-triggered mid-transition re-switch remain blocked as described below.

## Asset contract

The WAV masters remain local-only in the earlier sound-design output directory
and are not present in this branch's history. They were encoded without
trimming or normalization.

| Local master | Bytes | SHA-256 |
| --- | ---: | --- |
| `WORLD_333_clean_chrome_124BPM_Fmin.wav` | 8,194,106 | `3d28c46d2d004cdc99ce84cf5272486ba18aac849e7b5cc30e5cb5f8997a5d4a` |
| `WORLD_4_living_decay_124BPM_Fmin.wav` | 8,194,106 | `8cfb19a8807c30086dfa142e721f97c8558b0168aab89149960c71f97d0b6c9f` |
| `TRANS_333_to_4_chrome_melting_1p4s.wav` | 370,484 | `9a4a64dc099d89e140693e810d33f79777c0482e2d4c22f4865e4b551f1e2e91` |
| `TRANS_4_to_333_clean_resolve_1p4s.wav` | 370,484 | `4af965ebabe15e589e0a8b54f752e15444f2948cf78d8cfa5353af477d1df357` |

### Committed runtime files

Exactly four audio files are committed: two loops and two transitions.

| Runtime path | Bytes | SHA-256 | Loudness | True peak |
| --- | ---: | --- | ---: | ---: |
| `public/assets/audio/loop-333.m4a` | 1,000,522 | `0cba7010005c069979d4df486527d14e208143f169a9501efadc449e42b11c11` | −18.0 LUFS | −4.1 dBFS |
| `public/assets/audio/loop-4.m4a` | 998,335 | `4805f249bdb6a15c555d32250df8001c8e549319672da0791eb4904bd3322b3c` | −18.0 LUFS | −3.9 dBFS |
| `public/assets/audio/x-333-4.m4a` | 43,631 | `2b06d9881275a5ce8c32bbe82f84db3d955fcdba906ae02b696d173968dfb103` | −18.1 LUFS | −4.6 dBFS |
| `public/assets/audio/x-4-333.m4a` | 45,026 | `53c2a3e54daf76a5a30f0ab7df2fb93b7f031422f28953c372925b78f06e027d` | −18.0 LUFS | −6.7 dBFS |

Payload before: **17,129,180 bytes**. Payload after: **2,087,514 bytes**.
Savings: **15,041,666 bytes / 87.81%**; the new set is 8.21× smaller.

The local FLAC derivatives were also generated and decode-tested. They are not
committed because the requested runtime manifest is exactly four files and the
M4A set passed the seam law. Their hashes are recorded for reproducibility:

| Local FLAC derivative | Bytes | SHA-256 |
| --- | ---: | --- |
| `loop-333.flac` | 6,372,453 | `ada0fc1476afda70ac414a059636377f802de32f33a03c6d11b95e056daac6e1` |
| `loop-4.flac` | 6,424,535 | `6238a797ad11cf491aa0d7db7e31837a91517065b029de28b01c08ae81a1d068` |
| `x-333-4.flac` | 277,639 | `b29ecd7a5ec644a062fcd09a6b8fd53b6d613b68b450eb1a8058e3340efdb073` |
| `x-4-333.flac` | 270,750 | `eaf5f2b211b27e27fd51a39342bef2406719bee49d273145695200848af9c4d8` |

Generation used local `ffmpeg` only; it is not a runtime dependency:

```sh
ffmpeg -i master.wav -map_metadata -1 -c:a flac -compression_level 8 output.flac
ffmpeg -i master.wav -map_metadata -1 -c:a aac -b:a 256k -movflags +faststart output.m4a
```

### Decode and seam evidence

Chromium's actual `decodeAudioData` was used for all 12 generated files. Every
format produced the master's exact sample count:

| Asset | WAV frames | FLAC frames | M4A frames |
| --- | ---: | ---: | ---: |
| WORLD 333 loop | 1,365,677 | 1,365,677 | 1,365,677 |
| WORLD 4 loop | 1,365,677 | 1,365,677 | 1,365,677 |
| 333 → 4 | 61,740 | 61,740 | 61,740 |
| 4 → 333 | 61,740 | 61,740 | 61,740 |

At 124 BPM, four beats per bar and 16 bars require 1,365,677.419 frames at
44.1 kHz. The decoded loops are therefore within one sample of the exact
musical boundary. FLAC's decoded PCM MD5 is identical to WAV for all four
assets. M4A is lossy but gapless at the container/decode level: Chromium trims
AAC priming/padding to the exact master frame count.

The loop boundary remains continuous and non-zero after M4A decoding. WORLD 333
has a maximum wrap step of .0764 against a mean internal step of .0145; WORLD 4
has .0145 against .0168. Both are within six times the ordinary mean step. The
10 ms head and tail RMS values remain non-zero, so there is no encoder-added
zero fade. Positive L/R correlation is retained (333: .72, 4: .74 in the
decoded M4A set). The automated contract and the complete measurements are in
`docs/validation/world-sound/derivative-decode.json`.

### Runtime format fallback

`worldSoundSettings.paths` holds ordered candidate arrays for every asset:
**M4A → FLAC → WAV**. The engine accepts a candidate only after checking sample
rate, channel count and decoded frame count against the values in
`worldSoundSettings.js`. It tries the next candidate after fetch failure, decode
failure, encoder padding or wrong format parameters. If all candidates fail,
the logical asset is recorded `missing` and remains silent; no synthesized
substitute is created.

Only the primary M4A candidates are deployed in this four-file commit. The FLAC
and WAV URLs are ready fallback paths: adding those files later makes the
fallback operational without component changes. With the current package, a
primary-file failure tries the absent alternatives and then degrades silently.

## Module map

| File | Responsibility |
| --- | --- |
| `src/audio/worldSoundSettings.js` | The only configuration source for paths, mode mapping, world gains, bus/transition gains, activation/crossfade timing, limiter, ducking and one-shot voice cap. |
| `src/audio/worldSound.js` | Shared loop transport, `AudioBufferSourceNode.loop`, per-world gain crossfades, transition one-shots, lazy decode/cache, missing-asset state and voice cap. |
| `src/mode-audio.js` | Existing central controller extended with the world engine. Owns the one `AudioContext`, master volume/mute, SMASH priority, visibility suspension, route persistence and preference storage. |
| `src/xray.js` | First-trusted-gesture unlock, mode-change handoff, target prewarm and visibility plumbing. No second audio controller exists. |
| `src/sound-controls.js` | Existing SOUND ON/OFF and volume UI; unchanged public controls now drive the complete mix. |

`normal` maps to `333`; `xray` maps to `4`. The old synthesized 0.7 s mode
cues remain disabled by `modeAudioSettings.modeSoundsEnabled: false`. The
generator remains testable, but no mode change plays it.

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
9. Missing, 404 or invalid decoded candidates are tried in M4A → FLAC → WAV
   order. If every candidate fails, the asset is recorded as `missing` and
   remains silent. A failed starting loop does not prevent the other world from
   starting later. No fallback audio is synthesized.

The crossfade duration comes from
`getLivingDecaySettings().modeTransitionMs`, not a hard-coded value. The live
visual setting is currently **900 ms** (commit `200773b`), while this brief was
written with the older ~1400 ms expectation. Audio therefore follows the actual
900 ms visual transition today and will follow any future config change. The
one-shot files themselves remain 1.4 s.

## Tuning

Change paths, per-world gains, bus/transition levels, activation fade, lowpass,
limiter and ducking only in `src/audio/worldSoundSettings.js`. Do not duplicate
paths in components. The crossfade remains tied to
`src/data/livingDecaySettings.js:modeTransitionMs`.

For a replacement loop, keep the 1,365,677-frame grid at 44.1 kHz, preserve
non-zero boundaries and rendered tails, and keep the transition files anchored
on the shared F-minor sub and metallic ping. Update the candidate list and
expected frame counts only in `worldSoundSettings.js`. A bad replacement must be
visible as `BLOCKED` in tests, not replaced with invented sound.

## Listening checklist

1. **Loop seam, about 31 s:** listen through at least three WORLD 333 and WORLD 4
   wrap points on headphones and speakers. Confirm no click, dropout, doubled
   downbeat or reverb reset.
2. **Transition sync:** switch 333 → 4 and 4 → 333 while watching the visual
   tear. The 1.4 s one-shot must start with the tear and remain complete; the
   loop crossfade must follow the live visual setting (currently 900 ms).
3. **WORLD 4 density:** compare both worlds at the intended quiet site level.
   The corrupted materials should stay musical, retain the recognizable melodic
   thread and never become harsh noise or overpower the low end.
4. **iOS silent-switch behavior:** on a real iPhone, test the hardware silent
   switch in both positions after a fresh gesture, then test route changes,
   backgrounding and resume. Record the device, iOS version and observed
   behavior; never infer it from Chromium.
5. **SMASH priority:** start and stop SMASH in both worlds. The loop and any
   transition should duck smoothly, never stop or lose phase, and recover to the
   same level.
6. **Mute and volume persistence:** change volume and mute, reload, and confirm
   the saved state without an early AudioContext or audio request. SOUND OFF
   should suspend; SOUND ON should resume the existing transport.
7. **Tab suspension:** hide and restore the tab. Audio should suspend while
   hidden and continue from the same transport position on return.

## Verification (2026-11-04)

| Check | Actual result |
| --- | --- |
| `npm test` (outside sandbox) | **385 passed, 0 failed** |
| `node tests/world-audio-formats-browser.mjs` | **12/12 files PASS**: M4A, FLAC and WAV all decode at exact master frame counts; zero main-thread long tasks during fetch/decode |
| `node tests/world-sound-browser.mjs` | **6/6 profiles PASS** at 1440/390/320 × full/reduced, both modes, plus missing-file degradation |
| `node tests/mode-audio-browser.mjs` | PASS: gesture-only startup, no legacy cue, both file transitions, one shared context/route persistence |
| `node tests/sound-controls-browser.mjs` | **8/8 profiles PASS**: mute suspension, volume, keyboard/touch/persistence, no early requests |
| `node tests/smash-v31-browser.mjs` | PASS at 1440/390/320: live attack envelope, shared context, world-bus duck/release, cached SMASH |
| `npm run build` | PASS: 18 routes + 404 prerendered; exactly the four M4A files copied with unchanged hashes |

The world suite verifies one active loop per world, no double playback or fetch,
the incoming loop's shared phase, 900 ms config-driven crossfade, full 1.4 s
one-shots, inactive-source stop, retargeting, voice cap, mute/visibility
suspension, SMASH ducking and honest missing-file degradation. World-sound
screenshots and probe snapshots are in `docs/validation/world-sound/`.

## Limitations and blockers

- **Real iOS Safari: BLOCKED.** No physical iPhone or iOS runtime is available.
  Chromium touch emulation verifies gesture unlock, but not Safari autoplay,
  interruption, route or hardware-output behavior.
- **User-triggered mid-transition re-switch: BLOCKED at the visual integration
  boundary.** The audio engine retargets a second crossfade without restarting
  its transport, and the browser suite exercises that path directly through the
  test-only controller hook. The existing visual mode controller intentionally
  rejects a second mode command while its capture is active, so no current
  end-to-end gesture can reach the audio retarget. Do not claim a user-triggered
  reversal was tested.
- **Subjective seam/listening review: BLOCKED for real hardware.** File framing,
  non-zero boundaries, Web Audio looping and automated behavior pass; no claim
  is made about perceived seamlessness on an unavailable device.
- **OBSERVATION, outside audio scope:** `tests/mobile-interactions-browser.mjs`
  fails at its no-cold-WebGL-on-About assertion. The same failure and
  mannequin-preview stack occur on untouched base `11e78a1`; both records are in
  `docs/validation/world-sound/mobile-interactions-{current,base}.json`. The
  assertion was preserved and no mannequin or other V3.1-owned code was changed
  for this sound pass.
- The current four-file package does not deploy FLAC/WAV fallback files. The
  candidate chain is tested, but production fallback only becomes audible if
  those alternate files are added at the configured URLs.

## Deferred work

These are intentionally **TODO**, not part of this pass:

- Hero first-touch cue.
- Color-mapped ink impact sounds.
- THE OTHER SIDE ambience layer independent of the mode loops.
- If the downloadable preview needs audible world loops, add a deliberate
  offline packaging decision for the 2.1 MB M4A set and update the standalone
  audio assertions.
