# Architektur

Die bestehende Website bleibt Vite + JavaScript + CSS + Three.js. Ein kleiner Build-Schritt ergänzt statisches HTML; es gibt keinen Framework-Wechsel, kein CMS, keine Datenbank und keine Anmeldung.

| Bereich | Verantwortung |
| --- | --- |
| `src/data/siteContent.js` | Künstleridentität, sichtbare Texte, Kategorien und bestätigte Kontaktziele |
| `src/data/artworks.js` | Tatsächliche Projekte, Veröffentlichungsstatus, Bildlisten und optionale Projektmetadaten |
| `src/data/seoContent.js` | Editierbare Seitentitel, Beschreibungen, bestätigte Domain und sichere Vorschau-Voreinstellung |
| `src/routes.js` | Kanonische URLs, Routenerkennung und veröffentlichte Projektpfade |
| `src/pages.js` | Gemeinsame semantische HTML-Renderer für Build und Browser |
| `src/seo.js` | Reine Metadaten-/JSON-LD-Erzeugung und Aktualisierung nach Navigation |
| `src/app.js` | Seiteneinstieg, Interaktionen und bedarfsgeladener Hero |
| `src/navigation.js` | Normale Links progressiv ergänzen, kurze View Transitions, Verlauf/Scrollposition/Fokus |
| `src/image-reveals.js` | Sichtbarkeitsgesteuerte Masken für vorhandene, nicht kritische Bilder |
| `src/footer.js`, `src/easter-eggs.js` | Semantischer Footer, kurzlebige Tinte und standardmäßig nicht persistente Besuchsanzeige |
| `src/xray.js`, `src/data/xraySettings.js` | Dokumentweiter Modus, wiederverwendbare Medienfilter und editierbare visuelle Parameter |
| `src/wordmark-xray.js` | Farbkurven ausschließlich auf den Fragmenten des Wordmarks; Normalzweig unverändert, keine zusätzliche Rendering-Schleife |
| `scripts/prerender.mjs` | Vollständige statische Dokumente, 404, Sitemap, Robots und Routenmanifest |
| `scripts/serve-preview.mjs` | Lokale Prüfung echter Statuscodes, Canonical-Redirects und komprimierter Dateien |
| `vite.config.js` | Gemeinsame öffentliche SEO-Buildkonfiguration und Entwicklungs-Redirects/404 |

## URLs und Inhaltsmodell

Die Startseite bleibt minimal; ihre drei horizontalen Kategorien verlinken auf `/work/tattoos`, `/work/jewellery` und `/work/paintings`. `/work` zeigt alle Projekte, `/about` die Künstlerbeschreibung, `/#contact` den Kontaktabschnitt der Startseite. Veröffentlichtes Artwork erhält `/work/<category>/<id>`; dieselbe zentrale Routentabelle wird von HTML-Build, Browser und Vorschau-Server verwendet. Die früheren `?category=`-Links bleiben als Redirects kompatibel.

Ein Projekt besteht aus einer URL-tauglichen `id`, einer bekannten `category`, tatsächlichen Bildern und optionalen Angaben wie Titel, Beschreibung, Jahr und Details. `published: false` bleibt verborgen. Für Suchmaschinen reicht ein bloßes Bild nicht: vollständige Texte und Bild-Alt-Text sind zusätzlich nötig, bevor Projekt-/Archivseiten indexierbar werden. Es existieren keine erfundenen Portfolioeinträge. Die Bearbeitung ist in [CONTENT.md](CONTENT.md), die Indexierungsregeln in [SEO.md](SEO.md) beschrieben.

## HTML zuerst, Interaktion ergänzend

Vite erzeugt zunächst den bestehenden Einstieg und die unveränderten Code-/Asset-Chunks. Der Prerender-Schritt verwendet anschließend `renderRoutePage(route)` und `getPageMetadata(route)` und schreibt für jede tatsächliche Route ein eigenes Dokument. Der sichtbare Text, normale Links, Bildbeschreibungen, Überschriften und Metadaten sind ohne JavaScript lesbar. 3D, Cursor und Reveal-Effekte werden zum Verständnis der Inhalte nicht benötigt.

