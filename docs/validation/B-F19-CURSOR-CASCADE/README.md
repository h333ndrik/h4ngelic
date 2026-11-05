# B-F19 — Logo-Cursor an NAAVI, Footer-Cluster und Rubrikleiste

Stand: `v3.1.1-fixes`, Vorher-Build `736e71d`, Nachher-Build `3809a63`. Kein Merge, kein Deploy.
Diagnose und Nachmessung in `phase0-before.json` / `phase0-after.json`, Hit-Test in `hit/hit-results.json`.

## Befund

User-Sicht: global Logo-Cursor, aber an NAAVI, im Footer-Cluster (instagram, berlin de, h4 moshlab,
visit, Copyright) und an der Rubrikleiste der Systempfeil.

## Hypothesen — was zutrifft

| Kandidat | Ergebnis | Beleg |
| --- | --- | --- |
| 1) konkurrierende `cursor`-Deklaration ohne Token | **nein** | `rg "cursor\s*:" src/*.css` außerhalb `cursor.css`: keine Treffer. `tokens-audit` erzwingt das. |
| 2) Element mit eigener `cursor`-Regel unter dem Pointer | **nein** | `elementsFromPoint` an 20 Punkten (5 je Region, 1440 + 390): oberstes `pointer-events != none`-Element ist immer ein echtes Kind (Brand, Link, Glyph), kein Overlay/Scrim. |
| 3) Inline-Style von JS | **nein** | `rg "style\.cursor|cursor\s*=" src/` → nur `src/xray.js:185` setzt `html.dataset.cursor = 'xray'` (Attribut, kein Style). Runtime-Check: `[...document.querySelectorAll('*')].filter(e => e.style.cursor)` → `[]`. |
| 4) Scroll-Container-Gutter | **nein bei 1440/390/320** | `.footer-left`/`.footer-details`: `scrollbar-width: none`, Gutter 0. `.category-strip`: `scrollbar-width: thin`, aber `scrollWidth == clientWidth` (1370/1370 bzw. 346/346), `overflow-x: visible` unter 600 px → kein Gutter. Siehe Tabelle unten. |
| **Zusatz: Cascade war nicht `!important`** | **ja, Ursache der Fragilität** | Vorher gewann an jedem gemeldeten Element eine Regel **ohne** `!important` (`html :is(…)` = 0,1,1 bzw. `html, html *` = 0,0,1). Jede spätere Fremd-, UA- oder Extension-Regel mit `!important` (oder gleicher Spezifität) schlägt sie. |

Damit: der sichtbare Systempfeil ließ sich im Build `736e71d` headless **nicht** reproduzieren — aber genau
die Schwachstelle, die ihn erzeugt (nicht-`!important`-Regeln auf niedriger Spezifität), war messbar
vorhanden und ist jetzt geschlossen.

## Regel-Gewinner (CSSOM, Media-Query ausgewertet, `!important` + Spezifität + Reihenfolge)

| Viewport | Element | vorher: Gewinner | `!important` | nachher: Gewinner | `!important` | Wert vorher/nachher |
| --- | --- | --- | --- | --- | --- | --- |
| 1440 | `.category-link` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 1440 | `.category-link .arrow` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 1440 | `.category-strip` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 1440 | `.filter-link` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 1440 | `.footer-details` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 1440 | `.footer-impressum` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 1440 | `.footer-instagram` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 1440 | `.footer-left` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 1440 | `.footer-left .footer-brand` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 1440 | `.footer-location` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 1440 | `.footer-moshlab` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 1440 | `.footer-visit` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 1440 | `.hero-nav a` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 1440 | `.work-filters` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 1440 | `[data-global-index] summary` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 1440 | `[data-naavi]` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 1440 | `[data-naavi] .chapter-digit` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 1440 | `[data-naavi] .chapter-total` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 390 | `.category-link` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 390 | `.category-strip` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 390 | `.footer-details` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 390 | `.footer-instagram` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 390 | `.footer-left` | `html, html *, html ::before, html ::after` | False | `html body * (+ html:root body *)` | True | identisch |
| 390 | `.footer-moshlab` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |
| 390 | `[data-naavi]` | `html :is(a, button, summary, [role="button"], input, select, textarea, label, canvas)` | False | `html body :is(a[href], a, …)` | True | identisch |

Berechnete Werte sind vor/nach **identisch** (`ja`): gleiche Bilder, gleicher
Hotspot `8 2`, gleiche Fallback-Kette. Nur die gewinnende Regel und ihr `!important` haben sich geändert.

