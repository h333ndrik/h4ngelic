# Control vs. Corruption — 24. Oktober 2026

Stand: 24. Oktober 2026, Europe/Berlin. Feature-Branch `feat/control-corruption`, aufbauend auf PR #10 / `40e15d1`. Die neueste Anweisung aktiviert The Other Side und erweitert die bestehende Website; die vorherige Entscheidung „vorbereiten, deaktiviert lassen“ ist damit abgelöst. Frühere Messungen und Freigabestände bleiben in ihren historischen Berichten erhalten.

## Umgesetzte Funktionen

| Bereich | Verhalten und technische Umsetzung |
| --- | --- |
| Normal Mode | Charcoal `#303033`, vorhandene `h4ngelic`-Geometrie mit Tiefe `.455`, Chrome-/Tattoo-Material, Infinity-/X-/Y-Bewegung, Interaktionsphysik, h4-Cursor, Navigation und SEO bleiben Grundlage. |
| Aktivierung | `otherSideEnabled: true`. Haupttastatur-/Numpad-`4` mindestens 1.000ms halten; kurzes Loslassen bricht ab, Wiederholungen lösen keinen zweiten Wechsel aus. Blur, verdecktes Dokument, Eingabefelder und Navigation brechen einen unfertigen Hold ab. |
| Mobile und Assistenz | Derselbe versteckte Footer-Hotspot bietet einen stationären Ein-Sekunden-Pointer-/Touch-Hold. Bewegung/Scrollen bricht ab; kurze Taps entdecken nur die Anweisung. Native Button-Aktivierung bleibt als untimed Tastatur-/Assistenzalternative verfügbar. |
| Moduswechsel | Vorhandener 650ms-Übergang verbindet Farbkurven, Kanalversatz, Film und Wordmark-Material. Das normale Seiten-DOM bleibt benutzbar; reduzierte Bewegung verwendet einen einfacheren Wechsel. |
| Filmoberfläche | Original generierte lokale Filmtextur mit ausgebrannten weißen Inseln, blauen/violetten Dichten, grünen chemischen Flecken und unregelmäßigem Materialschaden. Keine dekorative Kachel und kein bloßer Farbverlauf. Ressourcen werden erst bei Entdeckung vorgeladen. |
| Cursor-Korruption | Canvas2D kopiert tatsächliche Film-/Fotopixel und vorherige beschädigte Pixel in verschobene Makroblöcke und horizontale Streifen. Schnelle Bewegung erzeugt mehr Schaden/Nachziehen; verankerte Regionen heilen anschließend aus. Höchstens zwei begrenzte Regionen, keine Partikel-Konfetti und keine zweite Three.js-Szene. |
| Wordmark | Verketteter Material-Hook mit objektlokaler Filmtextur, Korrosion, kleinen Randverlusten, magentafarbenen Säumen und heißen weißen Highlights. Die bestehende Textgeometrie, Pose, Physik und Tattoo-Reflexion bleiben erhalten. Der SVG-Cursor bleibt erkennbar. |
| Kristallklang | Zwei verwandte lokal synthetisierte Stereo-Klänge, jeweils 0,7s: leicht ansteigender Eintritt und absteigende Rückkehr, inharmonische Metall-/Glasresonanzen mit kurzem Nachklang. Trusted Input bereitet Audio vor, tatsächlicher Moduswechsel spielt ab. Mute, überlappungsfreie Stimmenbereinigung und Audiofehler-Fallback sind vorhanden. |
| Hover und Pfeile | Gemeinsame innere Vergrößerung bis 122%, große Spaltenlabels platzabhängig bis 120%, Fotos 108%; stabile Trefferflächen. Weißer Normal-Glow, stärkere weiße/grün/violett/magenta Säume im alternativen Modus. Einheitliche `.72em`-Pfeile mit `1.25px` Strich und engem responsivem Abstand. Geheime Hotspots bleiben davon ausgenommen. |
| Editorial-Bewegung | Frühe scrollgebundene Fly-ins, kurze native Pins, natürliche bestehende Verzögerung und präzise Umkehr bleiben bestehen. Die zwei temporären Textnachbilder verschwinden vor dem Endzustand. Hauptüberschriften sind `01 / SELECTED WORKS`, `02 / ABOUT`, `03 / CONTACT`; `MORE ABOUT` ist 24–44px groß. |
| Geheimtexte | Begrüßung weiterhin exakt oben in der Mitte, nun 14/12px. Footer-Anweisung unter Kontakt bei 40% des `30svh`-Freiraums: `HOLD 4 TO SEE THE OTHER SIDE.` bzw. `HOLD 4 TO REVERSE.`. Beide bleiben im Ruhezustand unsichtbar und erscheinen kurz mit 35% Deckkraft. |
| Besuchszähler | Separater versteckter `VISIT 001`-Zähler ganz unten im Homepage-Footer. Lokale Speicherung ist jetzt standardmäßig an; nur `{ count, lastSeen }`, 30min Inaktivität zur Besuchstrennung, keine Reload-/Navigationsinflation. Opt-out, optionale Host-Consent-Anbindung und Speicherfehler-Fallback bleiben möglich. |
| Tinte | Neue prozedurale flüssige Kontur/Fragmente/Tropfen je gültigem Klick. Dokumentverankert, 6–12s sichtbar mit Ausbreitung/Fade, höchstens zwölf aktive Marken. Normal off-white, alternativ negative Farben. Interaktive Ziele und Scrollgesten bleiben ausgespart. |

