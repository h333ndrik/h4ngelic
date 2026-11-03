# F25 — `3d model` category typography

`3d model` now uses the same plain heading treatment as the other child
categories: `archive-category-heading rubric-category-heading` with no link and
no arrow. It keeps `id="archive-model-title"`, `data-motion-static`, the
`model-3d` section anchor, `data-deferred-model` and all surrounding spacing.

The markup lives in one `modelSection` value inside `renderWorkPage` and is
inserted from both the rubric and non-rubric branches, removing the duplicated
literal section.

## Assertion changed

- `tests/content.test.js`: the subordinate-heading scan accepts
  `archive-category-heading` with the optional `rubric-category-heading` class,
  so the now-correctly-classed `3d model` is still included in the expected
  heading order.

## Results

- `npm test`: **372/372 PASS**.
- `portfolio-browser.mjs`: **6/6 PASS** at 1440/390/320 × full/reduced.
- `/work/tattoos` computed typography matches `flashes` exactly at 1440px;
  zero links, zero arrows, one `#model-3d` node.

## Evidence

- `before-3d-model-1440.png`
- `after-3d-model-1440.png`
- `results.json`, `node.txt`, `browser.txt`

No merge, deployment, H4 MOSH LAB change or force push was performed.
