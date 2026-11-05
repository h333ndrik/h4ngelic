# F26 — More heading, fallbacks and child headings

## Changes

- `/work/more` keeps `<h1 class="page-heading sr-only" id="work-page-title">more</h1>`.
  It remains the accessible and indexed page title but no longer paints a visible
  `more` heading above the categories. Metadata and document title are unchanged.
- `renderProject` no longer emits the `view work` text link for untitled projects.
  The image link and the digital inline expansion remain intact.
- All child category headings on rubric pages are plain text: `flashes`,
  `digital artworks` and `analog photography` have no `<a>` and no arrow.
  Their heading IDs, `data-motion-static`, section anchors and typography stay.
  The three cross-links remain the navigation between rubric pages.

## Search inventory and affected assertions

The requested searches were rerun over `tests/` and `scripts/`:

```sh
rg -n "archive-category-heading|work-group-heading|workGroups" tests/ scripts/
rg -n "view work|3d model|'tattoos'|\"tattoos\"" tests/ scripts/
```

The canonical heading class is `archive-category-heading`; in the current source
child headings also carry the second class `rubric-category-heading`. Searches now
key on the canonical class, and F25 keeps both classes so `3d model` and
`flashes` compute identically.

Assertions updated for F26:

- `tests/content.test.js`
  - `/work/more` h1 asserted as `page-heading sr-only`.
  - Rubric child headings asserted as plain text with zero links/arrows, while
    two cross-links per page remain.
- `tests/portfolio-browser.mjs`
  - Child headings inspected directly instead of via `.rubric-category-heading a`;
    each must have an ID/text and zero links/arrows.
- `tests/v31-navigation-browser.mjs`
  - The first child heading now expects zero arrows, not one.
- `tests/standalone-browser.mjs`
  - After `/work/more`, route back to `/work` (where leaf headings are still real
    links) before opening `/work/digital-artworks`. Rubric pages no longer expose
    that heading link by design.

`v23-static-titles-browser.mjs` was inventoried and needs no change: it exercises
only Home's static section titles. `v25-cross-links-browser.mjs` also needs no F26
change because cross-links remain unchanged; both are rerun for the final report.

## Results

- `npm test`: **372/372 PASS**.
- `portfolio-browser.mjs`: **6/6 PASS**.
- `v31-navigation-browser.mjs`: **6/6 PASS**.
- `v31-motion-browser.mjs`: **6/6 PASS**.
- Offline standalone routing is rechecked after the final production export.

## Evidence

- `before-more-1440.png`
- `after-more-1440.png`
- `after-more-headings-1440.png`
- `after-tattoos-headings-1440.png`
- `results.json`, `node.txt`, `browser.txt`

No temporary `tmp-*` script was committed. No merge, deployment, H4 MOSH LAB
change or force push was performed.