## Referenzen und gestalterische Grenzen

Gesichtet wurden die violette Tattoo-/Arm-Negativaufnahme, der cyan/grün/gelb-orange Körper-Falschfarbenlook, das dreigeteilte Film-Burn/Makroblock/Smear-Bild und das etwa sechs Sekunden lange zusätzliche Video. Das Video zeigt insbesondere erhaltene frühere Bildfragmente, zerrissene Blockgrenzen, weiß überbelichtete Regionen und violett-grüne Negativfarben.

Die im Brief angekündigten Referenzen 03 (chemische Filmlandschaft) und 05 (zerstörter blau-violett-weißer Film) wurden bis zu diesem Stand nicht geliefert. Auf die ausdrückliche Anweisung „weiter bzw. fertig“ hin basiert die erste Filmgestaltung auf den tatsächlich erhaltenen Referenzen und der schriftlichen Richtung. Die originale generierte Filmtextur ist ein Gestaltungshintergrund, kein als eigenes Tattoo ausgegebenes Referenzbild oder Portfolio-Projekt. Eine spätere Vorlage kann das Material gezielt verändern; es wurde keine Sichtung der fehlenden Dateien behauptet.

Die lokale Korruption nutzt die im Brief erlaubten dedizierten Bildflächen. Der Renderer macht keinen Screenshot beliebiger DOM-Inhalte und zerlegt keine echte Video-Codec-Bitstream-Struktur. Datamosh-artiges Verhalten entsteht aus realer Pixelverschiebung und temporaler Bildhistorie. Texte, Navigation und Formelemente bleiben echte, erreichbare DOM-Elemente. Fotos benötigen lokale oder CORS-lesbare Pixel; anderenfalls bleibt ihre normale Darstellung verfügbar. Es gibt keinen neuen globalen Liquid-Warp im Normal Mode, keine Cursor-Morphs, Ghost-Artworks, geheimen Archivseiten oder zusätzlichen Spiele.

Das reale Portfolio ist weiterhin leer. Bildkorruption und die bereits vorhandenen Galerie-/Detailübergänge werden mit bereitgestelltem Material in Browser-Fixtures geprüft und aktivieren sich für echte Projekte aus `src/data/artworks.js`. Kontaktziele bleiben leer, bis tatsächliche Instagram-/E-Mail-/Buchungsziele vorliegen. Es wurden keine Projekte, Adressen oder Stockbilder erfunden.

## Dateien und Abhängigkeiten

