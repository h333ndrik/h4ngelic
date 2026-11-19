# `?status` — Hero-Diagnose ohne Konsole

**Warum:** Auf iOS gibt es keine Konsole ohne Mac. Ein Befund wie „3D-Logo
funktioniert auf meinem iPhone nicht, beim Kollegen schon" lässt sich sonst
nicht in Zahlen fassen.

**Wie:** `https://www.h4ngelic.com/?status=1` öffnen. Unten links erscheint ein
schwarzes Feld mit dem Live-Zustand; ohne den Parameter wird **nichts**
eingefügt (kein Element, kein Timer — `tests/hero-status.test.js`).

```
build 88934610fd01
stage stage is-ready
loading false · quality mobile
poster block op 0.00 anim none
canvas block op 1.00 y 0
buffer 585×1266
webgl2 true · webgl true
dpr 2 · 390×844
reduce false · coarse true
```

**Lesart:**

| Zeile | gesund | Befund |
| --- | --- | --- |
| `stage` | `stage is-ready` | `is-poster-static` = Reduced Motion oder WebGL aus; `is-boot-failed`/`is-fallback` = 3D nicht ladbar |
| `poster` | `op 0.00` | `op 1.00` bei `is-ready` = Poster wird nicht ausgeblendet |
| `canvas` | `op 1.00 y 0` | `y -8xx` = Einfahrt hängt; `display none` = Poster-Modus |
| `webgl2/webgl` | `true` | `false` = Gerät/GPU gibt keinen Kontext her |
| `reduce` | `false` | `true` = „Bewegung reduzieren" aktiv, Poster ist dann Vertrag |

Der Test `tests/hero-status.test.js` belegt, dass der Parameter der einzige
Auslöser ist.
