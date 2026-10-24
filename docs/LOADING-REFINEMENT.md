# Ladeoptimierung — 24. Oktober 2026

Nachtrag zu [Control vs. Corruption](CONTROL-CORRUPTION.md), Basis `04fbdd7`, weiterhin [PR #11](https://github.com/h333ndrik/h4ngelic/pull/11). Gestaltung, Inhalte, Logo-Physik, Klang und Ein-Sekunden-Hold bleiben unverändert.

Die ohnehin beim Start benötigte Modus-Steuerung wird jetzt direkt in `src/app.js` importiert. Dadurch bündelt Vite ihren Code, ihre Einstellungen und ihr CSS in den Startdateien. Die nachträgliche CSS-/Modul-Ladekette entfällt. Film, Cursor-Korruption, beschädigtes Wordmark-Material und AudioContext bleiben bedarfsgesteuert; direkte Work-/About-Aufrufe laden keinen Hero.

## Frischer Vergleich

Je drei kalte Homepage-Navigationen und ein Work-Lauf pro Build, seriell, alle gültigen Läufe behalten. Lighthouse 13.5 / Chromium 154 / SwiftShader, mobile Simulation 412×823, DPR 1,75, 150ms RTT, 1638,4kbit/s und 4× CPU-Verlangsamung. Homepage: Mediane; Work: Einzelwert.

| Messwert | Homepage vorher → nachher | Work vorher → nachher |
| --- | --- | --- |
| Lighthouse-Punkte | 70 → 71 | 100 → 100 |
| FCP | 1655 → 1504ms | 1219 → 1109ms |
| LCP | 2406 → 2105ms | 1381 → 1123ms |
| TBT | 2017 → 1742ms | 0 → 0ms |
| CLS | .002386 → .002386 | 0 → 0 |
| Anfragen | 11 → 8 | 7 → 4 |
| Transfer gesamt | 353810 → 351170 Bytes | 39885 → 37261 Bytes |

Die Netzwerkprüfung bestätigt die drei eingesparten Anfragen. Timing und Punktzahl schwanken; die jeweils ersten Homepage-Läufe waren schneller. Spannweiten und alle Einzelwerte sind erhalten: [vorher](performance/loading-before-summary.json), [nachher](performance/loading-after-summary.json), [Vergleich und Anfragebelege](performance/loading-comparison.json). Frühere Werte im Hauptbericht bleiben historische Messungen. Dies sind keine realen Telefon-, Safari-, FPS- oder Feld-INP-Messungen; der vorhandene Hero verursacht weiterhin erhebliche CPU-Arbeit unter simulierter Verlangsamung.

## Abnahme und Vorschau

- 88 Node-Tests bestanden.
- Audio, Modus, Navigation, Pixelkorruption, Material und Hover erneut bestanden; einschließlich 320/390px, echtem Touch, Reduced Motion und keinem AudioContext vor Nutzereingabe. Die ursprünglichen Chrome-Pixel kehren exakt zurück. [Ergebnisse](performance/loading-browser-results.json).
- Preview- und expliziter Production-Build erfolgreich: sechs Routen plus 404. HTTP-/No-JS-SEO in beiden Konfigurationen bestanden. Die Production-Konfiguration wurde nur lokal gebaut.
- Die neue Offline-Datei besteht erneut 1440/390/320px mit null HTTP-Anfragen und null Laufzeitfehlern. ZIP und HTML stimmen bytegenau mit der getesteten Datei überein. [Prüfnachweis](previews/control-preview-results.json).

[ZIP herunterladen](previews/portfolio-preview.zip), entpacken und HTML öffnen. Für die Ansicht ohne ZIP: [Desktop auf GitHub](https://github.com/h333ndrik/h4ngelic/blob/feat/control-corruption/docs/previews/homepage-hero-xray.png), [mobil auf GitHub](https://github.com/h333ndrik/h4ngelic/blob/feat/control-corruption/docs/previews/mobile-hero-xray.png). Die bestehenden Standbilder zeigen die unveränderte Gestaltung der ersten Abnahme. Ein temporärer Live-Tunnel konnte wegen der Netzwerkbeschränkung dieser Umgebung nicht hergestellt werden.

Keine neuen Abhängigkeiten, kein Merge, keine Produktionsveröffentlichung und keine DNS-Änderung.
