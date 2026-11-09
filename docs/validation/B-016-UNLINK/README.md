# B-016 — Impressum-Link entfernt (Route bleibt)

Befund/Entscheidung (User 05.11.): `/impressum` ist ein §-5-DDG-Gerüst aus reinen
Platzhaltern (`[VOLLNAME]`, `[STRASSE+HAUSNUMMER]`, `[PLZ+ORT]`, `[E-MAIL]`,
`[UST-IDNR. ODER §19-HINWEIS]`). Ein verlinktes Platzhalter-Impressum ist nicht
besser als keins — der Link fällt aus beiden Footern, die Route bleibt stehen.

## Was entfernt wurde

| Ort | Vorher | Nachher |
| --- | --- | --- |
| Normal-Footer | `<a class="footer-impressum row-item" href="/impressum">impressum</a>` in `.footer-details` | nicht mehr im DOM |
| Other-Side-Footer | `[data-other-side-imprint-slot]` + in `src/xray.js` injizierter Zweitlink | Slot und Injektion entfernt |
| Tests | Footer-/Struktur-/Cursor-Suiten erwarteten 1 bzw. 2 Links | Assertions auf `0` umgestellt, sichtbar als „B-016: Impressum-Link bewusst entfernt bis Nutzdaten vorliegen (05.11.)" kommentiert |

## Was bleibt (bewusst)

- `/impressum` ist weiter prerendert: HTTP 200, `dist/impressum/index.html`
  vorhanden, `meta name="robots" content="noindex, follow"`.
- Nicht in `sitemap.xml` (Sitemap filtert `indexable`, Impressum ist es nicht).
- Inhalt der Seite unverändert (Platzhalter bleiben) — ein späterer Ein-Zeilen-
  Commit kann den Link wieder setzen.
- Kein visueller Platzhalter, kein leerer Slot: die Nachbarn rücken nach.

## Footer-Geometrie (gemessen, `measure-footer.mjs` → `footer-geometry.json`)

Build `57ff1e3c7c45`, normal und Other Side, jeweils 1440/390/320:

| Viewport | Zone | NAAVI-Zentrierung | Cluster-Gap | gemessene Gaps |
| --- | --- | --- | --- | --- |
| 1440 | 44,0 px | 0,00 px | 28,8 px | left 28,8 / 28,8 · details 28,79 |
| 390 | 44,0 px | 0,00 px | 12 px | left 12 / 12 · details 12 |
| 320 | 44,0 px | −0,34 px | 12 px | left 12 / 12 · details 12 |

Keine Legal-Links in beiden Modi (0/0), Seitenbreite unverändert (kein
horizontaler Overflow). Typ-C-Vertrag (`--cluster-gap`, 44-px-Targets,
NAAVI-Reservierung) bleibt unangetastet; `tests/row-geometry-contract.mjs` und
`tests/footer-v31-browser.mjs` laufen im Gate unverändert grün.

## Suiten zu diesem Fix

`npm test` 376/376 · `footer-v31-browser` (1440 + 390/320 × beide Motion) ·
`footer-zone-contract` 3/3 · `v32-structure-browser` · `cursor-hit-test`
4469/1149/939 × beide Motion + xray 2221 · `v15-mobile-browser` ·
`v31-ui-browser` · `link-glyph-contract` (68 Hover-Checks) · `seo-browser`
(23 Routen, Sitemap ohne `/impressum`, noindex belegt).