`index.html` enthält bewusst `seo`, `hero` und `content`-Kommentarpaare. Der Build ersetzt genau diese Blöcke und schlägt fehl, wenn sie fehlen oder doppelt vorkommen. `#page-content[data-prerendered]` kennzeichnet die bereits gerenderte Route, damit der Browser sie beim ersten Laden erhält.

Die Startseite enthält den tatsächlichen Hero. Auf Work, About, Projektseiten und 404 liegt sein ursprüngliches Markup ausschließlich in einem **inerten `<template id="hero-template">`**. Es erzeugt dort weder einen aktiven zusätzlichen H1 noch Canvas-/Hero-Anfragen. Bei späterer Navigation zur Startseite kann der Browser dieses Template einmal klonen. Der bestehende Three.js-Einstieg bleibt ein dynamischer Import, der erst beim sichtbaren Homepage-Hero ausgelöst wird.

Normale Anker bleiben die Navigationsgrundlage. Die Browser-Erweiterung erhält das Dokument und die bereits erzeugte 3D-Szene, aktualisiert Inhalt/Metadaten und stellt Fokus und Verlaufpositionen wieder her. Unbekannte Routen werden regulär angefordert und behalten ihre tatsächlichen HTTP-Statuscodes. Ein verspätet fertig geladenes 3D-Modul wartet zusätzlich auf den sichtbaren Hero, bevor es einen Kontext anlegt. Seitenmodule räumen ihre eigenen Observer und Listener vor dem Austausch auf; delegierte Footer-/Navigationslistener werden nur einmal pro Dokument angelegt. Es gibt keine persistenten Navigations- oder Besucherkennungen.

## Build und Vorschau

```sh
npm run build
npm run preview -- --port 4173
npm test
```

Der Build schreibt unter `dist/`:

- `index.html`, `about/index.html`, `work/index.html` und die drei Kategorie-Dokumente.
- Weitere Projektdokumente ausschließlich aus echten veröffentlichten Datensätzen.
- `404.html` mit verständlicher Navigation und ohne erfundenen Canonical.
- `sitemap.xml`, `robots.txt` und `route-manifest.json` mit der tatsächlich gebauten Indexierungsrichtlinie.

Der Vorschau-Server verwendet das Manifest für HTTP-Header und Route-Status. Er liefert gültige Dokumente mit 200, Canonical-Aliase mit 301, unbekannte Seiten mit 404 und fehlende Dateien als einfache Datei-404. Er unterstützt GET/HEAD, schützt vor Dateizugriffen außerhalb von `dist/` und hält komprimierbare Dateien samt gzip-Version im Speicher. Nach Neubauten muss er neu gestartet werden. Eine allgemeine SPA-Fallback-Regel gehört nicht zur Produktionsarchitektur.

Die Domain und die Produktionsfreigabe sind getrennte Einstellungen. Die bestätigte Domain ist `https://h4ngelic.com`, der Standardbuild bleibt `preview`. Erst ein ausdrücklich gewählter `H4_DEPLOYMENT=production`-Build erzeugt indexierbare vollständige Seiten. Details zu späterem Hosting, Suchmaschinenprüfung und Crawlerpolitik stehen in [SEO.md](SEO.md). Dieser Ablauf führt selbst keine Veröffentlichung durch.

## Grenzen

Statisches Prerendering bedeutet: Neue Projekte, Bilder, Texte oder geänderte Metadaten benötigen einen neuen Build. Es verarbeitet keine privaten Inhalte und zieht keine externen Bilder oder Profile automatisch ein. Unvollständige Archive bleiben bewusst nicht indexierbar. Browserinteraktionen und WebGL werden separat getestet; ein korrektes statisches Dokument beweist weder reale Gerätegeschwindigkeit noch Suchmaschinenindexierung.
