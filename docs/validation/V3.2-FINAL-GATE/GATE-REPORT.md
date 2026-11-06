# V3.2 FINAL GATE — Release-Vorbereitung und volle serielle Battery

Stand: 05.11.2026 · Branch `v3.1.1-fixes` (Worktree `f18-r4-blanket-cursor`) ·
Gate-Basis vor dem Sync `54cddb5`, nach dem Merge `c4d6b29`.
Kein Merge in `main`, kein Deploy, kein Force-Push — dieser Lauf liefert nur die
Entscheidungsgrundlage.

## 1. Pre-flight

| Prüfung | Ergebnis |
| --- | --- |
| `document.documentElement.dataset.build` auf `https://www.h4ngelic.com` | **`3f4693052f7e`** = `origin/main` (`3f46930`, V3.2 world sound gemergt) — kein Blocker |
| Audio-Stichprobe (gehasht) | `loop-4.ab235d059fec.m4a` 200 · `audio/mp4` · `immutable` · 2 774 228 B; `loop-333.d28de00523a5.m4a` 200 · 2 847 109 B; `x-333-4.5ee49fedc6d4.m4a` 200 · 30 015 B; `x-4-333.477df723d4d9.m4a` 200 · 29 591 B |
| Alte, ungehashte Pfade | `/assets/audio/loop-333.m4a` **404**, `/assets/audio/x-4-333.m4a` **404** |
| Branch | HEAD `54cddb5`, Arbeitskopie clean, `git fetch origin` ohne Neuigkeiten, 3 unpushed Commits (B-F19-r4-Folge) |
| Legacy-Registry | 4 pensionierte Suiten (`scroll-browser`, `easter-browser`, `smart-v3-browser`, `ref09-layout-browser`) — im Battery-Lauf **nicht** enthalten |

Produktions-Deploy ist damit aktuell; die Audio-Auslieferung ist gehasht,
immutable und ohne Fallback auf alte Namen.

## 2. Legacy: zwei Hero-Suiten pensioniert

`tests/hero-ink-browser.mjs` und `tests/hero-background-browser.mjs` booten mit
`reducedMotion: 'reduce'`, warten auf `#stage.is-ready` und arbeiten dann mit
`window.__H4_TEST__`. Seit dem Poster-Vertrag (`003086f` F29, `9e652aa`) gibt es
diesen Zustand nicht mehr: der Hero bleibt `is-poster-static`, ohne WebGL und
ohne Test-Hooks. Es ist also **keine Assertion veraltet, sondern der Vertrag
entfernt** — eine Aktualisierung hätte eine andere Aussage geprüft, die
`tests/hero-boot-browser.mjs` bereits abdeckt.

- Beide Dateien liegen jetzt in `tests/legacy/`, je mit eigenem README
  (entfernter Vertrag, entfernende Commits, heutige Abdeckung).
- `package.json`-Skripte `test:hero-ink` / `test:hero-background` entfernt; in
  `scripts/check-interaction-regressions.mjs` waren sie nie gelistet.
- `AGENTS.md` und `tests/legacy/README.md` nennen sie.
- Beleg der Vorbestehens: identischer Timeout auf dem unangetasteten
  Haupt-Workspace-Dev-Server (`stage is-poster-static`).
- Commit `29b5a4e`, `npm test` 376/376 danach.

## 3. B-F26 — „02/ more about" → „02/ about"

Eine Quelle: `src/labels.js` → `sectionLabels`. Frontpage-Heading
(`siteContent.home.aboutLabel`), About-Seite (`siteContent.about.label`) und der
INDEX (`index.html`) konsumieren sie; die INDEX-Zeilen tragen
`__H4_SECTION_*__`-Tokens, die der Vite-Plugin `h4ngelic-section-labels` in dev
und im Build ersetzt. Route bleibt `/about`, kein Redirect.

- `grep "more about"` in `dist/`: **eine** Stelle — der Preview-Link
  (`.about-preview .text-link`, B-F11, absichtlich längerer Text).
