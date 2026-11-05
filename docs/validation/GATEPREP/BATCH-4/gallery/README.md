# Batch 4 — Werkzeugseiten und der stille Besuchszähler

Build-Marker: `data-build="70a01a5fa93e"` — gebaut aus `2d52ca3` (B-F8) und
`70a01a5` (B-F15/B-F16).

## B-F8 — `visit 0000` ist eine Aussage, kein Bedienelement

**Phase 0:** der Zähler war ein `<button class="footer-visit-hotspot secret-hotspot">`
mit `aria-describedby` auf eine versteckte Tier-Phrase, die bei Hover, Fokus
oder Tap eingeblendet wurde (`[data-visit-message]`, `[data-visit-counter-hotspot]`).

**Fix:** reiner Textknoten `<span class="footer-visit" data-visit-count>`, ohne
Link, Button, Fokus, Hover oder Reveal. Er steht weiterhin an derselben Stelle
im Footer (direkt nach `h4 moshlab`, vor der rechten Gruppe) und trägt den
HOLD-4-Geist: Farbe `#f0efeb`, Opazität `.35`, Tracking `.84px`, lowercase,
`pointer-events: none`.

| Viewport | Text | Farbe | Opazität | Tracking | pointer-events | vorheriger Sibling |
| --- | --- | --- | --- | --- | --- | --- |
| 1440 | `visit 0001` | `rgb(240, 239, 235)` | 0.35 | 0.84px | none | `.footer-moshlab` |
| 390 | `visit 0001` | `rgb(240, 239, 235)` | 0.35 | 0.84px | none | `.footer-moshlab` |
| 320 | `visit 0001` | `rgb(240, 239, 235)` | 0.35 | 0.84px | none | `.footer-moshlab` |

Nach 500 ms Hover bleibt die Opazität bei `.35`, es existiert kein
`[data-visit-message]`-Knoten mehr. Screenshots: `footer-visit-{1440,390,320}.png`.

Die Tier-Phrase selbst bleibt erhalten — sie steht in der Kopfzeile
(`.returning-visitor-line`, Hover/Fokus/Touch wie bisher).

## B-F14 — kein „3d model" auf Werkzeugseiten (geprüft, kein Fix nötig)

Phase 0 auf `/creative/tools/m4shlab` und `/creative/tools/thr4ce`, direkt und
per SPA-Navigation: H1 ist immer der Werkzeug-Titel (`m4shlab — …`,
`thr4ce — …`), danach folgen nur `what it does`, `how it works`,
`install on mobile`. Ein `3d model`-Heading existiert ausschließlich als
`<h3>` im Tattoo-Archiv (`/creative/tattoos`), nicht auf Werkzeugseiten und
nicht im prerenderten HTML der Werkzeugrouten. Die Suite prüft das jetzt
dauerhaft (`headings.every(text => text !== '3d model')`).

## B-F15 — Unterrubriken-Leiste auf Werkzeugseiten

**Phase 0:** `hasFilters: false`, stattdessen `breadcrumbs: "home/tools"`.

**Fix:** eine gemeinsame Renderer-Funktion (`renderWorkFilters`) liefert die
Leiste für Archiv- und Werkzeugseiten; auf Werkzeugseiten ist `tools` aktiv.
Die Breadcrumb entfällt dort (Artwork-Seiten behalten ihre).

| Viewport | Links | aktiv | Position | y | Start |
| --- | --- | --- | --- | --- | --- |
| 1440 | tattoos · jewellery · tools · more | tools | fixed | 21 | 134 |
| 390 | dito | tools | fixed | 16 | 94 |
| 320 | dito | tools | fixed | 16 | 91 |

Screenshots: `tool-top-{m4shlab,thr4ce}-{1440,390,320}.png`.

## B-F16 — kein weißer Trennstrich, keine Faktenzeile

**Phase 0:** `.tool-facts` mit `border-top: 1px solid rgba(255,255,255,.145)`
und der Punktreihe (`deterministic & reversible · …`) direkt über dem Footer.

**Fix:** Markup und CSS-Regel entfernt; die Seite endet mit dem
Installations-Leitfaden. Die Suite zählt im gesamten `.tool-detail-page`
keine weiße `border-top` mehr (`dividers: []`).

Screenshots: `tool-bottom-{1440,390,320}.png`.

## Suiten (dieser Batch)

| Suite | Ergebnis |
| --- | --- |
| `npm test` | 373/373 |
| `tests/gateprep-batch4-browser.mjs` | 3/3 (1440, 390, 320) |
| `tests/v32-structure-browser.mjs` | PASS (Filter-Leiste, keine Breadcrumb, keine Fakten, 23 Routen) |
| `tests/v32-micro-browser.mjs` | PASS (Geist-Zähler, Caret, Headings) |
| `tests/v31-ui-browser.mjs` | 6/6 Profile |
| `tests/v15-mobile-browser.mjs` | 6/6 Profile |
| `tests/footer-v31-browser.mjs` | 6/6 Profile |
| `tests/v7-visitor-tiers-browser.mjs` | 6/6 Profile |
| `tests/standalone-browser.mjs` | 3/3 (neu exportiert) |
| `tests/master-browser.mjs` | grün (Dev-Server) |
| `tests/hero-boot-browser.mjs` | 3/3 |
| `tests/cursor-hit-test.mjs` | 4458/1138/928 Punkte, 0 Fremd-Cursor |
| `tests/seo-browser.mjs` | 23 Routen, Redirects, 404, Sitemap |
| `tests/link-glyph-contract.mjs`, `tests/tools-rubric-browser.mjs` | grün |

TESTMODE: fast — volle serielle Battery erst am Merge-Gate.

### Vorbestehender Drift (nicht dieser Batch)

- `tests/easter-browser.mjs` prüft die Vor-V3.1-Footer-Geometrie (zentrierter
  Zähler, Footer-Phrase, `.archive-empty`-Anker im Tattoo-Archiv). Seit B-013
  existiert kein leeres Tattoo-Archiv mehr; die Erwartungen sind alt.
- `tests/smart-v3-browser.mjs` (in `RELEASE-AUDIT` als Legacy gelistet),
  `tests/scroll-browser.mjs`, `tests/ref09-layout-browser.mjs` — unverändert
  driftend, nicht Teil der Gate-Battery.

## So prüfst du es (3 Zeilen)

1. `/creative/tools/m4shlab` öffnen: oben tattoos · jewellery · **tools** · more,
   kein „home / tools", unten kein Trennstrich und keine Faktenzeile.
2. Ganz nach unten scrollen: `visit 0001` steht still in Grau zwischen
   `h4 moshlab` und NAAVI — kein Hover, kein Klick, kein Popup.
3. Mit der Maus darüberfahren: nichts ändert sich.

## Kommandos

```sh
node scripts/serve-preview.mjs --port 55232
H4_BASE_URL=http://127.0.0.1:55232 node tests/gateprep-batch4-browser.mjs
H4_BASE_URL=http://127.0.0.1:55232 node tests/v32-structure-browser.mjs
npm test
```
