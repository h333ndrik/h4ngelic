# smash-v31 — isolierte Prüfung und Merge nach main (06.11.2026)

Merge nach `main`: **`d5508243027dc454772d124327617ff1eef55a88`** (Merge-Commit,
Eltern `3f46930` + `2f015d4`). Produktion `data-build` = `d5508243027d`.

## 1. Diff der Suite, jede Zeile klassifiziert

Basis `54cddb5` (vor dem World-Sound-Merge) → `2f015d4` (heute).
Der Merge hat die Datei automatisch zusammengeführt; die Änderungen stammen
deshalb aus **zwei** Quellen. Spalte „von" nennt sie.

| Zeile (Kurzform) | K | von | Begründung |
| --- | --- | --- | --- |
| `+` Kommentar „rendering the page allocates no context…" | K5 | Branch | reine Erläuterung |
| `+` `contexts.length === 0` **vor** dem Moduswechsel | K2 | Branch | neue Zusicherung: Laden allokiert nichts |
| `−` `contexts.length === 0` **nach** dem Moduswechsel | K3 | Branch | gilt nicht mehr: der Wechsel ist seit World Sound die erste Geste |
| `+` `contexts.length === 1` nach dem Moduswechsel | K2 | Branch | genau ein geteilter Kontext, nicht „mindestens einer" |
| `−` `decoded === 1` → `+ decoded >= 2` | K1 → ** zurückgenommen** | main (`bae1b3f`) | siehe 4.: auf `=== 4` verschärft |
| `−` `ended === false` → `+ ended === false \|\| endedAt >= …` | K1 → ** zurückgenommen** | main | siehe 4.: strikte Form wiederhergestellt |
| `−` feste `waitForTimeout(800/1200)` → `+` `waitForFunction` auf Gain | K4 | main | echtes Warten statt Sleep, keine Aussage entfernt |
| `−` `contexts[0].__gains[0].gain < .001` → `+` `contexts[0].state === 'suspended'` | K3 | main | Mute suspendiert jetzt den Kontext (World Sound) |
| `+` `restarted.decoded >= initial.decoded` (statt `=== 1` bzw. `>= 2`) | K2 | Branch | strenger als beide Vorgänger |
| `+` `indexRoute` `/creative` → `/work` | K3 | main | Routennamen der Welt-Sound-Linie; `/work` leitet auf `/creative` |

**Kein K1 im heutigen Stand.** Die zwei nachgiebigen Zeilen kamen aus `main`
und sind in `2f015d4` durch gemessene, strengere Formen ersetzt (Abschnitt 4).

## 2. Matrix (separater Worktree `/private/tmp/h4-smash-check` auf `54cddb5`)

Zwei Builds: `54cddb5` → `55250` (`data-build 54cddb56aa12`),
`2f015d4` → `55251` (`data-build 5db06ac0d341`, danach `d5508243027d` auf `55252`).

| Lauf | Build | Testdatei | Ergebnis | Beleg |
| --- | --- | --- | --- | --- |
| L1 | `54cddb5` | alt (`54cddb5`) | **PASS** 1440/390/320 | `exactfile, deferredfetch/cache, nativeattack/tail/stop, globalstate, routes and both realities` |
| L2 | `54cddb5` | neu | **FAIL** | `Entering the Other Side is the first gesture and unlocks exactly one shared context. 0 !== 1` |
| L3 | `2f015d4` | neu (verschärft) | **PASS** 1440/390/320 | identische PASS-Zeile, zusätzlich auf `55252` (Merge-Baum `d5508243027d`) wiederholt: PASS |
| L4 | `2f015d4` | alt | **FAIL** | `1 !== 0` in der alten Zeile „No AudioContext is allocated just for rendering the footer." |

Ergebnis: **GRÜN** nach der Definition (L1 grün, L2 rot, L3 grün, L4 rot,
kein K1, Ursache belegt).

Anmerkung: L3 lief beim ersten Versuch in einen Timeout auf
`[data-smash].waitFor()` direkt nach dem Moduswechsel und war im zweiten Lauf
grün — der bekannte Flake-Typ dieser Suite (Polling direkt nach dem Wechsel),
nicht reproduzierbar in drei Folgeläufen.

