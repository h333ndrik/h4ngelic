# Homepage refinement — 24. Oktober 2026

> Historischer PR-10-Snapshot (`40e15d1`): Dieser Bericht beschreibt den damals deaktivierten Modus und die tatsächlich gemessenen früheren Ergebnisse. Das spätere Control-vs.-Corruption-Update aktiviert den Modus und ist separat in [CONTROL-CORRUPTION.md](CONTROL-CORRUPTION.md) dokumentiert.

Stand: 24. Oktober 2026, Europe/Berlin. Dieses Update setzt das neueste Homepage-Briefing im bestehenden Projekt um. Der anschließende Wunsch bereitet einen Ein-Sekunden-Tastendruck für den späteren Modus vor; die ausdrückliche Entscheidung bleibt **`otherSideEnabled: false`**.

Die Website bleibt Vite, JavaScript, CSS und Three.js. Es wurden keine neuen Laufzeitabhängigkeiten hinzugefügt. Bestehende URLs, vorgerendertes HTML, Metadaten, der h4-Cursor, Chrome-Material, Tattoo-Reveal sowie Infinity-Bewegung und Interaktionsphysik bleiben Bestandteil der Anwendung.

## Umgesetztes Verhalten

| Bereich | Aktueller Stand |
| --- | --- |
| Homepage | Durchgehendes `#303033`, drei identisch gestaltete große Überschriften, horizontale Work-/Kontaktzeilen, keine Abschnittslinien oder weißen Linkboxen. Header-Identität und Standort bleiben außen, Tagline und Hero-Navigation unten. |
| Frühe Fly-ins | Beginn bei etwa 85% Viewporthöhe, kontinuierlicher Übergang in kurze native Sticky-Abschnitte, Richtungsbewegung von außerhalb des rechten Randes, Staffelung, starke Verzögerung und kleiner kontrollierter Überschwinger. About bleibt unpinned. Scrollen zurück und Anhalten verwenden dieselben Fortschrittswerte. |
| Typografische Nachbilder | Zwei temporäre monochrome Ebenen je Work-/Kontaktlabel, maximal `.22` und `.13` Deckkraft, begrenzter Abstand, vollständiges Verschwinden vor dem Endpunkt. Leere `aria-hidden`-Spans erzeugen dekorativen Text per CSS; Link und semantischer Text existieren einmal. |
| Hero-Tiefe | Reversible Kamera-Komposition mit maximal 8% zusätzlicher Z-Distanz und einem Grad mehr FOV, kombiniert mit zurückhaltendem Wrapper-Fade/Scale. Gespeicherte Layoutmaße und bestehende Render-Schleife; keine zweite Szene und kein Überschreiben der Logo-/Physiktransforms. WebGL pausiert weiterhin offscreen und in verdeckten Dokumenten. |
| Artwork-Übergänge | Reale Archivbilder führen über normale kanonische Links zur Detailseite. Unterstützte Browser verbinden das gewählte Bild im Übergang und bei Rücknavigation. Mehrbild-Viewer mit proportionaler Expansion/Rückkehr, Tastatur, Touch, Fokus-/Scrollwiederherstellung, Dekodierung und Fehlerzuständen. Direkte Links, reduzierte Bewegung und Browser ohne View Transitions bleiben bedienbar. |
| Versteckte Nachrichten | Unsichtbarer Besuchs-Hotspot unabhängig von den äußeren Labels exakt horizontal im Header zentriert. Hover/Tap zeigt Text mit etwa 30% Deckkraft und automatischem Ausblenden; Tastaturfokus bietet lesbaren Zugriff. Nach Kontakt sind `30svh` für den späteren Hinweis reserviert. |
| Datenschutz | Dauerhafte Besuchszählung bleibt aus. Der Fallback „nice to meet you.“ greift nicht auf Browser-Speicher zu. Persistenz erfordert sowohl Konfigurationsflag als auch gültige Consent-Anbindung; Navigation oder unmittelbares Neuladen ist kein separater Besuch. Keine externe Besuchsverfolgung. |
| Tinte | Jeder zulässige Klick/Tap erzeugt einen neuen prozeduralen Umriss mit variierenden Ausläufern, Fragmenten und Satellitentropfen. Off-white, kurze Expansion, zeitlich begrenztes Ausblenden, höchstens zwölf gleichzeitige Marken und vollständige Bereinigung. Interaktive Ziele und Scrollgesten bleiben ausgespart. |
| Zurückgestellter Modus | Gemeinsames Standardflag deaktiviert Controller-Import, Wordmark-Farbhook und öffentlichen Footer-Hinweis. Normales Charcoal bleibt erhalten. Der zukünftige Hinweis lautet exakt `press 4 for the other side.`. Der vorbereitete, inaktive Shortcut verlangt mindestens 1.000 ms kontinuierliches Halten von `4`/Numpad `4`; kurze Taps bleiben wirkungslos. |

