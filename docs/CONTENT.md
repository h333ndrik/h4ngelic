> Aktueller Stand: [PROJECT_PLAN.md](../PROJECT_PLAN.md) und
> [PROJECT_PROGRESS.md](../PROJECT_PROGRESS.md). Die Hauptseite heißt WORKS;
> INDEX ist das „+“-Menü oben rechts; NAAVI bleibt unabhängig davon unten mittig. Die drei
> Work-Hauptrubriken sind tattoos, jewellery und more. Unter tattoos stehen
> on skin, flashes und der vorerst leere Abschnitt 3d model; unter more stehen
> digital artworks vor analog photography. Der lokale VISIT-Zähler gilt gemeinsam über alle Routen und erscheint bei Hover, Tastaturfokus oder Tap im rechten Footer-Cluster.
> Es gibt drei reguläre Seiten: Startseite, Works und More About. Kontakt liegt nur auf der Startseite.

# Inhalte bearbeiten

Die Website verwendet einfache JavaScript-Dateien. Du brauchst weder React-Komponenten noch ein CMS, eine Datenbank oder einen Login zu bearbeiten.

| Inhalt | Datei |
| --- | --- |
| Projekte und Bilder | `src/data/artworks.js` |
| Kategorien, About-Texte, Instagram | `src/data/siteContent.js` |
| Kontaktformular und Upload-Grenzen | `src/data/inquirySettings.js` |
| Maildienst und geheime Server-Konfiguration | [INQUIRY.md](INQUIRY.md) — keine Zugangsdaten in Inhaltsdateien |
| Eigene Bilddateien | `public/images/` |
| Automatisch erzeugte Bildvarianten | `public/images/optimized/` |
| Automatisch ermittelte Bildgrößen | `src/data/imageManifest.json` — nicht manuell bearbeiten |
| Seitentitel, Beschreibungen, Domain und Indexierung | `src/data/seoContent.js` |
| Ruhige Scroll-Distanzen, Eingangsverlauf und Hero-Leisten-Fade | `src/data/motionSettings.js` — Anleitung in [MOTION.md](MOTION.md) |
| Prozedurale Tinte, versteckte Nachrichten und lokale Besuchszählung | `src/data/easterSettings.js` — Anleitung in [EASTER-EGGS.md](EASTER-EGGS.md) |
| Zurückhaltende Hero-Kameratiefe | `src/data/heroDepthSettings.js` — Anleitung in [MOTION.md](MOTION.md) |
| Aktiver Modus und öffentliche versteckte Anweisung | `src/data/featureFlags.js` — aktuell `otherSideEnabled: true` |
| Farbkurven, Palette, Hold- und Übergangszeit | `src/data/xraySettings.js` — [XRAY.md](XRAY.md) |
| Beschädigungs-/Glow-/Smear-Stärke, Recovery und Qualitätsgrenzen | `src/data/corruptionSettings.js` |
| Metallisch-kristalline Ein-/Austrittsklänge | `src/data/modeAudioSettings.js` |
| Gemeinsame Hover-Vergrößerung, Glow und Pfeilabstände | `src/data/uiEffectSettings.js` |
| Geliefertes grün-schwarzes Digitaloriginal | `src/data/digitalArtworkSettings.js` — Anzeige als gewöhnliche Bildgalerie, ohne Ink-Reveal |
| Optionales Flash-Modell und UV-/Materialprüfung | `docs/MANNEQUIN-WORKFLOW.md` |

## Ein Tattoo, Flash, Schmuckstück oder anderes Werk hinzufügen

1. Lege deine Bilddateien unter `public/images/` ab. Den Ordner kannst du beim ersten Projekt anlegen. Verwende kurze Dateinamen ohne Leerzeichen, zum Beispiel `projektname-01.webp`. WebP, AVIF, JPEG und PNG sind möglich. Verwende statische Bilder und bewahre deine Druckoriginale separat auf.
2. Öffne `src/data/artworks.js`. Füge deine Einträge hinter dem vorhandenen `featuredDigitalArtwork` ein. Bewahre seinen Import. Das folgende Beispiel zeigt die Struktur; verwende deine tatsächlichen Bilder und Angaben zum Projekt.

