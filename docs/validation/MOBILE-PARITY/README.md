# MOBILE-PARITY — B-F32 (Cursor + Glyph)

Basis `8c710c3` + B-F31 (`4bb62fa`, `6cbe954`, `5dfe46b`).

## B-F32

| Prüfung | 390 px | 320 px | 1440 px |
| --- | --- | --- | --- |
| `@media (pointer: coarse)` | true | true | false |
| computed `cursor` am Footer-Branding | `auto` (System) | `auto` (System) | `h4ngelic-cursor` |
| `.footer-secret` (HOLD-4-Hinweis) | `display: none` | `display: none` | sichtbar |
| End-Reveal-Fläche `[data-footer-secret-space]` | vorhanden | vorhanden | vorhanden |

Der Custom-Cursor hängt bereits an `@media (any-hover: hover) and
(any-pointer: fine)` (`src/cursor.css:35`); auf coarse Pointern greift keine
einzige Cursor-Deklaration, es gibt deshalb auch kein „hängendes" Element —
gemessen, nicht angenommen (`results.json`).

Neu ist nur die Glyph-Regel: der HOLD-4-Hinweis braucht eine Tastatur, auf
Touch bleibt seine Nachricht dauerhaft unsichtbar — er war damit eine
unsichtbare Fokusfalle. `src/easter-eggs.css` (Block `max-width: 600px`) setzt
`.footer-secret { display: none; }`. Die End-Reveal-Fläche bleibt, damit die
NAAVI weiterhin dorthin springen kann.

Test: `tests/mobile-parity-browser.mjs` (`npm run test:mobile-parity`), in der
Gate-Battery registriert. Läufe: 390/320/1440 grün; `v15-mobile-browser` und
`greeting-browser` (390/320) unverändert grün.
