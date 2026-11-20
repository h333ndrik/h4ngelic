# Codemap — h4ngelic

Geprüft gegen: 88934610fd01

Wo steht was? Jeder Bereich nennt **eine Datei und einen Suchanker** statt einer
Zeilennummer, weil Zeilennummern bei jeder Änderung verrutschen. Anker-Format:

```text
datei.js — Block „ankername"
```

`ankername` ist ein Text, der in der Datei wörtlich vorkommt (Funktionsname,
Token, Kommentar). `tests/codemap.test.js` prüft, dass jede hier genannte Datei
existiert und jeder Anker in ihr vorkommt — auch in `docs/karte.html`.

> **Pflegeregel:** Wer Struktur ändert (Datei neu/umbenannt, Sektion, Label,
> Route, Animationsparameter), pflegt `CODEMAP.md` **und** `docs/karte.html` im
> selben Commit. Sonst wird der Test rot.

---

## 1 — ROUTEN

| Route | Was passiert | Code |
| --- | --- | --- |
| `/` | Startseite mit Hero, INDEX, Rubrik-Reihe | `src/routes.js` — Block "resolveRoute" |
| `/creative/*` | Rubrikseiten (tattoos, jewellery, tools, more) | `src/pages.js` — Block "renderWorkPage" |
| `/about`, `/contact` | Text- und Formularseite | `src/pages.js` — Block "renderWorkPage" |
| Vorgerendert | 23 Routen + 404 als statisches HTML | `scripts/prerender.mjs` — Block "prerender" |
| Titel/Description | pro Route gesetzt | `src/seo.js` — Block "applyMetadata" |

Der Router arbeitet clientseitig weiter, die vorgerenderten Dateien sind der
Einstieg. Eine Route ohne Vorrendern ist ein Fehler im Build, nicht im Browser.

## 2 — DATEN

| Inhalt | Datei |
| --- | --- |
| Rubriken, Sektionen, Labels (`tattoos`, `jewellery`, `tools`, `more`) | `src/data/siteContent.js` — Block "workGroups" |
| Abschnittsnamen für INDEX/Headings (`sectionLabels`) | `src/data/siteContent.js` — Block "sectionLabels" |
| Kartenmaße der Karussells (300 × 420 mobil) | `src/carouselSettings.js` — Block "carouselSettings" |
| Physik-Profile Desktop/Touch | `src/data/heroPhysicsSettings.js` — Block "heroPhysicsProfiles" |
| Cooldown für Splats/Hero-Klick (320 ms) | `src/data/interactionMoshSettings.js` — Block "cooldownMs" |
| Poster-Verhalten (Reduced Motion = statisch) | `src/data/heroPosterSettings.js` — Block "reducedMotionStatic" |
| Begrüßungstexte in der Topbar | `src/data/easterSettings.js` — Block "nice to meet you." |

### Bilder je Sektion

| Sektion | Bildordner | Referenz |
| --- | --- | --- |
| tattoos (`#onskin`) | `public/images/tattoos/` — 8 JPEG (`tattoo-01` … `tattoo-08`) | `src/data/artworks.js` — Block "suppliedTattooPhotographs" |
| flashes | `public/images/flashes/` — 15 JPEG (`flash-01` … `flash-15`, 905 × 1280) | `src/data/artworks.js` — Block "suppliedFlashPhotographs" |
| digital-artworks | `public/images/digital-artworks/` — 1 JPEG | `src/data/digitalArtworkSettings.js` — Block "green-black-original.jpg" |
| jewellery | `public/images/jewellery/` — **Ziel, existiert noch nicht** | `src/data/placeholderProjects.js` — Block "placeholderProjects" |
| tools (m4shlab, thr4ce) | `public/images/tools-source/` — 6 PNG | `src/data/siteContent.js` — Block "tools-source" |
| generierte Varianten | `public/images/optimized/` — 65 WebP, aus den Originalen erzeugt | `scripts/optimize-images.mjs` — Block "images/optimized/" |

