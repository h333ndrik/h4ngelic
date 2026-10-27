> Current master-foundation update: the contact field is **HOW TO REACH YOU**,
> required free text with placeholder `email, instagram, phone number...`.
> Email addresses, Instagram handles and telephone numbers are accepted. The
> legacy multipart key `email` remains compatible; the mail adapter includes
> `reply_to` only when that value is a valid email address. All contact text
> appears in the message body. The 700ms IntersectionObserver entrance runs
> once, bypassed for reduced motion and keyboard focus.
>
> Delivery is blocked until `RESEND_API_KEY`, a verified `INQUIRY_FROM` sender
> and a same-origin deployed `/api/inquiry` backend exist. HTTP/provider-mock
> tests verify handling, **not delivery of real mail**. A downloaded HTML cannot
> submit mail. Errors preserve entered text and attachments.

# Inquiry form and delivery

The homepage Contact section and `/contact` share the same native form and
progressive enhancement. Name and a free-text contact channel are required; the
message is optional. An inquiry opened from a real artwork can carry its
published ID. No invented portfolio entries are accepted as context.

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
processing terms before enabling public submissions. The frontend includes a
short purpose statement; it does not invent a jurisdiction-specific legal
policy.

No email delivery or new public deployment is enabled by this change.

## Reproduction

```sh
node --test tests/inquiry.test.js
node tests/inquiry-http.mjs
```

The 17 Node cases test binary integrity, false boundary prefixes, malformed
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

Browser validation should additionally check 320px/390px and desktop layouts,
keyboard/file removal, success/error/unavailable states, route cleanup and
artwork context. Those runs are separate from actual live email delivery.
