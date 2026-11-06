# B-F22 — Filterleiste: Messung statt zweitem Fix (GATEPREP-2, Batch 1)

Build `c4710034ec5d`, HEAD `3744967`. Messskript:
`verify-chips.mjs` → `chips-verification.json`. Kein Quellcode geändert.

## Messung (Zustand `aria-current` gesetzt)

| Breite | Brand-Baseline | Chip-Baselines | Δ | Chip-Höhen | `column-gap` | `--chips-gap` | Breite ≤ Reservierung | Seite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1440 | 53.00 | 53.00 / 53.00 / 53.00 / 53.00 | **0.00** | 44.0 ×4 | 19.44 | 19.44 | 272.7 ≤ 1220.2 | 0 Overflow |
| 1920 | 53.50 | 53.50 ×4 | **0.00** | 44.0 ×4 | 22.00 | 22.00 | 296.6 ≤ 1690.9 | 0 |
| 2560 | 53.50 | 53.50 ×4 | **0.00** | 44.0 ×4 | 22.00 | 22.00 | 296.6 ≤ 2330.9 | 0 |
| 390 | 46.00 | 45.50 ×4 | **0.50** | 44.0 ×4 | 10.00 | 10.00 | 176.7 ≤ 231.7 | 0 |
| 320 | 46.00 | 45.50 ×4 | **0.50** | 44.0 ×4 | 10.00 | 10.00 | 165.1 ≤ 165.1 | 0 |

Die 0,50 px bei 390/320 kommen von zwei verschiedenen Schriftgrößen im selben
44-px-Kasten (Wortzeichen 14,82 px, Chips 13 px), beide zentriert. Kriterium war
≤ 1 px.

## Höhen-Delta je Zustand

| Zustand | 1440 | 1920 | 2560 | 390 | 320 |
| --- | --- | --- | --- | --- | --- |
| `aria-current` gesetzt | 44.0 ×4 | 44.0 ×4 | 44.0 ×4 | 44.0 ×4 | 44.0 ×4 |
| ohne `aria-current` | 44.0 ×4 | 44.0 ×4 | 44.0 ×4 | 44.0 ×4 | 44.0 ×4 |
| gedrückt (`:active` gehalten) | 44.0 ×4 | 44.0 ×4 | 44.0 ×4 | 44.0 ×4 | 44.0 ×4 |

Unterstreichung: `text-decoration: underline`, `text-underline-offset: 6px`,
`text-decoration-thickness: 1px` — kein `border-bottom`, keine Höhenänderung.
Im gedrückten Zustand wächst nur die Textbox des aktiven Chips um 0,17–0,20 px
durch den gemeinsamen Hover-Scale (1,025); die Elementhöhe bleibt 44 px.

## Kopplungs-Negativprobe

`--chips-gap: 80px` → Cross-Links (A), `footer-left`/`footer-details` (C)
bleiben an allen fünf Breiten unverändert, nur die Chips bewegen sich.
`--row-gap-min: 900px` → Chips und Footer bleiben unverändert, nur die
Cross-Links bewegen sich. Rohwerte in `chips-verification.json` unter
`coupling.before|afterChips|afterRow`.

## NAAVI-Reservierung gegen Referenz

`max-width` kommt weiterhin aus `var(--work-row-width)` (JS-gemessener
Brand-zu-INDEX-Abstand). Die Filterbox selbst ist gegenüber dem Vorzustand
(`inventory-before.json`) identisch: links 134,34 px, Breite 272,72 px @1440;
bei 320 px greift die Reservierung exakt (165,1 = 165,1). Die Leiste bleibt in
ihrem Bereich und verbreitert die Seite nicht (`pageOverflow` 0 überall).

## Entscheidung

Alle B-F22-Kriterien sind erfüllt. **B-F22 wird auf `fixed` gesetzt**, Beleg ist
der Typ-B-Commit `2ff38b4` aus B-F25. Kein Code in diesem Batch.
