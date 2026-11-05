# Next checkpoint — WORLD SOUND v3 merged, live on production

Updated 2026-11-05 after the release pass. **PR #22 is merged into `main`.**
`main` = `b5634bc5be4073c678672dd69f64810849cc157d` (merge commit), production
build marker `b5634bc5be40`. Vercel deployed it automatically.

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
| Full Node suite | DONE | 402/402 (`docs/validation/world-sound/v3/phase4c/node-tests.txt`) |
| Browser suites (7, serial) | DONE | `docs/validation/world-sound/v3/phase4c/*.txt` |
| Production build ships 4 M4A | DONE | `docs/validation/world-sound/v3/phase4c/build.txt` |
| Guided listening 4.1–4.2 | DONE | stage A wordmark + stage B WORKS 25 % (re-armed on `h4:pagechange`); no pointermove, no dwell, no scroll trigger |
| Activity bars 4.3b | DONE | static reduced-motion state, rAF only while audible |
| Honest SOUND label 4.3c | DONE | “sound on” / “sound off” text, stable `aria-label="sound"` + `aria-pressed` |
| Tap to resume 4.3d | DONE | keyboard reachable, clears on success |
| Performance budgets 4.4 | DONE | handler 0.2 ms, startup 0.2 ms, round-trip heap delta +48,214 B (budget 2 MB), zero audio-only long tasks |
| Outgoing loop release | DONE | inactive `bufferDuration: 0`, reload on next switch |
| Return-switch re-decode measured | DONE | 126.6 / 142.2 / 168.4 ms against the 900 ms window (`docs/WORLD-SOUND.md`, `docs/validation/world-sound/v3/phase5/re-decode-warm-cache.json`) |
| Push | DONE | `origin/v3.2-world-sound` = `17ae6e4` |
| Merge into `main` | DONE | PR #22, merge commit `b5634bc` |
| Production deployment | DONE | Vercel status success on `b5634bc`; build marker `b5634bc5be40` |
| Production assets verified | DONE | 4× HTTP 200, `audio/mp4`, exact lengths, SHA-256 match |
| Subjective listening | OPEN — user | checklist in `docs/WORLD-SOUND.md` |
| iPhone device test | OPEN — user | see next checkpoint below |
| Key is F minor as briefed | NOT MET — measured A minor / F major | documented; no guessed pitch shift |
| Push / merge for `v3.2-mannequin-female` | OUT OF SCOPE | must be rebased onto the new `main` before its next push |

## Merge record

- Branch `v3.2-world-sound`, head at merge `17ae6e4` (`V3.2-M9` re-decode
  measurement); `f654e49` (`V3.2-M8`) contained.
- PR #22 — https://github.com/h333ndrik/h4ngelic/pull/22 — merged with a merge
  commit at 2026-11-05T19:31:46Z. No squash, no rebase, branch not deleted.
- `main`: `9123a00` → `b5634bc5be4073c678672dd69f64810849cc157d`.
- Vercel: status context `Vercel` = success on `b5634bc`
  (deployment `https://vercel.com/h333ndrik/h4ngelic/Gjp2nvfSU3aKBXD4bQK4sEqsmnyh`).

Post-merge asset check on `https://www.h4ngelic.com` (apex `h4ngelic.com`
308-redirects to `www`):

| File | Status | Content-Type | Content-Length | SHA-256 vs repo |
| --- | --- | --- | --- | --- |
| `loop-333.m4a` | 200 | `audio/mp4` | 2,847,109 | match `d28de005…` |
| `loop-4.m4a` | 200 | `audio/mp4` | 2,774,228 | match `ab235d05…` |
| `x-333-4.m4a` | 200 | `audio/mp4` | 30,015 | match `5ee49fed…` |
| `x-4-333.m4a` | 200 | `audio/mp4` | 29,591 | match `477df723…` |

`cache-control: public, max-age=0, must-revalidate` on all four. The files live
in `public/assets/audio/` and keep their names, so they are not content-hashed
and do not get the immutable policy. Recorded as a finding, not changed.

Indexing deliberately unchanged: `<meta name="robots" content="noindex, follow">`
and `robots.txt` = `User-agent: * / Disallow: /`.

## Next checkpoint

1. **User listening pass on production** — `https://www.h4ngelic.com`, with the
   checklist at the end of `docs/WORLD-SOUND.md`: seam at ~90 s per world,
   both transition directions against the visual tear, world-4 density,
   SMASH ducking, mute/volume persistence after reload.
2. **iPhone device test** (real hardware, not emulation): silent switch, tap on
   the wordmark, activity bars beside SOUND, and tap-to-resume after a call or
   a backgrounded tab.
3. Then decide whether the cache policy for the four non-hashed M4A files needs
   a follow-up, and whether the F-minor brief key is re-cut or accepted.
4. Only after that: rebase `v3.2-mannequin-female` (local and remote both
   `b2433f5`) onto the new `main` before its next push. It stayed out of scope
   for this release and was not touched.

## Rollback

- Git: `git revert -m 1 b5634bc` on `main`, then push. This reverts the merge as
  a new commit; history stays intact and the branch can be merged again later.
- Vercel: previous production deployments are kept. Promote the deployment of
  `9123a00` back to production for an instant rollback without a new build.

## Known issues outside audio scope

- **`tests/smash-v31-browser.mjs` is a known load-dependent flake.** It polls a
  1.8 s gain attack with a 5 s `waitForFunction`. In the first back-to-back
  batch run after six other suites it timed out at that poll; the standalone
  run and the second full serial batch both passed at 1440/390/320. Evidence:
  `docs/validation/world-sound/v3/phase4c/smash-v31-browser.txt`. Do not treat
  a single timeout here as a new product defect — re-run it alone first.
- `tests/mobile-interactions-browser.mjs` fails the no-cold-WebGL-on-About
  assertion on base `11e78a1` as well. Diagnostics:
  `docs/validation/world-sound/mobile-interactions-current.json` and
  `mobile-interactions-base.json`. OBSERVATION only.
- A second visual mode gesture during the snapshot transition remains blocked by
  the V3.1 controller. The audio layer retargets smoothly; the visual limitation
  is unchanged.

## Reproduction

```sh
node scripts/buildWorldSound.mjs --validate
npm test
./node_modules/.bin/vite --host 127.0.0.1 --port 55341 --strictPort
H4_BASE_URL=http://127.0.0.1:55341 node tests/world-audio-formats-browser.mjs
H4_BASE_URL=http://127.0.0.1:55341 node tests/world-sound-browser.mjs
H4_BASE_URL=http://127.0.0.1:55341 node tests/guided-listening-browser.mjs
```

`ffmpeg` / `ffprobe` / `afconvert` are local build tooling only. Source `.mov`
and `.mp3` files plus `masters/` are gitignored and never committed.