Reduzierte Bewegung entfernt Nachbilder, dramatische Fly-ins, unnötige Pins und Kamera-Rezession. Kleine Bildschirme behalten lesbare horizontale Zeilen mit nativem Zugriff, statt die Labels in unlesbar kleine Texte zu verwandeln. Animationen verwenden überwiegend Transform und Opacity; Scrollarbeit verwendet gespeicherte Maße und geplante Frames, ohne zusätzlichen permanenten UI-Renderloop.

## Bereits ausgeführte Prüfungen

Diese Ergebnisse stammen aus diesem Refinement-Lauf. Historische PR-9-Prüfungen wurden dafür nicht übernommen.

| Prüfung | Tatsächlich bestätigtes Ergebnis |
| --- | --- |
| `npm test` | **65/65 bestanden**, einschließlich Kamera, Scroll-/Echo-Verhalten, Inhalte und Halte-Shortcut. |
| `xray-shortcut`-Unit-Suite | **6/6 bestanden**, im gemeinsamen Node-Lauf enthalten: 999/1.000-ms-Grenze, Wiederholungen, Abbruch und Cleanup. |
| `test:browser` | Bestanden für Desktop, Mobile, reduzierte Bewegung und WebGL-Fallback. |
| `test:artwork` | Bestanden: **5.766** veränderte Mesh-Pixel beim Tattoo-Reveal, **0** veränderte Pixel außerhalb des Wordmarks im Vergleich bei gleicher Pose. Das ist eine Darstellungsprüfung, keine Laufzeitmessung. |
| `test:portfolio` | Bestanden: Seiten-/Filterlinks, Verlauf und horizontale mobile Darstellung. |
| `test:micro` | Bestanden für Desktop sowie 390px und 320px. |
| `test:motion` | Bestanden: frühe Entrances, Nachbilder, Pinning, Umkehr-/Stoppzustände, native Gesten, Größenwechsel und reduzierte Bewegung. |
| `test:navigation` | Bestanden: Navigation, Import-Races, eine bestehende Szene, Scrollverlauf und Fallback. |
| `test:gallery` | Bestanden bei 1440px, 390px und 320px. |
| `test:artwork-transitions` | Bestanden für Desktop, Mobile, reduzierte Bewegung, fehlende View-Transitions-API und unterbrochene Übergänge. |
| Finale Builds | Preview und explizite Produktionskonfiguration bestanden; jeweils sechs HTML-Routen plus 404. Preview: **0** indexierbare Routen. Produktionskonfiguration: **2** (Home/About). Kein Deployment. |

### Finaler Build und gemeinsamer Node-Lauf

Der finale gemeinsame Node-Lauf besteht mit **65/65 Tests**. `npm run preview:export` führt den regulären Production-Bundle-Build samt Prerendering und anschließend den eigenständigen Offline-Export aus. Zusätzlich wurde lokal mit `H4_DEPLOYMENT=production` gebaut und vorgerendert. Beide Konfigurationen bestehen.

Die normale Website behält getrennte Chunks: UI **53,70 kB / 18,32 kB gzip**, Homepage-Three.js **597,40 kB / 153,37 kB gzip**, UI-CSS **24,99 kB / 5,63 kB gzip**. Vite meldet weiterhin die bekannte Warnung für den Three.js-Chunk über 500 kB. Die separate Offline-Datei bündelt die Skripte absichtlich; sie ist kein Abbild des initialen Transfers der normalen Website.

### Abschließende Browserprüfungen

`test:easter`, `test:xray` und `test:master` bestehen vollständig. Die kombinierten Prüfungen umfassen 320/390/768/1920px, genaue Umkehr-/Stoppzustände, verschwindende Nachbilder, Kamera-Rückkehr, ursprüngliche Header-Inset-Positionen, horizontal nutzbare Zeilen, Tastatur, Touch, reduzierte Bewegung, Tinten-Cleanup und Speicherschutz.

