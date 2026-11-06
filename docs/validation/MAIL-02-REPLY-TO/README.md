# MAIL-02 — Reply-To nur für eine echte Adresse

Branch `mail-02-reply-to`, Basis `d550824` (= `origin/main` nach dem
V3.2-/V3.1.2-Merge). Kein Merge, kein Deploy in diesem Lauf.

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
Genau diese Fälle bleiben bewusst ohne Reply-To.

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

Zweite, kleinere Beobachtung für einen späteren Lauf: die Anzeigenamen-Form
`Max <max@example.com>` bleibt ohne Reply-To (Spec: keine Leerzeichen). Wenn das
in echten Anfragen häufig vorkommt, wäre ein gezieltes Auslesen der
`<…>`-Form der nächste Schritt — dann aber mit eigener Prüfung und eigenem Test.
