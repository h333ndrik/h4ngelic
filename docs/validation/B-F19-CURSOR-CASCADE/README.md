# B-F19 — Cursor-Cascade an NAAVI, Footer und Rubrikleiste (GATEPREP-2, Batch 2)

Produktions-Build `af37506ab941` (Arbeitskopie mit den B-F19-Änderungen).
Diagnose: `diagnose.mjs` → `phase0-diagnosis.json`. Hit-Test:
`tests/cursor-hit-test.mjs` → `hit/hit-results.json`.

## 1. Regel-Gewinner (Phase 0)

Erwartet wurde eine Fremdregel, die an NAAVI, Footer oder Rubrikleiste den
Systempfeil gewinnt. Gemessen wurde das Gegenteil: an **allen** Zielen gewinnt
eine Garantie-Ebene aus `cursor.css`, und der berechnete Wert ist an jedem Ziel
ein Cursor-**Bild** (`url(...)`), nie ein Schlüsselwort.

| Ziel | Gewinner-Spezifität | Ebene | Cursor |
| --- | --- | --- | --- |
| NAAVI-Link `[data-naavi]` | 0,1,3 | L2 interaktiv | Bild |
| NAAVI `/`-Glyph, Zähler | 0,1,2 | L1 Basis | Bild |
| `footer-left`, Copyright, `visit` | 0,1,2 | L1 Basis | Bild |
| `footer-moshlab`, `footer-instagram` | 0,1,3 | L2 interaktiv | Bild |
| `footer-details` | 0,1,2 | L1 Basis | Bild |
| `work-filters` (Rubrikleiste), Tool-Leiste | 0,1,2 | L1 Basis | Bild |
| `work-filters .filter-link` | 0,1,3 | L2 interaktiv | Bild |
| INDEX geschlossen/offen, Panel | 0,1,3 / 0,1,2 | L2 / L1 | Bild |
| Kontrollgruppe: Hero-Canvas, Rubrik-Link, Formularfeld | 0,1,3 | L2 interaktiv | Bild |

18 Ziele bei 1440 px und 18 bei 390 px, **0** ohne Bild-Cursor, **0** Fremdregeln
(`phase0-diagnosis.json`, `targets[].winner.href` zeigt ausschließlich auf das
emittierte Stylesheet).

## 2. elementsFromPoint (10 Punkte je Region)

Footer bei 1440: `span.footer-brand.row-item`, `i.arrow`, `span.footer-left` ×3,
`div.footer-identity` ×3, `span.footer-details`, `span.interaction-visual` —
alle Bild-Cursor. Footer bei 390: dazwischen `a.chapter-counter.naavi` (die
NAAVI dockt dort in die Footer-Zeile), ebenfalls Bild. NAAVI: 10/10 Punkte auf
`a.chapter-counter.naavi`, alle Bild-Cursor.

## 3. Scroll-Gutter (OS-Grenze)

`.footer-left`/`.footer-details` scrollen bei 390 (234/123 bzw. 208/123), nicht
bei 1440 (624/624, 287/287); `scrollbar-width: none` plus
`::-webkit-scrollbar { display: none }` verstecken die Leiste, der native
Gutter am Rand bleibt aber Browser-/OS-gemalt. Die Filterleiste scrollt nur bei
320 (177/165). **Das ist keine CSS-Ursache und nicht per CSS reparierbar** —
dieser Streifen ist die einzige Stelle, an der der Systemzeiger technisch
erwartbar ist.

## 4. Inline-Styles und Literale

`rg "style\.cursor|cursor\s*=\s*['\"]" src/` → keine Treffer. Es gibt
`html.dataset.cursor = 'xray'` (nur ein Datenattribut) und
`modeIconSettings.cursor` (Konfiguration, kein Stil). Im emittierten CSS
existieren genau sechs `cursor`-Deklarationen: die Token-Definition und die
fünf Garantie-Ebenen. Keine Fremdregel, kein `cursor: none`.

## 5. Befund

Auf diesem Build ist der gemeldete Systempfeil **nicht reproduzierbar**: die
drei genannten Regionen verhalten sich messbar wie der Rest der Seite. Damit
bleiben genau zwei Erklärungen, beide außerhalb einer CSS-Regel:

1. **Nativer Scroll-Gutter** an den scrollenden Footer-Clustern (≤600 px) und
   an der Filterleiste (320 px) — OS-Grenze, dokumentiert, kein Fix.
2. **Anderer geladener Stand.** Die Vercel-Preview antwortet von hier aus mit
   `302 → vercel.com/sso-api` (SSO); ich kann sie nicht prüfen. `data-build` im
   `<html>` sagt sofort, welche Version jemand sieht.

## 6. Was geändert wurde

- Ebene 2/3/5 decken jetzt ausdrücklich auch `a` ohne `href` ab (Kommentar im
  CSS), Ebene 1/4 zusätzlich `::backdrop` — damit auch der offene Viewer keine
  Lücke lässt.
- Alle Ebenen bleiben `!important`; ein nativer Cursor hat kein JS-Sicherheitsnetz.
- Hit-Test: **neue Regions-Assertion** — der Messpunkt muss nachweislich im Ziel
  liegen (bei `pointer-events: none` in einem Vorfahren), sonst wäre ein
  `html`-Treffer als „grün" durchgegangen. Neu außerdem die Rubrikleiste selbst,
  der aktive Chip und ein Cross-Link als Pflichtregionen.

## 7. Beweis (Hit-Test, Produktions-Build)

| Profil | Punkte | Bild-Cursor | Fremd-Cursor |
| --- | --- | --- | --- |
| 1440×900 | 4470 | 2 Werte (Basis/pressed) | 0 |
| 390×844 | 1150 | 2 | 0 |
| 320×844 | 940 | 2 | 0 |
| 1440×900 reduce | 4470 | 2 | 0 |
| 390×844 reduce | 1150 | 2 | 0 |
| 320×844 reduce | 940 | 2 | 0 |
| xray (1440) | 2221 | xray/xray-pressed | 0 |

Assets: alle acht URLs 200, dekodiert, 20×30 bzw. 21×32 px (Budget ≤32).
`:active` liefert `h4ngelic-cursor-pressed`, xray liefert
`h4ngelic-cursor-other` und `-other-pressed`.

## 8. Selbstprüfung für den User (Konsole)

Auf der Seite, an der der Pfeil erscheint:

```js
document.documentElement.dataset.build
```

und dann mit der Maus über die Stelle fahren, Konsole:

```js
addEventListener('pointermove', e => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const hit = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
    .flatMap(r => r.cssRules ? [...r.cssRules] : [r])
    .filter(r => r.selectorText && r.style?.cursor && el.matches(r.selectorText.split(',')[0].trim() || '*'));
  console.log(el.tagName, el.className, getComputedStyle(el).cursor, hit.map(r => r.selectorText));
}, { passive: true })
```

Erwartet: `url("…/h4ngelic-cursor.svg") 8 2, …` und eine `html … body`-Regel.
Kommt dort ein Schlüsselwort oder eine fremde Regel, ist der geladene Stand ein
anderer als `af37506ab941` (oder eine Erweiterung greift ein) — bitte Ausgabe
mitschicken.
