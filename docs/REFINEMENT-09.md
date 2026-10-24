# Refinement 09 — Control / Corruption

Abnahme: 25. Oktober 2026, Europe/Berlin. Feature-Branch `feat/refinement-09`, Ausgangs- und Rückrollstand `2945c3bc0d16efec77cf1325a436ccd35c9a087c` auf `feat/control-corruption` / [PR #11](https://github.com/h333ndrik/h4ngelic/pull/11). Die zugehörigen UTC-Protokolle tragen teilweise noch den 24. Oktober.

**Refinement 09 ist implementiert und geprüft:** 104 Node-Tests, 24 Browser-Testreihen, optimierter Build, strikte Preview-SEO-Prüfung und aktualisierte HTML-/ZIP-Vorschau. Der echte Seitenpixel-Übergang umfasst Schrift und native Modalbilder. Die Klangüberarbeitung entfällt auf ausdrücklichen Wunsch des Nutzers; die bisherigen Klänge bleiben erhalten. Die Software-GPU-Messung zeigt trotz 720–920ms konfigurierter Übergangsdauer tatsächliche Controller-Abschlüsse bis 1.476ms; diese Grenze wird unten ausdrücklich ausgewiesen. [CONTROL-CORRUPTION.md](CONTROL-CORRUPTION.md), [LOADING-REFINEMENT.md](LOADING-REFINEMENT.md) und die früheren PR-Berichte bleiben historische Messstände.

## Auftrag und erhaltene Grundlage

Die bestehende Website wurde weiterentwickelt. Homepage, horizontale Werk-Kategorien, Work-/About-Routen, Inhalte und Navigation bleiben erhalten. Der vorhandene Chrome-Hero, seine reduzierte Extrusion, Infinity-Bewegung, X-/Y-Rotation und Interaktionsphysik wurden nicht neu gebaut. `src/main.js` und `src/wordmark-xray.js` bleiben byteidentisch zum Ausgangsstand. Es wurden keine Abhängigkeiten hinzugefügt.

Die neueste Ergänzung zu Phase 4.4 verlangt ausdrücklich eine Beschädigung der **wirklich sichtbaren Seite**: Schrift, Bilder und Hintergrund sollen als erfasste Bildinformation in versetzten Makroblöcken, horizontalen Schmieren und getrennten Farbkanälen aufbrechen. Ein separat darübergelegtes Rechteck- oder Farbglitch reicht nicht. Der Wechsel soll nach ungefähr 0,6–1,0 Sekunden auflösen; `333` erhält eine eigenständige Rekonstruktion. Die funktionierende Other-Side-Wordmark bleibt erhalten.

## Phasen und tatsächlicher Stand

| Phase | Stand | Abnahme |
| --- | --- | --- |
| 0 — Audit | Abgeschlossen | Architektur, Eingaben, Modus, Cursor, Footer, Tinte, Klang und vorhandene Prüfungen gesichtet; sauberer Ausgangsstand und separater Branch. |
| 1 — Eingabe und Hinweise | Implementiert und geprüft | Desktop 1440px, 390px, 320px sowie zusätzliche editierbare Rollen; Navigationsrennen behoben und erneut geprüft. |
| 2 — Layout und Bewegung | Implementiert und geprüft | Footer, obere Soundkontrolle und Layout auf 1440/390/320px; Scrollregression zusätzlich bis 1920px. |
| 3 — Cursor und Favicons | Implementiert und geprüft | Desktop, Reduced Motion, Touch 390/320px; Originaldateien, Hotspots und null Alphamasken-Abweichung bestätigt. |
| 4 — Film, lokale Korruption, Seitenübergang | Implementiert und geprüft | Echte Schrift- und native Modalbildpixel nachgewiesen; beide Wechsel auf Home/Work; Ambient 1000/390/320px, Ressourcenlauf und aktuelle Aufnahmen bestätigt. |
| 5 — Digitale Tinte | Implementiert und geprüft | Echte Materialpixel und vier Farbfelder, natürliche Lebensdauer, Anker, Limit zwölf, Kinderanimationen und Controls auf 1440/390/320px bestätigt. |
| 6 — Hover | Erhalten und geprüft | Gemeinsame Skalen/Glows, feste Trefferflächen, Pfeile, Keyboard, Touch und Reduced Motion bestätigt. |
| 7 — Glasbruchklang | Auf Nutzerwunsch ausgelassen | Keine neue Synthese; vorhandener Code, Einstellungen und WAVs bleiben byteidentisch. Die obere Mute-Kontrolle aus Phase 2 bleibt. |
| 8 — Gesamtprüfung und Lieferung | Geprüft und verpackt | 104 Node-Tests, 24 Browserreihen, Build/SEO, neue Messungen, bytegeprüfte Offline-HTML-/ZIP-Vorschau; Review-Link unten. |

### Phase 1: verlässlicher Moduswechsel

- `4` muss mindestens **1.000ms** durchgehend gehalten werden und aktiviert ausschließlich The Other Side. Frühes Loslassen bricht ab, Repeat erzeugt keinen zweiten Wechsel. Haupttastatur und Numpad funktionieren.
- Zurück geht es ausschließlich mit drei getrennten `3`-Drücken einschließlich Loslassen innerhalb eines festen **2.000ms**-Fensters. Eine gehaltene `3` zählt einmal. Ablauf, Blur, verborgenes Dokument, Navigation und ungeeignete Eingabekontexte verwerfen den begonnenen Vorgang.
- Eingabefelder, `contenteditable`, Komposition, Modifikatoren und editierbare ARIA-Rollen bleiben nutzbar. Die zusätzlichen Browserprüfungen bestätigen auch, dass deren Eingaben nicht mit `preventDefault()` verschluckt werden.
- Navigation bricht die Eingabe bereits beim Start ab. Damit ist das nachgewiesene Rennen „zweimal `3`, navigieren, einmal `3`“ geschlossen; ein erst später eintreffendes Seitenereignis kann die alte Folge nicht beenden.
- Der vorhandene stationäre Touch-Hotspot bleibt erreichbar. Sein Ein-Sekunden-Hold und die native Button-Aktivierung als Tastatur-/Assistenzalternative bleiben erhalten.
- Normal lautet der dezente Hinweis exakt `HOLD 4 TO SEE THE OTHER SIDE.`. In The Other Side bleibt `PRESS 3 THREE TIMES TO REVERSE.` hell, sichtbar und an derselben Position. Die Normal-Fläche einschließlich Body erbt wieder exakt `#303033`.

Nachweis: [gemeinsames Ergebnisarchiv](previews/ref09/verification.json), Bereich `foundation`. Die neue [Reverse-Unit-Prüfung](../tests/reverse-shortcut.test.js), [Foundation-Browserprüfung](../tests/ref09-foundation-browser.mjs) und [Prüfung editierbarer Rollen](../tests/ref09-editable-browser.mjs) bilden diese Fälle ab.

### Phase 2: Footer, Bedienelemente und Scrollbewegung

Die Footer-Identitätszeile ordnet Copyright links, `VISIT ###` in der mathematischen Mitte und `berlin, de` rechts an. `1fr auto 1fr` hält die Mitte unabhängig von den Textbreiten der Außenspalten. In 1440/390/320px betrug die gemessene Abweichung weniger als 0,5px; Labels überlappten nicht und erzeugten keinen Seitenüberlauf. Die vorhandene lokale Besuchslogik bleibt erhalten.

Sound sitzt nun bei den oberen Hero-Bedienelementen. Im Footer gibt es keine zweite Kontrolle. Der Browserlauf bestätigt die erhaltene Mute-Einstellung über Home → Work → About → Home. Die Begrüßung bleibt am bisherigen oberen Mittelpunkt und verwendet 16px am Desktop beziehungsweise 14px mobil. `MORE ABOUT` verwendet responsiv 28–56px. Die gemeinsamen Pfeile bleiben die bestehenden einheitlichen Pfeile. Die noch nicht bereite Mute-Kontrolle reserviert ihren Platz mit `visibility: hidden`; dadurch verschiebt ihre Initialisierung die anderen Kontrollpills nicht mehr.

Die Fly-ins bleiben an den nativen Scrollfortschritt gebunden. Eine kurze Beschleunigungsrampe in den ersten zwölf Prozent trifft anschließend die bisherige Kurve mit stetigem Ort, Tempo und Beschleunigung. Auch das Einpendeln endet stetig. Choreografie, Umkehr, kurze Pins und die beiden bereits vorhandenen Textnachbilder bleiben erhalten; Normal erhält keinen globalen Liquid-Warp.

Die fokussierte Phasenabnahme bestand mit 37 Unit-Tests; die endgültige Gesamtabnahme umfasst 104. Layout und Mute sind im [gemeinsamen Ergebnisarchiv](previews/ref09/verification.json) dokumentiert. Die bestehende Scrollprüfung umfasst 1440/320/390/768/1920px. Zugehörige Prüfungen: [Layout-Browserprüfung](../tests/ref09-layout-browser.mjs) und [Bewegungsprüfungen](../tests/scroll-motion.test.js). Nach der letzten reinen CSS-Korrektur für die reservierte Mute-Fläche bestand Layout nochmals auf 1440/390/320px.

### Phase 3: gleiche Kontur, anderes Material

Die drei ursprünglichen Normal-Cursor bleiben byteidentisch. Die Other-Side-Varianten füllen dieselbe vorhandene SVG-Kontur mit einem neuen lokalen Material und erhalten Ausschnitte, weiße Außenlinie, bisherige Größen und Hotspots:

| Zustand | Native Größe | Hotspot |
| --- | --- | --- |
| Normal | 27,2 × 40,8px | 9 / 2 |
| Hover | 28,832 × 43,248px | 10 / 2 |
| Gedrückt | 26,112 × 39,168px | 9 / 2 |

Die gelieferte schwarze Outline-Datei bestätigt die vorhandenen Pfade. Ihre Root-Größe 32×48 ersetzt nicht die bereits gewünschte Verkleinerung. Die zusätzlich gelieferte `cusor-logo.svg` enthält ein eingebettetes Rasterbild des weißen h4, keine neue Vektorgeometrie. Deshalb wird die vorhandene exakte Vektorkontur weiterverwendet.

Die neue Materialtextur orientiert sich am farbigen h4: weiße, überbelichtete gebrochene Inseln, violett/magentafarbene Risse, Acid-Grün und kleine blaue Fransen. Es ist ein original generiertes flaches Gestaltungsmaterial, kein Künstlerwerk und kein Portfolioeintrag. Ein Assetskript erzeugt die exakt maskierten Varianten und transparenten 16-/32px-Favicons. Versionierte Dateinamen vermeiden die Vermischung beider Favicon-Caches. Der gemeinsame Moduszustand steuert den Wechsel; Normal stellt das ursprüngliche SVG-Favicon wieder her.

Die fokussierten Assetprüfungen bestätigen die Byte-Identität der drei Normal-Dateien, gleiche Pfade/Root-Dimensionen und identische Alphamasken in nativer und vierfacher Größe. Die 16-/32px-PNGs sind transparent und jeweils kleiner als 2KB. Der vollständige Browserlauf bestand auf Desktop, mit Reduced Motion und auf Touch 390/320px ohne Laufzeitfehler. Nach Moduswechsel und Navigation wurden die Normal-Icons korrekt wiederhergestellt; Touch lädt keinen eigenen Desktop-Cursor. Reduced Motion erhält den ursprünglichen Basis-Hotspot und deaktiviert Hover-/Press-Größenfeedback.

Die tatsächliche SVG-Rasterung des Browsers ergab bei allen drei Varianten **null veränderte Alpha-Pixel**, während 3.509 / 3.972 / 3.240 Farbpixel wechselten. Nachweise: [Ergebnisarchiv, Bereich `icons`](previews/ref09/verification.json), [Assetprüfung](../tests/mode-icon-assets.test.js) und [Icon-Browserprüfung](../tests/ref09-icons-browser.mjs). Screenshots erfassen weder den Cursor des Betriebssystems noch die Browser-Tab-Leiste; geprüft sind die tatsächlichen CSS-Dateien/Hotspots, geladenen Favicon-Links und Browser-dekodierten Bildpixel.

### Phase 4: echte Seitenpixel statt eines dekorativen Glitchs

Der eingebundene [Snapshot-Controller](../src/mode-snapshot.js) verwendet native Browser-View-Transitions. Der Browser erfasst die alte und neue sichtbare Seite einschließlich ihrer Typografie, Bilder, Hintergründe und des compositierten Hero. SVG-Filter verarbeiten anschließend ausschließlich diese erfassten `SourceGraphic`-Bilder: versetzte Makroblöcke, UV-Streckung für horizontale Schmieren, getrennte Farbkanäle und nichtlineare Farbkurven. Die im Filter verwendeten farbigen UV-Maps sind unsichtbare Steuerdaten; sie werden nicht als farbige Rechtecke über die Seite gezeichnet.

Das ist ein nativer Browser-Snapshot mit SVG-Compositing, **kein selbst geschriebener WebGL-Screenshot-Shader** und kein permanentes Rastern oder Filtern des Live-DOM. Die Lösung vermeidet eine zusätzliche WebGL-Szene und eine Screenshot-Abhängigkeit. Die echte Seite bleibt während und nach dem Übergang die funktionale Grundlage. Der Rückkehrhinweis besitzt eine eigene ungefilterte Snapshot-Gruppe. Eintritt und Rekonstruktion erhalten verschiedene Abläufe; ein neuer Seed variiert die Beschädigung bei jedem Wechsel.

Die normale Konfiguration wählt 720–920ms, mit festen Konfigurationsgrenzen von 600–1.000ms. Das ist die angeforderte Animationsdauer; tatsächliche Browser-/Controller-Abschlüsse können länger dauern, wie die Laufzeitmessung unten zeigt. Ohne View-Transition-API verwendet die hochwertige Darstellung weiterhin die vorhandene einfache 650ms-Medien-/Hintergrundüberblendung. Reduced Motion und verborgenes Dokument wechseln unmittelbar. Lite überspringt den einfachen Fallback, kann bei unterstützter API aber weiterhin einen nativen Snapshot ausführen. Navigation, Blur, Resize und Entsorgung brechen laufende Snapshots ab. Die Prüfungen bestätigen genau einen Zustandswechsel, endliche Nullstärken, Unterbrechungsbereinigung und die direkten Snapshot-Fallbacks ohne zurückbleibende Effektnodes.

Ein zusätzlich nachgewiesenes Unterbrechungsrennen ist behoben: Wenn ein nativer Snapshot angenommen wurde, sein Update aber beim Blur noch ausstand, konnte ein bereits eingeplanter Fallback-RAF nach dem Abschluss erneut Farbkurve und Fortschritt überschreiben. `finish()` löscht nun auch diesen ausstehenden Frame. Die neue [Abbruchregression](../tests/ref09-mode-cancel-browser.mjs) schlug mit dem alten Code fehl und bestand nach der Korrektur: ein Moduscommit, kein aktiver Übergang, stabiler Zielwert und keine späteren rückläufigen Fortschrittswerte.

**Der tatsächliche Quellpixelnachweis ist bestanden.** Bei abgeschalteter Farbkurve/RGB-Trennung wanderten 5.407 helle Schriftpixel außerhalb ihrer ursprünglichen Maske; im beschädigten Ausschnitt blieben 7.507 helle Quellpixel erhalten und es entstanden **null unerwartete Farbpixel**. Nach Ende stimmten die Live-DOM-Pixel exakt mit dem Ausgangsbild überein. Das prüft echte sichtbare Schriftinformation statt einer farbigen Glitch-Fläche. Nachweise: [Ergebnisarchiv, Bereich `snapshot`](previews/ref09/verification.json) und [Snapshot-Browserprüfung](../tests/mode-snapshot-browser.mjs).

Auch das tatsächliche native `showModal()`-Artwork ist abgedeckt. In der 390×700px-Prüfung war das darunterliegende `main` unsichtbar, sodass die Bildquelle eindeutig das geöffnete Werkbild war. **12.333 helle Artwork-Pixel** wanderten aus ihrer ursprünglichen Maske, **29.216 Pixel** änderten sich, **null unerwartete Farbpixel** entstanden. Helle und dunkle Bildinformation blieb erhalten, die Wiederherstellung war bytegenau und Escape schloss den Viewer weiterhin. Kein zusätzlicher Dialog-Name oder Runtime-Sonderfall war nötig. Nachweise: [Ergebnisarchiv, Bereich `modal`](previews/ref09/verification.json) und [Modalbildprüfung](../tests/mode-snapshot-modal-browser.mjs).

Der begrenzte Integrationslauf bei 1000×760px bestand auf `/work` und `/` mit echter `4`-/`333`-Eingabe, jeweils erfassten Vorwärts-/Rückwärtswechseln und ohne Laufzeitfehler. Die gewählten Dauern betrugen Work **830,8 / 795,8ms**, Home **745,5 / 885,0ms**. Nach jedem Übergang waren die UV-Bildreferenzen entfernt und die Verschiebungswerte null. Die erfassten Gruppen blieben viewportgroß, auch bei der 4.086px langen Homepage. Der maximale gemeinsam gemessene RSS des Chromium-Prozessbaums lag bei **1.402.261.504 Bytes / 1.337,3MiB**, unter dem 2GiB-Abbruchlimit; der aktuelle separate Modalbildnachweis erreichte **915,3MiB**. Das sind SwiftShader-Diagnosewerte des gesamten Browserbaums, kein JavaScript-Heap, kein GPU-Speicherwert und keine Telefonprognose. Nachweis: [Ergebnisarchiv, Bereiche `nativeResources` und `modal`](previews/ref09/verification.json).

Aktuelle farbige Aufnahmen zeigen [native Beschädigung beim Eintritt](previews/ref09/native-datamosh-390.png) und die [eigenständige Rekonstruktion](previews/ref09/native-reconstruction-390.png). Der [geschützte Rückkehrhinweis](previews/ref09/protected-hint-active-390.png) wurde separat mit laufender Ambient-Darstellung und ohne Reduced Motion geprüft: seine gesamten vertikalen Grenzen 579,1–629,5px lagen innerhalb des 844px-Viewports, Textfarbe war Weiß und Deckkraft `1`. Vor und nach dem Pointerkontakt blieben ROI-Regionen und ROI-Paints null, die Pointer-Queue war leer; Ambient lief unabhängig weiter. Nachweis: [captures.json](previews/ref09/captures.json).

Das eingebundene [Ambient-Film-Modul](../src/ambient-film.js) lebt bei ruhigem Cursor langsam weiter. Es verarbeitet vorhandene Filmpixel in organischen Masken, Farbvarianten, lokal überbelichteten Stellen und gelegentlichen horizontalen Bildhistorien. Höchstens 6 Paints/s am Desktop und 3 mobil sind konfiguriert; nach teuren Paints reduziert sich das Budget. Die lokale Pixelkorruption verwendet das aktuelle Ambient-Quellbild und echte vorherige Bildpixel, größere Versätze/Schmieren und 2.350ms Basis-Recovery. Zwei begrenzte Regionen bleiben das Maximum.

Die Browserprüfung bestätigt sichtbare Entwicklung **ohne Pointereingabe** bei 1000/390/320px, getrennte Scheduler und Normal-/Hidden-/Reduced-Motion-Abschaltung. Während Ambient weiterlief, waren Pointer-Regionen, Pointer-Queue und Pointer-Paints bereits vollständig ruhig. Auf Work wurden dabei kein Hero-Modul, keine Hero-Schrift und keine Tattoo-Hero-Textur geladen. Desktop erzeugte ein schneller Strich 94.421 beschädigte Pixel gegenüber 2.647 beim langsamen Strich. Die Zeichenprobe erfasste 846 echte Quellen- und 84 Historienkopien, **keine gefüllten Rechtecke**.

| Viewportbreite | Geänderte Pixel bei ruhigem Cursor | Ambient-Fläche | Gemessenes angepasstes Budget | Erster Paint | Weitere Paints: Median / Spanne |
| --- | --- | --- | --- | --- | --- |
| 1000px | 257.757 | 1000×760px | 5 Paints/s | 84,0ms | 1,65ms / 0,9–3,3ms (8 Werte) |
| 390px | 56.005 | 355×768px | 2 Paints/s | 41,7ms | 1,1ms / 0,7–1,6ms (3 Werte) |
| 320px | 112.123 | 291×768px | 2 Paints/s | 43,4ms | 1,2ms / 0,5–1,6ms (3 Werte) |

Nachweise: [Ergebnisarchiv, Bereich `ambient`](previews/ref09/verification.json), [Ambient-Browserprüfung](../tests/ref09-ambient-browser.mjs) und [Lebenszyklus-Unit-Tests](../tests/ambient-film.test.js). Die kurzen CPU-Paint-Stichproben zeigen den höheren erstmaligen Vorbereitungsaufwand ausdrücklich; sie sind keine gemessene Framerate.

### Phasen 5–7: Tinte, Hover und erhaltene Klänge

Die Tinte behält dokumentverankerte individuelle Konturen, 6–12s Lebensdauer, höchstens zwölf aktive Marken und den Ausschluss interaktiver Ziele/Scrollgesten. Neu sind in beiden Modi echte lokale Filmpixel innerhalb der Kontur, mehrere chemische Pigmentflächen, eckige Ausschnitte, versetzte kurze Bildschmieren und schmale Farbfransen. Grün, Violett, Magenta, Blau und Weiß werden pro Marke kombiniert. The Other Side verstärkt Materialanteil, Sättigung und Leuchtrand. Die Darstellung verwendet kurze CSS-Animationen und keine neue dauerhafte Render-Schleife. Reduced Motion deaktiviert das Fraktur-/Smear-Animieren und erhält den ruhigen Fade.

Die Bereinigung reagiert jetzt nur auf das Animationsende der ganzen Marke. Tatsächlich endende Kinder-Frakturanimationen verbrauchen den Listener nicht und entfernen die Marke nicht vorzeitig. Die natürliche Gesamtlebensdauer und ein zeitlicher Cleanup-Fallback bleiben erhalten.

Der finale Browserlauf bestand bei **1440px**, **390px Touch** und **320px Touch mit Reduced Motion**, ohne Laufzeitfehler. Je geprüftem Fleck lagen vier unterschiedliche berechnete Pigmentfarben vor; der Desktop-A/B-Vergleich mit ausgeblendeten eingebetteten Bildern änderte **595 sichtbare Materialpixel**. Dadurch ist der reale Texturbeitrag belegt. Die tatsächlich gemessene natürliche Entfernung erfolgte nach **11.339 / 8.827 / 10.830ms**. Individuelle Konturen, Überleben der frühen Kinderanimationen, Dokumentverankerung beim Scrollen, Limit zwölf, klickbare Controls ohne Tintenabdruck und Schutz des persistenten Rückkehrhinweises sind bestätigt. Nachweise: [Ergebnisarchiv, Bereich `ink`](previews/ref09/verification.json) und [Tinten-Browserprüfung](../tests/ref09-ink-browser.mjs). Zufällige Konturen/Lebensdauern unterscheiden sich zwischen Läufen; hier stehen die Werte der endgültigen Gesamtabnahme.

Die vorhandenen gemeinsamen Hovereffekte bleiben Grundlage: stationäre Trefferflächen, passende Labels bis 122%, große Labels bis 120%, Fotos bis 108%, weißer Normal-Glow und farbige Other-Side-Säume. Die abschließenden Hover-/Microinteraction-Browserprüfungen bestanden einschließlich tatsächlicher Skalen, Pfeilausrichtung, dynamischer Kontrolltexte, Secret-Ausnahmen, Tastatur, Touch und Reduced Motion.

Die Klangüberarbeitung ist **absichtlich gestrichen**, entsprechend der neuesten Anweisung „setze den klang nicht um lass das einfach“. `src/mode-audio.js`, `src/data/modeAudioSettings.js` und die bisherigen Eintritts-/Rückkehr-WAVs bleiben byteidentisch. Der bestehende Audio-Controller mit Eingabevorbereitung, Mute, begrenzten Stimmen und Fehler-Fallback bleibt erhalten. Die in Phase 2 verschobene obere Soundkontrolle bleibt ebenfalls erhalten. Es gibt keinen ausstehenden Auftrag für eine neue Synthese oder neue Hörproben.

## Sichtreferenzen und Materialherkunft

Für Refinement 09 wurden die neue farbige h4-Vorlage, die schwarze Outline-SVG und das weiße h4-Raster in `cusor-logo.svg` berücksichtigt. Die neuen Datamosh-Vorlagen zeigen eine nächtliche Straßenszene mit erhaltenen Bildstücken und grellen Weiß-/Gelb-/RGB-Schnitten, breite mehrfarbige Bildschmieren, dunkle grün-violette fotografische/grafische Blockreste sowie die lavendelweiß überbelichtete Tattoo-Aufnahme mit Acid-Grün. Maßgeblich sind beschädigte **Quellbildinformationen**, nicht freistehende dekorative Partikel.

Das erneut angehängte `ScreenRecording_10-24-2026 21.mov` wurde mit der früheren Datei verglichen: beide sind byteidentisch, 12.768.010 Bytes, SHA-256 `525e988478d7acd27b72d1cdc4e79cb91c7465dddd2fead02ca950407bc73531`. Das Kontaktblatt wurde nochmals gesichtet. Es zeigt die erhaltenen Arm-/Hintergrundkanten, zeitliche Bildreste, zerrissene Makroblöcke und lavendelweiß/acidgrün/orange Farbbrüche. Es ist keine zusätzliche unbekannte Videoreferenz.

Das vorhandene Filmmaterial und das neue Cursor-Material sind lokale Gestaltungsmaterialien. Das öffentliche Werkarchiv bleibt ohne gelieferte freigegebene Projekte leer. Kontaktziele werden nicht erfunden. Test-Fixtures mit bereitgestelltem Material sind keine veröffentlichten Portfolioarbeiten.

## Konfiguration und Dateien

| Bereich | Dateien | Relevante Einstellungen / Stand |
| --- | --- | --- |
| Tastatur und Modus | [xraySettings.js](../src/data/xraySettings.js), [xray-shortcut.js](../src/xray-shortcut.js), [mode-hold.js](../src/mode-hold.js), [xray.js](../src/xray.js) | Hold 1.000ms, drei Reverse-Drücke, Fenster 2.000ms; Modus-/Eingabe-Guards. |
| Navigationsabbruch | [navigation.js](../src/navigation.js), [app.js](../src/app.js) | Synchrones `h4:navigationstart` vor dem Seitenwechsel. |
| Cursor und Favicons | [modeIconSettings.js](../src/data/modeIconSettings.js), [mode-icons.js](../src/mode-icons.js), [cursor.css](../src/cursor.css), [prepare-mode-icons.mjs](../scripts/prepare-mode-icons.mjs) | Versionierte Assets, gleiche Kontur/Hotspots; Desktop/Reduced/Touch 390/320 geprüft. |
| Erfasster Seitenübergang | [corruptionSettings.js](../src/data/corruptionSettings.js), [mode-snapshot.js](../src/mode-snapshot.js), [mode-snapshot.css](../src/mode-snapshot.css) | `transition`: 720–920ms, 20 Updates/s, 180px Versatz, 220px Smear, 9px Kanalversatz, Farbkurvenstärke `.86`, Raster 18×12; echte Schrift-/Modalbildpixel nachgewiesen. |
| Lebender Filmhintergrund | [ambientFilmSettings.js](../src/data/ambientFilmSettings.js), [ambient-film.js](../src/ambient-film.js) | `chemicalIntensity: 1.25`, `movementSpeed: 1`, Masken, 19–37s Evolution, Belichtung, Desktop-/Mobile-Budgets; eingebunden und geprüft. |
| Lokale Bildkorruption | [corruptionSettings.js](../src/data/corruptionSettings.js), [corruption.js](../src/corruption.js), [corruption-field.js](../src/corruption-field.js) | Pixel-/Smear-Stärke `1.35`, Basis-Recovery 2.350ms, Radius bis 200px, Versatz bis 150px, Smear bis 330px; bestehende zwei Regionen/Gerätebudgets bleiben. |
| Footer und Schrift | [footer.js](../src/footer.js), [easter-eggs.css](../src/easter-eggs.css), [homepage.css](../src/homepage.css), [index.html](../index.html) | Identitätszeile, Hinweise, Begrüßung, MORE ABOUT, obere Soundkontrolle. |
| Scrollchoreografie | [motionSettings.js](../src/data/motionSettings.js) | `fly.accelerationRamp: .12`; bestehende Abstände, Reihenfolge und Trails bleiben Grundlage. |
| Gemeinsame Hovereffekte | [uiEffectSettings.js](../src/data/uiEffectSettings.js) | Skalierung, Glow, Magnetbewegung und gemeinsame Pfeile. |
| Tinte und Besuche | [easterSettings.js](../src/data/easterSettings.js), [ink-imprint.js](../src/ink-imprint.js), [easter-eggs.js](../src/easter-eggs.js) | `ink`: 48–78px, Lebensdauer 6–12s, Limit zwölf, Textur/Palette, Materialanteil `.54` normal / `.79` Other, 13px Smear, 480ms Fraktur, Glow 3 / 6px; bestehende Visit-Konfiguration bleibt. |
| Vorhandene Klänge | [modeAudioSettings.js](../src/data/modeAudioSettings.js), [mode-audio.js](../src/mode-audio.js), [export-mode-sounds.mjs](../scripts/export-mode-sounds.mjs) | Keine Klangüberarbeitung auf ausdrücklichen Nutzerwunsch; bestehende Einstellungen/Dateien unverändert. |
| Echte Inhalte | [artworks.js](../src/data/artworks.js), [siteContent.js](../src/data/siteContent.js), [CONTENT.md](CONTENT.md) | Projekte, Bildvarianten, Beschreibungen, Kategorien, About und spätere Kontaktziele. |
| Vorschau-Export | [export-preview.mjs](../scripts/export-preview.mjs) | Neue Cursor-/Favicon-Assets eingebettet; endgültiger Export, Integrität und Offline-Abnahme bestätigt. |

## Finale Prüfung

**`npm test`: 104/104 bestanden, null Fehler. Alle 24 unterschiedlichen Entwicklungs-Browserreihen bestanden.** Sie umfassen Homepage, Portfolio/Galerie/Artwork, Bildübergänge, Navigation/History, Scroll/Master-Bewegung, Hover/Microinteractions, Geheimtexte/Besuche/Tinte, Tastatur/Touch/Editable-Rollen, Cursor/Favicons, Audio, native Snapshot-/Modalbildpixel, Unterbrechung, Ambient, lokale Korruption und unverändertes Hero-Material. [Maschinenlesbare Gesamtergebnisse](previews/ref09/verification.json). Nach der abschließenden reinen CSS-Änderung für die Mute-Platzreserve wurden Layout 1440/390/320px und der endgültige Offline-Export zusätzlich erneut geprüft.

Der optimierte Vite-Build und Prerender sind erfolgreich: sechs direkte Dokumentrouten plus echte 404, in Preview-Konfiguration null indexierbare Routen. Die strikte HTTP-/No-JS-SEO-Prüfung bestätigt semantische Inhalte, Metadaten, Canonicals auf `https://h4ngelic.com`, strukturierte Künstleridentität, Weiterleitungen, 404-Status, Sitemap und Robots. Work/About laden weder Three.js-Szene noch Hero-Schrift oder Reflexionstextur. Hero-Offscreen-/Hidden-Pause, Geräte-DPR, Reduced Motion und Tastatur-/Touch-Navigation bestehen weiterhin. Es gibt keinen separaten Lint-Befehl im Projekt.

Buildgrößen vor Übertragungskompression: Einstieg **91,88kB / 30,79kB gzip**, bedarfsgeladener Hero **597,83kB / 153,54kB gzip**, erst bei Entdeckung geladene Korruption **18,29kB / 7,23kB gzip**. Die vorhandene Three.js-Warnung für Chunks über 500kB bleibt. Der separate Offline-Export verbindet Module und eingebettete Assets für eine einzelne Datei; er ist kein Maß für den normalen Website-Transfer. Die Bildoptimierung fand weiterhin null veröffentlichte Portfolio-/Portraitbilder; sie erfand keine Arbeiten.

## Tatsächliche Leistungsmessungen

Frische kalte Navigationen gegen den Ausgangsstand `2945c3b` und den endgültigen optimierten Build, seriell ohne parallele Browser. Lighthouse **13.5.0**, Headless Chromium **154**, **SwiftShader-Software-GPU**, mobile Emulation **412×823px / DPR 1,75**, simuliert **150ms RTT / 1638,4kbit/s / 4× CPU-Verlangsamung**. Je Stand drei Homepage-Läufe und ein Work-Lauf; die Tabelle zeigt Homepage-Mediane beziehungsweise den einzelnen Work-Lauf. Alle Berichte ohne Lighthouse-Warnungen. [Baseline](performance/ref09-before.json), [endgültige Messungen](performance/ref09-after.json).

| Messwert | Homepage vorher → nachher | Work vorher → nachher |
| --- | --- | --- |
| Performance-Punkte | 72 → **71** | 100 → **100** |
| FCP | 1.503 → **1.506ms** | 1.054 → **1.103ms** |
| LCP | 2.104 → **2.105ms** | 1.224 → **1.253ms** |
| Total Blocking Time | 1.754 → **1.804ms** | 0 → **0ms** |
| Layout Shift | .002386 → **.002925** | 0 → **0** |
| Übertragene Bytes gesamt | 351.170 → **357.595** | 37.261 → **43.685** |
| JavaScript-Transfer | 178.018 → **183.564 Bytes** | 25.315 → **30.862 Bytes** |
| Anfragen | 8 → **8** | 4 → **4** |

Das ist **kein gemessener Performancegewinn**: ein Homepage-Punkt weniger, etwa 6,4KB mehr Transfer und 50ms mehr mediane TBT; LCP blieb praktisch gleich. Die Homepage-Einzelwerte lagen nachher bei 71–72 Punkten und 1.617,5–2.109,5ms TBT. Der vorhandene 3D-Hero bleibt unter simulierter langsamer CPU der dominante Aufwand. Der einzelne Work-Lauf erlaubt keine Streuungsaussage.

Ein erster neuer Messlauf zeigte **.006816 CLS**, weil die verspätet eingeblendete Soundkontrolle die übrigen Hero-Pills verschob. Die reservierte Mute-Fläche reduzierte das im finalen Drei-Lauf-Satz auf **.002925**. Der Ausgangswert .002386 war weiterhin etwas kleiner. Diese konkrete Layoutkorrektur ist keine Grundlage für eine pauschale Beschleunigungsbehauptung.

Zusätzlich wurde der laufende Moduswechsel direkt instrumentiert: ein Durchgang pro Profil, Resource-Hints auf 8GB / acht Kerne gesetzt, DPR 1, jeweils drei Sekunden stationäre Beobachtung nach dem Wechsel. Die Eingaben waren echte Tastaturereignisse, auch im Touch-Profil; damit wurde keine native Touch-Latenz gemessen. [Laufzeitdaten und genaue Definitionen](performance/ref09-runtime.json).

| Profil / Wechsel | Angeforderte Dauer | Tatsächlicher Controller-Abschluss ab Moduswechsel | Beobachtetes vollständiges Einpendeln |
| --- | --- | --- | --- |
| 1440px Full: Eintritt | 755ms | **1.192ms** | 2.031ms |
| 1440px Full: Rückkehr | 746ms | **1.476ms** | 1.850ms |
| 390px Touch/Lite: Eintritt | 872ms | **1.049ms** | 1.152ms |
| 390px Touch/Lite: Rückkehr | 785ms | **935ms** | 1.042ms |

Der Controller-Abschluss misst das Entfernen seines Übergangsmarkers; das vollständige Einpendeln berücksichtigt zusätzlich den beobachteten Hero-Materialwert und die optionale Compositor-Transition. Die Messung ist keine visuelle Paint-Latenzgarantie. **Die gewünschte Auflösung nach 0,6–1,0s wird in dieser Software-GPU-Umgebung nicht durchgehend erreicht.** Capture-/Compositor-/Scheduling-Aufwand verlängert den tatsächlichen Ablauf über die angeforderte CSS-Dauer hinaus.

Während der drei Sekunden Other Side liefen acht Ambient-Updates am Desktop beziehungsweise sechs im Touch-Profil; die ausgeheilten Pointer-ROIs erzeugten jeweils null weitere Frames. Nach Rückkehr stoppte Ambient ebenfalls vollständig. In diesen stationären Beobachtungsfenstern traten keine Long Tasks auf; daraus folgt keine Aussage über den gesamten initialen Wechsel. RAF-Intervalle, WebGL-Clear-Aufrufe, CPU-Paint-Zeiten und Prozess-RSS sind keine GPU-/Compositor-Framerate. Physische Safari-/Telefon-GPUs, reale Touch-Latenz und Feld-INP wurden nicht gemessen. Snapshot-Unterstützung bleibt browserabhängig; getestete einfache Fallbacks und Reduced Motion bleiben verfügbar.

## Vorschau und Review

Die aktualisierte [einzelne HTML-Vorschau](previews/h4ngelic-preview.html) enthält Hero, Modi, Inhalte, Navigation, Cursor-/Favicon-Assets und bisherige Klänge eingebettet. Alternativ: [ZIP mit derselben HTML-Datei und deutscher Anleitung](previews/portfolio-preview.zip).

- HTML: **3.253.587 Bytes**; SHA-256 `e3de123359e23f256ed176cdf9d2750ad4290d76e3743e84b3455dfedbce4475`.
- ZIP: **2.124.711 Bytes**. Die enthaltene HTML-Datei ist byteidentisch zur separat angebotenen Datei; die beiden WAVs sind byteidentisch zu den bisherigen Originalen.
- Finale Offline-Prüfung auf **1440/390/320px**: null HTTP-Anfragen und null Laufzeitfehler; WebGL-Hero, Ein-Sekunden-Keyboard-/Touch-Hold, `333`, weißer Rückkehrhinweis, obere Mute-Kontrolle, zentrierte Footer-Identität und Navigation bestanden.
- Separate **390px-Prüfung ohne Reduced Motion** auf dem Work-Hash: beide nativen Übergänge mit `captured: true`, null zurückbehaltene UV-Maps, null WebGL-Kontexte, Normal-Grau korrekt wiederhergestellt, null HTTP-Anfragen und null Laufzeitfehler.

**Prüfmethode:** Die verwaltete Chromium-Umgebung blockiert `file://`-Navigation. Die Tests führten deshalb mit `setContent()` die **exakten exportierten HTML-Bytes** aus und lehnten sämtliche HTTP-Anfragen ab. Das bestätigt die eingebettete Funktion ohne Netzwerk, behauptet aber keine getestete direkte `file://`-Navigation. [Offline-/Verpackungsnachweise im Ergebnisarchiv](previews/ref09/verification.json).

Aktuelle Aufnahmen: [Desktop Normal](previews/ref09/home-1440-normal.png), [Desktop Other Side](previews/ref09/home-1440-other.png), [390px](previews/ref09/home-390-other.png), [320px](previews/ref09/home-320-other.png), [horizontale Kategorien 320px](previews/ref09/categories-320.png), [Work](previews/ref09/work-normal.png), [About](previews/ref09/about-normal.png), [native Beschädigung](previews/ref09/native-datamosh-390.png), [Rekonstruktion](previews/ref09/native-reconstruction-390.png) und [geschützter Hinweis bei aktiven Effekten](previews/ref09/protected-hint-active-390.png). Statische Modusaufnahmen verwenden Reduced Motion für verlässliche Vergleiche; die nativen Übergangs- und aktiven Hinweisaufnahmen ausdrücklich nicht. [Aufnahmebedingungen](previews/ref09/captures.json).

Review-PR: [PR #12](https://github.com/h333ndrik/h4ngelic/pull/12). Keine Zusammenführung nach `main`, keine Produktionsveröffentlichung und keine DNS-Änderung. Das bestehende Archiv bleibt bis zur Lieferung echter freigegebener Arbeiten leer; Kontaktziele bleiben konfigurierbare Platzhalter.