Die Website bleibt Vanilla JavaScript, CSS, Vite und Three.js. Es wurden **keine neuen Laufzeitabhängigkeiten** hinzugefügt.

- Modus/Eingabe/Klang: `src/xray.js`, `src/xray-shortcut.js`, `src/mode-hold.js`, `src/mode-audio.js` und zugehörige Datendateien.
- Bildkorruption: `src/corruption-lifecycle.js`, `src/corruption.js`, `src/corruption-field.js`, `src/corruption.css`, `src/data/corruptionSettings.js` und lokale Film-WebPs.
- Bestehender Hero: `src/main.js` und `src/wordmark-xray.js`; keine neue Wordmark-Geometrie oder zweite Szene.
- UI/Inhalte: `src/interactions.js/.css`, `src/style.css`, `src/homepage.css`, `src/data/uiEffectSettings.js`, `src/data/siteContent.js`.
- Geheimtexte/Tinte: `src/footer.js`, `src/easter-eggs.js/.css`, `src/data/easterSettings.js`.
- Prüfungen, Sound-/Offline-Export und Dokumentation ergänzen diese Änderungen.

## Stärke später verändern

| Datei | Editierbare Werte |
| --- | --- |
| `src/data/corruptionSettings.js` | `distressIntensity`, `filmBurnIntensity`, `grainIntensity`, `colorCorruption`, `pixelCorruption`, `glowStrength`, `smearingIntensity`, `recoveryMs`, `recoverySpeed`, Impuls- und Qualitätsgrenzen |
| `src/data/xraySettings.js` | Farbpalette, Sättigung, neunwertige Farbkurven, Kanalversatz, `shortcutHoldMs: 1000`, `transitionMs: 650` |
| `src/data/modeAudioSettings.js` | 0,7s Dauer, Lautstärke `.3`, PCM-Maximalpegel `.68`, Grundton, Teiltöne, Ausklang, Ein-/Austrittsverlauf und frühe Reflexionen |
| `src/data/uiEffectSettings.js` | Hover-Skalen/Glow, 3px Magnetbewegung, Pfeildimensionen/-abstand/-strich |
| `src/data/easterSettings.js` | Zwei-Sekunden-Hinweis, 6–12s Tinte, Höchstzahl zwölf, Besuchsspeicher/Trennintervall/optionale Consent-Policy |
| `src/data/siteContent.js` | Kategorien, Überschriften, About und tatsächliche Kontaktziele |

Die Standardintensität liegt meist bei `1`; Körnung bei `.7`. `0` entfernt den jeweiligen Beitrag, nicht alle unabhängigen Effekte. Die Standard-Ausheilzeit `1600ms` wird geschwindigkeitsabhängig verlängert; höhere `recoverySpeed` beschleunigt die Rückkehr. Die Hintergrunddateien sind austauschbare optimierte lokale Assets. Eine Anpassung an mehreren Stärkeparametern benötigt keine Bearbeitung komplexer Komponenten. [XRAY.md](XRAY.md), [CONTENT.md](CONTENT.md) und [MOTION.md](MOTION.md) erläutern die Zuordnung.

## Tatsächlich bestätigte Prüfungen

- **`npm test`: 88/88 bestanden** nach der finalen Integration (0 Fehler/übersprungene Tests; 1,49s). Einschließlich PCM-Pegel/Ausklang, Eingabe-Abbruch, Velocity-/Impulsgrenzen, verankerte Recovery, deterministische Blockwerte, UI-Fit und Inhalts-/SEO-/Physikprüfungen.
- **Mode-/Audio-Browserprüfung bestanden:** echter Eingabe-Context, stummer kurzer Hold, tatsächliche 0,7s AudioBuffer, Wiedergabe zum Moduswechsel, Repeat-Latch, Stimme endet, Mute über Navigation, nicht unterstütztes Audio und keine Innenrouten-3D-Anfragen.
- **Easter-Browserprüfung bestanden:** 1440/390/320px, Geheimtexte, getrennte Counterposition, 6–12s-Tinten-Cleanup, tatsächliche Scroll-Verankerung, lokale Besuchstrennung, Speicherfehler, Opt-out und optionaler Consent-Gate.
- **Hover-Browserprüfung bestanden:** tatsächliche 120/122%-Skalen, statische Trefferflächen, Glow, dynamische Kontrolltexte, Pfeile, Secret-Ausnahmen und mobile/reduzierte Bewegung. Eine feste Testwartezeit wurde durch Warten auf den tatsächlichen Transform ersetzt; kein Laufzeitfehler war dafür nachgewiesen.

