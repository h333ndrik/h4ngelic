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
| Scroll-Distanzen, Staffelung, Nachbilder und Überschwinger | `src/data/motionSettings.js` — Anleitung in [MOTION.md](MOTION.md) |
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
4. Füge weitere Projekte mit Komma getrennt in dieselbe Liste ein. Die Reihenfolge der Einträge ist standardmäßig die Reihenfolge im Archiv. Optional sortiert `order: 1` vor höheren Nummern und Einträgen ohne `order`. Mit `cover: "/images/dein-detail.webp"` wird dieses bereits in `images` enthaltene Bild zuerst gezeigt. `featured: true` steht als redaktionelle Auswahl bereit; die Startseite behält ihre drei typografischen Rubriken ohne Bildkarten. Mit `published: false` bleibt ein Entwurf verborgen. Tattoos, Flashes und Analog Photography verwenden automatisch denselben nativen horizontalen Karusselltyp. Horizontales Trackpad-Scrollen, Shift + Mausrad, Ziehen, Wischen, Vor-/Zurück-Pfeile und die Tastatur dienen zum Blättern; vertikales Scrollen führt weiterhin durch die Work-Seite. Klick auf ein Bild öffnet den Viewer, Escape schließt ihn; die Galerie soll dabei ihre Position behalten. Der separate Titellink führt zur Projektdetailseite. Jewellery, Digital Artworks und vorhandene Paintings sind gewöhnliche Bildgalerien. Digital Artworks sind sofort vollständig sichtbar: keine Ink-Maske, keine zusätzliche Sticky-Scrollstrecke und kein Reveal-Canvas. Auf der Detailseite öffnet ein Bild den Viewer; Pfeiltasten wechseln zwischen Aufnahmen desselben Projekts. Details stehen in [ARTWORK-TRANSITIONS.md](ARTWORK-TRANSITIONS.md).
5. Starte `npm run dev` und prüfe `/work` sowie die Sprungmarken `/work#tattoos`, `/work#jewellery` und `/work#more`. Alle Archive bilden einen zusammenhängenden Scroll-Verlauf; alte Kategorie-URLs bleiben als direkte Einstiege erhalten. Der Start erzeugt automatisch passende WebP-Dateien. Wenn der Entwicklungsserver bereits läuft und du Bilder oder Einträge ergänzt, führe `npm run images:optimize` erneut aus oder starte den Server neu. `npm run build` erzeugt die Varianten ebenfalls automatisch und prüft den Produktionsbuild. `npm test` prüft unter anderem Datenanzeige, Bildverarbeitung und Animation; `npm run test:portfolio` und `npm run test:gallery` prüfen Navigation und Viewer bei laufendem Entwicklungsserver.

Solange Tattoos, Flashes oder Analog Photography keine veröffentlichten Einträge mit echten Bildern enthalten, bleibt ihre Karussellstruktur sichtbar: „archive in progress.“, Zähler `0 / 0` und deaktivierte Pfeile. Das ist ein leerer Inhaltsstand, kein vorgetäuschtes Portfolio. Andere leere Archive zeigen ebenfalls „archive in progress.“. Es werden weder Beispielkarten noch Stockbilder oder Kopien eines anderen Werks eingefügt. Derzeit ist nur das gelieferte grün-schwarze Digitaloriginal als Projekt veröffentlicht. Das gelieferte Poster bleibt Material für die Logo-Reflexion und wird nicht automatisch zum Portfolioeintrag. Du kannst es später bewusst als Projekt mit deinen Angaben aufnehmen.

## Bildgrößen und Ladeverhalten

`npm run images:optimize` liest die tatsächlich verwendeten lokalen Projekt- und Portraitbilder. Es erzeugt WebP-Varianten mit maximal 320, 640, 960, 1440 und 1920 px Breite; kleine Originale werden nicht vergrößert. Die Originaldateien werden nicht überschrieben. Inhaltsabhängige Dateinamen vermeiden veraltete Browser-Caches. Veröffentliche die erzeugten Dateien zusammen mit `src/data/imageManifest.json`; die Manifest-Datei wird vollständig vom Skript verwaltet.

Der Browser wählt per `srcset` eine passende Größe. Nicht kritische Bilder laden verzögert; reservierte Bildmaße verhindern springende Layouts. Im Viewer wird standardmäßig die größte erzeugte Variante geladen. Optional kannst du am Bild `fullSrc: '/images/deine-groessere-webdatei.webp'` angeben: Lokale Dateien werden ebenfalls optimiert und im Viewer als größte WebP-Variante verwendet. Externe `fullSrc`-Adressen bleiben direkt verlinkt und sollten bereits passend komprimiert sein.

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

Diese bestätigten Angaben versorgen unter anderem den Footer. Die Kontaktfläche selbst verwendet ein gemeinsames Inquiry-Formular auf der Startseite und unter `/contact`; sie besteht nicht mehr aus drei großen Kontaktlinks. Lasse unbestätigte zusätzliche Werte leer. Externe Ziele beginnen mit `https://`; interne Ziele beginnen mit `/`. Änderungen benötigen für eine veröffentlichte Website einen neuen Build.