```js
export const artworks = [
  featuredDigitalArtwork, // vorhandener Import des gelieferten Digitaloriginals
  {
    id: 'dein-projektname',
    category: 'tattoos',
    title: 'dein projekttitel',
    year: 2026,
    description: 'Deine Beschreibung des Projekts.',
    images: [
      {
        src: '/images/projektname-01.webp',
        alt: 'Beschreibe das sichtbare Motiv.',
        width: 1200,
        height: 1600,
      },
      {
        src: '/images/projektname-detail.webp',
        alt: 'Beschreibe die Detailaufnahme.',
        caption: 'optionale bildunterschrift',
      },
    ],
    details: {
      material: 'deine tatsächliche Materialangabe',
    },
    published: true,
  },
];
```

3. Wähle `tattoos` (fertige Tattoos), `flashes`, `jewellery`, `analog-photography` oder `digital-artworks`. Bestehende `paintings`-Einträge und URLs bleiben unterstützt; `more` ist eine Rubrik, keine Projektkategorie. Jedes Projekt benötigt eine eigene `id` und mindestens ein vorhandenes Bild. Titel, Jahr, Beschreibung, Bildunterschrift und `details` sind optional. Die Bildmaße werden automatisch ermittelt; wenn du `width` und `height` selbst angibst, müssen sie den angezeigten, gegebenenfalls nach EXIF gedrehten Maßen entsprechen.
4. Füge weitere Projekte mit Komma getrennt in dieselbe Liste ein. Die Reihenfolge der Einträge ist standardmäßig die Reihenfolge im Archiv. Optional sortiert `order: 1` vor höheren Nummern und Einträgen ohne `order`. Mit `cover: "/images/dein-detail.webp"` wird dieses bereits in `images` enthaltene Bild zuerst gezeigt. `featured: true` steht als redaktionelle Auswahl bereit; die Startseite behält ihre drei typografischen Rubriken ohne Bildkarten. Mit `published: false` bleibt ein Entwurf verborgen. Tattoos, Flashes und Analog Photography verwenden automatisch denselben nativen horizontalen Karusselltyp. Horizontales Trackpad-Scrollen, Shift + Mausrad, Ziehen, Wischen, Vor-/Zurück-Pfeile und die Tastatur dienen zum Blättern; vertikales Scrollen führt weiterhin durch die Work-Seite. Ein Klick oder Tap vergrößert das Bild an seiner Position im Karussell um etwa 10 Prozent; es öffnet kein Modal. Ein zweiter Klick, ein Klick außerhalb oder Escape stellt die Größe wieder her. Bildreihenfolge und Scrollposition bleiben erhalten; Ziehen soll nicht als Klick zählen. Der separate Titellink führt zur Projektdetailseite. Jewellery, Digital Artworks und vorhandene Paintings sind gewöhnliche Bildgalerien. Digital Artworks sind sofort vollständig sichtbar: keine Ink-Maske, keine zusätzliche Sticky-Scrollstrecke und kein Reveal-Canvas. Auf der Detailseite öffnet ein Bild den Viewer; Pfeiltasten wechseln zwischen Aufnahmen desselben Projekts. Details stehen in [ARTWORK-TRANSITIONS.md](ARTWORK-TRANSITIONS.md).
5. Starte `npm run dev` und prüfe `/work` sowie die Sprungmarken `/work#tattoos`, `/work#jewellery` und `/work#more`. Alle Archive bilden einen zusammenhängenden Scroll-Verlauf; alte Kategorie-URLs bleiben als direkte Einstiege erhalten. Der Start erzeugt automatisch passende WebP-Dateien. Wenn der Entwicklungsserver bereits läuft und du Bilder oder Einträge ergänzt, führe `npm run images:optimize` erneut aus oder starte den Server neu. `npm run build` erzeugt die Varianten ebenfalls automatisch und prüft den Produktionsbuild. `npm test` prüft unter anderem Datenanzeige, Bildverarbeitung und Animation; `npm run test:portfolio` und `npm run test:gallery` prüfen Navigation und Viewer bei laufendem Entwicklungsserver.

