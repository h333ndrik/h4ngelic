> Current V3 state: there is exactly one form, in Home `03 / CONTACT`.
> Every Contact/inquire destination leads to `/#contact`; legacy `/contact`
> redirects there. Required **HOW TO REACH YOU** accepts email, Instagram or
> phone with placeholder `email, instagram, phone number...`. The message
> uses the approved two-line placeholder and the action is **SEND MESSAGE**.
> The legacy multipart key `email` remains compatible; `reply_to` is included
> only for a valid email address. The 700ms entrance runs once and bypasses
> motion for reduced-motion preferences or keyboard focus.
>
> Actual delivery is blocked until a Resend key, verified sender and hosted
> same-origin backend are configured. Mock-provider tests prove handling,
> not real email delivery. Offline HTML cannot submit mail. Errors preserve
> entered text and attachments. No production deployment is authorized.

# Inquiry form and delivery

The only native form is in the homepage Contact section. Works and More About
contain no separate form. Use the shared `contactURL()` helper from
`src/routes.js` for links; `contactURL(project.id)` carries a published artwork
ID as `/?artwork=…#contact`. Legacy `/contact?artwork=…` redirects to that Home
section. The router scrolls to Contact and updates NAAVI; changing context
within Home refreshes only its hidden artwork field and label, retaining the
same form node, entered text and attachments.

Name and a free-text contact channel are required; the message is optional.
No invented portfolio entries are accepted as context. The message placeholder
is exactly:

```text
could be an inquiry, a question or just a thought.
feel free to write anything.
```

## What is implemented

- Multiple references, individual removal, image previews and accessible
  validation/status messages. Limits: five files, 5 MiB per file, 12 MiB total.
  JPEG, PNG, WebP, AVIF, GIF and PDF are supported; SVG and executables are not.
- The browser checks names, types and sizes for convenience. The server
  independently inspects magic bytes, extension/type agreement, number of
  files, cumulative size, required fields and the actual artwork ID.
- `server/inquiry.mjs` is a standalone native Node HTTP handler. It accepts
  multipart POST requests at `/api/inquiry`, sends via Resend's fixed HTTPS
  endpoint, and fixes the destination to **h4ngelic@gmail.com**. The sender's
  contact channel becomes `reply_to` only when it is a valid email address; social handles and phone numbers remain in the message body.
- Success is shown only after the provider returns an accepted message ID.
  This proves provider acceptance, not inbox delivery. Missing configuration
  returns 503, provider failures return 502, and the form preserves the inquiry
  so the visitor can retry or use the real email fallback.
- The downloadable HTML explicitly says that sending is unavailable and
  offers the same email fallback. It does not simulate delivery.
- No attachments or messages are written to disk or application logs. Image
  preview object URLs are revoked on removal, submission and route cleanup.

The endpoint is prepared but **live delivery has not been configured or
verified**. The repository has no production mail credentials or deployed
inquiry service. Tests use an injected local provider mock; no real message
has been sent by those tests.

## Configure delivery

1. Create or use a Resend account, verify a sender domain you control and
   obtain an API key with email-sending permission. A Gmail inbox alone does
   not provide a verified Resend sender domain.
2. Set these values in the **server's environment**, never in Vite's public
   variables, committed `.env` files, browser JavaScript or the HTML export:

   ```text
   RESEND_API_KEY=<your private sending key>
   INQUIRY_FROM=inquiries@your-verified-domain.example
   INQUIRY_ALLOWED_ORIGINS=https://h4ngelic.com
   INQUIRY_PORT=8787
   ```

   `INQUIRY_FROM` must be a bare email address, not a display-name expression.
   The server fixes the recipient independently of these values. The provider
   origin cannot be overridden through a form field or environment variable.

3. Run `node server/inquiry.mjs` with the supported Node version. It binds
   only to `127.0.0.1`; terminate HTTPS at your existing hosting proxy and
   forward the same-origin `/api/inquiry` route to this service. Static-only
   hosting cannot run the Node process without an additional backend.
