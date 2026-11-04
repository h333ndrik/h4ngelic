# Next checkpoint — WORLD SOUND v2 delivered, awaiting user review

Updated 2026-11-04. Branch `v3.2-world-sound`, local commit on top of
`27315c6`. Remote `origin/v3.2-world-sound` is still at `27315c6`; nothing was
pushed, merged or deployed in this pass.

## Per-item status

| Item | Status | Evidence |
| --- | --- | --- |
| One deterministic renderer for all four files | DONE | `scripts/renderWorldLoops.mjs`, `--determinism` reports identical WAV+M4A |
| Two 90 s loops, exactly 3,969,000 frames | DONE | WAV, FLAC and M4A decode at 3,969,000 in Chromium |
| Two 1.4 s transitions, exactly 61,740 frames | DONE | same decode test |
| Build arc, first 2 s ≈ last 2 s | DONE | +0.43 dB (333) / −0.48 dB (4) |
| Shared anchors present at every loop position | DONE | 3 probes × 4 anchors per loop in the render report |
| −18 LUFS per file, headroom retained | DONE | −18.0 / −18.0 / −18.1 / −18.1, peaks −5.8…−9.6 dBFS |
| Four M4A runtime files replaced, manifest exactly 2+2 | DONE | hashes in `docs/WORLD-SOUND.md`, asserted by tests |
| Fallback M4A → FLAC → WAV kept | DONE | unit test, unchanged order |
| 48 kHz device context plays instead of failing | DONE | `worldSound.js` + new unit test at 44.1 and 48 kHz |
| Runtime docs, checklist, evidence | DONE | `docs/WORLD-SOUND.md`, `docs/validation/world-sound/v2/` |
| Subjective listening review | OPEN — user | see checklist in `docs/WORLD-SOUND.md` |
| Real iOS Safari behaviour | BLOCKED — no device/runtime | recorded limitation |
| Push / merge / deploy | NOT DONE — by request | PR #22 unchanged |

## Merge path (unchanged, nothing else merges with this branch)

1. **User listens** to the four preview files and approves the new loops and
   transitions.
2. **User asks for the push.** Then `git push origin v3.2-world-sound`; PR #22
   updates from `27315c6` to the new commit.
3. **PR #22 merges into `main`** (user action). PR #20 is already merged at
   `9123a00`, so no further rebase is needed.
4. Vercel deploys `main` automatically. Then run the live listening checklist.

Do not push, merge or deploy without that explicit request.

## Reproduction

```sh
node scripts/renderWorldLoops.mjs --out work/world-sound-v2 --flac --determinism
npm test
./node_modules/.bin/vite --host 127.0.0.1 --port 55341 --strictPort
H4_BASE_URL=http://127.0.0.1:55341 node tests/world-audio-formats-browser.mjs
```

`afconvert` is used when present (macOS) for the AAC encode; `ffmpeg` is the
fallback and is the only requirement for FLAC and the remux. Neither is a
runtime dependency.

## Known non-audio issue

`tests/mobile-interactions-browser.mjs` fails its no-cold-WebGL-on-About
assertion on this branch and on base `11e78a1`. Existing diagnostics:
`docs/validation/world-sound/mobile-interactions-current.json` and
`mobile-interactions-base.json`. Out of scope for the audio pass; do not fix it
here.
