# B-F31 — Sektionen als eine Quelle, NAAVI-Itemmodus, Anker, Hash

Basis `5fd0ea3`, Build der Messung: aktueller Branch-Stand (Preview, 1440 px).
Commits: `4bb62fa` (Sektionen aus der Liste), `6cbe954` (eine ID-Regel),
`c2b0d19` (NAAVI-Itemmodus).

## 1. Quelle

`src/data/siteContent.js` → `categories` (Sektionen, inkl. `model-3d` mit
`presentation: 'model'`, `route: false`) und `workGroups[].children`
(Rubrik → Sektionen in Reihenfolge). Alles andere liest daraus:
Renderer (`src/pages.js`), NAAVI (`src/section-list.js`), ID-Regel
(`src/section-id.js`), Route-Ausschluss (`src/routes.js`).

Sektionsliste (live-IDs, unverändert):

| Rubrik | Sektionen (in Reihenfolge) | DOM-IDs |
| --- | --- | --- |
| tattoos | tattoos, flashes, 3d model | `finished-tattoos`, `flashes`, `model-3d` |
| more | digital artworks, analog photography | `digital-artworks`, `analog-photography` |
| jewellery | jewellery | `finished-jewellery` |
| tools | tools (Karten) | `tools` |

## 2. NAAVI-Itemmodus (gemessen)

| Seite | Zähler | href | aria-current | Hash nach Scroll |
| --- | --- | --- | --- | --- |
| `/creative/tattoos` | `01/ 03` → `03/ 03` | `#flashes` → `#finished-tattoos` | `true` | leer beim Einstieg, danach `#model-3d` |
| `/creative/more` | `01/ 02` → `02/ 02` | `#analog-photography` → `#digital-artworks` | `true` | danach `#analog-photography` |
| `/creative/jewellery` | `01/ 01` | keiner (Sprung deaktiviert) | `true` | leer |
| `/` | `00/ 04` (Kapitelmodus, unverändert) | `/#selected-work` | keins | leer |
| `/about` | `01/ 01` (Kapitelmodus) | `/` | keins | leer |
| `/creative/tattoos#flashes` | `02/ 03`, Label „flashes" | `#model-3d` | `true` | `#flashes` bleibt stehen |

Hash-Regel: Einstieg ohne Hash bleibt clean (kein Schreiben beim ersten
Rendern), ab der ersten Änderung `history.replaceState` — nie `pushState`.
NAAVI-Sprung und Hash-Sprung nutzen dieselbe `scrollIntoView`-Stelle, mit
`behavior: 'instant'` bei `prefers-reduced-motion: reduce`. Ein Reload mit Hash
scrollt erst nach `document.fonts.ready` plus zwei Frames.

Alle Ziffern kommen aus `formatCounter` (`src/labels.js`); Optik, Größe und
Typografie der NAAVI sind unverändert.

## 3. Mannequin

Die Bedingung ist die Sektion im DOM, nicht die Route:
`initMannequinPreviewLazy(content)` beobachtet `[data-mannequin-preview]` der
gerenderten Sektion `model-3d`. Die Sektion existiert nur auf der
tattoos-Rubrik; der Loader importiert Three.js erst bei Annäherung
(`rootMargin: '240px 0px'`). Beim Sektionswechsel bleibt das Element stehen,
es gibt keinen Remount. `tests/mannequin-framerate-browser.mjs:114`
(`#model-3d`) bleibt unverändert gültig.

## 4. Tests

- `tests/section-source.test.js` (5 Fälle): DOM-IDs == Datenliste (Menge und
  Reihenfolge), keine Sektions-ID als DOM-ID außerhalb der Datenliste,
  `model-3d` existiert genau einmal, `finished-` wird genau einmal gebaut.
  **Auf `5fd0ea3` rot (3 von 5), jetzt grün.**
- `v31-navigation-browser`: 1440/390/320 × beide Motion-Prefs, zweimal
  hintereinander grün (ein früherer Fehlschlag war ein stale Preview-Cache,
  reproduzierbar nur nach einem Rebuild ohne Server-Neustart).
- `naavi-format-browser`: grün (Kapitelmodus auf Home unverändert).
- `npm test`: 448 / 447 pass / 1 skipped / 0 fail.
