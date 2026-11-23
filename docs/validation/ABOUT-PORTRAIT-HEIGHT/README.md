# About-Portrait: Höhe bis „get in touch" (B-F42)

Basis: `main` = `d2c7065` (live `d2c7065fbf74`). Messung gegen den lokalen
Production-Build (`serve-preview.mjs`), 1440 × 900, `prefers-reduced-motion: reduce`.

## 1 — Messwerte (1440)

| Größe | vorher | nachher |
| --- | --- | --- |
| Überschrift-Unterkante | y 246,3 | y 246,3 |
| Bild-Oberkante | y 316,3 (**Abstand 70,0 px**) | y 316,3 (**Abstand 70,0 px**) |
| Bild linke Kante | x 163,5 | x 163,5 |
| Bildmaße | 558,7 × 730,2 | **453,5 × 592,7** |
| Seitenverhältnis (B × H) | 0,7649 | 0,7651 |
| Bild-Unterkante | y 1046,5 | **y 909,0** |
| „get in touch"-Unterstrich | y 909,0 | y 909,0 |
| Differenz Bild-Unterkante ↔ Unterstrich | +137,5 px | **0,0 px** |
| Textspalte | 558,7 px | 558,7 px |
| Dokumenthöhe /about | 1230 px | 1106 px |

Der Abstand Bild-Oberkante → Unterkante „get in touch" beträgt **592,7 px**; genau
dieser Wert ist jetzt die Bildhöhe (Toleranz war ±8 px).

## 2 — Umsetzung

- `src/app.js` — `measureAboutPortrait()`: misst `Bild-Oberkante →
  CTA-Unterkante inkl. Unterstrich` (`bottom − padding-bottom + underlineOffset + 1`)
  und schreibt sie als `--about-portrait-height`; dazu die Klasse
  `is-height-bound` auf der Figure. Läuft im bestehenden `scheduleSlashInset()`
  (Render, Resize, `fonts.ready`).
- `src/style.css` — `.about-portrait.is-height-bound { width: auto;
  height: var(--about-portrait-height); justify-self: start; }`. Die Breite folgt
  dem Seitenverhältnis; `object-fit: contain` bleibt, es wird **nicht** beschnitten.
- Obergrenze: `min(Ziel, Spaltenbreite / Verhältnis)`. Wo die Spalte zu schmal für
  die Zielhöhe wäre (1024, 768), bleibt das Bild in voller Spaltengröße — dort
  greift die Bindung nicht.
- Kein JS → keine Klasse, kein `--about-portrait-height` → Bild wie bisher in
  voller Spaltengröße (graceful degradation).
- Der Wert ist eine Messung, kein Literal: ändert sich der Text, folgt die Höhe
  beim nächsten Render automatisch.

## 3 — Andere Breiten

| Viewport | gebunden | Bild | Unterkante ↔ Unterstrich |
| --- | --- | --- | --- |
| 1440 | ja | 453,5 × 592,7 | 0,0 px |
| 1280 | ja | 451,2 × 589,8 | 0,0 px |
| 1024 | nein (Spaltenbreite ist die Grenze) | 388,2 × 507,3 | −68,6 px |
| 768 | nein (idem) | 246,5 × 322,2 | −297,7 px |
| 390 | nein — gestapelt | 346,0 × 452,2 | unverändert |
| 320 | nein — gestapelt | 276,0 × 360,7 | unverändert |

Mobile bleibt wie vorher: Bild über dem Text, kein Einzug, keine Höhenbindung
(`@media (max-width: 600px)` setzt `width: 100%; height: auto`).

## 4 — Screenshots

`about-1440-before.png` / `about-1440-after.png`, jeweils mit markierten Kanten:
Überschrift-Unterkante (blau), „get in touch"-Unterstrich (gelb), Bild-Unterkante
(rot). Vorher endet das Bild 137,5 px unter dem Unterstrich, nachher genau darauf.

## 5 — Tests

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | 448 Tests / 447 pass / 1 skipped / **0 fail** |
| `npm run build` | 38 Routen + 404 |
| `about-browser` (1440/390/320 × beide Motion-Preferences) | 6/6 PASS |
| `typography-contract` | 3 Profile + dist-grep PASS |
| `cursor-hit-test` | **PASS** — 1440 4470, 390 1150, 320 940, je reduziert dieselben, xray 2221, Footer-Samples 174/70/55, 0 Fremd-Cursor |
| Overflow 320/390/1440 | 0 px |

Startseite 02 (`.about-preview`) ist von der Änderung nicht betroffen:
Sektionshöhe 763 px (1440) / 428 px (390) wie zuvor, Reservierung `auto 480px` /
`auto 300px` unverändert, Dokument-Wachstum −4 px / 0 px, Footer sichtbar.
