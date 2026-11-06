# Token-Cleanup — Ghost-Token statt Literale

Build-Marker: `data-build="1689a220d008"` (committeter Batch-1-Stand).

## Befund (tokens-audit, STRUCT)

`src/easter-eggs.css` duplizierte drei Token-Werte:

- `.footer-smash { text-transform: lowercase; }` (Token `--h4-ghost-transform`)
- `.secret-message.is-discovered { opacity: .35; }` (`--h4-ghost-opacity`)
- `.footer-secret .secret-message.is-discovered { opacity: .35; }` (dito)

## Fix

Die `text-transform`-Deklaration entfällt (die Site läuft global lowercase),
beide Opacity-Regeln konsumieren `var(--h4-ghost-opacity)`.

## Beweis

`tests/tokens-audit.mjs` → **10 Definitionen, 12 Consumer, 0 duplizierte
Literale** (`../STRUCT/contracts/tokens.json`, `passed: true`).

`tests/tokens-visual-snapshot.mjs` vergleicht zwei Läufe **desselben Builds**:
`TOKEN_SNAPSHOT_MODE=baseline` injiziert die drei entfernten Literale,
der Vergleichslauf nutzt die Token. Ergebnis: **0 geänderte Farbkanäle** in
allen sechs Footer-Snapshots (1440/390/320 × normal/Other Side), außerhalb
des animierten 2-px-Rands.

| Breite | normal | Other Side |
| --- | --- | --- |
| 1440 | `normal-1440.png` = `after-normal-1440.png` | `other-1440.png` = `after-other-1440.png` |
| 390 | `normal-390.png` = `after-normal-390.png` | `other-390.png` = `after-other-390.png` |
| 320 | `normal-320.png` = `after-normal-320.png` | `other-320.png` = `after-other-320.png` |

## So prüfst du es (2–3 Zeilen)

1. Footer ansehen: „h4 moshlab“, „visit 0005“ und der versteckte SMASH-Hinweis
   sehen exakt aus wie vorher (gleiche Helligkeit, gleiche Kleinschreibung).
2. Im Other Side (Taste 4) den Footer öffnen — der Ghost-Hinweis hat dieselbe
   Deckkraft wie im normalen Modus.

## Kommandos

```sh
TOKEN_SNAPSHOT_MODE=baseline H4_BASE_URL=http://127.0.0.1:55230 node tests/tokens-visual-snapshot.mjs
H4_BASE_URL=http://127.0.0.1:55230 node tests/tokens-visual-snapshot.mjs
node tests/tokens-audit.mjs
```
