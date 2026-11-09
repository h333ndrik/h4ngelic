# B-F19 (Meldung 09.11.) — Cursor ändert sich über der NAAVI

**Befund (User):** Beim Hovern über die NAAVI unten wechselt der Cursor.
**Status:** fixed (`60e682d`), Produktions-Build `60e682d2580f`.

## Phase 0 — Reproduktion und Ursache

Gemessen am Build `a83408a016a8` (1440 px, Maus auf der NAAVI):

```
NAAVI (a.chapter-counter): url(...h4ngelic-cursor.svg) 8 2, url(...h4ngelic-cursor.png) 8 2, pointer
Footer-location (span):    url(...h4ngelic-cursor.svg) 8 2, url(...h4ngelic-cursor.png) 8 2, auto
```

Beide Assets antworten mit `200` und korrektem MIME (`image/svg+xml`,
`image/png`), das Bild ist also überall dasselbe. **Der Unterschied ist allein
der letzte Eintrag:** `pointer` auf Links, `auto` überall sonst. Solange das
Bild rendert, sieht das identisch aus — sobald ein Browser das Cursor-Bild
ablehnt (SVG-Größe, Richtlinie, blockierter Request), zeigt der Link die
System-Hand und der Rest der Seite den Pfeil. Genau das ist der sichtbare
Wechsel über der NAAVI.

Historische zweite Ursache, für ältere Builds relevant: bis `2976779`
(03.11.) wurde auf Links zusätzlich ein **anderes Bild** benutzt
(`h4ngelic-cursor-hover.svg`, Hotspot `10 2`). Ein Preview-Build von davor
zeigt über der NAAVI wirklich ein anderes Logo — `data-build` prüfen.

## Fix

`--h4-cursor-interactive` ist jetzt **byte-identisch** mit `--h4-cursor`,
inklusive `auto`-Fallback (`src/cursor.css`). Ebene 2 der Kaskade bleibt
bestehen (sie gewinnt weiter gegen UA-Link-Regeln), kann aber kein anderes
Cursor-Bild und keinen anderen Fallback mehr erzeugen. Pressed- und
Xray-Tokens nutzten bereits `auto`.

## Beweis

`tests/cursor-hit-test.mjs` prüft jetzt zusätzlich **Byte-Gleichheit** zwischen
jedem NAAVI-Punkt (Container, Ziffer, Total, `/`-Glyph) und einem
nicht-interaktiven Footer-Element. Vorher war nur geprüft, dass der Wert
„ein erlaubtes Token" ist — `pointer` vs. `auto` fiel dadurch nicht auf.

Produktions-Build `60e682d2580f`:

| Prüfung | Punkte | verschiedene Cursor-Werte |
| --- | --- | --- |
| 1440 × 900 | 4470 | 1 |
| 390 × 844 | 1150 | 1 |
| 320 × 844 | 940 | 1 |
| 1440 × 900 reduced | 4470 | 1 |
| 390 × 844 reduced | 1150 | 1 |
| 320 × 844 reduced | 940 | 1 |
| Xray-Modus | 2221 | (eigenes Token, 1 Wert) |

Ein einziger Wert über die ganze Fläche heißt: die NAAVI kann sich nicht mehr
vom Rest der Seite unterscheiden. Rohdaten: `naavi-cursor.json`.

## So prüfst du es

Auf der geladenen Seite (Desktop) in die Konsole:

```js
const a = getComputedStyle(document.querySelector('[data-naavi]')).cursor;
const b = getComputedStyle(document.querySelector('.footer-location')).cursor;
console.log(a === b, a);
```

Erwartet: `true` und ein String, der mit
`url(".../h4ngelic-cursor.svg") 8 2, ...` beginnt und mit `auto` endet.
Danach mit der Maus über die NAAVI fahren — es darf sich nichts ändern.

Und zur Sicherheit der Stand: `document.documentElement.dataset.build` muss
`60e682d2580f` (oder neuer) sein. Ein älterer Wert erklärt einen anderen Cursor
über der NAAVI (siehe Phase 0, `2976779`).