Solange Tattoos, Flashes oder Analog Photography keine veröffentlichten Einträge mit echten Bildern enthalten, bleibt ihre Karussellstruktur sichtbar: „archive in progress.“, Zähler `0 / 0` und deaktivierte Pfeile. Das ist ein leerer Inhaltsstand, kein vorgetäuschtes Portfolio. Andere leere Archive zeigen ebenfalls „archive in progress.“. Es werden weder Beispielkarten noch Stockbilder oder Kopien eines anderen Werks eingefügt. Derzeit sind das gelieferte grün-schwarze Digitaloriginal und alle acht gelieferten Tattoo-Fotografien veröffentlicht. Flash-, Jewellery- und Analog-Archive enthalten weiterhin keine erfundenen Bilder. Das gelieferte Poster bleibt Material für die Logo-Reflexion und wird nicht automatisch zum Portfolioeintrag. Du kannst es später bewusst als Projekt mit deinen Angaben aufnehmen.

## Bildgrößen und Ladeverhalten

`npm run images:optimize` liest die tatsächlich verwendeten lokalen Projekt- und Portraitbilder. Es erzeugt WebP-Varianten mit maximal 320, 640, 960, 1440 und 1920 px Breite; kleine Originale werden nicht vergrößert. Die Originaldateien werden nicht überschrieben. Inhaltsabhängige Dateinamen vermeiden veraltete Browser-Caches. Veröffentliche die erzeugten Dateien zusammen mit `src/data/imageManifest.json`; die Manifest-Datei wird vollständig vom Skript verwaltet.

Der Browser wählt per `srcset` eine passende Größe. Nicht kritische Bilder laden verzögert; reservierte Bildmaße verhindern springende Layouts. Im Viewer wird standardmäßig die größte erzeugte Variante geladen. Optional kannst du am Bild `fullSrc: '/images/deine-groessere-webdatei.webp'` angeben: Lokale Dateien werden ebenfalls optimiert und im Viewer als größte WebP-Variante verwendet. Externe `fullSrc`-Adressen bleiben direkt verlinkt und sollten bereits passend komprimiert sein.

V3.1 verkleinert die öffentliche Digital-Artwork-Vorschau auf ungefähr die Hälfte der bisherigen Breite: im Archiv maximal `min(41vw, 550px)`, auf der Werkdetailseite maximal die halbe Spaltenbreite bzw. 600px. Diese Vorschaubilder bieten nur die vorhandenen 320- und 640px-WebP-Varianten an; das `sizes`-Attribut entspricht ihrer tatsächlichen Breite. Auch die Digital-Detailseite lädt das Bild verzögert. Die Originaldatei und ihre Größenangaben bleiben unverändert, und erst ein bewusstes Öffnen des Viewers kann dessen größte verfügbare Variante laden. Andere Projektkategorien behalten ihre bisherige Bildauswahl.

Externe Bild-URLs werden nicht heruntergeladen oder optimiert. Gib für sie `width` und `height` an. Ohne bekannte Maße wird ein fester 4:5-Rahmen reserviert. Bevorzuge für zuverlässig schnelle Seiten lokale Dateien. Bei einem leeren Archiv werden keine Beispielbilder erzeugt; die Bildpipeline wird in automatisierten Tests mit einer temporären Datei geprüft.

## About, Portrait und Referenzen

In `src/data/siteContent.js` stehen unter `about`:

- `intro` und `location`: die beiden Haupttexte.
- `paragraphs`: zusätzliche Textabsätze als Liste von Strings.
- `portrait`: zunächst `null`; später zum Beispiel `{ src: '/images/portrait.webp', alt: 'Deine Bildbeschreibung' }`.
- `references`: zunächst `[]`; später eine Liste aus `{ title: 'Dein Referenztitel', url: 'https://…' }`.

Unter `home.aboutPreview` bearbeitest du den kurzen About-Auszug auf der Startseite. Leere optionale Inhalte erzeugen keine Rahmen oder Bildplatzhalter. Lokale Portraitbilder nutzen dieselbe automatische WebP-Verarbeitung und Größenreservierung wie Projekte.

## Kontakt konfigurieren

Unter `contact` in derselben Datei:

```js
contact: {
  instagramURL: 'https://www.instagram.com/h4ngelic/',
  email: 'h4ngelic@gmail.com',
  bookingURL: '', // optionaler tatsächlicher Buchungslink
},
```