## 3. AudioContext-Zähler

`window.__ctx.contexts` (Konstruktor-Hook), 1440 px, je ein Lauf pro Build:

| Build | beim Laden | nach Other-Side-Wechsel | nach Rückkehr |
| --- | --- | --- | --- |
| `54cddb5` (vor dem Merge) | 0 | **0** | 0 |
| `2f015d4` / `d550824` (heute) | 0 | **1** | **1** (kein zweiter) |

Damit ist die neue Erwartung „beim Laden 0, nach dem Wechsel genau 1" die reale
Mechanik: Erst der Gestus (Tasten-Hold 4) schaltet den einen geteilten Kontext
frei; der Rückweg legt keinen zweiten an. Kein Timeout, keine Toleranz wurde
irgendwo erhöht (die Timeouts `5000 ms` in den beiden `waitForFunction`-Angriffen
stammen aus `main` und ersetzen feste Sleeps).

## 4. Rücknahme der zwei nachgiebigen Zeilen (Commit `2f015d4`)

Gemessen auf dem Merge-Build, drei Viewports, je ein Lauf:

| Größe | Messwerte | Neue Assertion |
| --- | --- | --- |
| `initial.decoded` | 4 · 4 · 4 | `assert.equal(initial.decoded, 4)` (statt `>= 2`) |
| `restarted.decoded` | 7 · 7 · 7 | `>= initial.decoded` (strenger als `>= 2`, plus `fetched === 1`) |
| `stopping.ended` | false · false · false | `assert.equal(stopping.ended, false)` (der `\|\| endedAt`-Ausweg ist weg) |

## 5. mobile-interactions und hover-browser

### mobile-interactions-browser

| Änderung | K | Begründung |
| --- | --- | --- |
| `audio.length === 0` → Bandprüfung `0,1–2 s` + neue Zusicherung „90-s-Bett ist die einzige lange Stimme" | K3 + K2 | der World Sound legt einen 1-Sample-Silent-Tick und das Bett an; die Transitionsprüfung ist *enger* (Band statt „irgendetwas"), die Bett-Zusicherung ist neu |
| rohe Modusliste → `transitions()` (führendes `normal` = Initialmeldung, Folgeübergänge exakt) | K3 | der World Sound meldet beim Freischalten einmal den unveränderten Modus; alle echten Übergänge bleiben exakt verglichen |
| `audio.map(mode)` → gefiltert auf das Transition-Band | K3 | Tick und Bett sind keine Übergänge |
| `webGL === 0` nach Moduswechsel+Route → „kein **zusätzlicher** Renderer bei der Kalt-Route" | K3 | die Other Side hat einen eigenen Renderer; die absolute 0-Zusicherung bleibt zweimal erhalten (`Zeile 135` Kalt-Laden, `Zeile 324` Touch-Profil) |

Kein K1: die absolute WebGL-Nullprüfung existiert weiter, und die Audio-Prüfung
ist keine Nullprüfung — sie verlangt zusätzlich das Bett und schließt das
Transition-Band aus.

### hover-browser

| Änderung | K | Begründung |
| --- | --- | --- |
| fester `waitForTimeout(300)` → Warten, bis der Wert drei Frames stabil ist (`polling: 'raf'`) | K4 | die Rampe dauert ~400 ms; gemessen: 300 ms → 1,02346, 500 ms → 1,02449 |
| Assertion `1.024 ≤ scale ≤ 1.026` | unverändert | nicht nachgiebiger; der Endwert ist 1,02449 |

## 6. Merge

| Schritt | Ergebnis |
| --- | --- |
| `origin/main` vor dem Merge | `3f46930` (unverändert seit dem letzten Fetch) |
| Merge-Commit | `d5508243027dc454772d124327617ff1eef55a88`, Eltern `3f46930` + `2f015d4`, kein Squash, kein Rebase, kein Force |
| Push | `3f46930..d550824` auf `refs/heads/main`; `v3.1.1-fixes` = `2f015d4` |
| Rollback-Referenz main | vorher `3f46930` (für den Vercel-Promote) |
| Vercel | Deployment lief ohne Eingriff; `data-build` auf `www.h4ngelic.com` wechselte um **10:47:43** von `3f4693052f7e` auf **`d5508243027d`** |
| `npm test` im Merge-Baum | 404 Tests / 403 pass / 1 skipped / 0 fail |

