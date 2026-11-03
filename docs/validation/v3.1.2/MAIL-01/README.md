# MAIL-01 — privacy-safe Resend diagnostics

Branch: `mail-01-diagnostics` (isolated from `origin/v3.1.1-fixes` at `6ae7468`).

The inquiry handler now writes one JSON line to stderr when Resend is unreachable
or rejects a request. The response remains the same generic HTTP 502 with the
same user-facing text. Authentication, retry, timeout and idempotency behavior
are unchanged.

## Expected log lines

| Cause | Log line |
| --- | --- |
| Resend 401 — API key missing, invalid or rotated | `{"event":"resend_rejected","requestId":"<uuid>","status":401,"error":"<resend error name>"}` |
| Resend 403 — sender domain unverified or sending tier restriction | `{"event":"resend_rejected","requestId":"<uuid>","status":403,"error":"<resend error name>"}` |
| Resend 422 — request/field validation rejected | `{"event":"resend_rejected","requestId":"<uuid>","status":422,"error":"<resend error name>"}` |
| Resend 429 — provider rate limit | `{"event":"resend_rejected","requestId":"<uuid>","status":429,"error":"<resend error name>"}` |
| Other non-2xx Resend response | `{"event":"resend_rejected","requestId":"<uuid>","status":<status>,"error":"<resend error name>"}` |
| Resend response body is not parseable JSON | `{"event":"resend_rejected","requestId":"<uuid>","status":<status>,"error":"unparseable"}` |
| Network failure, DNS/TLS failure, timeout or abort before a response | `{"event":"resend_unreachable","requestId":"<uuid>","error":"TimeoutError"}` (or the actual error name, falling back to `NetworkError`) |

The `error` value is Resend's `result.name` when it exists; the status is always
included for a rejected HTTP response. Representative names are
`invalid_api_key`, `domain_not_verified`, `validation_error`,
`rate_limit_exceeded`, `internal_server_error`, `TypeError`, `AbortError` and
`TimeoutError`. The provider response body is never logged.

Never logged: email address, name, message, filenames, attachment data, subject,
mail body, API key, Authorization header, idempotency key, or the provider
response body beyond `result.name`.

The `requestId` is the existing per-request UUID. A failed request does not
return it to the browser; it is diagnostic correlation data in the Vercel
function log.

## Verification

- Clean branch baseline at `6ae7468`: `npm test` 372/372 PASS
  (`baseline-npm-test.txt`).
- Final isolated commit in a clean worktree: `npm test` 372/372 PASS
  (`npm-test.txt`).
- `node tests/inquiry-http.mjs`: PASS. The suite covers accepted, 403, 415, 429,
  502 and 503 behavior plus mocked Resend 401/403/422/500, unparseable 422, and
  a network throw. Each failure remains HTTP 502 with the exact generic text.
  Captured stderr contains only the expected structured fields; the test email,
  message, filename, attachment marker, provider-body marker and network-error
  detail are absent (`inquiry-http.txt`, `http-results.json`).
- No screenshots apply: the assertion target is server stderr, captured above.
- No real Resend request or email delivery was performed.
See [E2E-SMOKE.md](E2E-SMOKE.md) for the repeatable preview smoke, failure mapping and the remaining manual Vercel-log step.