Diese bestätigten Angaben versorgen unter anderem den Footer. Das einzige Inquiry-Formular steht im Abschnitt `03 / CONTACT` der Startseite. Alle Kontaktlinks führen zu `/#contact`; alte `/contact`-Links werden dorthin weitergeleitet. Für Links im Code verwende `contactURL()` aus `src/routes.js`, bei Werkbezug `contactURL(project.id)`. Der Kontext wird als `/?artwork=…#contact` übergeben, ohne beim Wechsel innerhalb der Startseite Entwurf und Anhänge zu löschen. Lasse unbestätigte zusätzliche Werte leer. Externe Ziele beginnen mit `https://`; interne Ziele beginnen mit `/`. Änderungen benötigen für eine veröffentlichte Website einen neuen Build.

Die öffentliche Formular-Konfiguration liegt in `src/data/inquirySettings.js`. Der tatsächliche Empfänger ist zusätzlich serverseitig festgelegt; eine Änderung von `siteContent.contact.email` konfiguriert keinen Maildienst. Der vorhandene Serveradapter benötigt weiterhin einen laufenden Endpunkt, Mail-Zugangsdaten und einen verifizierten Absender. Echte Zustellung ist bisher nicht konfiguriert oder bestätigt. Die heruntergeladene HTML-Vorschau kann keine Anfrage versenden und bietet eine E-Mail-Alternative an. [Einrichtung und Zustellprüfung](INQUIRY.md).

## Kategorien und Seiten

`siteContent.workGroups` definiert die drei Hauptrubriken **tattoos / jewellery / more**. `siteContent.categories` definiert ihre Blattkategorien und die aktive Darstellung: `drift` für die drei horizontalen Karussells, `existing` für gewöhnliche Bildgalerien. Tattoos enthält Tattoos und Flashes; More enthält Analog Photography und Digital Artworks. Digital Artworks verwendet `existing`, nicht Ink-Reveal. Die Startseite behält eine horizontale Zeile mit ausschließlich den drei Hauptrubriken; ihre Unterlinks stehen erst auf Work. Auf sehr schmalen Bildschirmen bleibt die Zeile horizontal scrollbar und per Tastatur erreichbar.

Die drei regulären Seiten verwenden echte URLs: `/`, `/work` und `/about`. Kontakt ist der Abschnitt `/#contact`, keine eigene Seite. Die bisherigen Kategorie-Einstiege `/work/tattoos`, `/work/flashes`, `/work/jewellery`, `/work/more`, `/work/analog-photography`, `/work/digital-artworks` und `/work/paintings` bleiben kompatibel; `/contact` leitet auf den Startseitenabschnitt weiter. Work bleibt eine zusammenhängende Seite: Die neuen Rubriklinks springen zu `/work#tattoos`, `/work#jewellery`, `/work#more` oder einem Unterabschnitt. Bestehende Kategorie-URLs und Querylinks bleiben direkte Einstiege; sie sollen die übrigen Archive nicht aus dem Dokument entfernen. Ein veröffentlichtes Projekt mit `id: 'dein-projektname'` und `category: 'tattoos'` erhält automatisch `/work/tattoos/dein-projektname`. Verwende eindeutige IDs aus Kleinbuchstaben, Zahlen und Bindestrichen; ändere sie nach Veröffentlichung nur mit einer passenden Weiterleitung.

INDEX ist das eigenständige `+`/`×`-Menü oben rechts und bleibt auf allen regulären Seiten verfügbar. Seine nummerierten Ziele führen zu Home, Works, More About, Home Contact und dem vorhandenen Schlussbereich. NAAVI ist die davon unabhängige Navigation unten mittig: Home zählt `00 / 04` bis `04 / 04`, Work `00 / 03` bis `03 / 03`, More About `00 / 01` bis `01 / 01`. Unterrubriken bekommen keine zusätzlichen Hauptnummern. Kontakt bleibt ausschließlich der Startseitenabschnitt; die schwebenden Bedienelemente dürfen seine Felder nicht verdecken.

### Das gelieferte grün-schwarze Digitaloriginal

