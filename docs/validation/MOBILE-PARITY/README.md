# MOBILE-PARITY — B-F32 (Cursor + Glyph)

Basis `8c710c3` + B-F31 (`4bb62fa`, `6cbe954`, `5dfe46b`).

## B-F32

| Prüfung | 390 px | 320 px | 1440 px |
| --- | --- | --- | --- |
| `@media (pointer: coarse)` | true | true | false |
| computed `cursor` am Footer-Branding | `auto` (System) | `auto` (System) | `h4ngelic-cursor` |
| `.footer-secret` (HOLD-4-Hinweis) | `display: none` | `display: none` | sichtbar |
| End-Reveal-Fläche `[data-footer-secret-space]` | vorhanden | vorhanden | vorhanden |

Der Custom-Cursor hängt bereits an `@media (any-hover: hover) and
(any-pointer: fine)` (`src/cursor.css:35`); auf coarse Pointern greift keine
einzige Cursor-Deklaration, es gibt deshalb auch kein „hängendes" Element —
gemessen, nicht angenommen (`results.json`).

Neu ist nur die Glyph-Regel: der HOLD-4-Hinweis braucht eine Tastatur, auf
Touch bleibt seine Nachricht dauerhaft unsichtbar — er war damit eine
unsichtbare Fokusfalle. `src/easter-eggs.css` (Block `max-width: 600px`) setzt
`.footer-secret { display: none; }`. Die End-Reveal-Fläche bleibt, damit die
NAAVI weiterhin dorthin springen kann.

Test: `tests/mobile-parity-browser.mjs` (`npm run test:mobile-parity`), in der
Gate-Battery registriert. Läufe: 390/320/1440 grün; `v15-mobile-browser` und
`greeting-browser` (390/320) unverändert grün.

## B-F37 — Mute-Taste „m"

Ein Dokument-Keydown im bestehenden Sound-Controller (`src/sound-controls.js`)
schaltet denselben Zustand wie der Button: `audio.setMuted(!audio.muted)`,
Label und `aria-pressed` folgen über das vorhandene `refresh()`.

Guard: `input`, `textarea`, `select`, `contenteditable` und jede Modifier-Taste
(`meta`/`ctrl`/`alt`) brechen vorher ab — ohne `preventDefault`. Groß- und
Kleinschreibung ist egal. Auf reinen Touch-Geräten gibt es kein
Tastatur-Äquivalent; dort bleibt der Button der einzige Weg (in der Tabelle
so geführt).

Nachweis (`tests/mobile-parity-browser.mjs`, 1440 px): `m` kippt den Zustand,
zweites `m` stellt ihn wieder her, Label folgt (`sound on` / `sound off`),
„mmmail" im Namensfeld bleibt Text und schaltet nichts, `Meta+m` schaltet
nichts.

Hinweis: `tests/sound-controls-browser.mjs` bricht in dieser Umgebung bei
`[data-smash]` ab (Timeout) — unabhängig von dieser Änderung, die nur einen
Keydown-Zweig ergänzt und kein DOM anfasst.

## B-F36 (Teil 1) — Footer ohne Scroll-Container

`@media (max-width: 600px)`: `.footer-left` und `.footer-details` sind keine
Scroll-Container mehr (`overflow: visible`, `flex-wrap: wrap`, `white-space:
normal`, `scrollbar-width: auto`). Der Inhalt bricht um, statt zu scrollen.

| Viewport | `.footer-left` sw/cw | `.footer-details` sw/cw | Höhe | Seite/Viewport | Brand/Visit/NAAVI |
| --- | --- | --- | --- | --- | --- |
| 320 | 88 / 88 | 88 / 88 | 90 px | 320 / 320 | 44 / 44 / 44 px |
| 390 | 123 / 123 | 123 / 123 | 90 px | 390 / 390 | 44 / 44 / 44 px |
| 1440 | 624 / 624 | 163 / 163 | 44 px (nowrap, unverändert) | 1440 / 1440 | 44 / 44 / 44 px |

Damit ist die H1-Quelle aus B-F19 **strukturell weg**: es gibt bei 320/390
keinen Container mehr, der scrollen könnte, also auch keinen Gutter —
unabhängig davon, ob H1 je bewiesen wird. Vorher: `146 / 88` bzw. `128 / 88`.
Kein horizontaler Seitenoverflow, alle Targets 44 px, Desktop unverändert.

**Noch offen an B-F36:** die sichtbare Rangfolge in drei Zeilen
(creative/about/contact → slow/pause/sound → 00/04). Sie betrifft `.hero-nav`
und `.controls`, die im Hero positioniert sind, nicht den Footer-Container —
das ist ein sichtbarer Umbau, der eine Vergleichsansicht braucht. Nicht in
diesem Lauf gebaut.

