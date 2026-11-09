# F27 — `tattoos` becomes `on skin` in the archive

The Tattoo work group now carries `archiveLabel: 'on skin'` in
`src/data/siteContent.js`. `renderWorkPage` uses `archiveLabel ?? label` for the
page title, the `/work` filter row and the V25 cross-link row. All URLs, IDs,
`data-work-group` values and the `/work/tattoos` route stay unchanged.

Homepage rubrics, NAAVI and INDEX still read `tattoos`; they consume `label`, not
`archiveLabel`.

## Assertions changed

- `tests/content.test.js`
  - `/work/tattoos` h1 is `on skin`.
  - New test asserts `label: 'tattoos'`, `archiveLabel: 'on skin'`, the active
    `on skin` filter with `/work/tattoos`, the cross-link labels, the unchanged
    `tattoos` group heading on the full archive and the unchanged Home label.
- `tests/portfolio-browser.mjs`
  - Rubric headings map Tattoos to `on skin`; filter labels are
    `on skin / jewellery / more`.
- `tests/v25-cross-links-browser.mjs`
  - Cross-link text uses `on skin` while the href remains `/work/tattoos`;
    column/order assertions are unchanged.
- `tests/v31-navigation-browser.mjs`
  - Filter text is `on skin / jewellery / more`.
- `tests/v15-mobile-browser.mjs`
  - Tattoo page heading is `on skin`.
- `tests/seo-browser.mjs`
  - The direct `/work/tattoos` heading expectation is `on skin`.
- `tests/standalone-browser.mjs`
  - Active filter text is `on skin`; hash paths remain unchanged.

`tests/global-navigation.test.js` and the Homepage tests were inventoried and kept
`tattoos`; they cover NAAVI/Home rather than the archive label.

## Results

- `npm test`: **373/373 PASS** (one new content test).
- `portfolio-browser.mjs`: **6/6 PASS**.
- `v25-cross-links-browser.mjs`: **6/6 PASS**.
- `v31-navigation-browser.mjs`: **6/6 PASS**.
- `v15-mobile-browser.mjs`: **4/4 PASS**.
- Production SEO/standalone checks are rerun after the final build.

## Evidence

- `before-tattoos-1440.png`
- `after-tattoos-1440.png`
- `after-work-filters-1440.png`
- `results.json`, `node.txt`, `browser.txt`

No temporary `tmp-*` script was committed. No merge, deployment, H4 MOSH LAB
change or force push was performed.
