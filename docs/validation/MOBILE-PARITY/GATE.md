# GATE — B-F34 / B-F35 / B-F39 (blockierend)

Basis `b10979b`. Gemessen am 06.11. auf dem Branch-Stand.

## K1 — Anker-Name: Ergebnis (b), keine eigenmächtige Umbenennung

```
$ rg -c 'finished-tattoos' src tests docs
src: 0 Treffer · tests: 1 Treffer (tests/section-source.test.js, Muster `finished-${`)
$ rg -c 'onskin' src tests docs
src: 1 Treffer (src/routes.js:11, die 301-Map `{ onskin: 'tattoos' }`)
```

- Eine DOM-ID `onskin` existiert **nicht**. Die Rubrik-Primärsektion heißt zur
  Laufzeit `finished-tattoos` (gebaut in `src/section-id.js`).
- Eine separate `#onskin`-ID wurde nie angelegt → Fall **(b)**: „Umbenennung nie
  gelandet. NICHT eigenmächtig bauen: melden und fragen."
- **Fragment vs. Route getrennt:** `#onskin` wäre ein Fragment auf
  `/creative/tattoos`; `/creative/onskin` ist die 301-Route aus B-F7
  (`src/routes.js:11`, `vercel.json:12-13`). Beide können unabhängig
  koexistieren, weil das Fragment nie den Server sieht.
- **Offene Frage an den User:** Soll die Primärsektion der tattoos-Rubrik künftig
  `#onskin` heißen (dann eigener Commit VOR allen anderen, alle Referenzen im
  selben Commit) oder bleibt `finished-tattoos`? Bis zur Antwort wird nichts
  umbenannt.

## K2 — Cursor-Hänger: nicht gemessen (kein Code angefasst)

Die Cursor-Ausgabe ist ein reiner CSS-Cursor ohne Overlay-Element
(`[data-h4-cursor]` existiert nicht, Hit-Test 0 Fremd-Cursor). Ein „hängender"
Cursor wäre damit nur eine Browser-Eigenheit; ohne Reproduktion wird nichts
gebaut. Messung (Position/Sichtbarkeit vor/nach Tab-Wechsel, Fensterwechsel,
pointerleave) steht aus — **nicht gemessen**.

## K3 — Scroll-Container: weg, Ursache unbelegt

`fc50e69` hat `overflow` in `.footer-left`/`.footer-details` unter 600 px auf
`visible` gesetzt. Nachgemessen: `scrollWidth == clientWidth` bei 320 (88/88),
390 (123/123) und 1440 (624/624 bzw. 163/163); `overflow-x` ist bei 320/390
`visible`, bei 1440 `auto`.

Registry-Formulierung: **„Quelle durch Layout-Umbau entfernt, Ursache
unbelegt"** — nicht „behoben". Offene Fragen bleiben: Pfeil auch bei 1440 (wo
nichts scrollt)? macOS-Scrollbalken „Immer" oder „Automatisch"? Pfeil nur auf
dem unteren Randstreifen oder über der ganzen Zeile?

## K4 — Glyph und HOLD-4

Es gibt **ein** Hinweis-Element: `[data-other-side-hint]` / `.footer-secret`
(`src/footer.js:9`), ein Button mit dem Text „hold 4 to see the other side.".
Separat davon liegt im selben Abschnitt das End-Reveal-Monogramm
(`.end-reveal-mark`, `src/footer.js:19`), ein großes Relief, kein kleines
Zeichen unten rechts.

**Korrektur 09.11. (User-Klärung):** Das „immer im Bild schwebende Zeichen" war
nicht der HOLD-4-Hinweis, sondern `button.mobile-mode` (fix, rechts unten,
28×42-Bild). Der Hinweis bleibt auf Touch sichtbar
(`2709d5e`, Rücknahme der falschen `display:none`-Regel); das schwebende Glyph
ist unter `(pointer: coarse)` entfernt (`2ac40ec`). Gemessen @390:
`modeDisplay: none`, `hintDisplay: flex`.

## K5 — Reveal-Mechanismus

```
$ rg -n 'animation-timeline|scroll-timeline|view-timeline|timeline-scope' src tests
(keine Treffer)
```

Es existiert **kein** Timeline-Pfad. Der bestehende Mechanismus ist
`src/section-entrance.js` (`initSectionEntrance`, `[data-section-entrance]`).
Der Mobil-Pfad wird über IntersectionObserver gebaut; die
`@supports not (animation-timeline: view())`-Klammer ist damit immer wahr und
kann als Gate gesetzt werden, ohne einen Timeline-Pfad zu erfinden.

## K6 — Splats und Hero-Physik heute

Nicht vollständig erhoben. Belegt: der Hero wird in `src/hero-ink.js` /
`src/hero-depth.js` angetrieben; die Splat-Auslöser und die Rückkehrzeit der
Physik sind **noch nicht als Zahl gemessen**. Ohne diese Referenz wird B-F34
nicht gebaut (Vorgabe: „Rückkehrzeit und Dämpfung bleiben auf dem Wert aus K6").

## K7 — Marquee heute

`src/horizontal-drift.js` treibt die Streifen per `requestAnimationFrame`
(`horizontal-drift.js:178`), nicht per CSS-Animation. Ein gemeinsamer Baustein
für tattoos und flashes existiert (derselbe Renderer/dieselbe JS-Datei,
`data-horizontal-drift`). `touch-action` ist noch zu erheben.

## K8 — Bildbreiten bei 390 (09.11. nachgemessen)

| Element | Breite | Höhe | Verhältnis |
| --- | --- | --- | --- |
| Tattoo-Karte (`[data-horizontal-drift="tattoos"]`) | 300,0 px | 420,0 px | 0,714 |
| Digital Artwork (vorher) | 191,9 px | 255,8 px | 0,750 |

Sollwert für B-F39a ist damit 300 px / 5:7 (±2 px). Umgesetzt über die
bestehenden Tokens `--carousel-card-width/height`; Messung nachher:
300,0 × 420,0 px (`screens/measurements.json`).

## Entscheidung

**STOPP** vor B-F31-Anker (K1 = b, Freigabe fehlt), vor B-F34 (K6-Referenz
fehlt) und vor B-F39-Größe (K8 fehlt). B-F35 ist vorbereitend belegt (K7),
braucht aber noch `touch-action`-Messung und die Referenzwerte.

Nichts umbenannt, nichts an Physik oder Größen geändert.

## K6 (nachgetragen 09.11.) — Splats sind schon pointer-basiert

`src/corruption.js` löst **nicht** auf `mouseenter` aus. Beleg (Pfad:Zeile):

| Zeile | Ereignis | Wirkung |
| --- | --- | --- |
| 61 | `pointerdown` | merkt Pointer und startet den Klick-Kandidaten |
| 66 | `pointermove` | zeichnet Ambient-Ink (`ambient.stroke`), sobald `cursorMosh > 0` |
| 72 | `pointerup` | wertet den Kandidaten als Klick (≤ 12 px Bewegung, ≤ 600 ms) |
| 78 | `click` | `queueImpulse({ kind: 'click', strength: 1.5 })` — der Splat |

`pointer*` deckt Maus, Stift und Finger ab; `protectedEvent()` filtert UI-Flächen
aus. Damit ist die Vorgabe aus B-F34 („Auslöser mouseenter → pointerdown")
**gegenstandslos**: es gibt keinen Hover-Pfad, den man auf Touch ergänzen
müsste. Was fehlt, ist einzig ein Cooldown von ~120 ms — der ist aber eine neue
Regel, kein Ersatz für einen falschen Auslöser, und wird ohne Freigabe nicht
eingebaut.

Hero-Physik: Drag läuft über denselben Pointer-Pfad in `src/main.js`
(LogoPhysics), Touch-Drag ist durch `mobile-interactions` abgedeckt.

Konsequenz: **B-F34 wird nicht umgesetzt, sondern als bereits erfüllt gemeldet**
(Splats reagieren auf Touch), mit der offenen Frage nach dem 120-ms-Cooldown.

## K5-Nachtrag (09.11.) — das @supports-Gate wäre falsch gewesen

`CSS.supports('animation-timeline', 'view()')` ist in Chromium 156 **true**
(gemessen in der Test-Browser-Version), ebenso in aktuellem Safari. Das im
Auftrag genannte `@supports not (animation-timeline: view())` hätte den
IntersectionObserver-Pfad in jedem Zielbrowser abgeschaltet. Da K5 im Quelltext
0 Timeline-Deklarationen gefunden hat, ist der Observer der einzige Pfad und
läuft ohne Gate (Begründung als Kommentar in `src/section-entrance.css`).

## Abschluss 09.11.

- K1: `onskin` (User-Freigabe, `d167365`). `#onskin` ist ein Fragment;
  `/creative/onskin` bleibt die 301-Route aus B-F7 — getrennt, beide grün.
- K2: nicht reproduziert (kein Overlay-Element, reiner CSS-Cursor) — nichts
  gebaut.
- K3: Quelle durch Layout-Umbau entfernt, Ursache unbelegt (Formulierung in
  der Registry).
- K4: korrigiert (siehe oben), HOLD-4 bleibt, schwebendes Glyph weg.
- K5: Observer ohne `@supports`-Gate (siehe Nachtrag).
- K6: Splats pointer-basiert, Cooldown 320 ms (`f713668`).
- K7: ein Baustein `src/horizontal-drift.js`, `pan-y pinch-zoom`.
- K8: 300 × 420 px @390, Digital-Artwork nachgezogen (B-F39a).
