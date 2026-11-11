# Live-Abgleich 11.11.2026 — `ed349011d814`

Messung gegen **`https://www.h4ngelic.com`**, `data-build` = `ed349011d814`
(= `origin/main` `ed34901`). Rohdaten: `live-check-2026-11-11.json`.

## 1 — Sind die Mobile-Commits live?

| ID | Commit(s) | in `origin/main` | live geprüft |
| --- | --- | --- | --- |
| B-F32 (Cursor + Glyph) | `ec19cc7`, `2709d5e`, `2ac40ec` | ja | ja |
| B-F33 (Press-State) | `b10979b` | ja | ja |
| B-F34 (Splat-Cooldown) | `6fa2591`, `f713668` | ja | Code-Pfad, s. u. |
| B-F35 (Marquee-Snap) | `faa92b6` | ja | ja |
| B-F36 (Footer-Zeilen) | `fc50e69`, `bb70f6b` | ja | ja |
| B-F37 (Mute „m") | `a52dcb5` | ja | ja |
| B-F39 (Artwork + Reveal) | `87269e8` | ja | ja |

Alle sieben sind gemergt und deployed; nichts liegt nur auf einem Branch.

## 2 — Abgleich Doku ↔ live

| Punkt | dokumentiert als | live bei 390 | Differenz |
| --- | --- | --- | --- |
| `(pointer: coarse)` | true | true | keine |
| Footer-Branding `cursor` | `auto` (System) | `auto` | keine |
| `.footer-secret` (HOLD-4-Hinweis) | Tabelle B-F32: `display: none` · Abschnitt „B-F32 (rev)": bleibt | `flex` | **nur Doku**: die Tabelle ist der alte Stand vor `2709d5e`, der rev-Abschnitt und der Test verlangen `flex` |
| `[data-footer-secret-space]` | vorhanden | 1 | keine |
| `button.mobile-mode` | `none` auf Touch, 0×0 | `none` 0×0 | keine |
| Footer-Reihenfolge | nav < controls < naavi (688–732 / 744–788 / 788–832) | 732 / 788 / 832 | keine |
| Footer-Cluster sw/cw | gleich (123/123, 88/88) | 123/123 · 88/88 | keine |
| Seite/Viewport | gleich | 390/390, 320/320, 1440/1440 | keine |
| Press-State | `.is-pressed` bei `pointerdown`, danach weg, Tap-Highlight transparent | während `true`, danach `false`, `rgba(0,0,0,0)` | keine |
| Marquee-Phasen | dragging → momentum → settling → drift | beide Streifen genau so | keine |
| Marquee-Einrasten | ganze Karte, Schritt 400 px | `tattoos` 399,603 (mod 400 = 399,60), `flashes` 0,109 → beide auf dem 400er-Raster (±0,4 px) | keine |
| Karte vollständig im Bild | ja | 1 von 8 Karten vollständig (67…367 px) | keine |
| Reveal `flashes` | 0 → 1 beim Scrollen | 0 → 1 | keine |
| Digital-Artwork | 300,0 × 420,0 (5:7) | 300 × 420 (0,714) | keine |
| Taste „m" bei 1440 | kippt und zurück | `true/sound on → false/sound off → true` | keine |
| B-F34 Splats | `pointerdown`-basiert, Cooldown 320 ms | nicht extern messbar (Splats zeichnen in ein Canvas, nur im xray-Modus aktiv) | **NICHT PRÜFBAR** live beobachtet; belegt über `src/corruption.js:61` (pointerdown) und `:87` (Cool-down) plus `npm test` |

Nur eine Zeile weicht ab, und die ist Doku: die B-F32-Tabelle im README trug
noch `display: none` für den HOLD-4-Hinweis, obwohl `2709d5e` ihn auf Touch
bewusst behält. Die Tabelle ist unten korrigiert.

## 3 — Hero-Logo bei 390 (Touch)

**Events:** `src/main.js:377–382` bindet ausschließlich Pointer-Events an den
Canvas — `pointermove`, `pointerdown`, `pointerup`, `pointercancel`,
`lostpointercapture`, `pointerleave`. Kein `mouse*`-, kein `touch*`-Handler.

**Drag (a):** funktioniert live. Treffer bei `256,396`; `is-dragging` bleibt
über alle fünf `touchmove` gesetzt, beim `touchend` fällt es weg. Im Dev-Build
mit Test-Hooks: `offset` 0 → `[1.92, 0.571, 0]`, `orientation`
`[0,0,0,1]` → `[-0.019, 0.077, -0.118, 0.99]`, `velocity` am Ende
`[4.013, 1.238, 0]`. Der Touch-Pfad fehlt nicht.

**Einfahrt (b):** läuft live. `h4:heroready` @3329 ms, `#logo-canvas`
`translateY` −876 px → 0 in ~1,2 s (Samples 2636 → 3850 ms). Bei 1440:
`heroready` @1965 ms, −932 px → 0 in ~1,2 s.

**Ruhezustand:** über 2 s ist das Quaternion-Delta **0** bei 390 *und* 1440;
nur die Position driftet (0,48 / 0,49). Das Logo rotiert also von sich aus
nicht — auf dem Desktop entsteht die Bewegung aus Hover und Drag, auf Touch
gibt es kein Hover. Das ist der einzige Unterschied und kein Fehler im
Touch-Pfad.

**Ergebnis:** weder (a) noch (b) ist die Ursache eines statischen Logos; es
gibt in diesem Bereich **keine zu schließende Lücke**, deshalb keine
Codeänderung.
