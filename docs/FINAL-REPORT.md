# Abschlussbericht und Produktionsbereitschaft

Stand: 23. Oktober 2026. Das bestehende Projekt wurde in den fünf gewünschten Phasen erweitert. Der alternative Modus heißt auf Wunsch **the other side**. Interne Dateinamen und der Statuswert `xray` bleiben stabile technische Bezeichner.

## Umsetzung und Review

| Phase | Ergebnis | Review |
| --- | --- | --- |
| A — Architektur/SEO | Vorgerendertes HTML, kanonische Kategorie-/Projektpfade, kompatible Querylinks, Metadaten, JSON-LD, Sitemap, Robots und echte 404-Antworten. | [PR #5](https://github.com/h333ndrik/h4ngelic/pull/5) |
| B — Homepage | Drei gleich gestaltete große Überschriften; horizontale Work-/Kontaktstreifen, native Sticky-Sequenzen, gestaffelte Fly-ins, umkehrbare About-Bewegung und Hero-Rezession. | [PR #6](https://github.com/h333ndrik/h4ngelic/pull/6) |
| C — Interaktionen | Progressive Seitenwechsel, Verlauf/Fokus/Scrollposition, Bildmasken und Galerie, organische Tinten-Spuren, versteckter Footer-Hinweis und abgesicherte Besuchsanzeige. | [PR #7](https://github.com/h333ndrik/h4ngelic/pull/7) |
| D — the other side | Taste `4`/Numpad und zugänglicher Footer-Schalter, falsche Farben/Solarisation, Kanalverschiebung, analoge Textur, lesbare UI und vollständige Rückkehr. | [PR #8](https://github.com/h333ndrik/h4ngelic/pull/8) |
| E — Integration | Gemeinsame Browserprüfungen, echte Messungen, Material-Shader statt Canvas-Filter, vorgerenderte Textur, korrigierter WebGL-Fallback, aktueller Offline-Snapshot und Dokumentation. | [Feature-Vergleich](https://github.com/h333ndrik/h4ngelic/compare/feat/xray-other-side...feat/final-integration) |

Die PRs bauen aufeinander und auf den bestehenden Website-PRs auf. Es wurde nichts in `main` zusammengeführt oder produktiv veröffentlicht. Cloudflare-, GoDaddy- und DNS-Einstellungen wurden nicht verändert.

Chrome-Material, Extrusion `0.455`, Infinity-Bewegung, X/Y-Rotation, Impuls-/Drag-Physik, Nachdrehen, Rückkehr, Tattoo-Reveal und der native h4-Cursor bleiben erhalten. Der 3D-Einstieg wartet auch nach einem verspäteten Import auf den sichtbaren Homepage-Hero. Die zusätzliche Farbverarbeitung läuft ausschließlich im alternativen Modus auf den Wordmark-Fragmenten; Normal überspringt sie vollständig. Der Browsertest bestätigt die pixelgenaue Rückkehr des echten Logos und der Fotos.

## Geprüfter Stand

- **52/52 Node-Tests bestanden.** Optimierter Standardbuild und ausdrücklich gewählter lokaler Produktionsbuild erfolgreich.
- Alle bestehenden und neuen Browser-Suites bestanden: `browser`, `artwork`, `portfolio`, `micro`, `gallery`, `motion`, `navigation`, `easter`, `xray`, `master`. Die kombinierten Tests decken 320/390/768/1920 px sowie Desktop, Touch, Tastatur und reduzierte Bewegung ab.
- Produktions-CSS separat mit Navigation und Medien-/Wordmark-Pixelprüfungen geprüft. Echte direkte HTML-Routen, Query-301s, tatsächliche 404s, Canonicals, eindeutige Metadaten, JSON-LD, Sitemap und Robots in Preview- und Produktionskonfiguration geprüft; die sechs Seiten sind ohne JavaScript lesbar.
- Direktes Work/About lädt weder Three.js-Hero, Font noch Reflexionstextur und initialisiert keinen WebGL-Kontext. Verdeckter/offscreen Hero zeichnet nicht weiter; eine zurückkehrende Homepage verwendet dieselbe Szene.
- Verlauf zum Kontaktbereich bewahrt Scrollposition und sichtbaren Fokus. View-Transition-Snapshots entstehen nach der Scroll-/Fokuswiederherstellung. Galerieprüfungen warten auf den tatsächlich fertig dekodierten Bildwechsel.
- Offline-HTML im Browser bei vollständig blockiertem HTTP geprüft: WebGL, Navigation, Filter, About/Kontakt und Moduswechsel funktionieren ohne externe Anfragen oder Laufzeitfehler. ZIP-Inhalt und Integrität geprüft. Vergleichsbilder visuell kontrolliert.

Die Prüfungen verwenden Chromium. Sie ersetzen keine Abnahme auf einem physischen Telefon und keine echte Safari-Prüfung.

## Tatsächliche Leistungsmessung

Frischer Vergleich mit `0a65d3b`, vor der Masterbrief-Erweiterung; Lighthouse 13.5 / Chromium 154 / SwiftShader, simuliertes mobiles Slow 4G und 4× CPU. Homepage je drei kalte Läufe mit Median je Kennzahl; Work je eine Einzelbeobachtung.

| Kennzahl | Homepage Basis | Homepage final | Work Basis | Work final |
| --- | ---: | ---: | ---: | ---: |
| Performance / 100 | 70 | 71 | 100 | 100 |
| FCP | 1,366 ms | 1,507 ms | 906 ms | 1,053 ms |
| LCP | 1,969 ms | 2,105 ms | 906 ms | 1,065 ms |
| Startup-TBT | 2,357 ms | 2,180 ms | 0 ms | 0 ms |
| CLS | 0.00246 | 0.00239 | 0 | 0 |
| Gesamter Transfer | 327,869 B | 342,642 B | 14,881 B | 29,357 B |

Die Erweiterung kostet zusätzliche UI-Daten; der Score bleibt praktisch gleich. Die Runtime-Prüfung hat erhebliche Kosten von Canvas-Filtern, SVG-Körnung und aufwendigen Farbkurven sichtbar gemacht. Die endgültige Lösung verarbeitet vier Farbanker direkt im bestehenden Wordmark-Shader und lädt die 13,202-Byte-Textur erst bei Aktivierung. Fotos behalten ihre vollständige beziehungsweise reduzierte Solarisation. Die statische Textur füllt den Viewport ohne sichtbare Kacheln.

Alle Rohzusammenfassungen, einzelnen Läufe, genauen Bedingungen, Runtime-Intervalle und Grenzen stehen in [MASTER-PERFORMANCE.md](MASTER-PERFORMANCE.md). Software-WebGL-Laborwerte belegen keine realen Telefon-FPS, garantierte Flüssigkeit, INP oder Feld-Core-Web-Vitals. Startup-TBT bleibt in diesem Software-GPU-Test hoch; das leere Archiv misst kein zukünftiges Portfolio mit vielen Bildern.

## Vorschau und offene Inhalte

[ZIP herunterladen](previews/portfolio-preview.zip), entpacken und `h4ngelic-preview.html` im Browser öffnen. Taste `4` oder der Footer-Schalter aktiviert **the other side**. Bei aktivierter Systemeinstellung für reduzierte Bewegung startet das Logo pausiert; `play` aktiviert die Bewegung.

[Homepage](previews/homepage.png) · [the other side](previews/homepage-xray.png) · [mobil](previews/mobile.png) · [mobil alternativ](previews/mobile-xray.png) · [Work](previews/work.png) · [About](previews/about.png) · [Bewegung mitten im Ablauf](previews/motion-midway.png)

Die vollständigen Vergleichsstills nutzen reduzierte Bewegung, damit alle Abschnitte sichtbar und die Logo-Posen vergleichbar sind. Das zusätzliche Zwischenbild stammt aus dem normalen Scrollablauf. Die Offline-Datei ist ein Review-Snapshot und keine Veröffentlichung auf der Domain.

- Bestätigte Produktionsdomain: **https://h4ngelic.com**. Normale Builds bleiben `preview/noindex`; vollständige Produktionsseiten werden nur im ausdrücklich gewählten Produktionsbuild indexierbar.
- Reale Portfolio-Projekte, Kontakt-/Buchungsziele, optionales Portrait und passendes Social-Vorschaubild müssen noch ergänzt werden. Es wurden keine Arbeiten oder Kontaktadressen erfunden. Browser-Fixtures und die gelieferte Reflexionsgrafik werden nicht als Portfolio-Projekte veröffentlicht.
- Von den zwei erwähnten visuellen Referenzen wurde eine geliefert. Die zweite fehlt; ihr visueller Abgleich ist deshalb offen.
- Persistente Besuchserkennung ist standardmäßig **aus**. Der nicht persistente Fallback greift nicht auf Browser-Speicher zu. Aktivierung erfordert Konfigurationsflag und gültige Consent-Anbindung.
- Live-Header, `robots.txt` und Hosting-/Crawlerregeln der Domain konnten nicht gelesen werden: Der ausgehende CONNECT-Proxy antwortete vor dem Domainzugriff mit **403**. Das ist keine Aussage über den HTTP-Status der Website. Live-Indexierung wurde nicht bestätigt.

## Vor einer späteren Produktionsfreigabe

- [x] Modulare Implementierung, zentrale Inhalts-/SEO-/Motion-/Effektkonfiguration und Bearbeitungsanleitung.
- [x] Automatisierte Tests, Browserprüfungen, Builds, Labormessungen und Offline-Vorschau.
- [ ] Reale Arbeiten mit Alt-Text, Titeln und Beschreibungen sowie tatsächliche Kontakt-/Buchungsziele ergänzen.
- [ ] Bei Bedarf zweite Referenz ergänzen; endgültige Wirkung auf realem Telefon und Safari abnehmen.
- [ ] Persistente Besuchsanzeige nur mit freigegebener Consent-Anbindung aktivieren; bis dahin ausgeschaltet lassen.
- [ ] Erst nach ausdrücklicher Freigabe Produktionsbuild veröffentlichen. Verzeichnis-HTML, Legacy-Redirects, echte 404s, Komprimierung und Indexierungsheader am tatsächlichen Hoster prüfen.
- [ ] Live-WAF-/Crawlerregeln prüfen und Such- und Trainingscrawler getrennt behandeln. Es wurden keine neuen Trainingsfreigaben hinzugefügt.
- [ ] Nach Veröffentlichung Schema/Metadaten live validieren, Eigentum in Search Console/Bing bestätigen, Sitemap einreichen und Indexabdeckung kontrollieren.

Bearbeitung und Betrieb: [CONTENT.md](CONTENT.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SEO.md](SEO.md), [MOTION.md](MOTION.md), [EASTER-EGGS.md](EASTER-EGGS.md) und [XRAY.md](XRAY.md).
