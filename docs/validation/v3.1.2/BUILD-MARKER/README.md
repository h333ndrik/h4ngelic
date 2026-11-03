# Build marker

## Reproduction

The deployed Vercel preview is SSO-blocked, so the loaded build could not be
identified from outside. The source also had no build SHA in the document or
console.

## Fix

`scripts/build-marker.mjs` reads `git rev-parse --short=12 HEAD`; the Vite plugin
writes `data-build` on `<html>` and `<meta name="h4-build">` in head. The app
logs `[h4ngelic] build <sha>` in development and preview builds, and omits the
log when `VERCEL_ENV=production`. A Node guard covers the pure transformation and
log policy.

## Proof

The verification production build reports `data-build="cf7141342e18"` and the same
`h4-build` meta value on every tested route. The console message was observed in
the preview suite, and the no-JS production page still exposed the marker.
`results.json`, `dist-head.txt` and `css-tail.txt` contain the raw evidence.
