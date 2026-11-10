# B-F19 auf der Live-Seite — Production `adb82226c7c3`

**Anlass:** Der Befund „an NAAVI unten wechselt der Cursor" wurde zweimal auf
Previews gemeldet, die von hier aus per SSO blockiert sind. Diese Messung läuft
gegen die **echte Production**, also gegen das Deployment von `main`.

- Base: `https://www.h4ngelic.com`
- Build-Marker: `adb82226c7c3` (`<meta name="h4-build">` im ausgelieferten HTML)
- Befehl:
  ```bash
  H4_BASE_URL=https://www.h4ngelic.com \
  H4_CURSOR_HIT_ARTIFACTS=docs/validation/CURSOR-NAAVI/production-adb8222 \
  H4_CURSOR_HIT_REPORT_NAME=hit-results.json \
    node tests/cursor-hit-test.mjs
  ```

## Ergebnis

| Viewport | Punkte (24-px-Raster) | verschiedene Cursor-Werte | Fremd-Cursor |
| --- | --- | --- | --- |
| 1440 × 900 | 4470 | 1 | 0 |
| 390 × 844 | 1150 | 1 | 0 |
| 320 × 844 | 940 | 1 | 0 |
| 1440 × 900, reduced motion | 4470 | 1 | 0 |
| 390 × 844, reduced motion | 1150 | 1 | 0 |
| 320 × 844, reduced motion | 940 | 1 | 0 |

Der eine Wert ist in allen Profilen wörtlich
`url("https://www.h4ngelic.com/assets/h4ngelic-cursor.svg") 8 2, url("…h4ngelic-cursor.png") 8 2, auto`.
`offenders` ist in jedem Profil leer.

NAAVI-Audit bei 1440, 390 und 320: `a.chapter-counter` hat `cursor: <Logo>` und
`pointer-events: auto`; die dekorativen Kinder (`.interaction-visual`,
`.chapter-digit-window`, `.chapter-digit`) bleiben `pointer-events: none` und
erben denselben Cursor.

Ebenfalls geprüft und grün: Footer-Cluster (Copyright, `berlin de`, `h4 moshlab`,
`visit`), Rubrikleiste, Formularfelder, Hero-Canvas inklusive simuliertem
Ziehen (`drag`), Xray-Allowlist (2221 Punkte), Touch-Profil (kein Logo-Cursor,
System-Cursor bleibt).

## So prüfst du es

1. `https://www.h4ngelic.com` laden, Konsole:
   `document.documentElement.dataset.build` → `adb82226c7c3`.
2. Mit der Maus über NAAVI unten (`04/ 04`, die `/`-Glyphe, den Zähler) fahren —
   der Cursor bleibt das h4-Logo.
3. Gleiches über Footer (`instagram`, `berlin de`, `visit`) und die
   Rubrikleiste auf `/creative/tattoos`.

`summary.json` ist die gekürzte Fassung des Reports (Kopfzahlen, Cursor-Wert,
NAAVI-Audit, Regionen mit Cursor-Wert statt vollständiger Cascade-Blobs);
`top-*`, `regions-*` und `touch-390.png` sind die Screenshots aus demselben
Lauf (das 1-MB-Xray-Materialbild wurde nicht mitcommittet; die Xray-Zahlen
stehen in `summary.json`).