### Finale Browser- und Integrationsabnahme

Alle **16 unterschiedlichen Browser-Testreihen** sind bestanden: `browser`, `artwork`, `portfolio`, `microinteractions`, `gallery`, `artwork-transitions`, `scroll`, `navigation`, `easter`, `xray`, `master`, `mode-audio`, `hover`, `corruption`, `wordmark-corruption` und `seo`. Die erste Gruppe lief gegen den eingefrorenen Entwicklungsstand; SEO zusätzlich gegen beide endgültigen Builds. [Regressionsergebnisse](performance/control-browser-results.json), [Korruptionsdaten](performance/control-corruption-results.json).

Die neue Korruptionsprüfung bestätigt tatsächliche Film-/Fotopixel und historische Canvas-Pixel, keine gefüllten Partikelrechtecke, stärkeren Schaden bei schneller Bewegung, verankertes Ausheilen, höchstens zwei Regionen, native Dialog-Einbettung, Leerlauf-Stopp und Cleanup bei Modus-/Seiten-/Tab-/Reduced-Motion-Wechseln. Echte Touch-Ereignisse erzeugen bei **390px und 320px** Bildschäden; Seitenbreite, Links und Lesbarkeit bleiben erhalten. Foto-/Galerieprüfungen verwenden ausschließlich bereitgestelltes Material in Test-Fixtures; das öffentliche Archiv bleibt leer.

Die kalte erste Aktivierung lädt den vorher nicht angefragten Wordmark-Hook und verändert **108.116 von 109.453 Mesh-Pixeln** in einer festen Pose. Nach der Rückkehr ist die mittlere Kanalabweichung zum ursprünglichen Chrome-Bild **0**; Pose, Orientierung und Kamera stimmen ebenfalls überein. Keine Shader- oder JavaScript-Fehler. Eine zu frühe Testabfrage im Lite-Profil wurde auf das Ende der tatsächlichen CSS-Farbüberblendung umgestellt; der Laufzeitcode musste dafür nicht geändert werden.

### Finaler Build, Assets und gemeinsame Tests

`npm run preview:export` und der separate explizite Production-Build sind erfolgreich. Beide prerendern sechs Dokumentrouten plus eine echte 404-Seite. Preview: null indexierbare Routen; Production-Konfiguration: Homepage und About indexierbar, leere Archive weiterhin `noindex`. Beide strikten HTTP-/No-JS-SEO-Prüfungen bestätigen Canonicals auf `https://h4ngelic.com`, Metadaten, Redirects, Statuscodes, Sitemap und Robots. Der Production-Build liegt ausschließlich lokal in `/tmp/h4-control-production`; dies ist keine Veröffentlichung.

Der reguläre Build behält getrennte Chunks: Einstieg **60,35kB / 20,46kB gzip**, bedarfsgeladener Hero **597,86kB / 153,55kB gzip**, erst bei Entdeckung geladene Korruption **10,84kB / 4,51kB gzip**. Die bestehende >500kB-Three.js-Warnung bleibt; Innenrouten fragen den Hero nicht an. Nur der Offline-Export kombiniert aus technischen Gründen alle Module (689,44kB JavaScript vor Einbettung der lokalen Assets). Keine neuen Abhängigkeiten.

Optimierte Filmdateien: **896×1344px / 244.514 Bytes** am Desktop und **512×768px / 87.338 Bytes** für Touch-/kleinere Geräte. Das Bildskript findet weiterhin null veröffentlichte Portfolio-/Portraitbilder und erfindet keine Inhalte.