- `grep "vision"` in `src/`: **0 Treffer** — es gab keinen internen Begriff
  anzugleichen; die Zielseite trug dieselbe Literal-Zeichenkette.
- Offene Rückfrage im Report: Zielseiten-Begriff. Default dieses Laufs ist
  „about" (Angleichung); ein Festhalten an „vision" wäre ein eigener Beschluss.
- Font-Fallback: `typography-contract.mjs` läuft mit blockierter Brand-Schrift
  unverändert grün (Label kommt aus dem Datenmodell, nicht aus Glyphen).
- Commit `57ff1e3`.

## 4. B-016 — Impressum-Link entfernt, Route bleibt

- Link aus **beiden** Footern entfernt (Anchor in `src/footer.js`,
  `[data-other-side-imprint-slot]` + xray-Injektion in `src/xray.js`); kein
  leerer Slot, Nachbarn rücken nach.
- `/impressum` bleibt: 200, prerendert, `meta[name=robots] = "noindex, follow"`,
  **nicht** in `sitemap.xml`; Inhalt unverändert.
- Footer-Geometrie (gemessen, `docs/validation/B-016-UNLINK/`): Zone 44,0 px,
  Gaps exakt `--cluster-gap` (28,8 px Desktop, 12 px @390/320), NAAVI ±0,34 px,
  0 Legal-Links in beiden Modi, kein horizontaler Overflow.