## Garantie-Ebenen (`src/cursor.css`, alle `!important`, im `(any-hover: hover) and (any-pointer: fine)`-Block)

| Ebene | Selektor | Spezifität | Token |
| --- | --- | --- | --- |
| 1 Basis | `html body *` (+ `html:root body *` gegen später eingefügte gleich spezifische Regeln) | 0,0,3 / 0,1,1 | `--h4-cursor` |
| 2 interaktiv | `html body :is(a[href], a, button, summary, [role='button'], input, select, textarea, label, canvas)` | 0,1,3 | `--h4-cursor-interactive` |
| 3 pressed | …`:active` | 0,2,3 | `--h4-cursor-pressed` |
| 4 xray | `html[data-mode='xray']`, `html[data-mode='xray'] body *` (+ `:is(…)`-Variante) | 0,1,1 / 0,1,3 | `--h4-cursor-xray` |
| 5 xray pressed | …`:active` | 0,3,3 | `--h4-cursor-xray-pressed` |

`!important` ist im Code kommentiert: bei nativem Cursor gibt es kein JS-Sicherheitsnetz, die Cascade ist die Garantie.

## Scroll-Gutter-Messung (Kandidat 4)

| Viewport | Container | `overflow-x` | `scrollbar-width` | client/offset Y | Gutter Y | scroll/client width |
| --- | --- | --- | --- | --- | --- | --- |
| 390 | `.footer-left` | auto | none | 44/44 | 0 px | 234/123 |
| 390 | `.footer-details` | auto | none | 44/44 | 0 px | 208/123 |
| 390 | `.category-strip` | visible | thin | 244/244 | 0 px | 346/346 |
| 1440 | `.footer-left` | auto | none | 44/44 | 0 px | 624/624 |
| 1440 | `.footer-details` | auto | none | 44/44 | 0 px | 287/287 |
| 1440 | `.category-strip` | auto | thin | 251/251 | 0 px | 1370/1370 |

Kein Gutter an allen drei geprüften Breiten. **OS-Grenze, nur falls doch ein klassischer Scrollbalken
erscheint** (z. B. Windows mit erzwungenen Scrollbars, oder wenn `scrollbar-color` den Overlay-Modus
abschaltet): über dem Scrollbar-Bereich zeichnet der Browser immer den Systempfeil, unabhängig von CSS.
Einzige saubere Lösung wäre, den Scroll-Container ganz zu vermeiden (Wrap-Layout statt `overflow-x`).
Das ist hier **nicht** gebaut — Vorschlag, keine Umsetzung.

## elementsFromPoint (Auszug, 1440)

| Region | Punkt | berechneter Cursor | oberste Elemente |
| --- | --- | --- | --- |
| `.footer-left` | 84,810 | `logo` | span.footer-brand, span.footer-left, div.footer-identity |
| `.footer-left` | 24,810 | `logo` | span.footer-brand, span.footer-left, div.footer-identity |
| `.footer-left` | 142,810 | `logo` | span.interaction-visual, a.footer-moshlab, span.footer-left |
| `.footer-left` | 84,830 | `logo` | span.footer-brand, span.footer-left, div.footer-identity |
| `.footer-left` | 84,789 | `logo` | span.footer-brand, span.footer-left, div.footer-identity |
| `.footer-details` | 307,810 | `logo` | i.arrow, span.interaction-visual, a.footer-instagram |
| `.footer-details` | 247,810 | `logo` | span.interaction-visual, a.footer-instagram, span.footer-details |
| `.footer-details` | 365,810 | `logo` | span.interaction-visual, a.footer-impressum, span.footer-details |
| `.footer-details` | 307,830 | `logo` | a.footer-instagram, span.footer-details, div.footer-identity |
| `.footer-details` | 307,789 | `logo` | a.footer-instagram, span.footer-details, div.footer-identity |
| `.category-strip` | 195,422 | `logo` | div.category-strip.rubric-row, div.section-pin, section#selected-work.content-section.selected-work |
| `.category-strip` | 24,422 | `logo` | div.category-strip.rubric-row, div.section-pin, section#selected-work.content-section.selected-work |
| `.category-strip` | 365,422 | `logo` | div.category-strip.rubric-row, div.section-pin, section#selected-work.content-section.selected-work |
| `.category-strip` | 195,542 | `logo` | span.rubric-line, div.category-strip.rubric-row, div.section-pin |
| `.category-strip` | 195,301 | `logo` | span.rubric-line, div.category-strip.rubric-row, div.section-pin |
| `[data-naavi]` | 195,810 | `logo` | a.chapter-counter.naavi, p.about-preview-copy.kinetic-item, div.section-pin |
| `[data-naavi]` | 155,810 | `logo` | a.chapter-counter.naavi, p.about-preview-copy.kinetic-item, div.section-pin |
| `[data-naavi]` | 234,810 | `logo` | a.chapter-counter.naavi, p.about-preview-copy.kinetic-item, div.section-pin |
| `[data-naavi]` | 195,830 | `logo` | a.chapter-counter.naavi, p.about-preview-copy.kinetic-item, div.section-pin |
| `[data-naavi]` | 195,789 | `logo` | a.chapter-counter.naavi, p.about-preview-copy.kinetic-item, div.section-pin |

