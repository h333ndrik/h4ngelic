# V3.1.2-r2 prevention suite

`tests/hero-boot-browser.mjs` runs serially at 1440/390/320 against either the
dev server or production preview. It covers booting/ready/slow/failed hero
states, exact cursor enumeration including footer hover/active states, the
hover/focus/touch greeting contract, slash alignment and overflow, and the
two-sided wheel contract.

The earlier top-level `results.json` and screenshots are from the first dev run.
`dev-final/` contains the final source run; `production/` is the first production
build and `production-final/` is the last build, including the failed-hero
navigation case. `r3-dev/` and `r3-production/` contain the r3 build-marker,
entrance-timeline, expanded cursor-state and reduced-motion checks. All three
profiles passed in every run.
