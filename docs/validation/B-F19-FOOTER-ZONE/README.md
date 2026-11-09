# B-F19-r4 — Footer-Zone: Cursor und Ink gemeinsam (Band mit Ober- und Unterkante)

Befund (User 05.11., 20:25): im Footer-Band (NAAVI, impressum, instagram,
h4 moshlab, Copyright) erscheint der Systempfeil **und** es entstehen keine
Farbkleckse; direkt unter dem Band am Seitenende funktionieren die Kleckse.

Arbeitskopie `19a0ea1` + dieser Fix, Build `19a0ea15b37c` (Produktions-Preview,
`node scripts/serve-preview.mjs`); Abschlusslauf auf dem Commit-Stand
`c3227e9` = Build `c3227e9e315e` (`footer-zone-contract.json`). Produktion `www.h4ngelic.com` wurde
gegengeprüft: `data-build="fdd42f5e5266"` (HTML-Meta `b5634bc5be40`), also ein
älterer Stand als dieser Branch.

Werkzeuge: `probe-zone-deep.mjs` (Messung), `capture-zone.mjs` (Bilder),
`tests/footer-zone-contract.mjs` (Prävention). Rohdaten:
`zone-deep-local.json`, `zone-deep-after.json`, `zone-deep-production.json`,
`footer-zone-contract.json`.

## 1. Zone

| Viewport | Band (`footer-identity`) | Footer | Scroll | Cluster `footer-left` | Cluster `footer-details` |
| --- | --- | --- | --- | --- | --- |
| 1440 × 950 | 894,0 – 938,0 (44,0) | 866 – 950 | 3343 | 624 / 624 | 287 / 287 |
| 390 × 844 | 787,7 – 831,7 (44,0) | 765,7 – 843,7 | 2566 | 123 / 234 | 123 / 208 |
| 320 × 844 | 788,3 – 832,3 (44,0) | 766 – 843 | 2569 | 88 / 234 | 88 / 208 |

Zonenbreite = volle Footerbreite (1440: 35 – 1405; 390: 22 – 368). Die
Cluster sind bei ≤600 px echte horizontale Scroll-Container
(`clientWidth < scrollWidth`), aber ohne sichtbaren Gutter
(`scrollbar-width: none` + `::-webkit-scrollbar{display:none}`).

## 2. Test 1 — Erreichbarkeit

`page.mouse` auf die Mitte der Items, `elementsFromPoint` (6 Ebenen) und Klick:

- `a.footer-moshlab` → Klick kommt an, `href="#"` bleibt (Platzhalter).
- `a.footer-impressum` → Navigation nach `/impressum` (nach
  `scrollIntoViewIfNeeded` auch bei 390/320, dort im scrollenden Cluster).
- `a.chapter-counter.naavi` → Klick kommt an (Referenz-Assertion im neuen Test:
  Höhe 44 px, vertikal zentriert ±2 px).
- Klick in die **freie Fläche** des Bandes → kommt an (`pointer-events: auto`),
  erzeugte vorher aber keinen Klecks (Test 2).

Keine fixierte Leiste, kein Overlay: die Kette Footer → `#page-content` → `main`
→ `.page-composition` (relative, z-index 1) → body → html hat nur bei
`.page-composition` einen Stacking-Context; `getRootNode()` ist überall
`document` (kein Shadow Root), `transform/filter/contain: none`.

## 3. Test 2 — Ink-Erzeugung

Presse (80 ms) auf die **leere Cluster-Fläche** (Punkt gehört dem Cluster-`span`,
nicht einem Item), 240 ms später gezählt:

| Viewport | vorher | nach Fix |
| --- | --- | --- |
| 1440 | 0 → **0** Kleckse | 0 → **1** Klecks (85,3 px breit, Opacity 0,79, Box im Viewport) |
| 390 | 0 → **0** | 0 → **1** (87,6 px, 0,80) |
| 320 | 0 → **0** | 0 → **1** (57,2 px, 0,80) |
| Streifen unter dem Band (Kontrolle) | 0 → **1** | 0 → **1** |

Klickbare/blockierte Fläche im Band (4-px-Raster, grün = malt, rot = geschluckt,
`hitarea-*.png`):

