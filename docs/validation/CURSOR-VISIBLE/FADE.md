# B-F1 r2 — weicher Cursor-Fade (180 ms)

Build-Marker: siehe `fade-trace.json` (`build`).

## Befund

Das Hide-on-Leave aus B-F1 funktionierte, schaltete aber hart: der Reveal lief
mit `transition: opacity 0s`, der Leave mit 120 ms. Die alte Production-Version
blendete sichtbar weicher.

## Fix

- `--h4-cursor-fade: 180ms` als zentrale Dauer am Overlay.
- Leave (`pointerout`/`mouseout`, `pointerleave`, `blur`, `visibilitychange`,
  `pagehide`, 900-ms-Idle-Fallback): `opacity 1 → 0` über 180 ms ease-out,
  `visibility` wechselt erst nach dem Fade auf `hidden`.
- Re-Enter: gleiche 180 ms ease-out, `visibility` sofort sichtbar.
- Es transitioniert **nur** `opacity` und `visibility`; `transform` bleibt
  ohne Transition und springt 1:1 auf den Pointer. Im Head-Script wird erst
  `translate3d(...)` gesetzt, dann `data-h4-cursor-visible="true"` – der Fade
  startet immer an der neuen Position.
- Initial bleibt das Overlay `opacity: 0; visibility: hidden`, der erste
  Fade-in passiert erst nach der ersten Positionierung.
- Reduced Motion: `transition: none` (instant, wie alle anderen Übergänge).
- xray-Allowlist behält ihr sofortiges Ausblenden (`transition: none`), damit
  der Moduswechsel unverändert bleibt.

## Trace (`fade-trace.json`)

| Lauf | Mid-Frames | Dauer bis Endwert | Start → Ende |
| --- | --- | --- | --- |
| Vorher (Transition entfernt, gleicher Build) | 0 | 0 ms (Hard Cut) | 1 → 0 in einem Frame |
| Leave | 8 | 183 ms | 1 → 0 |
| Re-Enter (neue Position 420/300) | 8 | 183 ms | 0 → 1 |
| Reduced Motion | 0 | 0 ms | 1 → 0 sofort |

Der erste Frame mit `data-h4-cursor-visible="true"` liegt bereits exakt auf dem
neuen Pointer (`dx/dy ≤ 0.25 px`) und startet bei `opacity < 1` – also Fade am
neuen Punkt, kein Nachlauf von der alten Stelle.

## Screenshots (1440 px)

- `fade-visible-1440.png` — Ruhezustand, Cursor voll sichtbar.
- `fade-out-mid-1440.png` — Mid-Frame im Leave-Fade.
- `fade-in-mid-1440.png` — Mid-Frame im Re-Enter-Fade an der neuen Position.

## So prüfst du es (2–3 Zeilen)

1. Maus aus dem Fenster führen: das Logo verschwindet über ~180 ms weich statt
   hart zu springen.
2. Zurück ins Fenster und sofort bewegen: das Logo erscheint weich direkt unter
   dem Pointer, ohne von der alten Stelle herzufahren.
3. Schnell über Links/NAAVI fahren: Tracking bleibt pixelgenau, nur die
   Sichtbarkeit blendet.

## Kommandos

```sh
H4_BASE_URL=http://127.0.0.1:55231 node tests/cursor-fade-browser.mjs
H4_BASE_URL=http://127.0.0.1:55231 node tests/cursor-kernel-browser.mjs
H4_BASE_URL=http://127.0.0.1:55231 node tests/cursor-hit-test.mjs
npm test
```

TESTMODE: fast — volle serielle Battery erst am Merge-Gate.