Die JPG-Datei aus deiner ZIP ist unverändert unter `public/images/digital-artworks/green-black-original.jpg` gespeichert (1440×1920). `featuredDigitalArtwork` in `src/data/digitalArtworkSettings.js` ist bereits veröffentlicht und in `artworks` eingebunden. Automatisch erzeugte WebP-Größen decken 320, 640, 960 und 1440px ab. Das Werk erscheint unter More → Digital Artworks als vollständig sichtbares responsives Bild mit gewöhnlichen Galerie-/Detailinteraktionen. Die Scroll-Ink-Maske und ihr Canvas-/CSS-Laufzeitpfad werden für die öffentliche Darstellung nicht mehr verwendet. Titel, Beschreibung und Jahr bleiben offen, bis du sie selbst angibst. [Originalnachweis und Verhalten](DIGITAL-ARTWORK-ASSET.md).

### Die acht gelieferten Tattoo-Originalfotos

Das ZIP **New Folder With Items 2.zip** enthält acht JPEG-Originale. Auf ausdrücklichen Wunsch werden **alle acht**, nicht nur die zunächst genannten fünf, in **on skin** verwendet. Die Dateien liegen unverändert unter `public/images/tattoos/tattoo-01.jpg` bis `tattoo-08.jpg`. Es wurden nur die Dateinamen geändert; Bildinhalt, Kodierung und Originalbytes bleiben erhalten. macOS-Ressourcen-Metadaten aus `__MACOSX/` sind keine Fotos und werden nicht veröffentlicht.

`docs/assets/tattoo-originals-v31.json` ordnet jeden ZIP-Eintrag seinem neuen Pfad zu und dokumentiert Dateigröße, SHA-256, unveränderte Originalbytes und tatsächliche Bildmaße. Die Reihenfolge entspricht der Reihenfolge der JPEG-Einträge im ZIP. Der Asset-Commit `f1841e4` enthält alle acht unveränderten Originale; die Prüfsummen der Git-Blobs wurden gegen die Manifestwerte geprüft. `suppliedTattooPhotographs` in `src/data/artworks.js` enthält acht veröffentlichte Fotoeinträge mit den neutralen IDs `tattoo-01` bis `tattoo-08`, je einem Bild und beschreibendem Alt-Text. Titel, Beschreibung und Jahresangabe bleiben offen, bis der Künstler diese Daten liefert.

Weitere Aufnahmen lassen sich nach demselben Muster ergänzen. Die vorhandene Bildpipeline erzeugt separate WebP-Auslieferungsvarianten; sie überschreibt keine Originaldatei. Nach einem neuen Bild führe `npm run images:optimize` bzw. einen neuen Build aus, prüfe das native Karussell und vergleiche die Original-Prüfsummen erneut. Die Originale und ihre Integrität sind damit nicht mehr blockiert. Die aktuelle Karussell-Integration bleibt bis zu den Desktop-/Mobile-Prüfungen PARTIAL; ihr tatsächlicher Teststand steht in PROJECT_PROGRESS.md.

`npm run build` schreibt eigene HTML-Dateien für diese Seiten. Der Hoster muss die jeweiligen Verzeichnis-Indexdateien und für unbekannte Ziele eine echte 404 ausliefern. Eine pauschale Weiterleitung aller unbekannten Pfade zur Homepage ist nicht mehr vorgesehen. Details stehen in [SEO.md](SEO.md). Es wurden keine Hosting- oder DNS-Einstellungen verändert und nichts deployt.

In `src/data/seoContent.js` kannst du Seitentitel und Beschreibungen bearbeiten. Optionale projektbezogene Werte stehen am Projekt unter `seo: { title, description, image }`; `image` kann ein echtes Bildobjekt mit `src`, `alt`, `width` und `height` sein. Für ein indexierbares Projekt sind ein echter Titel, eine Beschreibung und ein Bild mit Alt-Text nötig. Entwürfe erzeugen keine Detailseiten. Leere Archive werden nicht in die Sitemap aufgenommen. Die bestätigte Domain ist `https://h4ngelic.com`; Vorschau-Builds bleiben standardmäßig `noindex`.

Mit `npm run preview:export` erzeugst du `artifacts/h4ngelic-preview.html`. Diese eigenständige Datei enthält die vorhandenen Standardassets sowie lokal konfigurierte Portfolio-/Portraitbilder und verwendet ausschließlich für die Offline-Vorschau Hash-Adressen wie `#/work/tattoos`. Die echte Website behält ihre normalen URLs. Extern verlinkte Bilder werden nicht heruntergeladen und benötigen Internetzugriff. Prüfe Ergänzungen auch über `npm run preview`.


