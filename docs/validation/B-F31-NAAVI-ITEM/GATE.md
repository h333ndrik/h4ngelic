# GATE — B-F19 / B-F28 / B-F29 / B-F30 / B-F31

Stand zu Beginn: **`16084997f3e9`** (`origin/main`, „docs: close MAIL-02 in the
registry and move the merge queue to mail-01"). Stimmt mit der Vorgabe überein.
Baseline `npm test`: siehe Abschnitt 4.

## 1. F1 — Wo stehen Rubriken und Sektionen heute?

| Frage | Befund | Beleg | stabil? |
| --- | --- | --- | --- |
| Rubriken (tattoos, jewellery, tools, more) | zentral als Daten | `src/data/siteContent.js:26-31` (`workGroups` mit `children`) | ja |
| Sektionen (Rubrik-Innenleben) | zentral als Daten | `src/data/siteContent.js:14-22` (`categories`, inkl. `legacy: paintings`) | ja |
| Sektion „3d model" | **nur im Markup**, nicht in der Datenliste | `src/pages.js:170` (`id="model-3d"`, hart im Template-String) | nein |
| Sektions-IDs | aus der Daten-ID abgeleitet, aber an zwei Stellen gebaut | `src/pages.js:181` (`sectionId = primary ? finished-${entry.id} : entry.id`) und `src/pages.js:196` (Literal `'finished-tattoos'`) | teilweise |

Ergebnis F1: **zentral in `src/data/siteContent.js`** — mit einer Ausnahme
(„3d model") und mit einer doppelt gebauten ID-Regel.

## 2. F2 — Daten, Schleife oder hart im Markup?

| Rubrik | Sektionen laut Daten | gerendert als | Vorkommen der Sektions-ID im Quellcode |
| --- | --- | --- | --- |
| tattoos | tattoos, flashes (+ „3d model" nur im Markup) | Schleife `src/pages.js:180-186`, Modell-Sektion `:170` | `finished-tattoos` 1× (`pages.js:196`), `flashes` 8×, `model-3d` **1×** hart (`pages.js:170`) |
| jewellery | jewellery | Schleife, `directCategory`-Zweig `pages.js:194` | 12× |
| tools | tools (Karten, extern) | eigener Zweig `pages.js:172-177` | 12× |
| more | digital-artworks, analog-photography | Schleife `pages.js:180-186` | 12× / 6× |

Befund: **zwei Stellen** für die Rubrik-Innenstruktur (Datenliste + hart
kodierte Modell-Sektion) und **zwei Stellen** für eine Sektions-ID
(`finished-${entry.id}` in Zeile 181, Literal in Zeile 196).

Live-Gegenprobe (`https://www.h4ngelic.com/creative/tattoos`, Build
`16084997f3e9`): `<section id="finished-tattoos">`, `<section id="flashes">`,
`<section id="model-3d">`; Überschriften `tattoos`, `flashes`, `3d model`.
`/creative/more`: `<section id="digital-artworks">` **vor**
`<section id="analog-photography">`.

## 3. F3 — Stabile IDs und bestehende Verlinkungen

| ID | heute | verlinkt von | Umbenennung bricht |
| --- | --- | --- | --- |
| `finished-tattoos` | tattoos-Primärsektion | nur intern (`pages.js:196`) | nichts nachweisbar |
| `flashes` | tattoos-Untersektion | Tests, CSS/JS über `data-horizontal-drift` | ja (Test-Erwartungen) |
| `model-3d` | Modell-Sektion | `tests/mannequin-framerate-browser.mjs:114` | ja |
| `digital-artworks` | more-Sektion | `tests/v15-mobile-browser.mjs:121`, `tests/v31-ui-browser.mjs:221` | ja |
| `jewellery` | Rubrik + Sektion | `src/routes.js`, Tests | ja |

Gepflegte URL-Hashes existieren nicht: `#flashes`, `#onskin`, `#3d-model`
kommen in `src/`, `tests/` oder `index.html` nicht als Ziel vor. Die IDs sind
heute reine DOM-Anker.

## 4. Testlauf vorher

`npm test` auf `1608499`: **441 Tests / 440 pass / 1 skipped / 0 fail**
(Skip unverändert: Audio-Byte-Identität, local-only Master).

## 5. Sektionsliste (ab jetzt gültig) — Vorschlag, nicht implementiert

| Rubrik | Sektion | Status |
| --- | --- | --- |
| tattoos | tattoos (Label `tattoos`, ID `finished-tattoos`) | vorhanden |
| tattoos | flashes | vorhanden |
| tattoos | 3d model (ID `model-3d`, nur im Markup) | vorhanden, **muss in die Datenliste** |
| jewellery | jewellery | vorhanden |
| tools | tools (Kartenrubrik) | vorhanden |
| more | digital-artworks | vorhanden |
| more | analog-photography | vorhanden |

## 6. Entscheidung nach dem Gate

**A** — zentrale Quelle ist da, Sektionen liegen darin; die Liste wird dort
erweitert („3d model" wandert aus dem Markup in `siteContent.js`) und das
Markup rendert daraus. Für die eine hart kodierte Sektion gilt der B-Teil
dieser Entscheidung; betroffen ist ausschließlich die Rubrik `tattoos`.

## 7. STOPP — drei Messungen widerlegen Vorgaben aus Teil 5/6

Grundregel 3 verlangt hier den Stopp vor dem Umbau:

| # | Vorgabe | Messung | Widerspruch |
| --- | --- | --- | --- |
| K1 | Überschrift `on skin` für die erste tattoos-Sektion | Datenlabel ist `tattoos` (`siteContent.js:15`), live gerendert als `tattoos`; `tests/retired-slug-browser.mjs:60` **verbietet** `on skin` in Archiv-Überschriften; `/creative/onskin` ist ein 301 auf `/creative/tattoos` (B-F7, User-Entscheid 04.11.) | Die Vorgabe würde B-F7 zurücknehmen und einen grünen Test rot machen |
| K2 | Anker `#onskin` und `#3d-model` | Live-IDs sind `finished-tattoos` und `model-3d`; `#model-3d` wird in `tests/mannequin-framerate-browser.mjs:114` abgefragt, `#onskin` existiert nirgends | Umbenennen bricht bestehende Tests und die Regel „vorhandene IDs nie umbenennen" |
| K3 | Reihenfolge `more`: analog 01, digital 02 | Live-Reihenfolge ist digital → analog (`workGroups.more.children`, `siteContent.js:30`), live bestätigt | Umnummerierung ändert die sichtbare Reihenfolge von `/creative/more` — nicht Teil der Aufgabe |

Nicht betroffen und deshalb umgesetzt: B-F28, B-F30, B-F29, B-F19-Messung.

**Offene Entscheidung für den User** (eine der drei Varianten):

1. **Live-Namen behalten** — Itemmodus mit `tattoos` (01/ 03), `flashes`
   (02/ 03), `3d model` (03/ 03); Anker `#tattoos`, `#flashes`, `#3d-model`
   (`model-3d` → `3d-model` müsste dann auch der Mannequin-Test mitziehen).
2. **Vorgabe umsetzen** — Sektion auf `on skin` / `#onskin` umstellen, B-F7
   damit zurücknehmen (`retired-slug-browser.mjs:60`, 301-Richtung und
   Registry-Zeile B-F7 anpassen).
3. **K2 nur für die Modell-Sektion** — `#3d-model` einführen, `onskin` bleiben
   lassen (Kompromiss, ändert nur eine ID).

## 8. Umsetzungsstand nach dem Gate

| Punkt | Status | Beleg |
| --- | --- | --- |
| B-F28 INDEX-Link | umgesetzt, `198bf08` | `tests/creative-landing.test.js`, `tests/creative-landing-browser.mjs` |
| B-F30 Hero-Bar-Ziel | umgesetzt, `229b279` | dito, Tab + Enter bei 1440/320 |
| B-F29 Footer ohne Platzhalter | umgesetzt, `6909e2a` | `docs/validation/B-F29-FOOTER/` |
| B-F19 Messung | umgesetzt (kein Fix), `0df017f` | `docs/validation/B-F19-CURSOR-FOOTER-ZONE/` |
| B-F31 Itemmodus + Anker | **gestoppt** (§7, K1–K3) | Entscheidung des Users nötig |
| Gate-Test „DOM-IDs == Datenliste" | **nicht gebaut** — setzt die entschiedene Sektionsliste voraus | hängt an §7 |
| Mannequin-Bedingung auf `3d-model` | **nicht gebaut** — hängt an K2 | — |
