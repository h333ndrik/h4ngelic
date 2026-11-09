# Batch 1 — Cursor-Hide, Hero-Bar im Flow, begrenzter Touch-Fling

Build-Marker: `data-build="1689a220d008"` (committeter Stand der Batch-1-Commits
`735ea49`…`1689a22`, neu gebaut und gegen diesen Marker verifiziert). Die
Phase-0-Läufe davor tragen `831737ce85e6`, den unveränderten Ausgangsstand.

## Phase 0 — reproduziert vor dem Fix

| ID | Befund | Beleg |
| --- | --- | --- |
| B-F1 | Cursor bleibt nach Fenster-Verlassen sichtbar (`after: "true"`). | `../phase0/results.json`, `../phase0/cursor-frozen-*.png` |
| B-F2 | `.hero-nav` ist `position: fixed`; `navTop` bleibt 832 px bei `scrollY = 405` (1440 px). | `../phase0/results.json`, `../phase0/bar-scrolled-*.png` |
| B-F3 | Fling dreht das Logo bis 178,08° (Desktop-Messung), mobile Frames zeigen die edge-on-Silhouette. | `../phase0/physics.json`, `../phase0/fling-*.png` |

## Fix (zentrale Quellen)

1. **B-F1** — `index.html` Head-Script: `pointerout`/`mouseout` mit
   `relatedTarget === null`, `pointerleave`, `blur`, `visibilitychange`,
   `pagehide` und ein 900-ms-Idle-Fallback (`document.hasFocus() === false`).
   Anstehende rAF-Frames werden beim Verstecken abgebrochen.
2. **B-F2** — `.hero-nav` liegt jetzt im `<section class="hero">` und ist
   `position: absolute`. Der R7/F22-Bar-Transform (`sampleHeroBar`,
   `--hero-bar-shift`, `data-hero-bar-state`) ist entfernt.
3. **B-F3** — `src/data/heroPhysicsSettings.js` ist die einzige Quelle für
   Geschwindigkeits- und Rotationsgrenzen: Pointer 24, Drag 14, linear 4,2,
   angular 2,2, zusätzliche Rotation `Math.PI * .22` (39,6°), Return-Fenster
   2,5 s, Dämpfung 1,15 / 1,25.

## Messwerte nach dem Fix

- Hero-Bar: `position: absolute`, `insideHero: true`; `navTop 832 → 652` bei
  180 px Scroll (1440 px), `controlsTop 832 → 652`; Dokumenthöhe unverändert
  (`4213`), kein `data-hero-bar-state` mehr (`gallery/results.json`).
- Cursor: `opacity 0`, `visibility: hidden`, `data-h4-cursor-visible="false"`
  nach `pointerout relatedTarget=null`; Cursor-Kernel zusätzlich 20/20
  Sprünge mit 0 px Abweichung (`tests/cursor-kernel-browser.mjs`).
- Fling: identische extreme Geste 120 Hz — **179,99° vor dem Fix → 39,60°
  danach**, Lineargeschwindigkeit ≤ 4,2, Winkelgeschwindigkeit ≤ 2,2,
  Ruhe nach 3,408 s (`gallery/fling-physics.json`).
- Die Ambient-Basis (15-s-Zyklus in `src/motion.js`) bleibt unangetastet; für
  die Fling-Frames ist sie über `Pause` eingefroren, damit die Screenshots nur
  die Interaktionsrotation zeigen.

## Screenshots

- `rest-{1440,390,320}.png` — eingefrorene Ausgangspose vor dem Fling.
- `after-fling-{1440,390,320}-{350,650,1000}.png` — Mid-Frames nach dem Fling
  (kein Überschlag, Wortmarke bleibt lesbar).
- `after-bar-top-*.png` / `after-bar-scrolled-*.png` — Bar im Hero-Flow vor und
  nach 180 px Scroll.
- Vorher: `../phase0/fling-*-650.png` (edge-on) und
  `../phase0/bar-scrolled-*.png` (fixierter Balken).

## So prüfst du es (2–3 Zeilen)

1. Preview laden, Maus aus dem Fenster führen: der Logo-Cursor verschwindet und
   erscheint erst bei der nächsten Bewegung — nicht eingefroren am Rand.
2. Home 300 px scrollen: `creative / about / contact` und die Controls wandern
   mit dem Hero nach oben aus dem Bild (kein fixierter Balken mehr).
3. Mobile: Logo kräftig antippen und wegwerfen — es dreht maximal ~40°
   zusätzlich, bleibt lesbar und ist nach ~3,4 s wieder ruhig.

## Kommandos

```sh
H4_BASE_URL=http://127.0.0.1:55230 node tests/gateprep-batch1-browser.mjs
node tests/gateprep-batch1-physics.mjs
H4_BASE_URL=http://127.0.0.1:55230 node tests/cursor-kernel-browser.mjs
node --test tests/physics.test.js tests/scroll-motion.test.js
H4_BASE_URL=http://127.0.0.1:55230 node tests/v32-micro-browser.mjs
H4_BASE_URL=http://127.0.0.1:55230 node tests/v31-motion-browser.mjs
npm test
```