## Homepage-Bewegung anpassen

`src/data/motionSettings.js` steuert ruhige, begrenzte und reversible Eingangsbewegungen. `calm` bestimmt die gemeinsame Bewegung von rechts; Text und Formular eines Contact-Abschnitts sowie zusammengehörige Kategorie-Beschriftungen bewegen sich gemeinsam, ohne Rotation, Staffelung oder Überschwingen. Die numerische Work-Überschrift behält ihre bestehende Aufwärtsbewegung. `pin` steuert weiterhin die native Sticky-Strecke, `heroBar` das Ausblenden der unteren Hero-Steuerung beim Weiterscrollen. Bei reduzierter Bewegung ist der Inhalt sofort sichtbar; die Leiste wechselt unmittelbar zwischen sichtbar und ausgeblendet. Die alten `fly`-/Nachbild-Konfigurationen werden nicht mehr verwendet. [MOTION.md](MOTION.md) enthält ältere Hintergrundinformationen; der aktive V3.1-Stand steht in PROJECT_PROGRESS.md.

`src/data/heroDepthSettings.js` ergänzt die vorhandene Logoanimation um eine kleine Kamerabewegung. Die aktuellen Obergrenzen sind 8% mehr Z-Distanz (`distance: .08`) und ein Grad mehr Blickwinkel (`fieldOfView: 1`). Änderungen der Kameratiefe erfordern keine Änderung an Logo-Geometrie, Chrome-Material oder Physik. [MOTION.md](MOTION.md) erläutert alle Werte, Umkehrverhalten und reduzierte Bewegung.

## Versteckte Nachrichten und lokale Erinnerung

Der lokale Besuchszähler in `src/data/easterSettings.js` erscheint als **VISIT 0001**, **VISIT 0002** usw. mit mindestens vier Stellen. Die sieben früheren persönlichen Textstufen sind entfernt. Der Zähler sitzt im rechten Footer-Cluster und bleibt verborgen, bis sein stationärer Bereich per Hover, Tastaturfokus oder Tap entdeckt wird; der übrige Footer verschiebt sich dabei nicht. Dies ist keine öffentliche Besucherstatistik.

Die lokale Speicherung bleibt aktiv: `visits.enabled: true`, `requireConsent: false`, `showNumber: true`. Gespeichert werden ausschließlich `count` und `lastSeen`. Interne Seitenwechsel oder unmittelbares Neuladen zählen nicht als neuer Besuch; standardmäßig trennt eine halbe Stunde Inaktivität die Besuche. `enabled: false` deaktiviert Speicherzugriffe, `showNumber: false` entfernt das Zähler-Bedienelement. Für eine vorhandene Host-Consent-Anbindung kann `requireConsent: true` mit Callback verwendet werden. Speicherfehler verhindern die restliche Website nicht.

Die versteckte Anweisung unter Kontakt lautet in Normal Mode `HOLD 4 TO SEE THE OTHER SIDE.` und im alternativen Zustand `HOLD 4 TO REVERSE.`. Die 4 wird mindestens eine Sekunde gehalten; `333` bleibt als Rückweg erhalten. Der separate lokale Besuchszähler steht im rechten Footer-Cluster als `VISIT 0000`-Format und ist nicht der Kapitelzähler. Beide Anweisungsvarianten nutzen dieselbe Position; NAAVI bleibt unabhängig davon unten mittig.

## Visuelle Intensität und Klang anpassen

In `src/data/corruptionSettings.js` lassen sich einzelne Beiträge ändern:

| Wert | Wirkung |
| --- | --- |
| `distressIntensity` | Film-/Materialschaden und Grundstärke der Cursor-Korruption |
| `filmBurnIntensity` | Ausgebrannte helle Stellen im Wordmark-Material |
| `grainIntensity` | Deckkraft der zusätzlichen Körnung |
| `colorCorruption` | Solarisation/Farbkorruption und lokale Kanalverschiebung |
| `pixelCorruption` | Stärke des lokalen Makroblock-Schadens |
| `glowStrength` | Helle Materialstellen und zusätzlicher Other-Side-Hoverglanz |
| `smearingIntensity` | Länge des horizontalen Pixelnachziehens |
| `recoveryMs` / `recoverySpeed` | Basis-Ausheilzeit; höhere Geschwindigkeit heilt früher |
| `field` / `quality` | Begrenzung von Impulsen, aktiven Bildregionen, Auflösung und Paint-Rate |

