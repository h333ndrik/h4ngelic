# Portrait-Lücke — Rechnung und Entscheidung (nicht gebaut)

Gemessen am lokalen Build (`serve-preview.mjs`), Verhältnis 0,7651
(1179 × 1541), Zielhöhe = Bild-Oberkante → Unterstrich „get in touch".

| Breite | Bild heute | Zielhöhe | nötige Bildbreite (Ziel × 0,7651) | Spalten gesamt (ohne Einzug/Gap) | Text bliebe |
| --- | --- | --- | --- | --- | --- |
| 768 | 247 × 322 | **620 px** | **474 px** | 619 px | **145 px** |
| 820 | 289 × 378 | 623 px | 476 px | 667 px | **190 px** |
| 1024 | 388 × 507 | 576 px | 441 px | 853 px | 412 px |
| 1180 | 447 × 584 (gebunden) | 584 px | 447 px | 995 px | 548 px |

Spalten gesamt = Innenbreite des About-Layouts abzüglich Einzug (`--label-inset`,
69/73/91 px) und 10 % Gap; „Text bliebe" = Spalten gesamt − nötige Bildbreite.

## Entscheidung

Bei **768 px** müsste die Bildspalte von 247 auf 474 px wachsen (+92 %), der Text
fiele auf **145 px** — rund 15 Zeichen pro Zeile, unter der Hälfte der heutigen
320-px-Mindestbreite und weit unter der 300-px-Grenze. Bei 820 px wären es
**190 px**. Deshalb: **kein Umbau, die Lücke bleibt.** Sie ist die dokumentierte
Folge der Regel „Höhe = Spaltenbreite × 1,307", nicht ein Umbruchfehler.

Kontext, nicht gebaut: ab 1024 px bliebe der Text mit 412 px lesbar (Lücke dort
68,6 px) — ein Eingriff nur für ≥ 950 px wäre möglich, würde aber eine Ausnahme
in die Regel bringen, die auf 768/820 nicht trägt. Für eine Entscheidung des
Users: 474 px Bildspalte bei 768 sind nicht darstellbar, 441 px bei 1024 schon.
