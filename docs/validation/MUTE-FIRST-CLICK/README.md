# B-F40 — der erste echte Klick auf MUTE landet

**Befund (User):** Der erste Klick auf MUTE tut nichts; erst der zweite schaltet.
**Fix:** `25e3ed7` — `refresh()` schreibt das Label nur noch, wenn es sich wirklich
ändert (vorher ersetzte jedes Audio-Update die Textknoten des Buttons, auch beim
ersten `pointerdown`, das den Audio-Context freischaltet — das Klickziel war
mitten im Press zerstört).
**Beweis:** `tests/mobile-parity-browser.mjs`, Block „B-F40: the very first pointer
press on MUTE has to land".

## Messung

| Lauf | Zustand bei Load | Erster echter Maus-Klick | `aria-pressed` danach |
| --- | --- | --- | --- |
| Fix zurückgedreht (`button.textContent = label`) | `true` (sound on) | 500 ms nach Load | `true` — Klick verschluckt |
| Fix aktiv (`if (button.textContent !== label) …`) | `true` (sound on) | 500 ms nach Load | `false`, Label `sound off` |
| Fix aktiv | `true` (sound on) | 1500 ms nach Load | `false`, Label `sound off` |

Rot-Beleg (Fix zurückgedreht, Dev-Build auf `55173`):

```text
AssertionError [ERR_ASSERTION]: the first mouse press on MUTE flips it
(500 ms after load: true -> true)
```

`page.locator(...).click()` ist eine echte Maus-Sequenz
(`pointerdown → mousedown → pointerup → mouseup → click`); der Tastaturweg `m`
(B-F37) läuft nicht durch diesen Pfad und war deshalb grün, während der Klick brach.

## So prüfst du es

1. Seite frisch laden (kein vorheriger Klick auf die Seite).
2. Einmal auf MUTE klicken — Label wechselt sofort zwischen `sound on` und `sound off`.
3. In der Konsole: `document.querySelector('[data-controls] [data-mode-mute]').getAttribute('aria-pressed')`
   kippt nach genau diesem einen Klick.
