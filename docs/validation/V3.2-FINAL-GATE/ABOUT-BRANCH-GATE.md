# Gate-Battery — Branch `flashes-merge` (About-Runde)

Datum: 2026-11-21/22 · Branch `flashes-merge` · HEAD `ee9de2b` (+ Reservierungs-Fix)
Basis: `origin/main` = `cb2d0a4` · Build: 38 Routen + 404 · Node: 448 Tests / 447 pass / 1 skipped / 0 fail

## Ablauf

1. `npm run build` → `Prerendered 38 routes + 404`.
2. `scripts/serve-preview.mjs` (Preview) + `vite` (Dev) gestartet.
3. `node scripts/gate-battery.mjs after2` — 40 Suiten seriell, jede gegen den Server,
   den ihre Verträge brauchen (`H4_BASE_URL` dev/preview). Rohdaten:
   `battery-after2.json`.
4. Rot-Nachweis: identische Suiten gegen einen separaten Worktree auf `origin/main`
   (`/tmp/h4base`, detached `cb2d0a4`) mit eigenem Build und eigenen Servern.

## Ergebnis

**33 pass · 4 fail · 3 missing** (von 40)

| Suite | Ergebnis | Ursache | Auf `origin/main` |
| --- | --- | --- | --- |
| `v32-structure-browser` | FAIL (7s) | erwartet 8 Flash-Platzhalter, seit B-F38 sind es 15 echte Fotos (`0 !== 8`) | **identisch rot** |
| `portfolio-browser` | FAIL (4s) | erwartet 8 Bilder im tattoos-Streifen, tatsächlich 23 (`23 !== 8`) | **identisch rot** |
| `seo-browser` | FAIL (0s) | `/creative` ohne JS 1096 px breiter als der Viewport | **identisch rot** (`1096 !== 0`) |
| `standalone-browser` | FAIL (4s) | liest `artifacts/h4ngelic-preview.html` — Artefakt vom 3. November (vor R2) | Artefakt, nicht Code |
| `artwork-transitions-browser` | MISSING | Datei existiert auf diesem Branch nicht | — |
| `mobile-interactions-browser` | MISSING | Datei existiert auf diesem Branch nicht | — |
| `standalone-native-browser` | MISSING | Datei existiert auf diesem Branch nicht | — |

Alle übrigen 33 Suiten grün, darunter `typography-contract`, `row-geometry-contract`,
`footer-zone-contract`, `footer-v31-browser`, `mobile-parity-browser`,
`v31-navigation-browser` (150 s), `v31-ui-browser`, `hero-boot-browser`,
`about-browser`, `label-format-browser`, `naavi-format-browser`, `hover-browser`,
`gallery-browser`, `smash-v31-browser`, `cursor-hit-test`, `seo-*`-Begleiter.

### `standalone-browser` nach frischem Export

`npm run preview:export` erzeugt `artifacts/h4ngelic-preview.html` neu (33,4 MB,
Build vom Branch). Danach: **PASS 1440 / 390 / 320** — vier Einträge im INDEX,
eine Sekunde „4", acht echte Fotos, null HTTP-Anfragen, keine Laufzeitfehler.
Der rote Lauf davor war ausschließlich das drei Wochen alte Artefakt.

## Ein echter Befund aus der Battery (behoben)

`cursor-hit-test` war im ersten Lauf rot:

```
1440x900 reduce: the footer scan must land samples on .page-footer
({"left":35,"right":1405,"top":4201.95,"bottom":4285.95})
```

Gemessen: die Sektion 02 wuchs mit dem größeren CTA auf 763 px, die Sektion 03
(Formular) auf 1166 px, reserviert waren für beide 720 px. Beim Scrollen ans
Seitenende wuchs das Dokument deshalb um 226 px nach, der Footer rutschte aus dem
Viewport — auf `origin/main` passiert das nicht (dort ist 02 nur 679 px hoch).

Fix in `src/style.css`: `.about-preview` reserviert `auto 480px` (mobil 300 px),
`.contact-section` `auto 950px` (mobil 800 px) — die gemessenen Content-Höhen.

Nachgemessen über 7 Breiten × beide Motion-Preferences:

| Breite | Dokument-Wachstum nach Scroll ans Ende | Footer sichtbar |
| --- | --- | --- |
| 1440 | −4 px | ja |
| 1280 | −37 px | ja |
| 1024 | 0 px | ja |
| 768 | 0 px | ja |
| 600 | 0 px | ja |
| 390 | 0 px | ja |
| 320 | 0 px | ja |

Danach `cursor-hit-test`: **PASS** — 1440 4470 Punkte, 390 1150, 320 940, je
reduziert 4470/1150/940, dazu xray 2221; Footer-Samples 174/70/55, NAAVI-Samples
8/8/6, null Fremd-Cursor.

## Nicht geprüft / offen

- Vercel-Preview ist SSO-blockiert; alle Messungen liefen gegen den lokalen
  Production-Build (`serve-preview.mjs`) bzw. den Dev-Server.
- Die drei Baseline-roten Suiten bleiben rot. Sie gehören in einen eigenen
  Test-Reconciliation-Lauf, nicht in diesen Branch.

## Rollback (falls nach dem Merge nötig)

`git revert --no-commit cb2d0a4..ee9de2b && git commit` bzw. nach dem Reservierungs-
Commit `…..<letzter-sha>`; danach Vercel-Promote des letzten READY-Deployments.