- Test-Vertragsänderung sichtbar kommentiert („B-016: Impressum-Link bewusst
  entfernt bis Nutzdaten vorliegen (05.11.)") in footer-v31, v32-structure,
  cursor-hit-test, footer-zone-contract, v15-mobile, v31-ui, link-glyph,
  seo-browser und `easter-eggs.test.js`; `rows.manifest.json` (footer-details:
  2 Positionen / 1 Link) nachgezogen.
- Commit `9c18e52`.

## 5. Battery — vor dem Merge (Build `57ff1e3c7c45`)

Seriell, jede Suite einzeln; `dev` = Vite-Dev mit Test-Hooks, `preview` =
Produktions-Build. Rohdaten: `battery-before*.json`.

| Suite | Server | Ergebnis | Laufzeit |
| --- | --- | --- | --- |
| `about-browser` | dev | PASS | 9 s |
| `artwork-transitions-browser` | dev | FAIL — Befund | 1 s |
| `cursor-hit-test` | dev | PASS | 778 s |
| `digital-ink-browser` | dev | PASS | 72 s |
| `footer-v31-browser` | preview | PASS | 62 s |
| `footer-zone-contract` | preview | PASS | 11 s |
| `gallery-browser` | dev | PASS | 20 s |
| `greeting-browser` | preview | PASS | 10 s |
| `hero-boot-browser` | dev | PASS | 74 s |
| `hero-poster-browser` | preview | PASS | 12 s |
| `hover-browser` | preview | PASS | 16 s |
| `label-format-browser` | preview | PASS | 18 s |
| `link-glyph-contract` | preview | PASS | 14 s |
| `lowercase-sweep` | preview | PASS | 10 s |
| `master-accessibility-browser` | preview | PASS | 7 s |
| `microinteractions-browser` | dev | PASS | 10 s |
| `mobile-interactions-browser` | dev | PASS | 58 s |
| `naavi-format-browser` | preview | PASS | 1 s |
| `portfolio-browser` | preview | PASS | 127 s |
| `row-geometry-contract` | preview | PASS | 51 s |
| `rubric-gap-browser` | preview | PASS | 22 s |
| `rubric-hit-area-browser` | preview | PASS | 17 s |
| `seo-browser` | preview | PASS | 30 s |
| `smash-v31-browser` | preview | PASS | 48 s |
| `standalone-browser` | preview | PASS | 44 s |
| `standalone-native-browser` | preview | PASS | 10 s |
| `tokens-audit` | preview | PASS | 0 s |
| `tools-rubric-browser` | preview | PASS | 11 s |
| `typography-contract` | preview | PASS | 18 s |
| `v23-static-titles-browser` | preview | PASS | 24 s |
| `v25-cross-links-browser` | preview | PASS | 45 s |
| `v31-navigation-browser` | preview | PASS | 114 s |
| `v31-ui-browser` | preview | PASS | 79 s |
| `v312-r3-entrance-browser` | dev | PASS | 12 s |
| `v312-r3-production-cursor` | preview | PASS | 2 s |
| `v32-micro-browser` | preview | PASS | 10 s |
| `v32-structure-browser` | preview | PASS | 32 s |
| `v7-visitor-tiers-browser` | preview | PASS | 66 s |

**Summe vor dem Merge: 37 Suiten grün, 1 rot.** Die roten und die im Lauf
angepassten Fälle im Einzelnen:

| Fall | Befund | Entscheidung |
| --- | --- | --- |
| `gallery-browser` | Erwartete den alten Zähler `1 / 2`; seit R2 rendert der Viewer `01/ 02`. | Erwartung kommt jetzt aus `formatCounter()` (dieselbe Quelle wie NAAVI/Footer) — Label-Vertragsgruppe, grün. |
| `about-browser` | Importiert `/src/data/…` und gehört damit auf den Dev-Server, nicht auf den Preview. | Nur der Server war falsch; grün auf dev. |
| `artwork-transitions-browser` | **Rot.** Treibt eine Archivkachel `<a data-artwork-link>` per View Transition in die Detailroute. Solche Kacheln existieren nicht mehr: auf neun Routen gemessen **0** `data-artwork-link`, 34 `data-artwork-open` (Buttons/Menüs seit B-013/B-014). | **Befund, nicht gebogen.** Vertrag ist entfernt; Entscheidung offen (pensionieren oder neu definieren). |

## 6. Build und Routing nach dem Merge (Build `c4d6b292c255`)

| Prüfung | Ergebnis |
| --- | --- |
| `npm run build` | 23 Routen + 404, 0 indexierbare Routen im Preview-Modus |
| `data-build` in `dist/index.html` | `c4d6b292c255` (= Merge-Commit `c4d6b29`) |
| main-Chunk | genau **ein** `assets/main-BS4qCOTc.js` |
| `modulepreload` | `href="/assets/main-BS4qCOTc.js" data-hero-preload="module"` = emittierter Chunk, keine rohe `/src/main.js`-Kopie |
| SEO (`seo-browser`) | 23 semantische Direktrouten, Canonicals, strukturierte Daten, Legacy-Redirects, strikte 404 |
| 301-Matrix (`v32-structure-browser`) | 12 von 12 Legacy-URLs liefern 301, keine 404 |
| `/impressum` | 200, prerendert, noindex, nicht in der Sitemap |
| `/creative/*` | Slugs `tattoos` (kein `onskin`), Tools-Detailseiten 200, in der Sitemap |
| Seite `/work/tattoos`, `/work` auf Production | derzeit 200 bzw. 404 — **vor** diesem Branch; die neue `vercel.json` korrigiert die Ziele (`/creative/tattoos`, `/creative`, `/creative/onskin*`) |

## 7. Perf-Guards (nach dem Merge)

`tests/v312-r2-performance-browser.mjs`, Median aus 5 Läufen je Route/Breite
(headless, Software-GL — relativer Guard, kein Lighthouse-Ersatz):

| Route | 1440 | 390 | 320 |
| --- | --- | --- | --- |
| `/creative/tattoos` | 60 ms | 48 ms | 52 ms |
| `/contact` | 64 ms | 56 ms | 52 ms |

FCP/LCP-Guard ≤ 200 ms eingehalten, Home-Entrance **CLS < 0,01** (gemessen 0),
Entrance rein compositor-basiert (`v312-r3-entrance-browser`: opacity 1 konstant,
Y −795 → −31 → 0, Transform 1100/849 ms, Breathing 0,550–1,000, CLS 0).

## 8. Merge-Vorbereitung

| Schritt | Ergebnis |
| --- | --- |
| Sync | `git fetch origin` + `git merge origin/main` (`3f46930`), Merge-Commit `c4d6b29` |
| Bewusst **nicht** gewählt | `git rebase` (erzwingt Force-Push und schreibt die gepushte Branch-Historie um), `git push --force`, `--force-with-lease`, `git reset --hard` auf geteilten Branches |
| Konflikte | 4, alle aufgelöst (siehe unten) |
| Suiten nach dem Merge | `tokens-audit`, `typography-contract`, `link-glyph-contract`, `row-geometry-contract`, `footer-zone-contract`, `footer-v31`, `v32-structure`, `seo-browser`, `cursor-hit-test`, `world-sound`, `world-audio-formats`, `mannequin-preview`, Perf — alle grün (Tabelle unten) |
| Build-Marker | `c4d6b292c255` (Code-Stand des Merge-Commits; reine Doku-Commits danach verschieben den Marker, ohne Code zu ändern); Vercel-Preview ist SSO-blockiert (302 → `vercel.com/sso-api`), Beleg daher über `dist` + Preview-Server |

### Konflikte

| Datei | Art | Entscheidung |
| --- | --- | --- |
| `src/app.js` | beide Seiten importieren/initialisieren | beide Importe behalten; `initMannequinPreviewLazy` **und** `scheduleSlashInset()` + Font-Ready-Re-Messung |
| `tests/content.test.js` | Testtitel | vier Rubriken (Fixes-Linie, B-F25) gilt |
| `tests/mode-audio-browser.mjs` | Testrouten | Audio-Request-Filter von main + Live-Route `/creative` |
| `vercel.json` | add/add | Audio-Header (main) + Redirect-Matrix (Fixes-Linie), Ziele korrigiert |

### Nachgezogene Suiten (Route/Kontrakt nach dem Merge)

| Suite | Änderung | Grund |
| --- | --- | --- |
| `world-sound-browser` | `/work/tattoos?test=1` → `/creative/tattoos?test=1`; SMASH-Duck prüft jetzt im Other Side | Route umbenannt (B-F7); SMASH existiert nur dort (B-015) |
| `world-audio-formats-browser` | dieselbe Route | dito |
| `mannequin-preview-browser` | dieselbe Route | dito |

## 9. Battery — nach dem Merge (Build `c4d6b292c255`)

| Suite | Server | Ergebnis | Laufzeit |
| --- | --- | --- | --- |
| `cursor-hit-test` | dev | PASS | 819 s |
| `footer-v31-browser` | preview | PASS | 60 s |
| `footer-zone-contract` | dev | PASS | 12 s |
| `link-glyph-contract` | dev | PASS | 22 s |
| `mannequin-preview-browser` | preview | PASS | 17 s |
| `row-geometry-contract` | preview | PASS | 55 s |
| `seo-browser` | preview | PASS | 30 s |
| `tokens-audit` | dev | PASS | 0 s |
| `typography-contract` | preview | PASS | 20 s |
| `v312-r2-performance-browser` | dev | PASS | 22 s |
| `v32-structure-browser` | preview | PASS | 32 s |
| `world-audio-formats-browser` | dev | PASS | 3 s |
| `world-sound-browser` | dev | PASS | 45 s |


**Summe nach dem Merge: 15 Suiten grün, 0 rot** (die drei zuletzt gegen den
Produktions-Preview nachgefahrenen Kontrakte eingerechnet). `npm test` vor dem
Merge 376/376, nach dem Merge **404 Tests / 403 pass / 1 skipped / 0 fail** —
der Skip ist `world-sound-v3.test.js` „the same source bytes rebuild
byte-identical deliveries # source masters are local-only" (Master-Dateien sind
bewusst nicht im Repo).