## B-F19 — Nachtrag

Die Ursache-Hypothese H1 (Gutter) ist mit B-F36 Teil 1 gegenstandslos
geworden: die Cluster scrollen nicht mehr, es gibt keinen Rand, auf dem ein
Systempfeil liegen könnte. Die offenen Fragen an den User (macOS-Scrollbalken
„Immer"/„Automatisch", Pfeil nur auf dem Randstreifen oder über der Zeile,
auch bei 1440) bleiben für die Begründung dokumentiert, blockieren den Fix
aber nicht mehr.

## B-F36 (Teil 2) — drei Zeilen in Leserichtung

Auf ≤600 px stehen die drei Gruppen jetzt von oben nach unten und jeweils von
links nach rechts: **creative / about / contact** (primär, volle Breite),
**slow / pause / sound on** (sekundär, `opacity: .72`), **00/ 04** (der fixierte
NAAVI, zentriert).

| Viewport | Nav | Controls | NAAVI | Überlappung | Seitenbreite |
| --- | --- | --- | --- | --- | --- |
| 320 | 688–732 | 744–788 | 788–832 | keine | 320 = 320 |
| 390 | 688–732 | 744–788 | 788–832 | keine | 390 = 390 |
| 1440 | 776–820 (rechts) | 776–820 (links) | 788–832 | keine | 1440 = 1440 (unverändert) |

Alle drei Zeilen halten 44 px Höhe. Die alte Controls-Position (oben rechts,
`top: 72px`) ist damit weg — sie war die Ursache für „slow/pause/sound gedrängt
über den Links".

## B-F33 — Press statt Hover auf Touch

`src/press-state.js` schreibt `.is-pressed` auf den Link selbst
(`pointerdown`), räumt es bei `pointerup`/`pointercancel`/`pointerleave` wieder
ab. Kein `preventDefault`, keine Verzögerung — der Handler fasst nur
`classList` an. `src/style.css` setzt `-webkit-tap-highlight-color:
transparent` für genau diese Links, damit nicht zwei „gedrückt"-Optiken
übereinanderliegen, und gibt `.is-pressed` eine eigene, kurze Optik
(`opacity .72`, `translateY(1px)`, keine Transition).

Nachweis (390 px, `tests/mobile-parity-browser.mjs`): Klasse ist während des
`pointerdown` gesetzt, nach `pointerup` wieder weg, Tap-Highlight ist
`rgba(0, 0, 0, 0)`, Ziel-Href unverändert.

## B-F32 (rev) — schwebendes Mode-Glyph auf Touch entfernt

`button.mobile-mode` war `position: fixed; right: 14px; bottom: ~90px` mit einem
28×42-Pfeilbild und lag dauerhaft über der Seite — das „immer im Bild
schwebende" Zeichen. Unter `(pointer: coarse)` ist es jetzt `display: none`
(`src/mobile-mode.css`, letzter Block).

Gemessen (390): `modeDisplay: none`, Box 0×0; HOLD-4-Hinweis bleibt
(`hintDisplay: flex`). 1440 unverändert. Der HOLD-4-Hinweis bleibt der
Touch-Einstieg in die andere Seite.

## B-F34 — Splat-Cooldown wie beim Hero-Logo

Die Splats hingen schon an `pointerdown`/`pointerup`/`click`
(`src/corruption.js:61/72/78`), also auch an Touch. Neu ist nur die Drosselung:
ein Klick-Impuls wird verworfen, wenn seit dem letzten weniger als
`interactionMoshSettings.click.cooldownMs` (320 ms — derselbe Wert wie beim
Hero-Logo) vergangen sind. Der Wert wird gelesen, nicht dupliziert.

Damit gilt: ein Druck → ein Splat; ein zweiter Druck innerhalb von 320 ms →
kein zweiter Splat; nach Ablauf wieder einer. `npm test` 448 / 447 pass /
1 skipped / 0 fail (der Import im `memory-creation-failure`-Test wurde in die
bestehende Import-Map aufgenommen).

## B-F39a — Digital-Artwork in der Tattoo-Kartengröße (390 px)

Messung K8 vorher/nachher (`screens/measurements.json`):

| Element @390 | Breite | Höhe | Seitenverhältnis |
| --- | --- | --- | --- |
| Tattoo-Karte (`[data-horizontal-drift="tattoos"]`) | 300,0 px | 420,0 px | 0,714 (5:7) |
| Digital Artwork **vorher** | 191,9 px | 255,8 px | 0,750 (3:4) |
| Digital Artwork **nachher** | 300,0 px | 420,0 px | 0,714 (5:7) |