| Viewport | vorher malbar / geschluckt | nach Fix |
| --- | --- | --- |
| 1440 | 920 / 2500 (26,9 %) | 2600 / 820 (76,0 %) |
| 390 | 40 / 820 (4,7 %) | 300 / 560 (34,9 %) |
| 320 | 40 / 640 (5,9 %) | 290 / 390 (42,6 %) |

Nach dem Fix sind genau die echten Aktionen rot: `h4 moshlab`, NAAVI,
`instagram`, `impressum` (plus deren Pfeil-Glyphen).

## 4. Belegte Hypothese

**D — der Handler filtert Ziele in der Zone.** `src/easter-eggs.js` führte
`[tabindex]:not([tabindex="-1"])` in der `interactive`-Liste. Die beiden
Footer-Cluster sind `role="group"` + `tabindex="0"` (damit ihr Überlauf per
Tastatur scrollbar ist) und spannen je eine Grid-Spalte — zusammen das ganze
Band. `ignore()` (`target.closest(interactive)`) verwarf damit **jeden** Press
im Band, während der Streifen darunter auf `footer`/`body` fällt und malte.
Messung vorher: 7/10 Punkte (1440) bzw. 10/10 (390) mit Blocker
`span.footer-left` / `span.footer-details` via `[tabindex]…`, die übrigen über
`a`.

Ausgeschlossen:

- **A (fixierte Leiste):** Footer ist `position: static`, kein Overlay über dem
  Band, Klicks kommen an.
- **B (eigener Baum):** `getRootNode()` aller Footer-Elemente ist `document`.
- **C (Layer endet/verdeckt):** der Ink-Layer existiert vor dem ersten Press noch
  nicht (lazy) und wird in `[data-page-composition]` gehängt (Höhe = Dokument,
  4293/3410 px); nach dem Fix liegt der Klecks sichtbar im Band.
- **E (Scroll-Gutter):** Cluster scrollen bei ≤600 px (123/234 bzw. 88/234),
  aber ohne sichtbaren Gutter; das erklärt weder den Cursor (siehe 5) noch die
  fehlenden Kleckse.

## 5. Cursor: nicht reproduzierbar, Vertrag trotzdem geschlossen

2-px-Raster über die **volle** Bandfläche, `getComputedStyle().cursor` an jedem
Punkt:

| Build | Viewport | Punkte | Bild-Cursor | Fremdwert |
| --- | --- | --- | --- | --- |
| `19a0ea15b37c` (lokal) | 1440 / 390 / 320 | 14364 / 3612 / 2877 | 100 % | 0 |
| `fdd42f5e5266` (Produktion) | 1440 / 390 / 320 | 14364 / 3612 / 2877 | 100 % | 0 |

Asset: `/assets/h4ngelic-cursor.svg` → HTTP 200 `image/svg+xml`, dekodiert
20 × 30 (Produktion 23 × 35). Regel-Gewinner im Band ist die Basis-Ebene aus
`cursor.css` (`html body *`, `!important`), an Links die interaktive Ebene.

Damit ist der Systempfeil **auf diesem Branch und auf der Produktion** nicht
nachstellbar. Die verbleibende Lücke ist eine Test-Lücke, die jetzt geschlossen
ist: `cursor` kann als Zeichenkette `url(...)` enthalten und trotzdem auf `auto`
zurückfallen, wenn das Bild 404 ist oder nicht dekodiert — der alte Test hat nur
den String geprüft. Der neue Test lädt **und** dekodiert jedes Bild im
Cursor-Token.

Für die User-Sichtprüfung ist deshalb `data-build` entscheidend: steht dort
nicht der Fix-Commit, ist die Beobachtung ein Altstand (die Produktion liefert
`fdd42f5e5266`).

**NICHT PRÜFBAR:** Verhalten auf dem Gerät/Browser des Users (Headless-Chromium
hier), Vercel-Preview (302 → `vercel.com/sso-api`, SSO).

## 6. Fix

`src/ink-guard.js` (neu) hält die eine Guard-Liste; `src/easter-eggs.js`
importiert sie. Geändert ist genau eine Klausel:

```diff
-[tabindex]:not([tabindex="-1"])
+[tabindex]:not([tabindex="-1"]):not([role="group"])
```