### Bekannte Flakes

`NEXT_SESSION.md` nennt den Rebuild-Hash von world-sound-v3 und das
Attack-Ramp-Polling von smash-v31. In diesem Lauf ist keiner aufgetreten
(`world-sound-browser` und `smash-v31-browser` je einmal grün, kein
Wiederholungslauf nötig).

## 10. Nicht prüfbar

- **Echtes iPhone** (Silent-Switch, Thermal, PWA-Standalone) — hier nur
  Headless-Chromium mit Software-GL.
- **Vercel-Preview** — SSO (302 auf `vercel.com/sso-api`); Verifikation gegen
  `dist` und den lokalen Produktions-Preview.
- **Cursor in echter Browser-/OS-Umgebung** — Headless misst 100 % Bild-Cursor
  (14 364 / 3 612 / 2 877 Punkte in der Footer-Zone, 4 469 / 1 149 / 939 je
  Viewport über die ganze Seite, Asset 200 + dekodiert); die Restvariable ist
  Browser/OS/HiDPI des Users.
- **Datenschutztexte** — es existiert keine Datenschutzerklärung; DSGVO-Punkte
  (Resend, Vercel-Logs, localStorage) sind eine offene Aufgabe, kein Testfall.

## 11. Registry-Sync und offene Punkte

