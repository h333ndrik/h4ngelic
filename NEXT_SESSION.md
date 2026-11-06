# V3.2-M5 — Mannequin-C auf `main` gemergt — 2026-11-06

Branch `v3.2-mannequin-female`. Merge-Commit auf `main`:
`494ee492a6b329577e7e140425b944198cff0ddc` (`--no-ff`, 0 Konflikte),
Push `d550824..494ee49`. Deploy: Vercel baut aus `main` automatisch; Rollback
nur auf Zuruf: `git revert -m 1 494ee492a6b329577e7e140425b944198cff0ddc`.

## Status

- [x] URL-Schema von main uebernommen: kanonisch `/creative/<rubrik>`,
      `all` → `/creative`; der Abschnitt "3d model" bleibt Anker `#model-3d`
      innerhalb der Rubrik — keine eigene Route, kein Sitemap-Eintrag.
- [x] Viewer im Abschnitt "3d model": nur C sichtbar, A/B dev-only.
- [x] Asset unveraendert: `public/models/mannequin-c.d76abc164512.glb`
      (457.000 B, SHA-256 `d76abc1645120eb2…fbd71fb`, 49.838 Tris).
- [x] Merge-Gate: keine Quellcode- und keine Asset-Konflikte.

## Naechster Schritt

1. M1: gemeinsamer Three.js-Chunk fuer Hero und Mannequin.
2. Manuelle Restpunkte: iPad-Roundtrip (Procreate), Koaleszenz auf Hardware
   mit hoher Polling-Rate.

---

# V3.2-M4i checkpoint — merge-bereit

Updated 2026-11-05. Branch `v3.2-mannequin-female`.

## Status

- [x] Einziges ausgeliefertes C-Asset: `public/models/mannequin-c.d76abc164512.glb`
      (457.000 B, SHA-256 `d76abc1645120eb2…fbd71fb`, 49.838 Tris), `verify:assets` gruen.
- [x] deltaTime-Audit (M4f) und Pointer-Rate/Box3 (M4g) abgeschlossen; Push und
      Probe-Merge dokumentiert (M4h).
- [x] Suiten: `npm test` 396/396, Preview (3 Viewports), Einfahrt, Framerate
      (30/60/144 Hz), Pointer-Raten, Dev-Varianten, SEO 18 Routen + 404,
      Build 18 Routen + 404.

## Naechster Schritt

1. Merge-Entscheidung durch den Nutzer (kein Merge in diesem Lauf).
2. Vor dem Merge: Probe-Merge gegen den dann aktuellen `origin/main` wiederholen
   (drei bekannte Dokumentkonflikte, siehe REPORT.md §M4h/M4i).
3. Manuelle Restpunkte: iPad-Roundtrip (Procreate), Koaleszenz-Test auf Hardware
   mit hoher Polling-Rate, Freigabe fuer `vercel.json`.

---

# V3.2-M3 checkpoint — Optik (AO in der Albedo) — historisch, durch M4c/M4e ersetzt

Updated 2026-11-05. Branch `v3.2-mannequin-female`.

## Status

- [x] AO-Bake (2048, Distanz 0.18, Staerke 0.35, Verlauf 4 %) in der Albedo,
      Basis #f0efeb, Roughness 0.62, keine separate occlusionTexture.
- [x] Geometrie/UVs unveraendert (Tris, Fuellgrad, Bounding-Box geprueft),
      Procreate-OBJ bleibt, nur die Textur wurde ersetzt.
- [x] Neues GLB `mannequin-c.d76abc164512.glb` (457.000 B), Manifest und
      Config aktualisiert, `verify:assets` gruen.
- [x] Vorher/Nachher-Render + Textur in `docs/validation/MANNEQUIN-C/`.
- [x] `npm test` 387/387, Preview-Suite, SEO, Build 18 Routen + 404.

## Naechster Schritt

