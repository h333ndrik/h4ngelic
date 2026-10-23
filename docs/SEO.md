# SEO und Veröffentlichung

Die vom Künstler bestätigte Produktionsdomain ist **https://h4ngelic.com**. Die Website wird durch diese Änderungen weder veröffentlicht noch bei Suchmaschinen als indexiert gemeldet. Der normale Build ist eine Vorschau und absichtlich nicht indexierbar.

## Vorschau und Produktion bewusst unterscheiden

```sh
npm run build
npm run preview -- --port 4173
```

Der Standard `deployment: 'preview'` steht in `src/data/seoContent.js`. Vorschauseiten erhalten `noindex, follow` sowohl im HTML als auch im HTTP-Header des eigenen Vorschau-Servers. Ihre `robots.txt` sperrt das Crawling; ihre Sitemap bleibt leer. Canonicals zeigen auf die bestätigte Produktionsdomain. Eine öffentliche Vorschau erhält dadurch keine eigene kanonische Identität.

Ein später ausdrücklich freigegebener Produktionsbuild verwendet:

```sh
H4_DEPLOYMENT=production npm run build
npm run preview -- --port 4173
```

`H4_PRODUCTION_URL` kann die konfigurierte Domain überschreiben, falls sich die bestätigte Domain ändert. Erlaubt ist ausschließlich ein HTTPS-Origin ohne Pfad, Zugangsdaten, Query oder Fragment. Produktionsbuilds ohne gültige Domain schlagen fehl. Keine Hostname-Erkennung schaltet Vorschauen automatisch auf indexierbar. Die Build-Einstellung wird auch in das JavaScript eingebettet, damit spätere Navigation keine abweichenden Meta-Tags erzeugt.

Der Vorschau-Server liest die Einstellung aus `dist/route-manifest.json`, nicht aus der Umgebung seines späteren Starts. Er hält Dateien und gzip-Versionen im Speicher: **nach jedem neuen Build den Vorschau-Server neu starten**. Er ist ein Prüfserver und keine Produktionsbereitstellung.

## Metadaten und tatsächliche Inhalte

`src/data/seoContent.js` enthält Titel, Beschreibungen, Sprache, Domain und optionale Social-Preview-Bilder. About-Texte und bestätigte Kontaktprofile bleiben in `src/data/siteContent.js`. Ein Social-Bild ist zunächst nicht gesetzt; es wird kein Ersatzmotiv erfunden.

`src/seo.js` erzeugt pro Route Titel, Beschreibung, Canonical, Robots, Open Graph und JSON-LD. Metadaten sind bereits im ausgelieferten HTML vorhanden und benötigen weder JavaScript noch die 3D-Szene. Freie Texte werden für HTML und inline JSON sicher escaped.

| Route | Produktionsindexierung |
| --- | --- |
| `/`, `/about` | indexierbar |
| `/work`, `/work/tattoos`, `/work/jewellery`, `/work/paintings` | erst mit mindestens einem vollständigen veröffentlichten Projekt in der jeweiligen Auswahl |
| `/work/<category>/<id>` | nur vollständige veröffentlichte Projekte |
| unbekannte Pfade | HTTP 404, `noindex`, kein Canonical |

Ein vollständiges Projekt besitzt eine gültige Kategorie/ID, einen Titel, eine Beschreibung und mindestens ein gültiges Bild mit aussagekräftigem Alt-Text. `published: false` veröffentlicht weder eine Projektseite noch einen Sitemap-Eintrag. Die aktuellen leeren Archive zeigen weiterhin „archive in progress.“; sie sind keine indexierbaren Beispielportfolios.

Projektmetadaten können optional ergänzt werden:

```js
seo: {
  title: 'dein tatsächlicher projekttitel — h4ngelic',
  description: 'Eine konkrete Beschreibung dieses realen Projekts.',
  // Optional nur ein vorhandenes Bild; sonst wird das erste Projektbild genutzt.
  image: { src: '/images/dein-projekt.webp', alt: 'Das sichtbare Motiv', width: 1200, height: 1600 },
},
```

Füge nur reale Bilder und korrekte Maße hinzu; Produktionsbilder werden über die vorhandene Bildpipeline vorbereitet. Relative Bildadressen werden für Social-Metadaten und strukturierte Daten gegen die bestätigte Domain aufgelöst. Bild-URLs müssen öffentlich erreichbar sein. Es werden keine Indexierungs- oder Suchplatzierungsversprechen gemacht.

## Strukturierte Daten

Das JSON-LD beschreibt `WebSite`, `WebPage`/`AboutPage`/`CollectionPage`, `Person` und sinnvolle Breadcrumbs. Reale Projektseiten ergänzen `VisualArtwork` und `ImageObject`. Die Identität lautet **h333ndrik**, mit dem alternativen Namen **h4ngelic**, Arbeitsort **Berlin** und den im About-Text genannten Disziplinen. `sameAs` entsteht nur aus einem tatsächlich konfigurierten HTTPS-Instagram-Profil. Keine Straßenadresse, Geschäftszeiten, Preise, Bewertungen oder fiktive `LocalBusiness`-Einträge werden erzeugt. Jahreszahlen und Bildmaße erscheinen nur, wenn sie geliefert wurden.