## Leistung und Ressourcen

Film und Canvas-Code laden erst bei Entdeckung; die normale erste Seite erhält keine Effekt-Canvases. Die bestehende Homepage behält ihr bedarfsgeladenes Three.js-Modul, Offscreen-/Tab-Pausierung und Geräte-DPR-Begrenzung. Work/About verwenden bei aktiviertem Modus kleine Canvas2D-Flächen und laden keine zusätzliche 3D-Szene, Hero-Schrift oder Tattoo-Hero-Textur.

Die interaktive Standardgrenze ist zwei Regionen, jeweils höchstens 620×420px auf Desktop oder 360×300px mobil, DPR 1 und 30 Paint-Frames/s. Gezeichnet werden nur ausstehende Bewegungen und ausheilende Felder; anschließend stoppt der RAF vollständig. Blockbudget, Bildvorbereitung und bestehende Geräteprofile begrenzen Aufwand. Foto-Pixel werden einmal vorbereitet; es gibt kein `getImageData()` pro Pointermove. Reduzierte Bewegung schaltet interaktive Korruption aus. Diese technischen Grenzen allein beweisen keine reale Telefon-Framerate.

Frische kalte Navigationen gegen den eingefrorenen Stand **`40e15d1`** und den finalen Build, jeweils **drei Homepage-Läufe und ein Work-Lauf**, seriell ohne parallele Browser. Lighthouse **13.5.0**, Headless Chromium **154**, SwiftShader-Software-GPU; mobile Emulation **412×823 / DPR 1,75**, simuliert **150ms RTT / 1638,4kbit/s / 4× CPU-Verlangsamung**. Die Tabelle zeigt Homepage-Mediane bzw. den einzelnen Work-Lauf. Alle acht Berichte waren gültig, ohne Lighthouse-Warnungen.

| Messwert | Homepage vorher → nachher | Work vorher → nachher |
| --- | --- | --- |
| Performance-Punkte | 72 → **69** | 100 → **100** |
| FCP | 1.504 → **1.654ms** | 1.054 → **1.262ms** |
| LCP | 2.104 → **2.404ms** | 1.054 → **1.406ms** |
| Total Blocking Time | 1.745 → **1.897ms** | 0 → **0ms** |
| Layout Shift | .002386 → **.002386** | 0 → **0** |
| Übertragene Bytes gesamt | 342.756 → **353.810** | 29.223 → **39.885** |
| JavaScript-Transfer | 171.033 → **179.907 Bytes** | 18.484 → **27.188 Bytes** |
| Anfragen | 8 → **11** | 4 → **7** |

Das ist ein gemessener zusätzlicher Ladeaufwand: Homepage **+11.054 Bytes**, LCP **+300ms**, TBT **+152ms**, drei Punkte weniger. Der aktivierte Eingabe-/Audio-/Farbcontroller und seine geteilten Einstellungen/CSS verursachen zusätzliche frühe Anfragen; Film, Korruptionsrenderer und Wordmark-Schadensmaterial fehlen weiterhin vollständig in den initialen Netzwerkanfragen. Das vorhandene Three.js-Heromodul bleibt der größte CPU-Anteil. Work erreicht weiterhin 100 Punkte und lädt keinen Hero. Der einzelne Work-Lauf und drei Home-Läufe erlauben keine Aussagen über reale Besucher oder eine langfristige Streuung.

Exakte Einzelwerte, Versionen, Einstellungen, Anfragebelege und Spannweiten: [Baseline](performance/control-baseline-summary.json), [Final](performance/control-final-summary.json), [Vergleich](performance/control-comparison.json). Frühere PR-Messungen sind nicht in diese neuen Mediane eingerechnet.

