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

## B-F37 — Mute-Taste „m"

Ein Dokument-Keydown im bestehenden Sound-Controller (`src/sound-controls.js`)
schaltet denselben Zustand wie der Button: `audio.setMuted(!audio.muted)`,
Label und `aria-pressed` folgen über das vorhandene `refresh()`.

Guard: `input`, `textarea`, `select`, `contenteditable` und jede Modifier-Taste
(`meta`/`ctrl`/`alt`) brechen vorher ab — ohne `preventDefault`. Groß- und
Kleinschreibung ist egal. Auf reinen Touch-Geräten gibt es kein
Tastatur-Äquivalent; dort bleibt der Button der einzige Weg (in der Tabelle
so geführt).

Nachweis (`tests/mobile-parity-browser.mjs`, 1440 px): `m` kippt den Zustand,
zweites `m` stellt ihn wieder her, Label folgt (`sound on` / `sound off`),
„mmmail" im Namensfeld bleibt Text und schaltet nichts, `Meta+m` schaltet
nichts.

Hinweis: `tests/sound-controls-browser.mjs` bricht in dieser Umgebung bei
`[data-smash]` ab (Timeout) — unabhängig von dieser Änderung, die nur einen
Keydown-Zweig ergänzt und kein DOM anfasst.

## B-F36 (Teil 1) — Footer ohne Scroll-Container

`@media (max-width: 600px)`: `.footer-left` und `.footer-details` sind keine
Scroll-Container mehr (`overflow: visible`, `flex-wrap: wrap`, `white-space:
normal`, `scrollbar-width: auto`). Der Inhalt bricht um, statt zu scrollen.

| Viewport | `.footer-left` sw/cw | `.footer-details` sw/cw | Höhe | Seite/Viewport | Brand/Visit/NAAVI |
| --- | --- | --- | --- | --- | --- |
| 320 | 88 / 88 | 88 / 88 | 90 px | 320 / 320 | 44 / 44 / 44 px |
| 390 | 123 / 123 | 123 / 123 | 90 px | 390 / 390 | 44 / 44 / 44 px |
| 1440 | 624 / 624 | 163 / 163 | 44 px (nowrap, unverändert) | 1440 / 1440 | 44 / 44 / 44 px |

Damit ist die H1-Quelle aus B-F19 **strukturell weg**: es gibt bei 320/390
keinen Container mehr, der scrollen könnte, also auch keinen Gutter —
unabhängig davon, ob H1 je bewiesen wird. Vorher: `146 / 88` bzw. `128 / 88`.
Kein horizontaler Seitenoverflow, alle Targets 44 px, Desktop unverändert.

**Noch offen an B-F36:** die sichtbare Rangfolge in drei Zeilen
(creative/about/contact → slow/pause/sound → 00/04). Sie betrifft `.hero-nav`
und `.controls`, die im Hero positioniert sind, nicht den Footer-Container —
das ist ein sichtbarer Umbau, der eine Vergleichsansicht braucht. Nicht in
diesem Lauf gebaut.

## B-F19 — Nachtrag

Die Ursache-Hypothese H1 (Gutter) ist mit B-F36 Teil 1 gegenstandslos
geworden: die Cluster scrollen nicht mehr, es gibt keinen Rand, auf dem ein
Systempfeil liegen könnte. Die offenen Fragen an den User (macOS-Scrollbalken
„Immer"/„Automatisch", Pfeil nur auf dem Randstreifen oder über der Zeile,
auch bei 1440) bleiben für die Begründung dokumentiert, blockieren den Fix
aber nicht mehr.

## B-F36 (Teil 2) — drei Zeilen in Leserichtung

Auf ≤600 px stehen die drei Gruppen jetzt von oben nach unten und jeweils von
links nach rechts: **creative / about / contact** (primär, volle Breite),
**slow / pause / sound on** (sekundär, `opacity: .72`), **00/ 04** (der fixierte
NAAVI, zentriert).

| Viewport | Nav | Controls | NAAVI | Überlappung | Seitenbreite |
| --- | --- | --- | --- | --- | --- |
| 320 | 688–732 | 744–788 | 788–832 | keine | 320 = 320 |
| 390 | 688–732 | 744–788 | 788–832 | keine | 390 = 390 |
| 1440 | 776–820 (rechts) | 776–820 (links) | 788–832 | keine | 1440 = 1440 (unverändert) |

Alle drei Zeilen halten 44 px Höhe. Die alte Controls-Position (oben rechts,
`top: 72px`) ist damit weg — sie war die Ursache für „slow/pause/sound gedrängt
über den Links".