Pfade stehen **hart** in den Datenmodulen (kein CMS, keine API, kein base64).
Platzhalterkarten (`src/data/placeholderProjects.js` — Block "placeholderProjects")
greifen nur noch, solange eine Rubrik keine echten Einträge hat — heute also
nur bei jewellery.
`src/image-assets.js` — Block "getImageAsset" baut aus
`src/data/imageManifest.json` die `srcset`-Varianten; das Manifest schreibt
`npm run images:optimize`, das bei `dev` und `build` automatisch läuft.

## 3 — KOMPONENTEN

| Komponente | Aufgabe | Code |
| --- | --- | --- |
| App-Start | rendert die Route, startet alle Helfer | `src/app.js` — Block "initPressState(document)" |
| Hero 3D | Wortmarke, Kamera, Drag, Einfahrt | `src/main.js` — Block "LogoPhysics" |
| Hero-Basisbewegung | 15-s-Zyklus, Schweben und Drehen | `src/motion.js` — Block "sampleBase" |
| Physik | Drag, Nachlauf, Rückkehr in Ruhelage | `src/physics.js` — Block "beginDrag" |
| Tiefen-Effekt | Parallaxe beim Scrollen | `src/hero-depth.js` — Block "createHeroDepth" |
| NAAVI + INDEX | Kapitelzähler, Sprungmarken, Hash | `src/global-navigation.js` — Block "syncHash" |
| Footer | Zeilen, Links, End-Reveal | `src/footer.js` — Block "exhibition-footer" |
| Marquee | ziehbare Bilderstreifen | `src/horizontal-drift.js` — Block "carouselPhase" |
| Reveal | Sektionen fahren beim Scrollen ein | `src/section-entrance.js` — Block "data-section-reveal" |
| Press-State | kurze Rückmeldung beim Antippen | `src/press-state.js` — Block "is-pressed" |
| Sound | Mute, Lautstärke, Taste „m" | `src/sound-controls.js` — Block "data-mode-mute" |
| Ink/Splats | Kleckse auf leerer Fläche | `src/corruption.js` — Block "queueImpulse" |
| Xray-Modus | Material-Ansicht | `src/xray.js` — Block "data-xray" |
| Mannequin | 3D-Vorschau im Abschnitt „3d model" | `src/mannequin-preview.js` — Block "initMannequinPreview" |

## 4 — STYLES

| Bereich | Datei |
| --- | --- |
| Grundlayout, Hero-Bühne, Poster | `src/style.css` — Block ".stage.is-ready" |
| Startseite, Rubrik-Reihe | `src/homepage.css` — Block ".hero" |
| Rubrik-Reihen (Typ A/B/C, Abstände) | `src/rubric-row.css` — Block "row-" |
| Archiv-Struktur, Kartenmaße mobil | `src/archive-structure.css` — Block "--carousel-card-width" |
| Logo-Cursor (eine Regel, letzte Ebene) | `src/cursor.css` — Block "--h4-cursor-interactive" |
| NAAVI-Leiste | `src/global-navigation.css` — Block "chapter-counter" |
| HOLD-4-Hinweis, Footer-Geheimnis | `src/easter-eggs.css` — Block "footer-secret" |
| schwebendes Glyph (mobil aus) | `src/mobile-mode.css` — Block "mobile-mode" |
| Reveal-Animation | `src/section-entrance.css` — Block "is-section-reveal" |

## 5 — EVENTS

Auslöser → Datei:Anker → Wirkung → Animationsregel.

