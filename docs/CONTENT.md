# Inhalte bearbeiten

Die Website verwendet einfache JavaScript-Dateien. Du brauchst weder React-Komponenten noch ein CMS, eine Datenbank oder einen Login zu bearbeiten.

| Inhalt | Datei |
| --- | --- |
| Projekte und Bilder | `src/data/artworks.js` |
| Kategorien, About-Texte, Kontaktlinks | `src/data/siteContent.js` |
| Eigene Bilddateien | `public/images/` |
| Automatisch erzeugte Bildvarianten | `public/images/optimized/` |
| Automatisch ermittelte Bildgrößen | `src/data/imageManifest.json` — nicht manuell bearbeiten |

## Ein Tattoo, Schmuckstück oder Gemälde hinzufügen

1. Lege deine Bilddateien unter `public/images/` ab. Den Ordner kannst du beim ersten Projekt anlegen. Verwende kurze Dateinamen ohne Leerzeichen, zum Beispiel `projektname-01.webp`. WebP, AVIF, JPEG und PNG sind möglich. Verwende statische Bilder und bewahre deine Druckoriginale separat auf.
2. Öffne `src/data/artworks.js`. Ersetze die leere Liste `[]` durch deine Einträge. Das folgende Beispiel zeigt die Struktur; es wird erst mit deinen tatsächlichen Bildern und Angaben zum Projekt.

```js
export const artworks = [
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

3. Wähle `tattoos`, `jewellery` oder `paintings` als Kategorie. Für Schmuck oder Malerei wird nur dieser Wert geändert; der Aufbau bleibt gleich. Jedes Projekt benötigt eine eigene `id` und mindestens ein vorhandenes Bild. Titel, Jahr, Beschreibung, Bildunterschrift und `details` sind optional. Die Bildmaße werden automatisch ermittelt; wenn du `width` und `height` selbst angibst, müssen sie den angezeigten, gegebenenfalls nach EXIF gedrehten Maßen entsprechen.
4. Füge weitere Projekte mit Komma getrennt in dieselbe Liste ein. Die Reihenfolge der Einträge ist die Reihenfolge im Archiv. Mit `published: false` bleibt ein Entwurf verborgen. Mehrere Bilder erscheinen gemeinsam innerhalb des Projekts, mit der ersten Aufnahme als großem Hauptbild. Ein Klick auf ein Bild öffnet den Viewer; Pfeiltasten wechseln zwischen den Bildern desselben Projekts, Escape schließt ihn.
5. Starte `npm run dev` und prüfe `/work` sowie den jeweiligen Filter. Der Start erzeugt automatisch passende WebP-Dateien. Wenn der Entwicklungsserver bereits läuft und du Bilder oder Einträge ergänzt, führe `npm run images:optimize` erneut aus oder starte den Server neu. `npm run build` erzeugt die Varianten ebenfalls automatisch und prüft den Produktionsbuild. `npm test` prüft unter anderem Datenanzeige, Bildverarbeitung und Animation; `npm run test:portfolio` und `npm run test:gallery` prüfen Navigation und Viewer bei laufendem Entwicklungsserver.

Solange keine veröffentlichten Einträge mit Bildern vorhanden sind, zeigt das Archiv ausschließlich „archive in progress.“. Das bereits gelieferte Poster bleibt im 3D-Reveal und wird nicht automatisch zum Portfolioeintrag. Du kannst es später bewusst als Projekt mit deinen Angaben aufnehmen.

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
  getInTouchURL: '', // optionales eigenes Ziel für „get in touch“
  instagramURL: '', // deine vollständige https://-Profiladresse
  email: '',        // deine E-Mail-Adresse, ohne mailto:
  bookingURL: '',   // dein tatsächlicher Buchungslink
},
```

Lasse fehlende Werte leer. Es werden keine Adressen erfunden: nicht konfigurierte Einträge bleiben lesbar und als noch nicht verfügbar gekennzeichnet. Sobald du eine gültige Adresse einträgst, wird der Eintrag automatisch zu einem Link. „get in touch“ nutzt die E-Mail-Adresse, wenn kein eigenes Ziel gesetzt ist. Externe Ziele beginnen mit `https://`; interne Ziele beginnen mit `/`. Änderungen werden beim lokalen Entwickeln direkt übernommen und benötigen für eine veröffentlichte Website einen neuen Build.

## Kategorien und Seiten

Die drei Kategorien stehen zentral in `siteContent.categories` und liefern Bezeichnungen, Startseitenlinks und Work-Filter. Die Startseite zeigt sie immer in einer horizontalen Zeile; auf sehr schmalen Bildschirmen bleibt die Zeile horizontal scrollbar und per Tastatur erreichbar.

Die Produktionsseiten verwenden echte URLs: `/`, `/work`, `/work?category=tattoos` und `/about`. Der Kontaktlink führt nach `/#contact`. Der Webserver muss unbekannte Seitenpfade auf `index.html` auflösen; Vites Entwicklungs- und Vorschau-Server unterstützen das bereits. Für einen späteren Hoster ist diese HTML-Fallback-Regel nötig. Asset-Dateien sollen regulär ausgeliefert werden. Es wurde kein Hoster konfiguriert und nichts deployt.

Mit `npm run preview:export` erzeugst du `artifacts/h4ngelic-preview.html`. Diese eigenständige Datei enthält die vorhandenen Standardassets sowie lokal konfigurierte Portfolio-/Portraitbilder und verwendet ausschließlich für die Offline-Vorschau Hash-Adressen wie `#/work?category=tattoos`. Die echte Website behält ihre normalen URLs. Extern verlinkte Bilder werden nicht heruntergeladen und benötigen Internetzugriff. Prüfe Ergänzungen auch über `npm run preview`.
