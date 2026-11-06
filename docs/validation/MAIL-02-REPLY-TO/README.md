# MAIL-02 — Reply-To nur für eine echte Adresse

Branch `mail-02-reply-to`, Basis `d550824` (= `origin/main` nach dem
V3.2-/V3.1.2-Merge); Nachtrag MAIL-02b in Abschnitt 6. Kein Merge, kein
Deploy in diesem Lauf.

## 1. Befund (Teil 0)

### Resend-Payload, wie er im Branch vorher erzeugt wurde

`server/inquiry.mjs`, Zeile 201 (`createInquiryHandler`), ein einziger Aufruf:

| Feld | Wert |
| --- | --- |
| `from` | `config.from` = `INQUIRY_FROM`, produktiv `no-reply@h4ngelic.com` |
| `to` | `['h4ngelic@gmail.com']`, hartcodiert als `RECIPIENT` (Zeile 9) |
| `subject` | `new h4ngelic inquiry` |
| `text` | `name: …`, `how to reach you: …`, optional `artwork:` + URL, dann die Nachricht |
| `attachments` | nur wenn Dateien vorliegen (MIME-geprüft, Base64) |
| `reply_to` | **bereits vorhanden:** `...(address(fields.email) ? { reply_to: fields.email } : {})` |

Der Zweig ist nicht neu: `git log -S "reply_to" -- server/inquiry.mjs` nennt
`54a56b9` („Implement V6 connected navigation, inquiry flow and isolated feedback
playground"). Auch `origin/main` und `origin/mail-01-diagnostics` enthalten ihn.

### Feld und Validierung

| Punkt | Befund |
| --- | --- |
| Feldname | `email` (`name="email"`), `type="text"`, `required`, `maxlength="254"`, `autocomplete="off"` |
| Platzhalter | `email, instagram, phone number...` → **Freitext**, keine Adresse garantiert |
| Client | `validateInquiryContact` (nur Präsenz), `inquiry.js` schickt das Feld als Multipart-Feld |
| Server | `validateInquiryFields` trimmt und prüft Präsenz, Länge ≤ 254 (über `inquirySettings`) und `[\x00-\x1f\x7f]` → sonst 400 „please enter how to reach you." |
| Honeypot | Feld `website` wird verworfen und führt zu 400; `started` erzwingt ≥ 800 ms Formularzeit |

### Warum die Benachrichtigung ohne Reply-To ankam

Lokaler Lauf des echten Handlers mit gemocktem Provider (kein echter Versand):

| Kontaktwert (Freitextfeld) | Status | `reply_to` |
| --- | --- | --- |
| `visitor@example.com` | 202 | `visitor@example.com` |
| `max@example.com` | 202 | `max@example.com` |
| `@h4ndrik` | 202 | **fehlt** |
| `+49 176 1234` | 202 | **fehlt** |
| `instagram: h4ngelic` | 202 | **fehlt** |
| `Max <max@example.com>` | 202 | **fehlt** |
| `h4ngelic@gmail.com` + CRLF + `Bcc: …` | 400 (Kontaktprüfung) | — |

Der Mechanismus funktioniert also; die Benachrichtigung hatte in der Praxis
vermutlich einen Wert, der keine reine Adresse war — am häufigsten die
Anzeigenamen-Form `Max <max@example.com>` (Autofill) oder ein Handle/Telefon.
Stand MAIL-02 (`b27ac4a`) blieben diese Fälle ohne Reply-To; die
Anzeigenamen-Form ist mit MAIL-02b (Abschnitt 6) abgedeckt, Handle und Telefon
bleiben es.

## 2. Die Prüfung

`server/inquiry.mjs` → `export function isReplyAddress(value)` (vorher lokal als
`address()`); dieselbe Funktion prüft auch `INQUIRY_FROM`, damit es nur eine
Regel gibt. Konservativ, ohne Abhängigkeit, ohne Regex-Monster:

1. muss ein String sein, **exakt** ohne führende/abschließende Leerzeichen,
2. Länge ≤ 254,
3. **keine Steuerzeichen** `[\x00-\x1f\x7f]` — damit sind `\r`, `\n` und
   Header-Injection ausgeschlossen (Pflicht, nicht optional),
4. genau **ein** `@`, nicht am Anfang/Ende (leerer Local- oder Domain-Teil ⇒ falsch),
5. Local-Part 1–64 Zeichen, erlaubter Zeichensatz, kein führender/abschließender
   Punkt, kein `..`,
6. Domain: mindestens zwei Labels, jedes 1–63 Zeichen `[a-z0-9-]` ohne
   führenden/abschließenden Bindestrich,
7. **neu verschärft:** das letzte Label muss ein plausibles TLD sein
   (`[a-z]{2,}` oder `xn--…`) — vorher galt `visitor@example.c` als gültig.

Ist der Wert keine Adresse, wird `reply_to` **weggelassen**; die Anfrage geht
unverändert raus (202). Unverändert bleiben `from`, `to`, `subject`, der Text,
die Anhänge, der generische 502-Text und das PII-freie Verhalten (kein Log von
Adresse, Text oder Dateinamen).

## 3. Tests

`tests/inquiry-reply-to.test.js` (neu, 5 Testblöcke):

| Fall | Erwartung | Ergebnis |
| --- | --- | --- |
| `visitor@example.com`, `max@example.com`, `first.last+tag@sub.example.co.uk` | gültig | ✅ |
| `@h4ndrik`, `+49 176 1234`, `instagram: h4ngelic`, `Max <max@example.com>`, `max@example`, `example.com` | ungültig | ✅ |
| `…\r\nBcc: evil@example.com`, `…\nBcc: …`, `…\r`, `\x00`, `\x1f`, `\x7f` | ungültig | ✅ |
| leer, Leerzeichen, führende/abschließende Leerzeichen, `null`, `undefined`, `42` | ungültig | ✅ |
| 254+-Zeichen-Wert, Local-Part > 64, `.x@…`, `x.@…`, `x..y@…`, `@-example.com`, `@example-.com`, `example..com`, `@example.c`, `@@` | ungültig | ✅ |

`tests/inquiry-http.mjs` (Loopback-HTTP mit gemocktem Provider, kein echter Versand):

| Fall | Ergebnis |
| --- | --- |
| gültige Adresse `visitor@example.com` | 202, `reply_to` exakt `visitor@example.com` |
| `first.last+tag@example.com` | 202, `reply_to` exakt übernommen, `to`/`from` unverändert |
| `@loopback-visitor`, `+49 170 1234567` | 202, **kein** `reply_to`, Text enthält den Freitext |
| Wert mit CRLF + `Bcc:` | **400** mit dem generischen Kontakttext, **kein** Provider-Aufruf (Header-Injection kann nicht entstehen) |
| Provider-Fehler | weiterhin 502 mit byte-identischem Text |
| Cross-Origin, Honeypot, Spoof-Anhang, Rate-Limit, unkonfiguriert | unverändert 403 / 400 / 415 / 429 / 503 |

`npm test`: **409 Tests / 408 pass / 1 skipped / 0 fail** (Skip unverändert:
Byte-Identität der Audio-Deliverables, Source-Master local-only).
`node tests/inquiry-http.mjs`: grün, `artifacts/inquiry/http-results.json`.

## 4. Payload nachher (gültige Adresse)

```json
{
  "from": "no-reply@h4ngelic.com",
  "to": ["h4ngelic@gmail.com"],
  "reply_to": "first.last+tag@example.com",
  "subject": "new h4ngelic inquiry",
  "text": "name: …\nhow to reach you: first.last+tag@example.com\n…",
  "attachments": ["…"]
}
```

Ohne gültige Adresse fehlt ausschließlich `reply_to`; alles andere ist identisch.

## 5. Empfehlung (nicht umgesetzt): `INQUIRY_TO`

`to` steckt als `const RECIPIENT = 'h4ngelic@gmail.com'` im Handler. Eine
`INQUIRY_TO`-Env-Variable (mit `isReplyAddress`-Prüfung und Fallback auf die
Konstante) würde den Empfänger ohne Code-Deploy wechselbar machen — eine Zeile
Argument: Postfachwechsel oder Weiterleitung sind Betriebs-, keine
Code-Entscheidungen. Entscheidung liegt beim User; hier kein Code.

Die Anzeigenamen-Form ist inzwischen umgesetzt — siehe Abschnitt 6 (MAIL-02b).

## 6. Nachtrag MAIL-02b — Anzeigenamen-Form `Name <adresse>`

### 6.1 Befund vorher (gemessen an `isReplyAddress`, Commit `b27ac4a`)

Das Feld „how to reach you" ist Freitext; Browser-Autofill und kopierte
Mail-Headerzeilen liefern dort `Name <adresse>`. Diese Form fiel durch die
Prüfung, `reply_to` wurde weggelassen — der Fix griff dann nicht.

| Eingabe | `isReplyAddress` vorher | `isReplyAddress` nachher |
| --- | --- | --- |
| `max@example.com` | true | true (unverändert) |
| `Max Mustermann <max@example.com>` | **false** | false |
| `Max <max@example.com>` | **false** | false |
| `<max@example.com>` | **false** | false |
| `  Max  <  max@example.com  >  ` | **false** | false |
| `Max <max@example.com` | false | false |
| `Max <a@b.de> <c@d.de>` | false | false |
| `Max <@h4ndrik>` | false | false |
| `Max <a@b.de>\r\nBcc: x@y.z` | false | false |
| `@h4ndrik`, `+49 176 1234`, `""` | false | false |

`isReplyAddress` ist **unverändert** — die strenge Prüfung bleibt die einzige
Wahrheit. Neu ist ein Vor-Schritt.

### 6.2 Fix: `extractReplyAddress` als Vor-Schritt

`server/inquiry.mjs` → `export function extractReplyAddress(value)`:

1. `typeof value !== 'string'` oder **Steuerzeichen `[\x00-\x1f\x7f]`** →
   `''`. Diese Prüfung steht **vor** jeder Klammerauswertung, Injection wird
   also nicht „durch Extraktion" entschärft.
2. Kein `<` und kein `>` → Wert wird 1:1 an `isReplyAddress` gegeben.
   Genau eines von beiden fehlt oder `>` steht vor `<` → `''`.
3. Genau ein Paar: ein zweites `<` hinter dem ersten oder ein zweites `>` hinter
   dem schließenden, oder Resttext nach `>` → `''`.
4. Inhalt der Klammern wird getrimmt (Leerraum um die Adresse ist erlaubt),
   leer → `''`. Ein Anzeigename, der selbst ein `@` enthält, gilt als
   mehrdeutig → `''` (lieber kein Reply-To als das falsche).
5. Ergebnis muss `isReplyAddress` bestehen; dann wird genau dieser String
   verwendet. Kein zweiter Adress-Parser, keine zweite Regel.

Der Handler berechnet den Wert einmal (`const replyTo = extractReplyAddress(fields.email)`)
und setzt `...(replyTo ? { reply_to: replyTo } : {})`. `from`, `to`,
`subject`, Text, Anhänge, 502-Text und das PII-freie Verhalten sind unverändert;
ein fehlender Reply-To macht die Anfrage nie kaputt.

### 6.3 Verhalten nachher (gemockter Provider, kein echter Versand)

| Eingabe | Status | `reply_to` |
| --- | --- | --- |
| `Max Mustermann <max@example.com>` | 202 | `max@example.com` |
| `Max <max@example.com>` | 202 | `max@example.com` |
| `  Max  <  max@example.com  >  ` | 202 | `max@example.com` |
| `<max@example.com>` | 202 | `max@example.com` |
| `max@example.com` | 202 | `max@example.com` (unverändert) |
| `Max <max@example.com` | 202 | **fehlt** |
| `Max <a@b.de> <c@d.de>` | 202 | **fehlt** |
| `Max <@h4ndrik>` | 202 | **fehlt** |
| `max@example.com <other@example.com>` | 202 | **fehlt** (mehrdeutig) |
| `Max <a@b.de>\r\nBcc: x@y.z` | **400** | — (vor dem Provider-Aufruf) |
| `@h4ndrik`, `+49 176 1234`, `""` | 202 | **fehlt** (unverändert) |

### 6.4 Tests

`tests/inquiry-reply-to.test.js`: 4 weitere Blöcke (Extraktion, unvollständige/
doppelte/mehrdeutige Formen, Injection, Freitext) — 9 Tests, alle grün.
`tests/inquiry-http.mjs`: Autofill-Form → 202 mit `reply_to` exakt
`max@example.com`, `to`/`from` unverändert; Report-Feld
`replyToDisplayNameForm`. `tests/inquiry.test.js`: der alte Fall
`name <visitor@example.com>` (bisher „kein Reply-To") ist der neue Vertrag und
liegt jetzt in einem eigenen Test mit positiver Assertion.

`npm test`: **414 Tests / 413 pass / 1 skipped / 0 fail**
`node tests/inquiry-http.mjs`: grün, `replyToExact: true`,
`replyToDisplayNameForm: "max@example.com"`, `replyToInjection` weiterhin
„rejected with 400 before the provider call".

## 7. Merge-Gate-Battery (mail-02-go)

Vollständige serielle Battery vor dem Merge auf `main`:

```bash
npx vite --host 127.0.0.1 --port 5183 --strictPort
npm run build && node scripts/serve-preview.mjs --host 127.0.0.1 --port 55242
H4_GATE_DEV=http://127.0.0.1:5183 H4_GATE_PREVIEW=http://127.0.0.1:55242 \
  node scripts/gate-battery.mjs mail-02-go
```

Ergebnis: **35 von 38 Suiten PASS, 1 MISSING (pensioniert), 2 FAIL** —
`docs/validation/V3.2-FINAL-GATE/battery-mail-02-go.json`.

| Suite | Status | Einordnung |
| --- | --- | --- |
| `artwork-transitions-browser` | MISSING | erwartet: B-F27 pensioniert (`tests/legacy/`), vom Battery-Runner als „not present" geführt |
| `standalone-browser` | FAIL | **umgebungsbedingt, nicht durch MAIL-02** — siehe 7.1 |
| `standalone-native-browser` | FAIL im Battery-Lauf | Ursache war das fehlende Artefakt `artifacts/h4ngelic-preview.html` (gitignored); nach `npm run preview:export` grün, Exit 0 |

Die Vertrags-Suiten `tokens-audit`, `typography-contract`,
`link-glyph-contract`, `row-geometry-contract` und `footer-zone-contract` liefen
in derselben Battery und sind PASS.

### 7.1 `standalone-browser` — NICHT PRÜFBAR in dieser Umgebung

Befund: `tests/standalone-browser.mjs:305` erwartet nach dem Mute-Klick
`aria-pressed="true"`, gemessen wird `"false"`. Zwei unabhängige Belege, dass das
nicht aus MAIL-02 stammt:

1. **Reproduktion auf `origin/main` (`d550824`)** in einem separaten, unberührten
   Worktree: nach `npm run preview:export` scheitert dieselbe Zeile mit demselben
   Wert. Der Branch `mail-02-reply-to` ändert ausschließlich `server/inquiry.mjs`,
   Tests und Dokumentation — keinen Client-Code.
2. **Ursache in der Umgebung:** `system_profiler SPAudioDataType` listet **kein
   Audio-Ausgabegerät**. `src/sound-controls.js` schreibt `aria-pressed` nur in
   `refresh()`; nach dem Klick läuft `refresh` ausschließlich über
   `audio.prime(event).then(refresh)`. Ohne Ausgabegerät löst dieses Promise nie
   auf, `aria-pressed` bleibt auf dem alten Wert.

Folge: Diese eine Assertion ist auf diesem Rechner **NICHT PRÜFBAR** und weder
Beleg für noch gegen MAIL-02. Offen für einen späteren Lauf (hier bewusst nicht
behoben, weil außerhalb des MAIL-02-Scopes): der Mute-Zustand sollte auch dann
aktualisiert werden, wenn Audio nicht startet — dann wäre die Suite
umgebungsunabhängig.

### 7.2 Merge

Merge-Commit auf `main`: `7f733f0` (Eltern: `494ee49` = bisheriges `main` mit dem
Mannequin-Merge, `6905b79` = `mail-02-reply-to`). Kein Squash, kein Rebase, kein
Force-Push. Baum des Merge-Commits enthält den kompletten Branch-Stand; der
Server-Code ist unverändert gegenüber der getesteten Fassung.

Nach dem Merge auf dem kombinierten Baum geprüft:

- `npm test`: **441 Tests / 440 pass / 1 skipped / 0 fail** (die zusätzlichen 27
  Fälle kommen aus dem Mannequin-Merge, der vorher auf `main` lag).
- `node tests/inquiry-http.mjs`: grün, `replyToExact: true`,
  `replyToDisplayNameForm: "max@example.com"`.
- `npm run build`: 23 Routen + 404, keine Fehler.

Die Browser-Battery (Abschnitt 7) lief auf dem Branch-Baum vor dem Merge. Der
Mannequin-Zweig hatte seine eigene Gate-Dokumentation (`b9ab902`); die
Dateimengen überschneiden sich nicht (Mail-Pfad: `server/inquiry.mjs`).

Rollback: `git revert -m 1 7f733f0` auf `main`, dann das letzte READY-Deployment
in Vercel erneut promoten.