Der deaktivierte Modus wurde auf Home/Work/About geprüft: keine öffentlichen Hinweise, Filter oder Mode-Ressourcen. Eine ausdrücklich isolierte Entwicklungsfixture prüft den alten Controller mit echten Tastaturereignissen: 850 ms plus Loslassen bleibt wirkungslos; mindestens 1.000 ms aktiviert einmal, Wiederholungen bleiben ohne zweiten Toggle, ein neuer vollständiger Hold kehrt zurück. Blur und Dispose brechen ab. Die öffentliche Konfiguration wird dafür nicht verändert. Auf dem gebauten Server wird nur diese Source-Import-Fixture ausdrücklich übersprungen; die Prüfungen des deaktivierten öffentlichen Modus bestehen dort ebenfalls.

`test:seo` besteht gegen beide finalen gebauten Konfigurationen: sechs direkte HTML-Routen ohne JavaScript, echte 301/404-Antworten, Metadaten, Canonicals für `https://h4ngelic.com`, Sitemap/Robots und Refresh-Navigation. Direkte Work-/About-Aufrufe laden und starten keine 3D-Szene.

Die aktualisierte Offline-Datei besteht WebGL-, Tagline-, Kategorie-/Filter-, About-, Kontakt- und Home-Navigationstests mit **0 externen HTTP-Anfragen und 0 Laufzeitfehlern**. Auch ein langer 4-Hold aktiviert darin keinen Modus. ZIP-Integrität und identische enthaltene HTML-Bytes wurden überprüft.

Die Browserprüfungen verwenden Chromium und bei WebGL Software-Rendering. Sie ersetzen keine Abnahme auf einem physischen Telefon oder in Safari. Temporäre Testbilder stammen aus bereits geliefertem Material und werden nicht als Portfolio-Projekte veröffentlicht.

## Neue Leistungsmessung

Frisch gemessen am **24. Oktober 2026** gegen den eingefrorenen PR-9-Build **`9a46686`** und den aktuellen Build von `feat/homepage-motion-refinement` (`index-DX2Yi8zA.js`, `main-DzSND93U.js`). Die erste Messreihe lief Baseline → Final; die Bestätigung lief Final → Baseline. Alle Ergebnisse bleiben erhalten: **sechs kalte Home-Läufe und zwei Work-Läufe je Build**, unten jeweils der Median.

Bedingungen: **Lighthouse 13.5.0**, **Chromium 154**, **SwiftShader-Software-GPU**, simuliertes mobiles Slow 4G, **4× CPU-Drosselung**, 412×823px bei DPR 1,75. Keine anderen Browserprüfungen liefen parallel. Keine Lighthouse-Laufzeitwarnungen.

| Messwert | Home vorher | Home aktuell | Work vorher | Work aktuell |
| --- | ---: | ---: | ---: | ---: |
| Performance-Score | 71 | 71 | 100 | 100 |
| FCP | 1.505 ms | 1.524 ms | 1.115 ms | 1.111 ms |
| LCP | 2.105 ms | 2.103 ms | 1.121 ms | 1.111 ms |
| TBT | 1.882 ms | 2.084 ms | 0 ms | 0 ms |
| CLS | 0,00239 | 0,00239 | 0 | 0 |
| Gesamter Transfer | 342.642 B | 342.756 B | 29.357 B | 29.223 B |
| JavaScript-Transfer | 170.560 B | 171.033 B | 18.248 B | 18.484 B |
| Anfragen | 8 | 8 | 4 | 4 |

Score, LCP und CLS bleiben im Median vergleichbar. **Die Home-TBT steigt um 202 ms (10,7%)**; das ist keine nachgewiesene Performance-Verbesserung. Die Home-Einzelwerte liegen vorher bei 1.752–1.980 ms und aktuell bei 1.834–2.208 ms, Scores vorher 71–72 und aktuell 70–71. Die Long-Task-Zuordnung zeigt den bestehenden Three.js-Homepage-Chunk als größten CPU-Kostenblock. Die Messung isoliert keine einzelne Ursache des TBT-Unterschieds. CPU-Startkosten des Heroes bleiben ein Leistungsrisiko und sind ausdrücklich kein grüner Performance-Nachweis für reale Mobilgeräte.