## Inline-Styles / Literale

- `style.cursor` in `src/`: keine Treffer. Laufzeit-Scan: `[]`.
- `cursor:`-Literale außerhalb der Token-Definitionen: keine (nichts zu entfernen).
- Entfernte Regeln: keine — die alten Regeln wurden durch die Garantie-Ebenen ersetzt, nicht dupliziert.

## Asset-Lade-Test (neu)

| Asset | Status | dekodiert | Größe | Typ |
| --- | --- | --- | --- | --- |
| `/assets/h4ngelic-cursor.svg` | 200 | True | 20×30 | `image/svg+xml` |
| `/assets/h4ngelic-cursor.png` | 200 | True | 20×30 | `image/png` |
| `/assets/h4ngelic-cursor-pressed.svg` | 200 | True | 21×32 | `image/svg+xml` |
| `/assets/h4ngelic-cursor-pressed.png` | 200 | True | 21×32 | `image/png` |
| `/assets/h4ngelic-cursor-other-r09.svg` | 200 | True | 20×30 | `image/svg+xml` |
| `/assets/h4ngelic-cursor-other.png` | 200 | True | 20×30 | `image/png` |
| `/assets/h4ngelic-cursor-other-pressed-r09.svg` | 200 | True | 21×32 | `image/svg+xml` |
| `/assets/h4ngelic-cursor-other-pressed.png` | 200 | True | 21×32 | `image/png` |

## Hit-Test (gehärtet)

- erlaubte Werte: nur `url(…)` mit h4-Asset und Hotspot `8 2`; blankes `auto`/`pointer` = **FAIL**
  (Fehlermeldung enthält Element, Messpunkt und gewinnende Regel)
- Regel-Gewinner-Assertion in allen Pflichtregionen: Gewinner muss eine Garantie-Ebene sein
- Zustands-Assertions: `:active` → pressed-Sprite, `html[data-mode='xray']` → xray, xray `:active` → xray-pressed
- Punktzahlen: 1440=4466, 390=1146, 320=936, 1440r=4466, 390r=1146, 320r=936; Xray 2221; Touch-Kontext: kein h4-Cursor, kein Overlay

## So prüfst du es

1. Footer unten rechts: über `instagram`, `berlin de`, `h4 moshlab`, `visit` und das Copyright fahren — überall
   dasselbe Logo, beim Klick die leicht größere Variante.
2. NAAVI (`04/ 04` inklusive `/`) und die Rubrikleiste (`tattoos · jewellery · tools · more`) abfahren.
3. Konsole: `getComputedStyle(document.querySelector('.footer-moshlab')).cursor` →
   `url("…/h4ngelic-cursor.svg") 8 2, url("…/h4ngelic-cursor.png") 8 2, pointer`.

## Nachbesserung während der Verifikation

Der erste Durchlauf des gehärteten Hit-Tests fand in Xray einen echten Restfall:
am Punkt `12,12` ist das oberste Element `<html>` selbst, und die Xray-Ebene
begann bei `html[data-mode='xray'] body`. Dort gewann die Basis (`html`) mit dem
normalen Sprite. Fix: `html[data-mode='xray']` steht jetzt mit in Ebene 4
(`src/cursor.css`). Zweiter Fund: die Gewinner-Probe bewertete eine
Selector-Liste mit der Spezifität ihres *stärksten* Mitglieds; sie zählt jetzt
nur die Mitglieder, die das Element wirklich matchen
(`tests/helpers/cursor-cascade.mjs`). Beides ist im zweiten Hit-Test-Lauf
(6 Profile, Xray 2221 Punkte) grün.