`0` entfernt den jeweiligen Beitrag; die Standardstärke liegt meist bei `1`. Die Einstellungen greifen an unterschiedlichen Stellen, deshalb entfernt beispielsweise `pixelCorruption: 0` nicht die Filmtextur. Halte Qualitätsgrenzen auch bei höherer Intensität klein. Die eigentliche Hintergrundtextur liegt als lokale optimierte Varianten `public/assets/corrupted-film.webp` und `corrupted-film-mobile.webp` vor. Sie ist eine generierte Gestaltungstextur, kein Portfolioeintrag.

`src/data/xraySettings.js` enthält die Palette, neunwertige nicht-monotone Farbkurven, Sättigung, Kanalabstand und `shortcutHoldMs: 1000`. Echte Projektbilder werden unabhängig davon in der zentralen Portfolio-Datei eingetragen. `src/data/uiEffectSettings.js` steuert Hover-Skalen und Pfeilform/-abstände gemeinsam; große Labels werden automatisch auf den vorhandenen Platz begrenzt.

`src/data/modeAudioSettings.js` steuert `enabled`, `volume`, `durationSeconds`, Grundton, inharmonische Teiltöne, Ausklang und Ein-/Austrittsverlauf. Die Standardklänge dauern 0,7 Sekunden, werden lokal im Browser erzeugt und über SOUND im unteren linken Hero-Bereich stummgeschaltet. Der kleine angehängte Pfeil öffnet den Lautstärkeregler darüber; Stummschaltung und Lautstärke werden lokal gespeichert. Ein Audiofehler verhindert keinen Moduswechsel. `npm run sounds:export` erzeugt Review-WAVs aus denselben Einstellungen. Die Website benötigt diese Dateien nicht zur Laufzeit.

Nach Änderungen an Daten/Assets prüfst du den Entwicklungsserver und erzeugst einen neuen Build bzw. Offline-Export. Die normalen Inhaltsdateien bleiben unabhängig von Effekt-Parametern. [XRAY.md](XRAY.md) erläutert die technische Umsetzung; der tatsächlich geprüfte aktuelle Stand steht in [CONTROL-CORRUPTION.md](CONTROL-CORRUPTION.md).

## SMASH mit dem freigegebenen Original

V3.1 genehmigt ausdrücklich die unveränderte Übernahme der gelieferten Datei **`h4ngelic_v8_full_sound_remaster_v11.mp3`**. Sie liegt unter `public/audio/`; ihre SHA-256 lautet `307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b`. Frühere Hinweise auf ausschließlich private Ablage sind damit für genau diese freigegebene Datei überholt. Es wird keine Ersatzmusik erzeugt, kein Remix vorgenommen und keine Audiodatei neu kodiert.

`smashURL`, `smashFadeInSeconds`, `smashFadeOutSeconds` und `smashStopFadeSeconds` in `src/data/modeAudioSettings.js` konfigurieren den vorhandenen zentralen Controller. Der Track wird auf der normalen Website erst beim ersten bewussten SMASH-Klick geladen und anschließend im Controller zwischengespeichert. Er startet von vorn mit 1,8 Sekunden Fade-in, erhält Vorrang vor den Website-Cues und blendet während der letzten etwa fünf Sekunden aus. Ein zweiter Klick beendet ihn mit etwa einer Sekunde Fade-out. Danach beziehungsweise am natürlichen Ende kehren die Website-Cues zurück. Globale Lautstärke und Stummschaltung gelten weiterhin; ein Wechsel zwischen 333 und 4 unterbricht den Track nicht.

Die selbstständige Offline-HTML enthält das exakt gleiche MP3 einmal als eingebettete Bytes, damit sie ohne Server funktioniert; die Audiodaten werden auch dort erst nach bewusstem Gebrauch dekodiert und wiedergegeben. Diese Einbettung ist vom verzögerten Netzwerkabruf der normalen Website zu unterscheiden. Die tatsächlichen Browser-, Fade- und Integritätsprüfungen sind im aktuellen PROJECT_PROGRESS.md dokumentiert. Die Dateifreigabe startet keinen Launch und verändert keine Hosting- oder DNS-Einstellung.