1. Optional: AO-Staerke/Distanz nach Geschmack justieren
   (`AO_STRENGTH`, `AO_DISTANCE` in `scripts/bake-mannequin-ao.py`), danach
   `node scripts/retexture-mannequin-c.mjs` erneut laufen lassen.
2. Lizenzfrage zu C bleibt offen (`outputs/mannequin-remodeling/LICENSE-NOTE-C.md`).

---

# V3.2-M2 checkpoint — "3d model" finalisiert

Updated 2026-11-04. Branch `v3.2-mannequin-female`, Basis `9dd66ce`.
Committet, **nicht gepusht**, kein Merge, kein Deploy.

## Status

- [x] Nur C ist sichtbar; der Varianten-Umschalter ist aus der UI entfernt.
- [x] A/B: verborgen, NICHT geloescht — Registry bleibt, erreichbar nur im
      Dev-Server ueber `?variant=a|b` (kein Link, keine Navigation).
- [x] `initialYaw` pro Variante als Konstante (C = 0 rad, C ist +Z-vorn).
- [x] Demo-Design fuer C deaktiviert (`aria-disabled` + sichtbarer Hinweis).
- [x] Section-Einfahrt ueber `src/section-entrance.js`: dieselben Sampler wie
      "01 / creative" (Schwellen .68/.10, Easing `smoothProgress`, Distanz
      min(28px, 4.5vw)); Reduced Motion instant.
- [x] `LICENSE-NOTE.md` wortgleich nach
      `outputs/mannequin-remodeling/LICENSE-NOTE-C.md` verschoben; Build
      enthaelt den String nicht mehr (Test).
- [x] Rotation/Hover/Drag/Swipe/Flick, Lazy-Load, dispose und No-WebGL-Poster
      unveraendert.
- [x] `npm test` 386/386, `test:mannequin-preview`, `test:mannequin-variants-dev`,
      SEO 18 Routen + 404, statische Titel 6/6, Build 18 Routen + 404.

## Naechster Schritt (bewusst nicht ausgefuehrt)

1. **Lizenz klaeren**: `outputs/mannequin-remodeling/LICENSE-NOTE-C.md`
   (ausserhalb des Repos). Erst nach Freigabe pushen/mergen.
2. V3.2-M1: geteilter Renderer-Chunk mit dem Hero, gemeinsame
   Rotationskonstanten, Decal-Placement fuer C.
3. Hero-"Abschiessen" als echtes Modul, sobald die Animation existiert
   (`TODO(V3.2-M1)` in `src/mannequin-preview-config.js`).

## Beobachtungen (vorbestehend, nicht angefasst)

- `npm run test:mobile` scheitert an `tests/mobile-interactions-browser.mjs:193`
  auch auf `9dd66ce` (eigener Worktree geprueft).
- `.chapter-counter` ueberlagert je nach Scrollposition den unteren Frame-Rand.
- A/B sind `-Z`-vorn, C ist `+Z`-vorn; ohne sichtbare A/B folgenlos.

# V3.1.2 final review state
---