| ID | Status | Evidence |
| --- | --- | --- |
| B-F19 / B-F19-r4 | `fixed` (User-Sichtprüfung offen) | `docs/validation/B-F19-FOOTER-ZONE/`, `tests/footer-zone-contract.mjs` |
| B-F25 | `reproduced` (User-Bestätigung offen) | `docs/validation/B-F25-ROW-MECHANISM/`, `row-geometry-contract` |
| B-F26 | `fixed` | dieser Report, Abschnitt 3; `label-format`, `typography`, `v32-structure` |
| B-016 | **open** — Link entfernt, Platzhalter im Dokument, Nutzdaten ausstehend | `docs/validation/B-016-UNLINK/` |
| B-F27 (neu) | **open** — `artwork-transitions-browser` prüft einen entfernten Vertrag | 0 `data-artwork-link` auf 9 Routen |

Offene Einschätzungen (keine Entscheidung ohne User):

- **B-016**: Nutzdaten (VOLLNAME, Adresse, E-Mail, USt/§19) und
  Datenschutzerklärung fehlen; Kontaktformular (Resend), Vercel-Logs mit IP und
  `localStorage` (Visit-Zähler, Formular-Entwürfe) sind zu benennen. Kein
  Cookie-Banner nötig, solange kein Tracking läuft — offen, ob Vercel Analytics
  aktiv ist.
- **B-F19 Cursor**: in Headless 100 % Bild-Cursor; bei reproduzierbarem
  Systempfeil `data-build`, Browser, OS, Skalierung und Screenshot anfordern.
- **B-F25**: `reproduced`, User-Bestätigung offen.
- **B-F26**: Zielseiten-Begriff „about" (Default dieses Laufs) oder „vision"?
- **B-F27**: `artwork-transitions-browser` pensionieren (empfohlen, ein Commit
  mit README) oder Vertrag neu definieren (Archivkachel → Detailroute per View
  Transition gibt es nicht mehr).
- **iPhone-Echttest**: Silent-Switch, Thermal, PWA-Standalone.

## 12. Urteil

**MERGE-REIF: ja** — nach der Pensionierung von B-F27 (Abschnitt 15) und dem
vollständigen Abschluss-Lauf ist keine Suite mehr rot:

- 41 Browser-Suiten, 41 grün, 0 rot, seriell, je 3 Viewports × beide
  Motion-Preferences (Tabelle in Abschnitt 15).
- `npm test`: 404 Tests / 403 pass / 1 skipped (bewusst: Byte-Identität der
  Audio-Deliverables, Source-Master sind local-only) / 0 fail.
- Build `a2540558e5a3` (HEAD nach der Pensionierung): 23 Routen + 404, ein
  main-Chunk, `modulepreload` auf den emittierten Chunk, `data-build` im HTML.
