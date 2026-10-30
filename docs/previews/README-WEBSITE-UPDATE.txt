H4NGELIC — V3.1 REFINEMENT

Öffnen
1. Auf GitHub im Branch feat/smart-continuation-v3 die Datei
   docs/previews/h4ngelic-preview.html öffnen.
2. „Download raw file“ wählen, die HTML-Datei speichern und auf einem
   Computer im Browser öffnen. Die GitHub-Codeansicht führt die Website nicht aus.
3. Bei portfolio-preview.zip zuerst entpacken, dann die HTML-Datei öffnen.
   Die HTML-Datei lässt sich unabhängig vom ZIP verwenden.

Aktueller Prüfstand
Den genauen geprüften Stand, Dateihashes, Testergebnisse und offene Punkte
enthalten PROJECT_PROGRESS.md und NEXT_SESSION.md im selben Branch.
Diese Anleitung selbst behauptet keine noch ausstehende erfolgreiche Prüfung.

Navigation und Gestaltung
- Das + oben rechts öffnet das nummerierte INDEX-Menü 00 / bis 04 /.
  INDEX bleibt getrennt von NAAVI unten in der Mitte.
- h4ngelic oben links führt zur Startseite.
- Kontakt liegt ausschließlich in 03 / CONTACT auf der Startseite.
  Links aus Work und About führen dorthin; Artwork-Kontext bleibt erhalten.
- HOW TO REACH YOU akzeptiert E-Mail, Instagram oder Telefonnummer.
  Der Button heißt SEND MESSAGE. Anhänge und Entwürfe bleiben bei Fehlern erhalten.
- Kleine, rahmenlose Hero-Steuerung: Slow, Pause und Sound mit aufklappbarem
  Lautstärkeregler. Steuerung und Hero-Navigation blenden beim Herunterscrollen
  gemeinsam aus und beim Zurückscrollen wieder ein.
- Ruhige, reversible Eingänge ersetzen die frühere weite, gestaffelte Flugbewegung.
  Kontaktüberschrift und Formular bewegen sich gemeinsam; WORKS-Unterüberschriften
  teilen den Fortschritt ihrer Hauptrubrik.
- Gemeinsamer dezenter Hover und ein 4px-Radius verbinden die Bedienflächen.
  Fotos, digitale Arbeiten und Korruptionseffekte behalten ihre geraden Kanten.

Die acht Tattoo-Fotografien
Alle acht vom Künstler gelieferten JPEG-Originale sind unverändert enthalten:
public/images/tattoos/tattoo-01.jpg bis tattoo-08.jpg.
Dateizuordnung, Maße und SHA-256 stehen in docs/assets/tattoo-originals-v31.json.
On Skin zeigt sie im nativen horizontalen Karussell mit Trackpad, Ziehen,
Wischen und Tastatur. Ein ausgewähltes Foto vergrößert sich an seinem Platz
um 10 Prozent; zweiter Klick, Klick daneben oder Escape stellt es zurück.
Die Website zoomt dabei nicht heraus; es öffnet sich kein zentriertes Karussell-Modal.

WORKS-Hierarchie: tattoos / on skin, flashes, leeres 3d model;
jewellery; more / digital artworks, analog photography.
Das echte grün-schwarze Digitaloriginal behält seine Bildansicht ohne Ink-Reveal.
Die Vorschau ist kleiner und verwendet passende responsive Bildvarianten.
Noch nicht mit echten Arbeiten gefüllte Archive zeigen „archive in progress.“.
Es werden keine Stockbilder oder erfundenen Projekte eingesetzt.
Eigene Arbeiten zentral in src/data/artworks.js ergänzen; siehe docs/CONTENT.md.

Footer
Der lokale Zähler heißt VISIT 0000, mit mindestens vier Ziffern.
Er liegt rechts bei smash / instagram / berlin, de und erscheint dezent bei
Hover, Tastaturfokus oder Tap. Die sieben früheren Begrüßungstexte entfallen.
Interne Navigation zählt keinen neuen Besuch. Auf schmalen Bildschirmen lassen
sich die Footer-Gruppen innerhalb ihrer Zeile horizontal bewegen; NAAVI behält
seinen eigenen Platz in der Mitte.
Links neben diesem Bereich stehen Branding und h4 moshlab ↗. Der MOSH-LAB-Link
bleibt der genehmigte Platzhalter, bis seine echte Zieladresse vorliegt.

SMASH — freigegebener Originaltrack
Der unveränderte, ausdrücklich zur Veröffentlichung freigegebene Track lautet:
h4ngelic_v8_full_sound_remaster_v11.mp3
Größe: 3.210.973 Bytes
SHA-256: 307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b

SMASH im Footer startet den Track von vorn mit etwa 1,8 Sekunden Einblendung.
Die vorhandenen Website-Klänge werden zurückgenommen. In den letzten ungefähr
fünf Sekunden blendet der Track aus. Ein erneuter Klick beendet ihn mit etwa
einer Sekunde Ausblendung; nach Stopp oder natürlichem Ende werden die normalen
Klänge wieder freigegeben. Sound-Mute und Lautstärke gelten für die gesamte
Mischung. Interne Seitenwechsel und 333↔4 unterbrechen den Track nicht.

Auf der über HTTP geöffneten Website wird die MP3 erst beim ersten bewussten
SMASH-Aufruf geladen und anschließend im selben Dokument wiederverwendet.
Diese Offline-HTML enthält die freigegebenen MP3-Bytes bereits, damit kein
Internet nötig ist; deshalb ist die Datei größer. Decodierung und Wiedergabe
beginnen auch hier erst nach Bedienung. Ist Sound ausgeschaltet, bleibt die
Wiedergabe stumm, bis Sound wieder eingeschaltet wird.

THE OTHER SIDE
Taste 4 oder Numpad 4 mindestens eine Sekunde halten; zurück mit 333 oder
nochmaligem Halten von 4. Kurzes Antippen reicht nicht. Auf Touch-Geräten den
h4-Schalter viermal antippen, zum Zurückkehren dreimal. Eingabefelder vorher
verlassen. Reduzierte Bewegung wird respektiert. Bestehender Chrome-Hero,
Physik, finales originales h4 und Memory-Moshing bleiben erhalten.

Offline-Grenzen
Alle benötigten lokalen Website-Assets sind eingebettet. Interne Seiten nutzen
in dieser Datei #-Adressen. Externe Links benötigen weiterhin Internet.
Echter Anfrageversand benötigt einen konfigurierten Mail-Dienst und ist in
einer Offline-Datei nicht verfügbar. Eine Vorschau bestätigt keinen Mailversand.

Dies ist eine herunterladbare Review-Vorschau, keine Produktionsseite.
Es erfolgt kein Launch, kein Domain-Anschluss, kein Merge in main und keine
Änderung an api/inquiry.js durch diese V3.1-Verfeinerung.