| Auslöser | Datei:Anker | Wirkung | Animationsregel |
| --- | --- | --- | --- |
| `pointerdown` auf dem Hero | `src/main.js` — Block "pointerDown" | Drag startet, Logo folgt dem Finger | direkt per rAF, **keine** CSS-Transition auf Position |
| `pointermove` | `src/main.js` — Block "pointerMove" | Bewegung wird gepuffert und im nächsten Frame gesetzt | 1 Frame Verzögerung, kein Lerp |
| `pointerup` / `pointercancel` | `src/main.js` — Block "pointerUp" | Loslassen, Nachlauf, Rückkehr in Ruhelage | Physik-Dämpfung, kein Snap |
| Hero bereit | `src/main.js` — Block "markHeroReady" | Poster blendet aus, Logo fährt von oben ein | `translateY -100% → 0`, 1100 ms, expo-out |
| Klick auf leere Fläche | `src/corruption.js` — Block "queueImpulse" | ein Splat | Cooldown 320 ms, danach wieder einer |
| `pointerdown` auf Link | `src/press-state.js` — Block "is-pressed" | Link wirkt gedrückt | Klasse ohne Transition, `opacity .72` |
| Ziehen am Marquee | `src/horizontal-drift.js` — Block "carouselPhase" | dragging → momentum → settling → drift | Einrasten auf ganze Karten nach Touch (Schritt = Karte + Abstand) |
| Scrollen in eine Sektion | `src/section-entrance.js` — Block "data-section-reveal" | Sektion fährt ein | 520 ms Opacity, 700 ms `translateY`, einmalig |
| Taste „m" | `src/sound-controls.js` — Block "keydown" | Mute an/aus, Label folgt | keine |
| Klick auf INDEX | `src/global-navigation.js` — Block "data-global-index" | Panel öffnet/schließt | `details`, native |
| Kapitelwechsel | `src/global-navigation.js` — Block "syncHash" | URL bekommt Sektions-Hash | `replaceState`, nie `pushState` |
| HOLD 4 | `src/xray.js` — Block "data-xray" | Wechsel auf die andere Seite | Übergang wie Moduswechsel |

## 6 — TESTS

| Zweck | Datei |
| --- | --- |
| Node-Tests (Logik, Kontrakte) | `tests/*.test.js` |
| Cursor-Vertrag über die ganze Fläche | `tests/cursor-hit-test.mjs` |
| Hero-Einfahrt und Boot | `tests/hero-boot-browser.mjs` |
| Mobile-Parität | `tests/mobile-parity-browser.mjs` |
| Navigation und NAAVI | `tests/v31-navigation-browser.mjs` |
| Serielle Gate-Battery | `scripts/gate-battery.mjs` — Block "const all = [" |
| Diese Karte | `tests/codemap.test.js` — Block "Geprüft gegen" |

## 7 — REGELN

- **Anker-Vertrag.** Verweise nennen Datei + Suchanker, niemals Zeilennummern.
  Anker müssen wörtlich in der Datei stehen; `tests/codemap.test.js` prüft das
  für `CODEMAP.md` und `docs/karte.html` gemeinsam.
- **Mobile-Dauerregel.** Unter 600 px ändern sich Layout und Bedienung, **nicht**
  die Dauern: es gibt keine mobilen Übergangszeiten. Geprüft per Suche nach
  `transition-duration`/`animation-duration` in allen `max-width: 600px`-Blöcken
  — 0 Treffer. Neue Mobilanpassungen dürfen keine eigenen Zeiten einführen.
- **Hash-Regel.** Die URL bekommt den Sektions-Hash ausschließlich per
  `replaceState` (`src/global-navigation.js` — Block "syncHash"); ein Frame der
  alten Route darf ihn nicht mehr schreiben (`refresh()` bricht ab).
- **Reduced Motion.** `prefers-reduced-motion: reduce` schaltet den Hero auf das
  statische Poster (`src/data/heroPosterSettings.js` — Block "reducedMotionStatic"), Reveals springen sofort an ihren Endzustand, Marquee
  verliert Nachlauf und Einrasten. Das ist Vertrag, kein Fehler.
- **Kein Deploy ohne „go".** Merge und Push nach `main` lösen den
  Production-Build aus und brauchen ein ausdrückliches „go" des Users.