- SEO: 23 Direktrouten, 12/12 Legacy-301, `/impressum` 200 + noindex + nicht in
  der Sitemap, `/about` in der Produktions-Sitemap, keine 404 auf Alt-URLs.
- Perf: FCP-Median 36–76 ms je Route/Breite, LCP ≤ 200 ms, CLS 0.

**Bedingung:** der Merge nach `main` erfolgt erst nach deinem expliziten
„go" (AGENTS.md). Dieser Lauf hat nur den Branch gepusht.

## 13. Queue-Statement mit Rollback

**Pos 1 — V3.2 world sound (Vercel)** — *gemergt* (`bae1b3f`, Bookkeeping
`3f46930`), Produktion `data-build 3f4693052f7e`, Audio-Assets gehasht und
immutable.
Offen: Sound-Checkliste (Loop 333, 4 halten, 3er-Sequenz, SMASH an/aus,
Mute/Volume-Persistenz, Naht bei ca. 31 s, iPhone-Echttest).
Rollback: `git revert -m 1 bae1b3f` + Push — **Achtung**: hebt die gehashten
URLs und die Immutable-Regel auf, Clients behalten gecachte Dateien; bei
Audioproblemen besser neue Dateinamen.

**Pos 2 — v3.1.1-fixes (dieser Branch)** — Inhalt: F-Stapel V3.1.2, Batch A bis
B-F25, Legacy-Pensionierung (4 + 2 Suiten), B-F19-r4 Ink-Guard, B-F26 Label,
B-016 Unlink, world-sound-Sync.
Voraussetzung: B-F27 entschieden **und** „go".
Nach dem Merge: Production-Deploy, Smoke über Kernrouten, `data-build` gegen den
Merge-Commit abgleichen.
Rollback: `git revert -m 1 <merge-sha>` + Push; das letzte READY-Deployment in
Vercel erneut promoten.

**Pos 3 — mail-01-diagnostics** — erst nach Pos 1 und 2: `origin/main` per
`git merge` (nicht rebase) holen, Suiten grün, dann Merge; danach Mail-Smoke
gegen Production mit maximal 3 echten Sends, bei 502 die Log-Zeile
`resend_rejected` / `resend_unreachable` auswerten.

## 14. Reproduktion

```bash
# Dev-Server (Test-Hooks) und Produktions-Preview
npx vite --host 127.0.0.1 --port 5183 --strictPort
npm run build && node scripts/serve-preview.mjs --port 55242

# Battery (seriell, nach Server-Phase)
H4_GATE_DEV=http://127.0.0.1:5183 H4_GATE_PREVIEW=http://127.0.0.1:55242 \
  node scripts/gate-battery.mjs after
```

## 15. Abschluss-Lauf nach der B-F27-Pensionierung

### 15.1 Pensionierung (Commit `a254055`)

`tests/artwork-transitions-browser.mjs` → `tests/legacy/`, eigenes README mit
entferntem Vertrag (`<a data-artwork-link>` + View Transition auf
Artwork-Kacheln), entfernenden Änderungen (B-013/B-014) und heutiger
Ersatzabdeckung. Aus `package.json` (`test:artwork-transitions`) und aus
`scripts/check-interaction-regressions.mjs` entfernt; `AGENTS.md` und die
Legacy-Tabelle nennen sie. Registry B-F27 = **pensioniert**.

Ersatzabdeckung, belegt durch grüne Suiten im selben Lauf:
`gallery-browser` (Opener, Viewer, Tastatur, FLIP, Cleanup, 1440/390/320 × beide
Motion-Preferences), `inline-artwork-expand.test.js` (Unit), `portfolio-browser`
(Archiv/Routen), `navigation-browser`/`interaction-mosh-browser`
(Route-View-Transitions).

### 15.2 B-F26-Belege (kein Code in diesem Teil)