Die öffentliche Formular-Konfiguration liegt in `src/data/inquirySettings.js`. Der tatsächliche Empfänger ist zusätzlich serverseitig festgelegt; eine Änderung von `siteContent.contact.email` konfiguriert keinen Maildienst. Der vorhandene Serveradapter benötigt weiterhin einen laufenden Endpunkt, Mail-Zugangsdaten und einen verifizierten Absender. Echte Zustellung ist bisher nicht konfiguriert oder bestätigt. Die heruntergeladene HTML-Vorschau kann keine Anfrage versenden und bietet eine E-Mail-Alternative an. [Einrichtung und Zustellprüfung](INQUIRY.md).

## Kategorien und Seiten

`siteContent.workGroups` definiert die drei Hauptrubriken **tattoos / jewellery / more**. `siteContent.categories` definiert ihre Blattkategorien und die aktive Darstellung: `drift` für die drei horizontalen Karussells, `existing` für gewöhnliche Bildgalerien. Tattoos enthält Tattoos und Flashes; More enthält Analog Photography und Digital Artworks. Digital Artworks verwendet `existing`, nicht Ink-Reveal. Die Startseite behält eine horizontale Zeile mit ausschließlich den drei Hauptrubriken; ihre Unterlinks stehen erst auf Work. Auf sehr schmalen Bildschirmen bleibt die Zeile horizontal scrollbar und per Tastatur erreichbar.

Die Seiten verwenden echte URLs: `/`, `/work`, `/work/tattoos`, `/work/flashes`, `/work/jewellery`, `/work/more`, `/work/analog-photography`, `/work/digital-artworks`, `/about`, `/contact` und weiterhin `/work/paintings`. Work bleibt eine zusammenhängende Seite: Die neuen Rubriklinks springen zu `/work#tattoos`, `/work#jewellery`, `/work#more` oder einem Unterabschnitt. Bestehende Kategorie-URLs und Querylinks bleiben direkte Einstiege; sie sollen die übrigen Archive nicht aus dem Dokument entfernen. Ein veröffentlichtes Projekt mit `id: 'dein-projektname'` und `category: 'tattoos'` erhält automatisch `/work/tattoos/dein-projektname`. Verwende eindeutige IDs aus Kleinbuchstaben, Zahlen und Bindestrichen; ändere sie nach Veröffentlichung nur mit einer passenden Weiterleitung.

Auf der Homepage wird INDEX nicht mehr angezeigt. Die vorhandenen Hero-Links erschließen Work, About und die Kontaktsektion `/#contact`; auf Innenseiten bleibt der kompakte INDEX erhalten. Der Kapitelzähler gehört nur zur Homepage: Er führt durch ihre tatsächlichen Abschnitte, am Inquiry-Formular vorbei bis zum abschließenden h4-/Modushinweis. Der letzte Bereich gehört weiterhin zu Contact und erhöht nicht künstlich die Kapitelzahl. Das Formular soll erreichbar bleiben, ohne dass der Zähler seine Eingaben verdeckt.

### Das gelieferte grün-schwarze Digitaloriginal

Die JPG-Datei aus deiner ZIP ist unverändert unter `public/images/digital-artworks/green-black-original.jpg` gespeichert (1440×1920). `featuredDigitalArtwork` in `src/data/digitalArtworkSettings.js` ist bereits veröffentlicht und in `artworks` eingebunden. Automatisch erzeugte WebP-Größen decken 320, 640, 960 und 1440px ab. Das Werk erscheint unter More → Digital Artworks als vollständig sichtbares responsives Bild mit gewöhnlichen Galerie-/Detailinteraktionen. Die Scroll-Ink-Maske und ihr Canvas-/CSS-Laufzeitpfad werden für die öffentliche Darstellung nicht mehr verwendet. Titel, Beschreibung und Jahr bleiben offen, bis du sie selbst angibst. [Originalnachweis und Verhalten](DIGITAL-ARTWORK-ASSET.md).

`npm run build` schreibt eigene HTML-Dateien für diese Seiten. Der Hoster muss die jeweiligen Verzeichnis-Indexdateien und für unbekannte Ziele eine echte 404 ausliefern. Eine pauschale Weiterleitung aller unbekannten Pfade zur Homepage ist nicht mehr vorgesehen. Details stehen in [SEO.md](SEO.md). Es wurden keine Hosting- oder DNS-Einstellungen verändert und nichts deployt.

In `src/data/seoContent.js` kannst du Seitentitel und Beschreibungen bearbeiten. Optionale projektbezogene Werte stehen am Projekt unter `seo: { title, description, image }`; `image` kann ein echtes Bildobjekt mit `src`, `alt`, `width` und `height` sein. Für ein indexierbares Projekt sind ein echter Titel, eine Beschreibung und ein Bild mit Alt-Text nötig. Entwürfe erzeugen keine Detailseiten. Leere Archive werden nicht in die Sitemap aufgenommen. Die bestätigte Domain ist `https://h4ngelic.com`; Vorschau-Builds bleiben standardmäßig `noindex`.

