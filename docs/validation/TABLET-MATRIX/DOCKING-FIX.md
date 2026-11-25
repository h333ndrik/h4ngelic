# NAAVI-Docking — Ursache, neue Regel, Nachweis

Messung gegen Production `5eb6fcbbc6ba` (vorher) und den lokalen
Production-Build mit dem Fix. Breiten 601/640/700/767/768/820/1024/1180/1440,
jeweils iPad-Emulation (`isMobile`, `hasTouch`, DPR 2), Scroll ans Seitenende.

## a) Ursache (pfad:zeile)

`src/global-navigation.js:192–199` — `paintChrome()`:

```js
const defaultCentre = dockBounds.top + dockBounds.height / 2;        // :194
const footerCentre  = footerBounds.top - view.scrollY + footerBounds.height / 2; // :195
const docked = footerCentre <= defaultCentre && footerCentre >= dockBounds.height / 2; // :196
const offset = docked ? footerCentre - defaultCentre : 0;            // :197
```

`measureChrome()` (`:138`) misst `dockBounds` **ohne** `--naavi-dock-y` (`:141`)
und `footerBounds` als Rechteck des `[data-footer-row]` (`:174`) — beides korrekt.

Das Problem ist die Bedingung selbst: am Seitenende liegen NAAVI-Leiste und
Footer-Zeile **im selben Kasten** (beide 44 px, identische Ober- und Unterkante),
also sind beide Mittelpunkte physikalisch derselbe Punkt. Der Vergleich
`footerCentre <= defaultCentre` entscheidet dann über Bruchteile eines Pixels —
reines Sub-Pixel-Rauschen aus zwei getrennt gerundeten Rechtecken:

| Breite | footerCentre − defaultCentre | `<=` | Attribut vorher |
| --- | --- | --- | --- |
| 601 | −0,078 px | ja | an |
| 640 | **+0,300 px** | nein | aus |
| 700 | −0,172 px | ja | an |
| 767 | **+0,400 px** | nein | aus |
| 768 | **+0,200 px** | nein | aus |
| 820 | **+0,200 px** | nein | aus |
| 1024 | 0,000 px | ja | an |
| 1180 | **+0,300 px** | nein | aus |
| 1440 | **+0,500 px** | nein | aus |

Es ist also **kein** Abstand zum Seitenende und **keine** Viewport-Höhe, die
entscheidet, sondern die letzte Nachkommastelle der Footer-Geometrie
(`footerBottomGap` war überall 11,5–12,2 px, Footer-Zeile 44 px, Leiste 44 px).
Sichtbarer Effekt: der Offset differierte um höchstens 0,17 px.

## b) Neue Regel

Eine Bedingung, die nicht von Sub-Pixeln abhängt: **docken, sobald die
Footer-Zeile im Viewport ist**. Der Offset bewegt die Leiste weiterhin nur
nach oben (`Math.min(0, …)`), das Rendering bleibt identisch.

```js
const footerTop = footerBounds ? footerBounds.top - view.scrollY : Infinity;
const footerCentre = footerBounds ? footerTop + footerBounds.height / 2 : Infinity;
const docked = footerBounds !== null && footerTop < view.innerHeight && footerCentre >= dockBounds.height / 2;
const offset = docked ? Math.min(0, footerCentre - defaultCentre) : 0;
```

Die zweite Bedingung (`footerCentre >= dockBounds.height / 2`) bleibt als
Sicherung: liegt die Footer-Zeile weit über dem Viewport, folgt die Leiste nicht.

## c) Nachweis über neun Breiten

| Breite | Attribut am Seitenende | Offset | Leiste | Footer-Zeile | Labels überdeckt | min. Target |
| --- | --- | --- | --- | --- | --- | --- |
| 601 | **an** | −0,08 px | 743–787 | 743–787 | 0 | 44 px |
| 640 | **an** | 0 px | 795–839 | 795–839 | 0 | 44 px |
| 700 | **an** | −0,17 px | 875–919 | 875–919 | 0 | 44 px |
| 767 | **an** | 0 px | 964–1008 | 964–1008 | 0 | 44 px |
| 768 | **an** | 0 px | 965–1009 | 965–1009 | 0 | 44 px |
| 820 | **an** | 0 px | 1035–1079 | 1035–1079 | 0 | 44 px |
| 1024 | **an** | 0 px | 610–654 | 610–654 | 0 | 44 px |
| 1180 | **an** | 0 px | 711–755 | 711–755 | 0 | 44 px |
| 1440 | **an** | 0 px | 880–924 | 880–924 | 0 | 44 px |

Kein einziger `row-item` schneidet die Leiste (Rechteck-Schnitt leer), alle
Targets bleiben 44 px, `overflow = 0` überall. Die Kästen sind vor und nach dem
Fix identisch — es hat sich nur der Zustand entschieden, nicht die Position.

Umschaltpunkt (Scroll ±24 px um die Stelle, an der die Footer-Oberkante die
Viewport-Unterkante trifft): darunter `docked = false` (Footer noch außerhalb),
darüber `docked = true` — an jeder Breite, an der der Punkt erreichbar ist
(bei 1024/1180 liegt er hinter dem Scroll-Maximum, dort ist der Footer immer
sichtbar und damit immer angedockt).

## d) Suiten

`footer-zone-contract` 3/3 · `footer-v31-browser` PASS ·
`naavi-format-browser` PASS · `v31-navigation-browser` PASS —
keine Änderung an Layout, Optik oder Label-Überdeckung.
