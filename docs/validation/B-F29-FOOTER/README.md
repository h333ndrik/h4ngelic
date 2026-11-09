# B-F29 — Footer: Platzhalterlink entfernt, `visit` rückt nach

Basis `1608499` (`origin/main`), Build-Marker der Messung `229b279` (B-F30).
Messung: `node measure` gegen zwei Preview-Server (vorher `229b279`, nachher
Arbeitsstand), 1440/390/320, `prefers-reduced-motion: reduce`, `geometry.json`.

## 1. Befund

`src/footer.js:39` rendete `<a class="footer-moshlab" href="#" data-moshlab-placeholder>h4 moshlab ↗</a>`
als Platzhalter mit leerem Ziel. Der Link war bewusst inert (`app.js`,
`easter-eggs.js` fingen den Klick ab) und besetzte die zweite Position im
linken Cluster.

## 2. Fix

- `src/footer.js`: Link aus dem Markup entfernt (nicht versteckt). Der linke
  Cluster besteht jetzt aus `footer-brand` + `footer-visit`; `visit` sitzt auf
  der freigewordenen Position. `aria-label` des Clusters lautet
  „artist and local visit count".
- `src/app.js`, `src/easter-eggs.js`: die beiden `data-moshlab-placeholder`-
  Klickfänger sind gelöscht (toter Code).
- `src/easter-eggs.css:40`: `.footer-moshlab` aus der gemeinsamen Link-Regel
  entfernt; Optik von `visit` unverändert (Ghost-Token, 44 px, kein Hover,
  kein Ziel).

## 3. Messung (geometry.json)

| Viewport | Cluster vorher | Cluster nachher | `visit` links | Details links (Δ) | NAAVI links (Δ) | Zeilenhöhe |
| --- | --- | --- | --- | --- | --- | --- |
| 1440 | brand, moshlab, visit | brand, visit | 278.19 → 161.52 px | 1241.83 (±0.00) | 676 (±0) | 44 → 44 |
| 390 | brand, moshlab, visit | brand, visit | 205.33 → 117.23 px | 245 (±0.00) | 153 (±0) | 44 → 44 |
| 320 | brand, moshlab, visit | brand, visit | 205.33 → 117.23 px | 210 (±0.00) | 118 (±0) | 44 → 44 |

- Alle Targets bleiben **44 px** hoch (`footer-brand`, `[data-visit-count]`).
- Rechter Cluster und NAAVI verschieben sich um **0.00 px** — Toleranz ±2 px
  deutlich eingehalten.
- Dokumentbreite = Viewportbreite bei allen drei Breiten (`1440/390/320`) →
  **kein horizontaler Overflow der Seite**.
- Innerhalb der Cluster bleibt der bewusste Scroll-Mechanismus: `footer-left`
  `scrollWidth 146 / clientWidth 123` (390 px) bzw. `88` (320 px), vorher
  `234`. Der Wert sinkt um die Breite des entfernten Links (88 px). Das ist
  genau der B-F19-Befund (Gutter) und **kein** neuer Overflow.

## 4. 0-Treffer-Nachweis

```
$ rg -ic moshlab tests src index.html
(keine Ausgabe)
```

Der Platzhalter existiert weder im Markup noch in Tests oder Skripten. Die
drei Node-Suiten `tests/content.test.js` und `tests/easter-eggs.test.js`
prüfen stattdessen aktiv, dass der linke Cluster nur Branding + Zähler enthält
und der Footer kein `href="#"` mehr rendert.

## 5. Suiten

- `node --test tests/content.test.js tests/easter-eggs.test.js` → 26/26 gruen
- `tests/footer-v31-browser.mjs` 1440/390/320 × beide Motion-Prefs → 6/6 PASS
- `tests/footer-zone-contract.mjs` → 3/3 PASS (`build=229b279eb454`)