Separate instrumentierte Desktop-Prüfung der **aktiven Korruption**: 156 Controller-Zeitschritte, **Median 0,90ms / p95 2,60ms / Maximum 58,80ms** CPU-Dauer. Darin steckt auch die erstmalige Fotovorbereitung; diese kann einen einzelnen längeren Zeitschritt verursachen. Das Blockbudget reduzierte sich dabei von 160 auf 136. Diese Werte messen Controller-Arbeit, keine GPU-/Compositor-Zeit und keine Bildrate. Nach dem Ausheilen stoppt die Effekt-RAF; identische Pointer-Koordinaten starten sie nicht neu. Mobile Touch-Prüfungen bestätigen tatsächliche Pixel, kleinere Assets, Regionsgrenzen, Recovery und Cleanup, beweisen aber keine reale Telefon-Framerate.

Die Homepage hat unter simulierter langsamer CPU weiterhin erhebliche TBT durch den bestehenden 3D-Hero. Physische schwache Telefone, Safari/Web-Audio-Besonderheiten und Feld-INP wurden in dieser Chromium-Umgebung nicht gemessen. Das Effektbudget und Reduced-Motion-Verhalten begrenzen Arbeit; sie ersetzen diese späteren Geräteprüfungen nicht.

## Vorschau und Review

Die aktuelle [Offline-Vorschau als ZIP](previews/portfolio-preview.zip) enthält die exakt geprüfte `h4ngelic-preview.html`, eine deutsche Anleitung und beide Hörproben. ZIP **1.736.078 Bytes**, HTML **2.567.714 Bytes**; Integrität und Byte-Übereinstimmung wurden nach dem Verpacken geprüft. Die Datei funktioniert bei **1440/390/320px ohne HTTP-Anfragen und ohne JavaScript-Laufzeitfehler**. Geprüft wurden WebGL, kurzer/Ein-Sekunden-Hold, nativer mobiler Hold, Modushinweis, Film, Mute, Kategorie-/About-/Contact-Navigation und Rückkehr. [Maschinenlesbarer Vorschau- und Verpackungsnachweis](previews/control-preview-results.json).

Aktuelle Standbilder: [Normaler Hero](previews/homepage-hero.png), [The Other Side](previews/homepage-hero-xray.png), [390px](previews/mobile-hero-xray.png), [320px](previews/mobile-320-hero-xray.png), [mobiler Kontakt](previews/mobile-contact-xray.png), [Work](previews/work-xray.png), [About](previews/about-xray.png) und [tatsächlicher Cursor-Bildschaden](previews/control-cursor-corruption.png). Die gepaarten Hero-Bilder verwenden dieselbe pausierte Pose. Bei 320px ist das dritte Kontaktlabel zunächst teilweise im vorgesehenen horizontalen Scroller; es bleibt erreichbar und erzeugt keinen Seitenüberlauf. Vollseitige Bilder können einen fixierten Filmhintergrund nur an ihrer ursprünglichen Viewport-Position zeigen; gesonderte Viewport-Aufnahmen prüfen die wirkliche Scroll-Komposition. Zusätzliche Aufnahmen bleiben im ignorierten Ausführungsordner, wesentliche Paare sind eingecheckt.

Hörproben aus denselben PCM-/Lautstärkeeinstellungen: [Eintritt](previews/other-side-enter.wav), [Rückkehr](previews/other-side-leave.wav), jeweils **0,7s / 48kHz / Stereo / 134.444 Bytes**. Die Website erzeugt die Klänge selbst und lädt diese Review-WAVs nicht herunter.

[Pull Request #11](https://github.com/h333ndrik/h4ngelic/pull/11) auf dem separaten Branch `feat/control-corruption`, Basis `feat/homepage-motion-refinement` (PR #10). Kein Merge in `main`, keine Produktionsveröffentlichung und keine DNS-Änderung.

Die frühere [REFINEMENT-REPORT.md](REFINEMENT-REPORT.md) bleibt ein historischer PR-10-Snapshot. [FINAL-REPORT.md](FINAL-REPORT.md) und [MASTER-PERFORMANCE.md](MASTER-PERFORMANCE.md) behalten ihren älteren PR-9-Kontext. Die Werte dieser Berichte sind keine Ersatzmessung für die neue aktive Bildkorruption.