Die Messung liefert keine Feld-INP-Werte, echten Telefon-FPS oder Safari-Garantie. Sichtbarkeits-/Tab-Pausierung, Geräteprofil/DPR und das Ausbleiben von Three.js auf Innenrouten wurden zusätzlich funktional im Browser geprüft.

Maschinenlesbare [Gesamtauswertung](performance/refinement-comparison.json) mit Medianen, Bereichen und Provenienz; vollständige kompakte Laufzusammenfassungen: [Baseline](performance/refinement-baseline-summary.json), [Final](performance/refinement-final-summary.json), [Bestätigung Final](performance/refinement-confirm-final-summary.json), [Bestätigung Baseline](performance/refinement-confirm-baseline-summary.json). Die großen rohen Lighthouse-Berichte bleiben in `artifacts/performance/` und lassen sich über `npm run measure:performance` erneut erzeugen.

Die tatsächlichen älteren Werte bleiben in [MASTER-PERFORMANCE.md](MASTER-PERFORMANCE.md) und den dort verlinkten JSON-Dateien erhalten. Sie beschreiben einen früheren Stand mit aktivem alternativem Modus und gelten nicht als Messung dieser Änderung. Ein leeres Archiv bildet außerdem kein zukünftiges Portfolio mit vielen echten Bildern ab.

## Vorschau und Review

Aktuelle interaktive [Offline-Vorschau als ZIP](previews/portfolio-preview.zip): vollständig entpacken und `h4ngelic-preview.html` im aktuellen Browser öffnen. Stand **24. Oktober 2026**, geprüft ohne externe Netzwerkzugriffe. Das ZIP enthält zusätzlich eine deutsche Anleitung; 1.192.617 Byte ZIP, 2.094.108 Byte HTML.

Aktualisierte Standbilder: [Homepage](previews/homepage.png), [390px mobil](previews/mobile.png), [320px mobil](previews/mobile-320.png), [Work](previews/work.png), [About](previews/about.png), [Fly-in mit Nachbildern](previews/motion-midway.png), [Hero-Tiefe](previews/hero-depth.png), [Besuchsnachricht Desktop](previews/homepage-visitor.png) und [mobil](previews/mobile-visitor.png). Die vollständigen statischen Seitenbilder verwenden reduzierte Bewegung, damit alle Inhalte lesbar im Endzustand erscheinen; Fly-in und Hero-Tiefe wurden mit normaler Bewegung aufgenommen.

Review-Branch: `feat/homepage-motion-refinement`, Basis `feat/final-integration`. [Pull Request #10](https://github.com/h333ndrik/h4ngelic/pull/10). Der lokale Browser-Preview läuft während der Cloud-Sitzung auf Port 4211; das ZIP ist die übertragbare interaktive Vorschau und benötigt keinen Server.

Es wurde nichts nach `main` zusammengeführt, nichts produktiv deployt und keine Domain-/DNS-Einstellung verändert.

## Bearbeitung und offene Inhalte

Das Work-Archiv ist weiterhin ehrlich leer; es enthält keine Stockbilder oder erfundenen Projekte. Reale Arbeiten samt Alt-Text, Beschreibungen und Maßen werden in `src/data/artworks.js` ergänzt. Die wiederverwendbaren Bildübergänge aktivieren sich aus diesen Daten automatisch. Kontakt- und Buchungsziele bleiben unkonfiguriert, bis die tatsächlichen Adressen vorliegen. Das vorhandene Tattoo-Reflexionsmotiv wird nicht automatisch als Portfolioeintrag veröffentlicht.

- [CONTENT.md](CONTENT.md): Projekte, Bilder, About, Kontakt und zentrale Konfiguration.
- [MOTION.md](MOTION.md): frühe Scrollbereiche, Pins, Nachbilder und Hero-Kamera.
- [ARTWORK-TRANSITIONS.md](ARTWORK-TRANSITIONS.md): echte Bilddaten, Navigation, Viewer und Fallbacks.
- [EASTER-EGGS.md](EASTER-EGGS.md): Nachrichten, Tinte und Consent-/Speicherschutz.
- [XRAY.md](XRAY.md): deaktivierter Modus, künftige Freigabegrenze und vorbereiteter Halte-Shortcut.
- [SEO.md](SEO.md): Prerendering, Indexierungsregeln und späteres Hosting.

Eine spätere öffentliche Modusfreigabe ist eine eigene Aufgabe. Für dieses Refinement bleiben der Modus, sein Material-Hook und sein öffentlicher Hinweis deaktiviert.
