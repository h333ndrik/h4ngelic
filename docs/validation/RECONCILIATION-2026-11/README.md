# Reconciliation 2026-11 — No-JS-Überlauf, Test-Drift

Gemessen gegen Build `7a11ce55fa18` (origin/main = `7a11ce5`), lokal `127.0.0.1:4199`
(`dist` identisch zu Production) und gegen `https://www.h4ngelic.com`.
Rollback-SHA vor diesem Lauf: **`7a11ce5`**.

## 1 — `/creative` ohne JavaScript: kein Überlauf

Behauptung aus der Aufgabe: 1096 px zu breit bei 1440. **Nicht reproduzierbar.**

`no-js-overflow.json` enthält 48 Zeilen (8 Pfade × 3 Breiten × mit/ohne JS);
`overflow = max(0, documentElement.scrollWidth − innerWidth)`:

| Breite | ohne JS | mit JS | scrollWidth == innerWidth |
| --- | --- | --- | --- |
| 1440 | 0 px | 0 px | ja |
| 390 | 0 px | 0 px | ja |
| 320 | 0 px | 0 px | ja |

Gegen Production (`www.h4ngelic.com`, `data-build="7a11ce55fa18"`) dieselbe Null
auf `/creative`, `/creative/tattoos`, `/creative/flashes`, `/creative/jewellery`,
`/creative/tools`, `/creative/tools/m4shlab`, `/creative/more`, `/about`, `/`.

**Warum kein Überlauf, obwohl Elemente breiter als der Viewport sind:** Der
breiteste Kasten ist der `.drift-track` der Flashes (5 944 px ohne JS, 6 970 px
mit JS). Er liegt vollständig im horizontalen Scroller
`.drift-viewport` (`overflow-x: auto` ohne JS, `hidden` nach der
Drift-Erweiterung). Unterschied ohne/mit JS ist also nur der Clipper-Modus
(`auto` vs. `hidden`), nie die Dokumentbreite. Kein `overflow-x: hidden` auf
`html`/`body` wurde gesetzt; es gibt nichts zu kaschieren.

**Echte Ursache der roten `seo-browser`-Suite:** nicht Layout, sondern ein
eingefrorener Routenzähler. `tests/seo-browser.mjs` prüfte
`manifest.routes.length === 23` und eine 23-Pfade-Liste; seit B-F38 baut die
Seite **38** Routen (23 + 15 Flash-Detailseiten). Die Suite liest Routen,
Werkliste und Tool-Liste jetzt aus `routeDefinitions()`, `publishedProjects()`
und `siteContent.tools` — dieselben Module, aus denen `scripts/prerender.mjs`
baut. Die Überlauf-Assertion bleibt unverändert scharf und läuft über alle 38
Routen.

## 2 — Test-Drift: Suiten lesen aus der Datenquelle

| Suite | vorher (eingefroren) | jetzt (Datenquelle) |
| --- | --- | --- |
| `seo-browser` | 23 Routen, 8 Tattoos, 1 Digital, 15 Fixpfade | `routeDefinitions()`, `publishedProjects()`, `siteContent.tools` |
| `v32-structure-browser` | flashes *und* jewellery: 8 Platzhalter, `01/ 08` | `artworks` + `placeholderProjects`: Platzhalter nur, solange eine Rubrik keine echten Einträge hat |
| `portfolio-browser` | `photos = 8`, `digital = 1` | Summe je gerenderter Sektion aus `artworks` (tattoos 8 + flashes 15 = 23 auf der Archivseite) |

Keine Assertion wurde gelockert oder übersprungen; die Zahlen sind ersetzt
durch dieselbe Quelle, die auch die Seite rendert.

**Gegenprobe (Eintrag temporär abgeklemmt, `flash-15` → `published: false`,
ohne Rebuild):**

| Suite | Ergebnis | Meldung |
| --- | --- | --- |
| `portfolio-browser` @1440 | rot | `23 !== 22` (Seite 23 Bilder, Datenquelle 22) |
| `v32-structure-browser` @1440 | rot | `'01/ 15' !== '01/ 14'` |

Nach `git checkout src/data/artworks.js` (SHA `01e4220b…` unverändert) wieder
grün: `portfolio-browser` 1440/390 je reduced true/false PASS,
`v32-structure-browser` PASS.

## 3 — Verifikation

- `npm test`: **448 Tests / 447 pass / 1 skipped / 0 fail** (Baseline gehalten).
- `npm run build`: **38 Routen + 404**.
- Grün: `seo-browser` (38 Routen), `v32-structure-browser`, `portfolio-browser`
  (1440/390), `cursor-hit-test` (1440/390/320 × reduced, 0 Fremd-Cursor),
  `footer-zone-contract` (3/3), `footer-v31-browser`, `row-geometry-contract`
  (5 Viewports), `mobile-parity-browser`, `v31-navigation-browser` (390/320),
  `about-browser` (1440/390/320 × reduced).
- Desktop 1440: **kein Website-Code geändert** (`git diff --stat HEAD -- src public`
  leer), deshalb ist das 1440-Rendering des Builds unverändert;
  `creative-1440-js.png` und `creative-1440-nojs.png` liegen zur Sicht bei.
- Kein horizontaler Overflow bei 320/390/1440, mit und ohne JS (siehe Tabelle).

## So prüfst du es (2–3 Zeilen)

1. DevTools-Konsole auf `/creative`: `document.documentElement.scrollWidth - innerWidth`
   muss `0` sein — auch mit deaktiviertem JavaScript (DevTools → Settings → Debugger
   → Disable JavaScript).
2. `npm test` zeigt `448 tests, 447 pass, 1 skipped, 0 fail`; `npm run build`
   endet mit `Prerendered 38 routes + 404`.
3. `H4_BASE_URL=http://127.0.0.1:4199 node tests/v32-structure-browser.mjs` und
   `node tests/portfolio-browser.mjs` laufen grün, obwohl flashes heute 15 echte
   Fotos und jewellery 8 Platzhalter zeigt.