| Prüfung | Ergebnis |
| --- | --- |
| Einzige Quelle | `sectionLabels` in `src/labels.js`, konsumiert von `src/data/siteContent.js` und (über `__H4_SECTION_*__`) `index.html` → `vite.config.js` |
| `dist`-grep `02/ more about` | **0** in allen emittierten HTML-Dateien |
| `more about` in `dist` | genau **1** Vorkommen: `<a … href="/about">more about</a>` — der CTA-Link (B-F11), kein Sektionsheading |
| Wortgrenzen-grep `vision` in `src/` | **0** |
| `/about` | 200, prerendert, `index, follow`, in der Produktions-Sitemap (5 indexierbare Routen: `/`, `/creative/tools`, beide Tools, `/about`) |
| `/impressum` | 200, prerendert, `noindex, follow`, nicht in der Sitemap |

Die CTA-Entscheidung ist damit dokumentiert: der Link unter dem Abschnitt bleibt
„more about" (Kleinschreibung, B-F11); willst du dort ebenfalls „about", ist das
ein separates Ein-Zeilen-Commit an `siteContent.home.moreAboutLabel`.

### 15.3 Battery (seriell, 41 Suiten, Build `a2540558e5a3` bzw. `…` nach dem Report)

| Suite | Server | Ergebnis | Laufzeit |
| --- | --- | --- | --- |
| `about-browser` | dev | PASS | 8 s |
| `cursor-hit-test` | dev | PASS | 640 s |
| `digital-ink-browser` | dev | PASS | 75 s |
| `footer-v31-browser` | preview | PASS | 63 s |
| `footer-zone-contract` | dev | PASS | 13 s |
| `gallery-browser` | dev | PASS | 18 s |
| `greeting-browser` | preview | PASS | 10 s |
| `hero-boot-browser` | dev | PASS | 79 s |
| `hero-poster-browser` | preview | PASS | 12 s |
| `hover-browser` | preview | PASS | 15 s |
| `label-format-browser` | preview | PASS | 19 s |
| `link-glyph-contract` | dev | PASS | 22 s |
| `lowercase-sweep` | preview | PASS | 10 s |
| `mannequin-preview-browser` | preview | PASS | 16 s |
| `master-accessibility-browser` | preview | PASS | 7 s |
| `microinteractions-browser` | dev | PASS | 10 s |
| `mobile-interactions-browser` | dev | PASS | 60 s |
| `naavi-format-browser` | preview | PASS | 2 s |
| `portfolio-browser` | preview | PASS | 130 s |
| `row-geometry-contract` | preview | PASS | 57 s |
| `rubric-gap-browser` | preview | PASS | 27 s |
| `rubric-hit-area-browser` | preview | PASS | 15 s |
| `seo-browser` | preview | PASS | 29 s |
| `smash-v31-browser` | preview | PASS | 47 s |
| `standalone-browser` | preview | PASS | 44 s |
| `standalone-native-browser` | preview | PASS | 10 s |
| `tokens-audit` | dev | PASS | 0 s |
| `tools-rubric-browser` | preview | PASS | 11 s |
| `typography-contract` | preview | PASS | 20 s |
| `v23-static-titles-browser` | preview | PASS | 25 s |
| `v25-cross-links-browser` | preview | PASS | 53 s |
| `v31-navigation-browser` | preview | PASS | 122 s |
| `v31-ui-browser` | preview | PASS | 85 s |
| `v312-r2-performance-browser` | dev | PASS | 21 s |
| `v312-r3-entrance-browser` | dev | PASS | 12 s |
| `v312-r3-production-cursor` | preview | PASS | 2 s |
| `v32-micro-browser` | preview | PASS | 10 s |
| `v32-structure-browser` | preview | PASS | 33 s |
| `v7-visitor-tiers-browser` | dev | PASS | 75 s |
| `world-audio-formats-browser` | dev | PASS | 3 s |
| `world-sound-browser` | dev | PASS | 45 s |

SUITES=41 PASS=41 FAIL=0