# Next checkpoint — WORLD SOUND v3 merged, live on production
Updated 2026-11-05 after the cache-hashing release. **PR #22 and PR #23 are
merged into `main`.** `main` = `bae1b3f13b5befa49be3be3685a6cef92a799efd`
(merge commit of PR #23), production build marker `bae1b3f13b5b`. Vercel
deployed it automatically.

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
| Content-hashed audio URLs | DONE, LIVE | `<name>.<sha256:12>.m4a` + generated `src/audio/worldSoundManifest.js`; `vercel.json` rule verified on production: `public, max-age=31536000, immutable` |

## Merge record

- Branch `v3.2-world-sound`, head at merge `17ae6e4` (`V3.2-M9` re-decode
  measurement); `f654e49` (`V3.2-M8`) contained.
- PR #22 — https://github.com/h333ndrik/h4ngelic/pull/22 — merged with a merge
  commit at 2026-11-05T19:31:46Z. No squash, no rebase, branch not deleted.
- `main`: `9123a00` → `b5634bc5be4073c678672dd69f64810849cc157d`.
- Vercel: status context `Vercel` = success on `b5634bc`
  (deployment `https://vercel.com/h333ndrik/h4ngelic/Gjp2nvfSU3aKBXD4bQK4sEqsmnyh`).

Second merge: PR #23 — https://github.com/h333ndrik/h4ngelic/pull/23 — head
`b1a83b7` (`V3.2-M10`), merged with a merge commit at 2026-11-05T20:25:13Z.
`main`: `fdd42f5` → `bae1b3f13b5befa49be3be3685a6cef92a799efd`. Branch kept.

Post-merge asset check on `https://www.h4ngelic.com` (apex 308-redirects to
`www`), all four content-hashed URLs:

| URL | Status | Content-Type | Content-Length | Cache-Control |
| --- | --- | --- | ---: | --- |
| `/assets/audio/loop-333.d28de00523a5.m4a` | 200 | `audio/mp4` | 2,847,109 | `public, max-age=31536000, immutable` |
| `/assets/audio/loop-4.ab235d059fec.m4a` | 200 | `audio/mp4` | 2,774,228 | `public, max-age=31536000, immutable` |
| `/assets/audio/x-333-4.5ee49fedc6d4.m4a` | 200 | `audio/mp4` | 30,015 | `public, max-age=31536000, immutable` |
| `/assets/audio/x-4-333.477df723d4d9.m4a` | 200 | `audio/mp4` | 29,591 | `public, max-age=31536000, immutable` |

Byte counts match the committed files; the four stable paths return `404`. Before
this change the same URLs (and the hashed JS chunks) were served with
`public, max-age=0, must-revalidate`, which is why `vercel.json` was added.

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
3. Then decide whether the F-minor brief key is re-cut or accepted.
4. **Rebase `v3.2-mannequin-female` (local and remote both `b2433f5`) onto the
   new `main` BEFORE its next push.** It stayed out of scope for both releases
   and was not touched.

## Serving model (audio)

- Four files only, served as `/assets/audio/<name>.<sha256:12>.m4a`. The old
  stable names (`/assets/audio/loop-333.m4a` …) are gone and return `404`.
- `vercel.json` sets `Cache-Control: public, max-age=31536000, immutable` for
  `/assets/audio/(.*)` only — verified live on the four URLs. It contains
  nothing else (no buildCommand, outputDirectory, framework, rewrites or
  redirects), so the dashboard settings and routing stay untouched.
- **Use `npm run dev`, not a bare `vite`.** `predev` runs
  `node scripts/hash-world-audio.mjs`, which verifies the content hashes and
  regenerates `src/audio/worldSoundManifest.js`. A bare Vite start skips that
  step, so after replacing an audio file the dev server would still serve the
  old manifest. `npm run sounds:hash -- --check` verifies without writing.

## Rollback

- Git: `git revert -m 1 bae1b3f` on `main`, then push. This reverts PR #23 (the
  hashed URLs and the cache rule) as a new commit; history stays intact.
  The earlier release is reverted the same way with `git revert -m 1 b5634bc`.
- Vercel: previous production deployments are kept. Promote the deployment of
  `fdd42f5` back to production for an instant rollback without a new build.

## Known issues outside audio scope

- **`tests/smash-v31-browser.mjs` is a known load-dependent flake.** It polls a
  1.8 s gain attack with a 5 s `waitForFunction`. In the first back-to-back
  batch run after six other suites it timed out at that poll; the standalone
  run and the second full serial batch both passed at 1440/390/320. Evidence:
  `docs/validation/world-sound/v3/phase4c/smash-v31-browser.txt`. Do not treat
  a single timeout here as a new product defect — re-run it alone first.
- **`tests/world-sound-v3.test.js` — “the same source bytes rebuild
  byte-identical deliveries” is a known intermittent flake.** It re-encodes
  from `masters/` and compares M4A hashes. It failed once with
  “loop-333 is not reproducible”, then passed on an isolated re-run and in the
  full 402-test suite. Re-run it alone before treating it as a regression.
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