Es gibt keine neue Größenkonstante: `src/pages.js` schreibt bei der Sektion
`digital-artworks` die zwei bestehenden Tokens `--carousel-card-width` /
`--carousel-card-height` (aus `src/carouselSettings.js`) als Inline-Style an die
Sektion. `src/archive-structure.css` (nur `max-width: 600px`) setzt darauf die
Ruhebreite, die Ruhehöhe und `--digital-base-width`. Der Rahmen behält seinen
reservierten Expansionsplatz; das gerenderte Bild ist im Ruhezustand `cover`
(Kartenvertrag), im geöffneten Zustand `contain` (ganzes Werk sichtbar).

- 320 px: ebenfalls 300 × 420; Tipp-Expansion wächst wie die Tattoo-Karte auf
  die Viewportbreite (1,067×, exakt derselbe Wert wie die Karte).
- 390 px: Tipp-Expansion 300 → 390 px (1,30×), Dokumentbreite bleibt 390.
- 1440 px: unverändert 400,7 × 534,3 px, Wachstum 1,058× wie vorher
  (`screens/b-f39-digital-1440.png`).

**So prüfst du es:** `/creative/more` bei 390 px öffnen, das Digital-Artwork
messen (`document.querySelector('#digital-artworks .artwork-open img')
.getBoundingClientRect().width`) → 300; antippen → es füllt die Breite.

## B-F39b — Rubrik-Sektionen kommen beim Scrollen an (Touch)

`src/section-entrance.js` (der bestehende, routenverwaltete Helfer aus B-F31)
beobachtet jetzt zusätzlich alle `[data-section-reveal]`-Sektionen — die Marke
setzt der Renderer aus derselben `siteContent.js`-Sektionsliste, es gibt keine
zweite Liste. IntersectionObserver mit `threshold: 0` und
`rootMargin: '0px 0px -12% 0px'`; Eintritt löst die Klasse
`is-section-revealed` aus, die Sektion läuft einmalig ein
(opacity 0 → 1 in 520 ms, `translateY 14px → 0` in 700 ms expo-out).

- **Kein `@supports`-Gate:** gemessen ist
  `CSS.supports('animation-timeline', 'view()') === true` in Chromium 156
  (und damit auch in aktuellem Safari). Das im Auftrag vorgesehene
  `@supports not (animation-timeline: view())` hätte den einzigen Pfad in jedem
  Zielbrowser abgeschaltet. K5 hatte im Quelltext 0 Timeline-Deklarationen
  gefunden; der Observer ist deshalb der einzige Mechanismus.
- **Kein Blitz beim Laden:** Sektionen, die beim Armieren schon im Bild sind,
  werden nicht versteckt; die Einfahrt beginnt mit der nächsten Sektion.
- **Fail-safe:** Die `is-section-reveal-pending`-Klasse schreibt nur der
  Observer. Ohne JS (oder ohne IntersectionObserver) bleibt jede Sektion
  sichtbar — es gibt keinen CSS-Zustand, der Inhalt dauerhaft auf opacity 0
  hält. Reduced Motion: Endzustand sofort, keine Transition.
- **Lifecycle:** Verlassen der Route ruft den Teardown des Helfers
  (Observer `disconnect`, Klassen entfernt), die Rückkehr armt neu. Getestet
  über den Router (`/creative/tattoos` → `/creative/more` → zurück).
- Desktop 1440: `(pointer: coarse)` greift nicht, keine Klasse, keine Regel —
  gemessen `pending: false`, `opacity: 1` auf beiden Sektionen.

Evidence: `screens/b-f39-reveal-mid-{390,320}.png` (Mid-Frame; für das Standbild
wurde die 520-ms-Transition auf 4 s gestreckt, die echten Zeiten stehen in
`measurements.json`).

**So prüfst du es:** `/creative/tattoos` bei 390 px laden, langsam nach unten
wischen — „flashes" fährt ein; in der Konsole
`getComputedStyle(document.getElementById('flashes')).opacity` → `1`.

## B-F35 — Marquee: Touch-Drag mit Nachlauf und ganzem Bild am Stillstand

Beide Streifen (`tattoos`, `flashes`) laufen durch denselben Baustein
`src/horizontal-drift.js`; Drag läuft über `pointerdown/move/up`, also auch für
Touch, `touch-action` ist im enhanced Zustand `pan-y pinch-zoom` (gemessen).
Neu ist nur der Stillstand: endet der Nachlauf nach einem **Touch**-Drag,
rastet der Streifen auf die nächste ganze Karte ein (gemessene Schrittweite
400 px = 300 px Karte + 100 px Abstand) und die Umgebungsbewegung setzt danach
wieder ein. Rad- und Maus-Drag behalten das Desktop-Verhalten (gemessen:
`momentum → idle`, nie `settling`).

