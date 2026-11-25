# Tablet-Matrix — 768 / 820 / 1024 / 1180

Messung gegen Production **`www.h4ngelic.com`**, `data-build="5eb6fcbbc6ba"`
(Stand 25.11.). Nur gemessen, nichts geändert, nichts gepusht.

Profile: echte iPad-Emulation (`isMobile: true`, `hasTouch: true`, DPR 2,
`prefers-reduced-motion: reduce`). Zweiter Durchlauf je Breite **ohne**
`hasTouch`/`isMobile`, um Finger gegen angeschlossenes Trackpad zu trennen.

## Matrix

| Viewport | Overflow | Footer | Portrait | NAAVI | Cursor (Finger / Trackpad) | any-hover (Finger / Trackpad) |
| --- | --- | --- | --- | --- | --- | --- |
| 768 × 1024 (portrait) | 0 / 0 | 2 Cluster · 4 Labels · alle 44 px · 418 px Freiraum zwischen den Clustern · 0 überdeckte Labels | volle Spalte 246,5 × 322,2 · endet **297,7 px** über „get in touch" | sichtbar 88 × 44, `00/ 04` → am Ende `04/ 04`, Sprung setzt die Sektion auf y = 0 und zählt auf `01/ 04` | `auto` / `pointer` · Logo / Logo | `false` / `true` |
| 820 × 1180 (portrait) | 0 / 0 | 2 · 4 · 44 px · 468 px · 0 | volle Spalte 289,1 × 377,9 · **−244,8 px** | gleich, Sprung ok | `auto` / `pointer` · Logo / Logo | `false` / `true` |
| 1024 × 768 (landscape) | 0 / 0 | 2 · 4 · 44 px · 664 px · 0 | volle Spalte 388,2 × 507,3 · **−68,6 px** | gleich, Sprung ok | `auto` / `pointer` · Logo / Logo | `false` / `true` |
| 1180 × 820 (landscape) | 0 / 0 | 2 · 4 · 44 px · 813 px · 0 | **gebunden** 447,1 × 584,4 · **Δ 0,0 px** | gleich, Sprung ok | `auto` / `pointer` · Logo / Logo | `false` / `true` |

Footer-Details je Breite (Cluster, Scrollbreite, Items):

| Breite | `footer-left` | `footer-details` | Cluster-Scroll | mittlerer Freiraum | min. Target |
| --- | --- | --- | --- | --- | --- |
| 601 | 214 px · 2 Items | 128 px · 2 Items | 0 | 257 px | 44 px |
| 640 | 233 · 2 | 129 · 2 | 0 | 294 px | 44 px |
| 700 | 263 · 2 | 130 · 2 | 0 | 352 px | 44 px |
| 767 | 295 · 2 | 131 · 2 | 0 | 417 px | 44 px |
| 768 | 296 · 2 | 131 · 2 | 0 | 418 px | 44 px |
| 820 | 321 · 2 | 132 · 2 | 0 | 468 px | 44 px |
| 1024 | 421 · 2 | 136 · 2 | 0 | 664 px | 44 px |
| 1180 | 497 · 2 | 140 · 2 | 0 | 813 px | 44 px |

Portrait-Rampe um die Umschaltgrenze (live, 25.11.):

| Breite | gebunden | Bild | Unterkante ↔ CTA-Linie |
| --- | --- | --- | --- |
| 1000 | nein | 378,3 × 494,5 | −80,2 px |
| 1050 | nein | 398,8 × 521,3 | −56,1 px |
| 1100 | nein | 419,3 × 548,0 | **−32,0 px** |
| 1120 | nein | 427,5 × 558,8 | −22,4 px |
| 1140 | nein | 435,7 × 569,5 | −12,8 px |
| 1160 | nein | 443,9 × 580,2 | **−3,1 px** |
| 1170 | **ja** | 446,7 × 583,9 | 0,0 px |
| 1180 | ja | 447,1 × 584,4 | 0,0 px |

## 2 — Befunde

**Footer bei 768: nicht zusammengedrückt.** Es gibt keine drei Spalten mehr:
der Footer besteht aus zwei Clustern mit je zwei Labels (Brand + Visit links,
Instagram + Location rechts) — die dritte Position in der Mitte hält die NAAVI.
Bei 768 liegen zwischen den Clustern **418 px** leere Fläche, jedes Label ist
**44 px** hoch, kein Cluster scrollt (`scrollWidth == clientWidth` in allen acht
Breiten), und die NAAVI überdeckt **0** Labels (Rechteck-Schnitt mit jedem
`row-item`: leer). `footer-768-annotated.png` zeigt alle Rechtecke im selben
Messmoment.

**Portrait-Lücke.** Kein Sprung, sondern eine Rampe: −80,2 px bei 1000, −32,0 px
bei 1100, −3,1 px bei 1160, 0 ab 1170. Unterhalb von ~1165 px ist die Spalte
breiter als die Zielhöhe erlaubt, deshalb bleibt das Bild in voller
Spaltenbreite und endet entsprechend früher. Bei den Tablet-Breiten heißt das:
1024 → 68,6 px Lücke, 820 → 244,8 px, 768 → 297,7 px.

**Cursor.** Der Umschalter ist die Zeiger-Fähigkeit, nicht die Breite: mit
`hasTouch` und ohne feinen Zeiger liefert `(any-pointer: fine)` `false`, der
Body steht auf `cursor: auto`, Links auf `pointer` (Systempfeil/Hand). Sobald
ein Trackpad/Maus da ist (`any-pointer: fine`), greift überall der
Logo-Cursor. Ein iPad mit Magic Keyboard verhält sich also wie der Desktop —
auf allen vier Breiten identisch gemessen.

**Zwischen 600 und 768 px bricht nichts.** 601/640/700/767 gemessen: Overflow 0,
Footer-Struktur unverändert (2 Cluster, 4 × 44 px, Innenabstände 12–16 px,
mittlerer Freiraum wächst 257 → 417 px), NAAVI deckt kein Label.

**NAAVI.** Sichtbar (88 × 44, fest unten mittig) auf allen Breiten, Zähler
`00/ 04` am Anfang, `04/ 04` am Ende, Sprung setzt die Zielsektion auf y = 0 und
stellt den Zähler auf `01/ 04`. Der Sprung schreibt keinen URL-Hash — dasselbe
Verhalten wie auf 1440 und 390, also keine Tablet-Besonderheit.

**Docking.** `data-naavi-footer-docked` ist am Seitenende nicht überall gleich
(601/700/1024 an, 640/767/820/1180 aus, im Nachlauf bei 768 an). Sichtbar ändert
sich nur die Position um den Docking-Offset (wenige px) in der Fußzeile; eine
Überdeckung von Labels entsteht in keinem Zustand.

## 3 — Empfehlung

Kein dritter Umbruchpunkt: bei 768 stehen 418 px Freiraum zwischen den
Footer-Clustern, alle Targets sind 44 px und nichts überlappt — die einzige
Auffälligkeit ist die dokumentierte Spaltenbreiten-Grenze des Portraits
(297,7 px Lücke bei 768, 68,6 px bei 1024), nicht ein Umbruchfehler.

## Dateien

`matrix.jsonl` (Rohdaten Matrix), `footer-detail.json` (Cluster/Items/NAAVI),
`portrait-ramp.json` (Umschaltgrenze), `footer-{768,820,1024,1180}.png`,
`footer-768-annotated.png`, `footer-1180-annotated.png`, `about-{768,820,1024,1180}.png`.