## 7. Post-Deploy-Smoke (Produktion, Build `d5508243027d`)

| Prüfung | Ergebnis |
| --- | --- |
| `/`, `/about`, `/contact`, `/creative/tattoos`, `/creative/tools`, `/creative/jewellery`, `/creative/more` | alle **200** |
| `/impressum` | **200**, `meta robots = noindex, follow` |
| `/work/tattoos` → `/creative/tattoos` · `/creative/onskin` → `/creative/tattoos` · `/work/flashes` → `/creative/flashes` · `/work` → `/creative` · `/creative/onskin/tattoo-01` → `/creative/tattoo-01` | **308** (Vercel-Status für `permanent: true`), richtige Ziele, **keine 404** |
| INDEX | `00/ home`, `01/ creative`, **`02/ about`**, `03/ contact` |
| Frontpage-Heading | **`02/ about`** |
| Footer | `0` Legal-Links (`footer-impressum`/`[data-other-side-imprint-slot]`) |
| Ink | Klick in die freie Bandfläche: `0 → 1` Klecks |
| Cursor (Footer-Band, 4-px-Raster) | **3762/3762** Punkte Bild-Cursor, 0 Fremdwerte (Dokumentation, keine Bewertung der User-Sicht) |
| Sound | **0** Audio-Requests vor der ersten Geste; nach dem Hold-4-Gestus `loop-333` angefordert (3 Requests gesamt: Bett + 2 Transitions) |
| Page-Errors | 0 |

### Befund im Smoke: Sitemap leer, `robots.txt` sperrt alles

| Beobachtung | Wert |
| --- | --- |
| `https://www.h4ngelic.com/sitemap.xml` | `<urlset>` **ohne** `<loc>` |
| `https://www.h4ngelic.com/robots.txt` | `User-agent: *` / `Disallow: /` |
| `<meta name="robots">` auf `/` | `noindex, follow` |

**Ursache:** der Vercel-Build läuft ohne `H4_DEPLOYMENT=production`
(`src/seo.js`: `deployment: env.H4_DEPLOYMENT || seoContent.deployment`, und
`seoContent.deployment` ist `'preview'`). Indexierbarkeit ist nur im
Produktionsmodus möglich.

**Nicht durch diesen Merge verursacht:** die Sitemap-Erzeugung ist unverändert
(`src/seo.js`/`scripts/prerender.mjs` liefern im Preview-Modus weiterhin eine
leere Sitemap); der vorherige Deploy `3f4693052f7e` lief mit identischer
Konfiguration. Lokal mit `H4_DEPLOYMENT=production npm run build` enthält die
Sitemap korrekt `/`, `/creative/tools`, `m4shlab`, `thr4ce`, `/about` — und
`/impressum` fehlt.

**Empfehlung (nicht ausgeführt, Entscheidung des Users):** `H4_DEPLOYMENT=production`
als Environment-Variable im Vercel-Projekt setzen und neu deployen. Ein
Code-Change ist dafür nicht nötig. Ein Rollback des Merges würde das Problem
nicht lösen.

## 8. Queue-Stand und Rollback

| Pos | Stand | Rollback |
| --- | --- | --- |
| 1 — V3.2 world sound | gemergt (`bae1b3f`, Bookkeeping `3f46930`), in `main` enthalten | `git revert -m 1 bae1b3f` + Push. **Achtung:** hebt gehashte URLs und die Immutable-Regel auf; bereits gecachte Dateien bleiben bei Clients — bei Audioproblemen besser neue Dateinamen |
| 2 — v3.1.1-fixes | **gemergt** (`d550824`), Production `d5508243027d` | `git revert -m 1 d550824` + Push, danach das Deployment von `3f46930` in Vercel erneut promoten |
| 3 — mail-01-diagnostics | nächste Position | Sync ausschließlich per `git merge origin/main` (nie Rebase, kein Force-Push), Suiten grün, dann Merge; danach Mail-Smoke gegen Production mit maximal 3 echten Sends; bei 502 die Logzeile `resend_rejected` / `resend_unreachable` auswerten |