Messung @390 (`screens/measurements.json`, Frame-Sampling in
`tests/mobile-parity-browser.mjs`):

| Streifen | Phasen | Karte vollständig im Bild | Seite scrollt vertikal |
| --- | --- | --- | --- |
| tattoos | dragging → momentum → settling → drift | ja (bei 400 px Stillstand) | ja (0 → 314 px) |
| flashes | dragging → momentum → settling → drift | ja | ja |

**So prüfst du es:** bei 390 px über den Streifen wischen, loslassen; sobald
die Bewegung zur Ruhe kommt, steht eine Karte vollständig im Bild
(`[data-carousel-phase]` läuft durch `settling`), danach driftet es weiter.

## Mobile-Animations-Durchgang (09.11.)

| Animation | 390 px Touch | Reduced Motion |
| --- | --- | --- |
| Hero-Einfahrt (`#logo-canvas` von oben) | läuft: Start `translateY -795,7 px` → `0` in 1100 ms | Poster statisch, Canvas `display: none` |
| Poster-Atem beim Laden | `hero-poster-breathe`, 2,8 s | `animation: none` |
| Rubrik-Reveal (B-F39b) | Eintritt, 520/700 ms | Endzustand sofort |
| Bild-Reveal (`image-reveals.js`) | IO bei 8 %, Maske 520 ms | Endzustand sofort |
| Marquee-Drag (B-F35) | Drag + Nachlauf + Einrasten | kein Nachlauf (`transition: none`, sofort) |
| Press-State (B-F33) | `pointerdown` → `.is-pressed` | unverändert (keine Transition) |
| Splats (B-F34) | `pointerdown`, Cooldown 320 ms | Splats ohne Bewegung |

Hover-gebundene Effekte (Magnet, Glow, Pfeil) sind unter
`(hover: none), (pointer: coarse)` bereits abgeschaltet
(`src/interactions.css`, `src/header-contrast.css`) — auf Touch läuft keine
Animation ins Leere. Der schwebende Mode-Pfeil bleibt entfernt (B-F32 rev,
`2ac40ec`); der HOLD-4-Hinweis bleibt (`2709d5e`).

## Verifikation gegen den Production-Build (09.11.)

`npm run build` (23 Routen + 404) und `node scripts/serve-preview.mjs` auf
`127.0.0.1:55173`; danach:

- `tests/mobile-parity-browser.mjs`: 10/10 PASS (inkl. B-F39a/b und B-F35).
- `tests/v15-mobile-browser.mjs`: 4/4 PASS (390/320 × beide Motion-Preferences).
- `npm test`: 448 Tests / 447 pass / 1 skipped / 0 fail.

## Rote Suiten — nachträglich geklärt (09.11.)

Die oben als „bekannt rot" geführten Suiten waren Erwartungen aus der Zeit vor
späteren Verträgen, kein Produktfehler. Sie sind jetzt abgeglichen (`02badd6`,
`914ad61`) und grün:

| Suite | Ursache | Auflösung |
| --- | --- | --- |
| `horizontal-drift-browser` | erwartete den leeren `flashes`-Streifen; seit `4ada015` (B-013) stehen dort 8 markierte Platzhalterkarten, Zähler `01/ 08`. | Assertions beschreiben den Platzhalter-Vertrag (0 `img`/`canvas`, 8 Karten, 8 Buttons, beide Pfeile aktiv). |
| `footer-zone-contract` | verlangte eine gemeinsame Grundlinie aller Footer-Items; B-F36 bricht unter 600 px auf zwei Zeilen im 90-px-Band um. | bis zu zwei Zeilen, kein Überlappen, innerhalb des Bands; Desktop weiter eine Zeile. |
| `v31-navigation-browser` | die Contrast-Fixture feuert `h4:pagechange`, während ein Sektions-Hash gesetzt ist — B-F31 landet dann (korrekt) per Smooth-Scroll neu, mitten in der Messung. | Fixture löscht vorher den Hash und prüft, dass die Probe die NAAVI wirklich überlappt. |
| `v31-ui-browser` | Controls sind auf dem Handy absichtlich `.72` (B-F36); Digital-Expansion wächst seit B-F39 aus dem 300-px-Slot wie die Tattoo-Karte. | profilabhängige Schwellen wie bei der Tattoo-Karte, Controls ≥ .7 unter 600 px. |
| `naavi-format-browser` | las `dist/index.html` aus einem Zwischenstand ohne Prerender-Tokens. | nach `npm run build` grün; keine Codeänderung. |
| `tokens-audit` | `src/mannequin-preview.css` deklarierte vier Cursor-Werte, die nie gewinnen konnten. | Deklarationen entfernt (`914ad61`), Begründung bleibt als Kommentar. |