4. For local development, explicitly include the exact browser origin, such
   as `http://localhost:5173`, in `INQUIRY_ALLOWED_ORIGINS`. Vite mounts the
   same handler directly at `/api/inquiry`; no separate process or proxy is
   needed for that development path. The origin list is
   comma-separated and contains exact origins without trailing slashes or
   URL paths. Do not enable arbitrary origins.
5. Configure the reverse proxy with a request limit of at most 13 MiB, upload
   and response timeouts, HTTPS and a per-visitor edge rate limit. The service
   also caps raw multipart input, concurrency, header size and upload time.
6. Submit a real inquiry with and without attachments using authorized test
   details. Confirm provider acceptance, actual inbox delivery, the correct
   recipient, usable attachments and Reply-To. Exercise errors and retries.
   Record the result without publishing personal information or credentials.

The in-process limiter allows three attempts per direct socket address per
ten minutes, stores at most 2,000 addresses, and accepts at most four in-flight
requests. It deliberately does not trust `X-Forwarded-For` or other arbitrary
proxy headers. Behind a proxy this can become a shared server-address limit;
use a properly configured edge limiter for per-visitor limits and adapt the
trusted-proxy architecture explicitly if required. The map resets on process
restart. This is not a distributed anti-abuse service.

The hidden website field and short minimum fill time provide low-cost spam
checks, not a proof of humanity. Native no-JavaScript submissions can omit
the client start time. Stronger anti-abuse controls can be added at the edge
without making public browsing dependent on an authentication system.

## Privacy and attachments

References are forwarded as email attachments, not served as executable
public files. MIME checks establish basic file-type consistency; they are not
an antivirus scan or a guarantee that a document is safe to open. Configure
provider/inbox attachment protection and the artist's retention policy.
Confirm the site's legally appropriate privacy notice and the mail provider's
processing terms before any separately authorized public submissions. The V3
frontend removes the former short purpose sentence without replacing it with
unapproved copy; it does not invent a jurisdiction-specific legal policy.

No email delivery or new public deployment is enabled by this change.

## Reproduction

```sh
node --test tests/inquiry.test.js
node tests/inquiry-http.mjs
```

The focused Node cases test binary integrity, false boundary prefixes, malformed
multipart data, spoofed MIME types, actual streamed and per-file/total-byte
limits, Unicode filenames, required inputs, origin/rate/concurrency protections,
bounded rate storage, fixed recipient and Reply-To, unconfigured delivery,
successful mocked acceptance and provider failures.

The separate HTTP check opens two loopback servers: the actual inquiry handler
and a local email-provider mock. Native `FormData` passes through the full HTTP
path. The completed run returned 202 for mock acceptance, 403 for a foreign
origin, 502 for provider failure, 415 for a disguised attachment, 429 at the
attempt limit and 503 when unconfigured. The Unicode attachment name and exact
attachment bytes survived. The report is written to
`artifacts/inquiry/http-results.json`; it explicitly records
`liveDeliveryVerified: false`.

The current V3 form browser suite passed at 1440px, 390px and 320px, each with
normal and reduced motion. It checks the single field surfaces, grid alignment,
labels, stable focus, entrance, context changes, retained draft and uploads.
Evidence is `artifacts/smart-continuation-v3/inquiry.json`. Cross-route
Contact/history verification belongs to the main navigation integration suite.
All browser and mock-provider checks remain separate from actual live email
delivery.


## Existing serverless adapter

Main added `api/inquiry.js` in commit `5c46828` during V3 review preparation. The feature branch preserves this thin Vercel Node adapter unchanged; it delegates to `server/inquiry.mjs`. Syntax/module import and an actual local HTTP 405 method-rejection probe pass. This does not establish a configured Vercel deployment, provider credentials, verified sender or real message delivery; none was performed by this task.
