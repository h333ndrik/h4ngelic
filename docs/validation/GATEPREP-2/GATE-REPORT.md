# GATEPREP-2 — Gate-Report (drei Micro-Batches)

Ausgangspunkt `3744967` (Build `c4710034ec5d`). Kein Merge, kein Deploy, kein
Force-Push. `main` (`9123a00`) und `mail-01-diagnostics` unangetastet.

## Batch 1 — B-F22 geprüft und geschlossen (Messung, kein Code)

`docs/validation/B-F25-ROW-MECHANISM/B-F22-CHIPS.md`, Rohdaten in
`chips-verification.json`, Commit `af37506`.

| Kriterium | Ergebnis |
| --- | --- |
| Baseline je Chip gegen `h4ngelic` | 0,00 px @1440/1920/2560; 0,50 px @390/320 |
| Höhe `aria-current` / ohne / `:active` | 44,0 px in allen drei Zuständen @ allen fünf Breiten |
| `column-gap` = `--chips-gap` | 19,44 / 22 / 10 px, exakt |
| 44-px-Targets | 44,0 px, alle vier |
| NAAVI-Reservierung | Box 134,34 / 272,72 px @1440, 165,1 = 165,1 @320; kein Seiten-Overflow |
| Kopplung `--chips-gap` (80 px) | nur Typ B bewegt sich, A und C stehen |
| Kopplung `--row-gap-min` (900 px) | nur Typ A bewegt sich, B und C stehen |

**Entscheidung:** B-F22 `fixed`, Beleg `2ff38b4` (B-F25 Typ B). Kein zweiter Fix.

## Batch 2 — B-F19 Cursor-Cascade

Evidence: `docs/validation/B-F19-CURSOR-CASCADE/README.md`,
`phase0-diagnosis.json`, `hit/hit-results.json`.

| Prüfung | Ergebnis |
| --- | --- |
| Regel-Gewinner, 18 Ziele @1440 und @390 | 36/36 Bild-Cursor, Gewinner immer Garantie-Ebene |
| `elementsFromPoint`, 10 Punkte Footer + 10 NAAVI | 40/40 Bild-Cursor |
| Fremde `cursor`-Regeln im Bundle | 0 (nur Token-Definition + 5 Ebenen) |
| Inline `style.cursor` | 0 |
| Assets | 8/8 HTTP 200, dekodiert, 20×30 / 21×32 px |
| Scroll-Gutter | Footer-Cluster bei ≤600, Filterleiste bei 320 = native Gutter, OS-Grenze |
| Vercel-Preview | `302 → vercel.com/sso-api` (SSO), von hier nicht prüfbar |

**Befund:** der gemeldete Systempfeil ist auf diesem Build **nicht
reproduzierbar**. Verbleibende Erklärungen: nativer Scroll-Gutter (OS-Grenze)
oder ein anderer geladener Stand (`data-build` prüfen, Konsole-Snippet im
README). Die Garantie-Ebenen wurden um `a` ohne `href` und `::backdrop`
erweitert; der Hit-Test prüft jetzt, dass der Messpunkt wirklich im Ziel liegt.

Hit-Test: 4470 / 1150 / 940 Punkte je Motion-Preference plus 2221 xray,
0 Fremd-Cursor. Registry: B-F19 `fixed`, User-Sichtprüfung offen.

## Batch 3 — Legacy-Suiten entschieden

| Suite | Ausgang | Begründung | Commit |
| --- | --- | --- | --- |
| `scroll-browser.mjs` | **pensioniert** | Braucht Pinning (`--motion-run`, `[data-motion-pin]`), sechs `.motion-echo` und drei Rubriken. Alle drei Verträge sind weg (unten). | `tests/legacy/` |
| `easter-browser.mjs` | **pensioniert** | Prüft die V3.0-„seven-tier memory"-Zeile, einen `[data-visit-counter-hotspot]`-Regler und `.archive-empty` als Blank-Fläche. Seit B-F8 ist VISIT eine stille Anzeige, die Zeile ist weg, das Tattoo-Archiv gefüllt. | `tests/legacy/` |
| `smart-v3-browser.mjs` | **pensioniert** | V3-Shell: NAAVI-Total `03` (jetzt `04`, Other Side ist viertes Kapitel) und ein gepinnter Contact-Scroll. Bereits in `docs/V3.1.2-FINAL-REPORT.md` als ältere V3-Suite markiert. | `tests/legacy/` |
| `ref09-layout-browser.mjs` | **pensioniert** | Wartet auf `#stage.is-ready` im Reduced-Motion-Profil (dort rendert bewusst das Poster), misst `[data-visit-counter-hotspot]`, die siebenstufige Begrüßung und die alte Footer-Identity-Zeile. | `tests/legacy/` |

Entfernte Verträge und deren Commits:

- Motion-Echos, Pinning, V3.1-Footer, NAAVI-Total 04: `daeaff8`.
- VISIT als stille Ghost-Anzeige statt Hotspot: `2d52ca3` (B-F8).
- Vierte Rubrik: `736e71d`-Zyklus / B-F25 (`deca5a1` … `80133fa`).
- Poster-Hero im Reduced-Motion-Profil: F20/F29 (`31832b8`, `c77cffa`).

Live-Abdeckung je Suite steht in `tests/legacy/README.md`; die npm-Skripte
`test:motion` und `test:easter` sind entfernt, die Regel steht in `AGENTS.md`
(Abschnitt „RETIRED SUITES"). Kein „bleibt rot und egal".

## Datei-Überschneidung der Batches

- Batch 1: nur Doku/Evidence (`docs/validation/B-F25-ROW-MECHANISM/*`,
  `BEFUNDE.md`).
- Batch 2: `src/cursor.css`, `tests/cursor-hit-test.mjs`, Doku.
- Batch 3: `tests/legacy/*`, `package.json`, `AGENTS.md`, Doku.
Keine Datei wird von zwei Batches gleichzeitig angefasst.

## Stand und nächster Schritt

- Registry: B-F22 `fixed`, B-F19 `fixed` (Sichtprüfung offen), B-F25
  `reproduced`.
- Merge-Queue unverändert: 1. PR #22 (world sound), 2. `v3.1.1-fixes`
  (inkl. STRUCT + B-F25 + GATEPREP-2), 3. `mail-01-diagnostics`.
- Rollback bei einem Merge: `git revert -m 1 <merge-sha>` plus Vercel-Promote
  des letzten READY-Deployments.
- Merge erst nach ausdrücklichem „merge"/„go".
