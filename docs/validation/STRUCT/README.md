# STRUCT Contract Evidence

Verified baseline: `945b551`, production build `945b5515b0a0`, 23 routes plus 404.

## Runs

```sh
export H4_BASE_URL=http://127.0.0.1:55200
node tests/typography-contract.mjs
node tests/link-glyph-contract.mjs
node tests/tokens-audit.mjs
```

- Typography: PASS at 1440/390/320 and emitted-bundle grep; about 12 seconds.
- Links: PASS on five representative routes, 71 visible-link hover checks; about 15 seconds.
- Tokens: completed and wrote `contracts/tokens.json`; exits non-zero with three
  documented hardcodes in `src/easter-eggs.css` (listed in `../BEFUNDE.md`).

## So prüfst du es

1. Open `/` and confirm the three section labels and NAAVI use `NN/ label` and
   `NN/ NN`; the rubric row is `tattoos · jewellery · tools · more`.
2. Open `/creative`, hover any visible text link and confirm the h4 logo pointer
   is visible and remains attached to the pointer.
3. Run `node tests/tokens-audit.mjs`; the three reported ghost-token duplicates
   must remain listed until a separate, behavior-preserving cleanup lands.