Vor einer späteren Veröffentlichung JSON-LD mit dem Schema Markup Validator und gegebenenfalls Googles Rich Results Test prüfen. Korrektes Schema garantiert keine besonderen Suchdarstellungen; nicht jede Schema.org-Klasse ist ein Google-Rich-Result-Typ.

## Canonicals, Statuscodes und Hosting

`npm run build` erzeugt vollständige HTML-Dateien für jede veröffentlichte Route, `404.html`, `sitemap.xml`, `robots.txt` und ein Routenmanifest. Nur indexierbare kanonische URLs gelangen in die Sitemap; ohne reale Projekte sind das bei einem Produktionsbuild ausschließlich Startseite und About.

Die alten Links `/work?category=tattoos` usw. werden vom eigenen Vorschau-Server per **301** auf `/work/tattoos` usw. umgeleitet. Bekannte Pfade mit abschließendem Slash oder `/index.html` erhalten ebenfalls ihre kanonische URL. Unbekannte Seiten liefern echte **404**; fehlende Assets liefern eine einfache Datei-404 und kein Homepage-HTML.

Ein späterer Hoster muss diese Eigenschaften erhalten:

- Für bekannte URLs die jeweils generierte HTML-Datei ausliefern; keine globale SPA-Regel „alle Anfragen → index.html mit 200“ verwenden.
- `404.html` für unbekannte Seiten mit Status 404 ausliefern.
- Die drei alten Kategorie-Query-Links gezielt per 301 umleiten; den übrigen Query-String nicht zur neuen kanonischen Identität machen.
- Vorschau-Deployments zusätzlich serverseitig mit `X-Robots-Tag: noindex, follow` versehen; Produktionsantworten vor Freigabe auf versehentliche `noindex`-Header prüfen.
- HTML, JavaScript, CSS und SVG komprimiert ausliefern; statische Bilder nicht durch HTML-Fallbacks ersetzen.

Cloudflare Pages kann statische HTML-Verzeichnisse und eine oberste `404.html` ausliefern; die endgültigen Status-/Redirect-Regeln müssen beim tatsächlichen Hoster geprüft werden. Für queryabhängige Redirects ist dort eine gezielte Regel oder kleine Serverfunktion erforderlich. Diese Arbeit verändert keine Cloudflare-, GoDaddy-, DNS- oder Hosting-Einstellungen.

## Crawler und KI-Suche

Die vorhandene Produktions-Crawlerpolitik wird erhalten: Wenn `public/robots.txt` bereits Regeln enthält, übernimmt der Build sie unverändert. Ohne bestehende Datei fügt der Produktionsbuild nur Kommentare und die Sitemap-Adresse hinzu; es werden keine neuen `Allow`-Regeln oder crawlerbezogenen Trainingsfreigaben eingeführt. Vorhandene bewusste Sperren gehören in diese Datei und dürfen bei einer späteren Änderung nicht versehentlich entfernt werden.

**OAI-SearchBot** dient der OpenAI-Suche; **GPTBot** betrifft einen anderen Zweck, einschließlich potenziellen Modelltrainings. Beide sind getrennt zu entscheiden. Diese Implementierung ändert keine ausdrückliche Trainingsrichtlinie und behandelt Suchauffindbarkeit nicht als Zustimmung zum Training. Auch andere Such- und Trainingscrawler sind anhand ihrer jeweiligen Dokumentation getrennt zu prüfen. `llms.txt` ist für diese Grundlage nicht erforderlich und wurde nicht hinzugefügt.

## Prüfung nach einer freigegebenen Veröffentlichung

1. Produktions-HTML, Canonicals, HTTP-Status, `robots.txt` und Sitemap auf der tatsächlichen Domain prüfen. Startseite und About dürfen kein versehentliches `noindex` tragen; leere Archive bleiben ausgeschlossen.
2. Eigentum in Google Search Console und Bing Webmaster Tools mit einer vom Eigentümer freigegebenen Methode verifizieren. DNS-TXT, HTML-Dateien oder Kontoeinstellungen werden hier nicht automatisch geändert.
3. `https://h4ngelic.com/sitemap.xml` dort einreichen und einzelne reale URLs über die URL-Prüfung kontrollieren.
4. Indexabdeckung, ausgeschlossene Seiten, Canonical-Auswahl und Crawlfehler beobachten. Nach dem Hinzufügen realer Projekte neu bauen und deren Sitemap-/Metadateneinträge prüfen.

Lokale Tests prüfen technische Voraussetzungen. Sie bestätigen weder eine tatsächliche Veröffentlichung noch Suchmaschinenindexierung.