Mit `npm run preview:export` erzeugst du `artifacts/h4ngelic-preview.html`. Diese eigenständige Datei enthält die vorhandenen Standardassets sowie lokal konfigurierte Portfolio-/Portraitbilder und verwendet ausschließlich für die Offline-Vorschau Hash-Adressen wie `#/work/tattoos`. Die echte Website behält ihre normalen URLs. Extern verlinkte Bilder werden nicht heruntergeladen und benötigen Internetzugriff. Prüfe Ergänzungen auch über `npm run preview`.


## Homepage-Bewegung anpassen

`src/data/motionSettings.js` steuert die frühen Fly-ins und ihre temporären Nachbilder. `approach: .85` beginnt den Ablauf, sobald die Oberkante eines Work-/Kontaktabschnitts etwa 85% der Viewporthöhe erreicht. `pin` steuert die zusätzliche Scrollstrecke; `fly` Distanz, Staffelung und kleinen Überschwinger. `trail` enthält die zwei Nachbild-Ebenen mit `.22` und `.13` maximaler Deckkraft. Das sind Scrollbereiche, keine Zeitangaben. Nachbilder werden aus dem vorhandenen Label erzeugt; du musst Text oder Links dafür nicht doppelt eintragen.

`src/data/heroDepthSettings.js` ergänzt die vorhandene Logoanimation um eine kleine Kamerabewegung. Die aktuellen Obergrenzen sind 8% mehr Z-Distanz (`distance: .08`) und ein Grad mehr Blickwinkel (`fieldOfView: 1`). Änderungen der Kameratiefe erfordern keine Änderung an Logo-Geometrie, Chrome-Material oder Physik. [MOTION.md](MOTION.md) erläutert alle Werte, Umkehrverhalten und reduzierte Bewegung.

## Versteckte Nachrichten und lokale Erinnerung

Die sechs Besuchstexte stehen in `src/data/easterSettings.js`. Sie erscheinen nach Entdeckung des zentralen Header-Hotspots; die äußeren Header-Labels bleiben unverändert. Die Schriftgröße und die räumlich getrennten Footer-Hotspots stehen in `src/easter-eggs.css`.

Die neu angeforderte lokale Speicherung ist aktiv: `visits.enabled: true`, `requireConsent: false`, `showNumber: true`. Gespeichert werden nur `count` und `lastSeen`. Ein normaler Seitenwechsel oder unmittelbares Neuladen ist kein neuer Besuch; standardmäßig trennt eine halbe Stunde Inaktivität die Besuche. `enabled: false` deaktiviert Speicherzugriffe, `showNumber: false` entfernt den separaten versteckten Footer-Zähler. Für eine vorhandene Host-Consent-Anbindung kann `requireConsent: true` mit Callback verwendet werden. Fehler beim Speicherzugriff lassen die Begrüßung weiterhin funktionieren. Details: [EASTER-EGGS.md](EASTER-EGGS.md).

Die versteckte Anweisung unter Kontakt lautet in Normal Mode `HOLD 4 TO SEE THE OTHER SIDE.` und im alternativen Zustand `HOLD 4 TO REVERSE.`. Die 4 wird mindestens eine Sekunde gehalten; `333` bleibt als Rückweg erhalten. Der separate Besuchszähler steht ganz unten als `VISIT 001` und ist nicht der Kapitelzähler. Beide Anweisungsvarianten nutzen dieselbe Position; der Besuchszähler steht nicht neben der Begrüßung oben.

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

`src/data/xraySettings.js` enthält die Palette, neunwertige nicht-monotone Farbkurven, Sättigung, Kanalabstand und `shortcutHoldMs: 1000`. Die sechs Besuchstexte oder echte Projektbilder müssen dafür nicht in Komponenten eingetragen werden. `src/data/uiEffectSettings.js` steuert Hover-Skalen und Pfeilform/-abstände gemeinsam; große Labels werden automatisch auf den vorhandenen Platz begrenzt.

`src/data/modeAudioSettings.js` steuert `enabled`, `volume`, `durationSeconds`, Grundton, inharmonische Teiltöne, Ausklang und Ein-/Austrittsverlauf. Die Standardklänge dauern 0,7 Sekunden, werden lokal im Browser erzeugt und über den bestehenden oberen Sound-Schalter stummgeschaltet. Ein Audiofehler verhindert keinen Moduswechsel. `npm run sounds:export` erzeugt Review-WAVs aus denselben Einstellungen. Die Website benötigt diese Dateien nicht zur Laufzeit.

Nach Änderungen an Daten/Assets prüfst du den Entwicklungsserver und erzeugst einen neuen Build bzw. Offline-Export. Die normalen Inhaltsdateien bleiben unabhängig von Effekt-Parametern. [XRAY.md](XRAY.md) erläutert die technische Umsetzung; der tatsächlich geprüfte aktuelle Stand steht in [CONTROL-CORRUPTION.md](CONTROL-CORRUPTION.md).