`artwork-transitions` taucht nicht mehr auf. Kein Skip außer dem begründeten
Node-Skip.

### 15.4 Vertrags-Anpassungen in diesem Lauf (alle sichtbar kommentiert)

| Suite | Befund nach dem Merge | Anpassung |
| --- | --- | --- |
| `smash-v31-browser` | „No AudioContext is allocated just for rendering the footer" stand **hinter** dem Wechsel in die Other Side — der ist seit dem World-Sound-Merge selbst die erste Geste und schaltet genau einen Kontext frei (1 statt 0). | Assertion geteilt: beim Laden weiterhin **0**, nach dem Wechsel **genau 1**. Keine Abschwächung, eine zusätzliche Zusicherung. |
| `mobile-interactions-browser` | Der World-Sound meldet beim Freischalten einmal den unveränderten Modus (`'normal'`) und legt einen 1-Sample-Silent-Tick (0,00002 s) an; die Suiten verglichen die rohe Ereignisliste. | Modus-Stream wird auf echte Übergänge normalisiert (führendes `normal` = Initialmeldung) und Audio auf das Transition-Band 0,1–2 s geprüft; zusätzlich: der 90-s-Bed ist die einzige lange Stimme. Die WebGL-Zusicherung gilt jetzt pro Kalt-Route (kein zusätzlicher Renderer), nicht gegen den Renderer der Other Side. |
| `hover-browser` | Fester `300 ms`-Sleep traf die ~400 ms-Rampe mitten im Flug (1,02391 statt 1,02449). | Wartet jetzt, bis der Wert drei Frames stabil ist, dann gilt weiter 1,024–1,026. |

Keine dieser Anpassungen senkt eine Schwelle; zwei von drei fügen eine
Zusicherung hinzu.

### 15.5 Nicht blockierende offene Punkte (Board)

| Punkt | Warum er den Merge nicht blockiert | Beleg |
| --- | --- | --- |
| B-016 Nutzdaten + Datenschutz (Art. 13/14 DSGVO; Resend, Vercel-Logs mit IP, localStorage) | Der Platzhalter ist **entlinkt**; er ist damit nicht mehr öffentlich beworben und die Route ist `noindex`. Die Rechtstexte sind Inhalt, nicht Code. | `docs/validation/B-016-UNLINK/`; `seo-browser` (noindex + Sitemap-Ausschluss) |
| Vercel Analytics an/aus (entscheidet über Cookie-Banner) | Kein Tracking ist im Code aktiviert; die Entscheidung ändert keinen Build. | kein Analytics-Snippet in `index.html`/`src/` |
| B-F19 Cursor in echter Browser-/OS-Umgebung | Headless misst 100 % Bild-Cursor in der Zone und auf der ganzen Seite, Asset dekodiert; die Restvariable ist die Umgebung des Users. | `docs/validation/B-F19-FOOTER-ZONE/`, `battery` (cursor-hit-test 4469/1149/939 ×2 + xray) |
| B-F25 User-Bestätigung | Vertrag ist implementiert und in `row-geometry-contract` (5 Viewports) belegt; es fehlt nur die Sichtprüfung. | `docs/validation/B-F25-ROW-MECHANISM/` |
| iPhone-Echttest (Silent-Switch, Thermal, PWA-Standalone) | Nur auf echter Hardware prüfbar, nicht Teil des Merge-Gates; die Standalone-Suiten sind grün. | `standalone-browser`, `standalone-native-browser` |

**Keiner dieser Punkte blockiert** — es sind Inhalts-, Hardware- oder
Bestätigungsfragen, keine offenen Vertragsverletzungen.

### 15.6 Sync-Regel für Position 3 (verbindlich)

`mail-01-diagnostics` holt `origin/main` ausschließlich per **`git merge
origin/main`**. Ein Rebase ist verboten, weil er einen Force-Push erzwingt und
die gepushte Historie umschreibt; `git push --force*` und `git reset --hard` auf
geteilten Branches ebenso.
