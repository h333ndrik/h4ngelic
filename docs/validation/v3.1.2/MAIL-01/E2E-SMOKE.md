# MAIL-01 — Inquiry E2E smoke

Base branch: `mail-01-diagnostics`, based on `origin/v3.1.1-fixes`
(`6ae7468`). Work was performed in an isolated worktree; the F18–F27 working
copy in the primary checkout was not modified or staged.

## Status

| Check | Result |
| --- | --- |
| Baseline `npm test` | **372/372 PASS** |
| Final `npm test` | **376/376 PASS** |
| `npm run test:inquiry-http` | **PASS** (accepted/403/415/429/502/503 and mocked Resend failures) |
| Smoke contract tests | **3/3 PASS** (skip, exact 502 body, 201 success) |
| Live preview request | **MANUAL / NOT RUN** — no `SMOKE_URL` was supplied |
| Vercel function log capture | **MANUAL** — Vercel CLI is not installed and no deployment URL is available |
| Real sends | **0 of maximum 2** |

No preview URL was present in the environment or repository. GitHub exposes a
Vercel deployment ID, but its dashboard and function logs require the user's
Vercel login; no preview hostname or auth token is available locally. No URL
was guessed and no request was sent to production.

## Running the live smoke

```sh
SMOKE_URL='<PREVIEW_URL>' \
SMOKE_NAME='<SMOKE_NAME>' \
SMOKE_MAIL='<SMOKE_MAIL>' \
SMOKE_TEXT='<SMOKE_TEXT>' \
npm run smoke:inquiry
```

The same values can be supplied as `--url`, `--name`, `--mail` and `--text`.
Without `SMOKE_URL`, the command exits successfully with `outcome: "skipped"`.
It makes exactly one POST to `/api/inquiry`, adds no attachments, uses the
frontend field names `artwork`, `started`, `name`, `email`, `message` and
`website`, and performs no retry.

The script prints one JSON line on stdout and a short human summary on stderr.
The name, contact and message are never printed. A current failure is recognized
as HTTP 502 with a byte-identical `{"error":"<generic message>"}` response.
A 200/201 response is reported as `mail_ok` with conclusion
`Mail-Flows o.k.; the earlier 502 was elsewhere or transient.`

## Observation and conclusion mapping

| Scenario | Expected observation | Conclusion / action |
| --- | --- | --- |
| Resend 401 | `resend_rejected`, `status: 401`, Resend error name | API key missing, invalid or rotated: rotate `RESEND_API_KEY` in Vercel |
| Resend 403 | `resend_rejected`, `status: 403`, usually `domain_not_verified` | Check `INQUIRY_FROM` and Resend sender-domain verification / sending tier |
| Resend 422 | `resend_rejected`, `status: 422`, usually `validation_error` | Check field format, sender and Resend payload validation |
| Resend 429 | `resend_rejected`, `status: 429`, usually `rate_limit_exceeded` | Wait for the provider limit window; contact support if persistent |
| Resend 500 | `resend_rejected`, `status: 500`, e.g. `internal_server_error` | Wait and retry later; contact Resend support if persistent |
| Network/Timeout | `resend_unreachable`, no status, `TimeoutError`/`TypeError`/`AbortError` | Investigate Vercel outbound network, DNS/TLS and timeout |
| HTTP 200/201 at smoke endpoint | `mail_ok`, request ID if returned | Mail-Flows o.k.; the earlier 502 was elsewhere or transient |
| 502 with wrong body | `body_mismatch` | Do not infer a Resend cause until the deployed response contract is checked |
| HTTP 401/403 before mail handler | `unexpected_status`, no 502 body | Inspect Vercel edge/auth/origin configuration; these are not Resend log statuses |

## Local contract evidence

A local preview-style HTTP mock returned the exact current 502 body:

```json
{"event":"inquiry_smoke","status":502,"bodyEqual":true,"requestId":null,"outcome":"error_observed","conclusion":"Inquiry failure observed; read resend_rejected/resend_unreachable from Vercel function logs.","submittedFields":["artwork","started","name","email","message","website"],"attachments":0}
```

The request count was 1. A second local mock returned HTTP 201 with a request
ID and the script reported `mail_ok`. These are transport/contract tests, not
proof of live Resend delivery and not a substitute for the preview run.

## Manual Vercel log step

1. Open the Vercel Dashboard for `h4ngelic`.
2. Open **Deployments**, then select the preview deployment under test.
3. Open **Functions**, select `/api/inquiry`, and open **Logs**.
4. Run the smoke command above once.
5. Filter for `resend_rejected` or `resend_unreachable`.
6. Record only `timestamp`, `status`, `error` and `requestId`.
7. Report the line here. A 401/403/422/429/500 maps to the provider causes in
   the table above; an unreachable event maps to Vercel networking/timeout.

If the smoke returns 200/201, there will be no Resend failure line; report
“Mail-Flows o.k.” instead.

## Evidence files

- `e2e-baseline-npm-test.txt` — clean baseline, 372/372.
- `e2e-npm-test.txt` — final suite, 376/376.
- `e2e-inquiry-http.txt` — loopback inquiry integration.
- `e2e-smoke-unit.txt` — three smoke contract tests.
- `e2e-local-mock-output.txt` — actual JSON/human output for an exact mock 502.
- `e2e-skip-output.txt` — CI-safe skip without `SMOKE_URL`.
- `e2e-tooling.txt` — local preview/log tooling availability.

## Scope note

The only inquiry-handler edit is extracting the already used generic 502 text
into the exported `GENERIC_INQUIRY_FAILURE` constant so the script can import
the exact value. Status codes, response text, retries, timeout, idempotency and
logging behavior are unchanged. No F18–F27 file was touched.
