# Next checkpoint — WORLD SOUND v3 delivered, awaiting user listening

Updated 2026-11-05. Branch `v3.2-world-sound`, new local commit on top of
`4ab1a75` (no history rewrite). Nothing pushed, merged or deployed.

## Per-item status

| Item | Status | Evidence |
| --- | --- | --- |
| Four real-source files cut from the user's `.mov` / `.mp3` inputs | DONE | `docs/validation/world-sound/v3-build.json` |
| Both loops exactly 3,969,000 frames; both transitions 39,690 frames | DONE | browser decode + unit tests |
| Head preserved byte-exactly (first 88,200 frames) | DONE | head SHA-256 in `docs/WORLD-SOUND.md` |
| Seam gates pass on both loops | DONE | 0.03 / 0.05 dB level delta; 0 seam step; gradients 1.47 / 0.90 dB |
| −18 LUFS and < −1 dBTP per file | DONE | −18.0 / −18.0 / −18.0 / −18.1; peaks −3.4…−10.6 dBFS |
| Transition length follows visual config | DONE | 900 ms → 39,690 frames; `windowSeconds` assertion |
| Direction mapping reversible in settings | DONE | `transitionRouting` |
| Bed dip −6 dB, SMASH uses min (never sum) | DONE | unit + browser tests |
| SOUND OFF / tab hide release SFX and dip | DONE | `world.release()` on mute and hide |
| Lazy fetch, one decode per buffer, one active loop | DONE | 5× switch test + browser probe |
| Manifest exactly 4 M4A files | DONE | directory listing + hashes + build output |
| Full Node suite | DONE | 402/402 (`docs/validation/world-sound/v3/phase4/node-tests.txt`) |
| Browser suites (5, serial) | DONE | `docs/validation/world-sound/v3/*.txt` |
| Production build ships 4 M4A | DONE | `docs/validation/world-sound/v3/build.txt` |
| Guided listening 4.1–4.3a | DONE | `docs/validation/world-sound/v3/phase4/guided-listening-browser.txt` |
| Phase 4 after “hearing nothing” | BLOCKED — brief truncated | request the rest of the text |
| Subjective listening | OPEN — user | checklist in `docs/WORLD-SOUND.md` |
| Key is F minor as briefed | NOT MET — measured A minor / F major | documented; no guessed pitch shift |
| Real iOS Safari | BLOCKED — no device | recorded limitation |
| Push / merge / deploy | NOT DONE — by request | PR #22 unchanged |

## Pending input

The Phase 4 brief was cut off after “hearing nothing”. Send the remainder before
4.3 b/c or later phases are implemented. The current pass covers unlock, the
three-stage trigger cascade, mute precedence, resume affordance and the iOS hint.

## Merge path (exact order)

1. **User listens** to the four files and approves the result.
2. **User explicitly asks for the push.** Then `git push origin v3.2-world-sound`;
   PR #22 updates to the new commit.
3. **PR #22 merges into `main`** (user action). PR #20 is already merged at
   `9123a00`; no further rebase is required.
4. Vercel deploys `main` automatically. Then run the live listening checklist.

Do not push, merge or deploy before step 2 is explicitly requested.

## Reproduction

```sh
node scripts/buildWorldSound.mjs --out work/world-sound-v3
node scripts/buildWorldSound.mjs --validate
npm test
./node_modules/.bin/vite --host 127.0.0.1 --port 55341 --strictPort
H4_BASE_URL=http://127.0.0.1:55341 node tests/world-audio-formats-browser.mjs
H4_BASE_URL=http://127.0.0.1:55341 node tests/world-sound-browser.mjs
```

`ffmpeg` / `ffprobe` / `afconvert` are local build tooling only. Source `.mov`
and `.mp3` files plus `masters/` are gitignored and never committed.

## Known issues outside audio scope

- `tests/mobile-interactions-browser.mjs` fails the no-cold-WebGL-on-About
  assertion on this branch and on base `11e78a1`. Diagnostics:
  `docs/validation/world-sound/mobile-interactions-current.json` and
  `mobile-interactions-base.json`. OBSERVATION only.
- A second visual mode gesture during the snapshot transition remains blocked by
  the V3.1 controller. The audio layer retargets smoothly; the visual limitation
  is unchanged.