Begründung: ein Tab-Stopp ist keine Aktion. `role="group"`-Cluster existieren
nur, damit ihr Überlauf per Tastatur erreichbar ist; ihre leere Fläche bleibt
malbar. Echte Aktionen (`a`, `button`, Formularfelder, Rollen-Controls,
`canvas`, `[data-no-ink]`) blockieren weiterhin — Links malen nicht und
navigieren unverändert. Unangetastet: Hero-Physik, Cursor-Optik/-Assets/-Hotspot
(8 2), Press-Skalierung 1,08×, Ink-Farben/Form/Lebensdauer/Limits, Texte,
Footer-Geometrie (44 px, `--cluster-gap`, NAAVI-Reservierung).

Nicht geändert, aber als nächster Kandidat derselben Klasse notiert:
`.category-strip` (`role="navigation"`, `tabindex="0"`) und
`.horizontal-drift` (`role="region"`, `tabindex="0"`) sind ebenfalls
Fokus-/Scroll-Container ohne eigene Aktion; sie bleiben in diesem Fix bewusst
unberührt, weil der Befund das Footer-Band betrifft.

## 7. Tests

- `npm test`: **376/376** grün.
- `tests/footer-zone-contract.mjs` (neu, 3 Viewports, 2-px-Raster, Asset-Decode,
  Press auf die leere Fläche, Link-Navigation, 44-px-Targets, `--cluster-gap`,
  kein Seiten-Overflow): **PASS 3/3**, Laufzeit ~14 s.
- Rot-Probe ohne Fix (guard zurückgerollt, neu gebaut, Port 55234):
  `FAIL … a press on .footer-left paints (0 -> 0)` bei 390 und 320 — der Test
  wäre ohne den Fix rot.
- Voll-Lauf gegen denselben Build: `cursor-hit-test` 4470/1150/940 je
  Viewport × beide Motion-Preferences + xray 2221 (0 Fremd-Cursor),
  `footer-v31-browser` (1440, 390/320 je beide Motion), `row-geometry-contract`
  (5 Viewports, 5 Reihen), `typography-contract` (3 Viewports + dist-grep),
  `tokens-audit` (24 Definitionen, 0 Befunde), `hero-boot-browser` (3
  Viewports), `digital-ink-browser` (6 Profile), Physik-Suite (179,99° →
  39,60°, Settle 3408 ms), `seo-browser` (23 Routen, Redirects, 404) — alle grün.

### Vor bestehender Rotstand (nicht durch diesen Fix verursacht)

`tests/hero-ink-browser.mjs` und `tests/hero-background-browser.mjs` booten mit
`reducedMotion: 'reduce'` und warten auf `#stage.is-ready`. Seit dem
Poster-Vertrag (F20/F29) bleibt der Hero unter reduzierter Bewegung bewusst
`is-poster-static` ohne WebGL — beide Suiten laufen deshalb in ihren Timeout.
Belegt als vorbestehend: derselbe Fehler tritt unverändert auf dem
unangetasteten Haupt-Workspace-Dev-Server (`127.0.0.1:5173`) auf, dessen Stage
ebenfalls `stage is-poster-static` bleibt. Beide Suiten sind Kandidaten für
`tests/legacy/` (AGENTS.md, RETIRED SUITES); die aktuelle Ink-Abdeckung liefert
`tests/digital-ink-browser.mjs` plus die Node-Suiten aus `npm test`.

## 8. So prüfst du es (2–3 Zeilen)

1. Preview laden, Konsole: `document.documentElement.dataset.build` — muss den
   Fix-Commit zeigen.
2. Ganz nach unten scrollen, in die **leere** Fläche zwischen `h4ngelic ©` und
   `h4 moshlab` klicken → Klecks; auf `impressum` klicken → Navigation.
3. Konsole: `getComputedStyle(document.querySelector('.footer-identity')).cursor`
   → `url("…/h4ngelic-cursor.svg") 8 2, …`.

Bilder: `band-{before,after}-{1440,390,320}.png` (Band), `hitarea-*.png`
(Flächenkarte), `ink-*.png` (Press mit Ring am Klickpunkt).
